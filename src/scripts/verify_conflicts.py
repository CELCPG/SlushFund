#!/usr/bin/env python3
"""
R6c: re-derive random conflict rows from their sources, with logic separate from compute_conflicts.py.

For each sampled congress_trades row it rebuilds, from the stored trade row and the public sources:

  committee   the raw committee-membership-current.yaml / committees-current.yaml of the snapshot named in
              committee_basis (fetched from raw.githubusercontent.com, the URL a reader would open): is the
              member's bioguide id listed under a top-level committee whose name matches the sector's
              jurisdiction keywords? The latest snapshot on or before the trade date is also re-found with git
              (--repo) and must be the one the row names.
  contractor  company_tickers links read directly (status, class, window rules re-applied) and the awards
              joined from the awards table itself, not through the award_tickers view, KEEPING ONLY awards signed
              on or before the trade date (R6d): count, total, first / last date and the top award must equal
              related_contracts, and the top award's signing date must not be after the trade. A trade dated before
              AWARDS_COVERAGE_START must have has_federal_contract NULL and contract_basis not_computed_trade_before_*.
              The top award is fetched from api.usaspending.gov (recipient, signed date).
  late        days_to_file / stock_act_late from original_filed_date - transaction_date (the filing dates in the row).
  large       amount_max >= 250,000.
  score       0-100 sum of the four weights, tier thresholds, and the number of reasons.

Every row lists its three URLs: the trade filing (disclosure_url), the ticker link (evidence_url) and the award
(usaspending_url), plus the committee snapshot files.

Usage:
  python3 src/scripts/verify_conflicts.py --n 20 --seed 1 [--committee 10] [--options 5] [--contractor 20] [--precoverage 5] [--later 5]
         --repo <congress-legislators clone> --out f.json     (--out also writes f-urls.csv for the contractor samples)
"""
import argparse
import csv
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import date

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client
from compute_conflicts import (AWARDS_COVERAGE_START, CONTRACT_BASIS, CONTRACT_BASIS_PRE, JURISDICTION, SECTOR_MAP,
                               UNRELIABLE_DATE_FLAGS)

UA = "slushfund-verify/1.0"
RAW = "https://raw.githubusercontent.com/unitedstates/congress-legislators/{sha}/{path}"
CACHE = os.path.join(tempfile.gettempdir(), "slushfund-verify-pdfs", "r6c-raw")
_last = [0.0]
FIELDS = ("id,member_name,member_chamber,bio_guide_id,ticker,transaction_type,transaction_date,owner,asset_type,option_type,strike,expiry,"
          "filed_date,original_filed_date,days_to_file,stock_act_late,date_flag,amount_max,lot_count,disclosure_url,"
          "conflict_score,conflict_tier,conflict_reasons,committee_conflict,committee_conflict_detail,committee_basis,"
          "has_federal_contract,related_contracts,contract_basis,instrument")


def get(url, name=None, as_json=False):
    path = os.path.join(CACHE, name) if name else None
    if path and os.path.isfile(path):
        data = open(path, "rb").read()
    else:
        wait = 1.1 - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if path:
            os.makedirs(CACHE, exist_ok=True)
            open(path, "wb").write(data)
    return json.loads(data) if as_json else data.decode("utf-8")


def iso(s):
    return date.fromisoformat(s) if s else None


def top_level_committees(committees_text):
    """{thomas_id: (name, type)} of top-level committees (own parse: a '- type:' item and its 2-space name / thomas_id)."""
    out, name, tid, ctype = {}, None, None, None
    for ln in committees_text.splitlines():
        m = re.match(r"^- type:\s*(\S+)", ln)
        if m:
            name = tid = None
            ctype = m.group(1)
        m = re.match(r"^  name:\s*(.+?)\s*$", ln)
        if m and name is None:
            name = m.group(1).strip("'\"")
        m = re.match(r"^  thomas_id:\s*(\S+)\s*$", ln)
        if m and tid is None:
            tid = m.group(1).strip("'\"")
        if name and tid:
            out[tid] = (name, ctype)
            name = tid = None
    return out


def chamber_seats(membership_text, names, chamber):
    """seats listed under the top-level committees of one chamber (counting bioguide lines)."""
    inside, n = False, 0
    for ln in membership_text.splitlines():
        if re.match(r"^\S.*:\s*$", ln):
            cid = ln.strip()[:-1]
            inside = cid in names and names[cid][1] == chamber
            continue
        if inside and re.match(r"^\s+bioguide:\s*\S+\s*$", ln):
            n += 1
    return n


def listed_under(membership_text, committee_id, bioguide):
    inside = False
    for ln in membership_text.splitlines():
        if re.match(r"^\S.*:\s*$", ln):
            inside = ln.strip() == f"{committee_id}:"
            continue
        if inside and re.match(rf"^\s+bioguide:\s*{re.escape(bioguide)}\s*$", ln):
            return True
    return False


def congress_start(d):
    y = d.year if d.year % 2 else d.year - 1
    return date(y, 1, 3) if d >= date(y, 1, 3) else date(y - 2, 1, 3)


def check_committee(sb, t, repo):
    res = {"basis": t["committee_basis"]}
    d, sector = iso(t["transaction_date"]), SECTOR_MAP.get((t["ticker"] or "").upper())
    nd = re.match(r"no_committee_data_since_(\d{4}-\d{2}-\d{2})$", t["committee_basis"] or "")
    if nd and repo:
        # claim: since the new Congress began, no snapshot up to the trade date lists >= 80% of this chamber's seats.
        start, chamber = iso(nd.group(1)), (t["member_chamber"] or "").lower()
        col = "house_seats" if chamber == "house" else "senate_seats"
        ref = max(r[col] for r in sb.table("committee_snapshots").select(f"snapshot_date,{col}")
                  .gte("snapshot_date", start.isoformat()).lt("snapshot_date", date(start.year + 2, 1, 3).isoformat()).execute().data)
        log = subprocess.run(["git", "-C", repo, "log", "--format=%H %cI", "--", "committee-membership-current.yaml"],
                             capture_output=True, text=True).stdout.split("\n")
        seen, all_partial = [], True
        for ln in log:
            if ln.strip():
                sha, ts = ln.split()
                if start <= iso(ts[:10]) <= d:
                    m2 = get(RAW.format(sha=sha, path="committee-membership-current.yaml"), f"{sha}-membership.yaml")
                    c2 = get(RAW.format(sha=sha, path="committees-current.yaml"), f"{sha}-committees.yaml")
                    n2 = chamber_seats(m2, top_level_committees(c2), chamber)
                    seen.append({"date": ts[:10], "chamber_seats": n2})
                    all_partial = all_partial and n2 < 0.8 * ref
        res.update(ok=all_partial and t["committee_conflict"] is None, reference_seats=ref, snapshots_between=seen,
                   note=f"new Congress {start}: no snapshot up to the trade date is complete for the {chamber}")
        return res
    m = re.match(r"congress_legislators_snapshot_(\d{4}-\d{2}-\d{2})$", t["committee_basis"] or "")
    if not m:
        res.update(ok=(t["committee_conflict"] is None and not (t["committee_conflict_detail"])), note="no snapshot used; committee_conflict must be NULL")
        return res
    snap_date = m.group(1)
    snap = sb.table("committee_snapshots").select("commit_sha,source_url,committees_url").eq("snapshot_date", snap_date).execute().data[0]
    res.update(snapshot_url=snap["source_url"], committees_url=snap["committees_url"])
    mem = get(snap["source_url"], f"{snap['commit_sha']}-membership.yaml")
    com = get(snap["committees_url"], f"{snap['commit_sha']}-committees.yaml")
    names = top_level_committees(com)
    chamber = (t["member_chamber"] or "").lower()
    used = chamber_seats(mem, names, chamber)
    res["chamber_seats_in_snapshot"] = used
    later_ok = True
    if repo:
        # every other commit between that snapshot and the trade date must be partial for this chamber (< 80% of the
        # used snapshot's seats), otherwise the loader skipped a better snapshot
        log = subprocess.run(["git", "-C", repo, "log", "--format=%H %cI", "--", "committee-membership-current.yaml"],
                             capture_output=True, text=True).stdout.split("\n")
        later = []
        for ln in log:
            if ln.strip():
                sha, ts = ln.split()
                if iso(snap_date) < iso(ts[:10]) <= d:
                    later.append((ts[:10], sha))
        res["later_commits_checked"] = []
        for cd, sha in sorted(later):
            m2 = get(RAW.format(sha=sha, path="committee-membership-current.yaml"), f"{sha}-membership.yaml")
            c2 = get(RAW.format(sha=sha, path="committees-current.yaml"), f"{sha}-committees.yaml")
            n2 = chamber_seats(m2, top_level_committees(c2), chamber)
            res["later_commits_checked"].append({"date": cd, "chamber_seats": n2})
            if n2 >= 0.8 * used:
                later_ok = False
    held = [(cid, nm) for cid, (nm, _ty) in names.items() if listed_under(mem, cid, t["bio_guide_id"])]
    res["seats_listed"] = [nm for _cid, nm in held]
    expect, detail = False, None
    if sector:
        for kw in JURISDICTION[sector]:
            hit = next((nm for _cid, nm in held if kw in nm), None)
            if hit:
                expect, detail = True, f"{hit} ({sector})"
                break
    res["expected_committee_conflict"] = expect
    res["ok"] = (expect == bool(t["committee_conflict"])) and ((detail or None) == (t["committee_conflict_detail"] or None)) and later_ok
    if not later_ok:
        res["note"] = "a later snapshot, complete for this chamber, exists before the trade date: the loader skipped it"
    return res


def usable_links(sb, ticker, d):
    """company_tickers links of a ticker that the R6b join rule accepts on date d (re-implemented, read directly)."""
    out = []
    for L in sb.table("company_tickers").select("*").eq("ticker", ticker).execute().data:
        if (L["status"] in ("auto_confirmed", "manual_confirmed") and L["instrument_class"] in ("common", "adr", "preferred")
                and L["window_status"] in ("same_entity", "checked") and d >= date(2020, 10, 1)
                and (not L["valid_from"] or d >= iso(L["valid_from"])) and (not L["valid_to"] or d <= iso(L["valid_to"]))):
            out.append(L)
    return out


def link_awards(sb, L):
    """awards of one link, joined from the awards table itself (the award_tickers view's rule, re-implemented), any date."""
    q = sb.table("awards").select("id,recipient_uei,recipient_parent_uei,obligated_amount,date_signed,usaspending_url,recipient_name,fiscal_year")
    q = q.or_(f"recipient_parent_uei.eq.{L['recipient_parent_uei']},and(recipient_parent_uei.is.null,recipient_uei.eq.{L['recipient_parent_uei']})")
    rows, start = [], 0
    while True:
        chunk = q.range(start, start + 999).execute().data
        rows += chunk
        if len(chunk) < 1000:
            break
        start += 1000
    return [a for a in rows
            if (not L["recipient_uei"] or a["recipient_uei"] == L["recipient_uei"])
            and (not L["valid_from"] or iso(a["date_signed"]) >= iso(L["valid_from"]))
            and (not L["valid_to"] or iso(a["date_signed"]) <= iso(L["valid_to"]))]


def check_contractor(sb, t):
    d = iso(t["transaction_date"])
    res = {"contract_basis": t["contract_basis"]}
    reasons_have_contract = any("federal contract" in r for r in (t["conflict_reasons"] or []))
    if t["date_flag"] in UNRELIABLE_DATE_FLAGS:
        res.update(ok=(t["has_federal_contract"] is None and (t["contract_basis"] or "").startswith("not_computed_date_")
                       and t["related_contracts"] is None and not reasons_have_contract),
                   note="unreliable date: has_federal_contract must be NULL")
        return res
    good = usable_links(sb, t["ticker"], d)
    if d < AWARDS_COVERAGE_START:
        # the awards table starts 2023-10-01: it cannot say whether the company held an award before this trade
        anyaw = [(L, link_awards(sb, L)) for L in good]
        res.update(ok=(t["has_federal_contract"] is None and t["contract_basis"] == CONTRACT_BASIS_PRE
                       and t["related_contracts"] is None and not reasons_have_contract),
                   note=f"trade before {AWARDS_COVERAGE_START}: has_federal_contract must be NULL (not computed), never false",
                   linked_with_awards_under_r6c_rule=any(aw for _L, aw in anyaw))
        return res
    found = {}
    for L in good:
        aw = [a for a in link_awards(sb, L) if iso(a["date_signed"]) <= d]          # only awards signed on or before the trade
        if aw:
            found[L["id"]] = (L, aw)
    expect = bool(found)
    stored = t["related_contracts"] or {}
    stored_links = {li["company_ticker_id"]: li for li in stored.get("links", [])}
    ok = (expect == bool(t["has_federal_contract"])) and t["contract_basis"] == CONTRACT_BASIS and (t["has_federal_contract"] is not None)
    if expect:
        ok = ok and stored.get("links_matched") == len(found) and len(stored_links) == min(3, len(found)) and set(stored_links) <= set(found)
    res["expected_has_federal_contract"] = expect
    links_out = []
    for lid, (L, aw) in found.items():
        total = round(sum(round(float(a["obligated_amount"] or 0) * 100) for a in aw) / 100)   # whole cents, then dollars (as compute_conflicts)
        top = max(aw, key=lambda a: float(a["obligated_amount"] or 0))
        dates = sorted(a["date_signed"] for a in aw)
        s = stored_links.get(lid)
        stored_top = next((a for a in aw if s and a["id"] == s["top_award_id"]), None)
        match = bool(s) and (s["award_count"] == len(aw) and s["awards_signed_on_or_before_trade"] == len(aw) and s["obligated_to_date"] == total
                             and s["first_award_date"] == dates[0] and s["last_award_date"] == dates[-1]
                             and stored_top is not None and float(stored_top["obligated_amount"] or 0) == float(top["obligated_amount"] or 0))
        if s:                                                         # stored shows the top 3 links only
            ok = ok and match
        links_out.append({"company_ticker_id": lid, "ticker": L["ticker"], "class": L["instrument_class"], "window_status": L["window_status"],
                          "link_evidence_url": L["evidence_url"], "window_source": L["window_source"], "recipient": L["recipient_name"],
                          "award_count": len(aw), "obligated_to_date": total, "stored_match": match if s else "not in stored top 3",
                          "top_award_url": top["usaspending_url"], "top_award_id": top["id"], "top_award_signed": top["date_signed"],
                          "top_award_signed_on_or_before_trade": iso(top["date_signed"]) <= d,
                          "first_award_signed": dates[0], "last_award_signed": dates[-1]})
    res["links"] = links_out[:3]
    if links_out:
        top_link = max(links_out, key=lambda x: x["obligated_to_date"])
        try:                                                              # the award itself, from USAspending's own API
            api = get(f"https://api.usaspending.gov/api/v2/awards/{top_link['top_award_id']}/", as_json=True)
            rec = (api.get("recipient") or {})
            res["usaspending_api"] = {"recipient": rec.get("recipient_name"), "uei": rec.get("recipient_uei"),
                                      "date_signed": (api.get("period_of_performance") or {}).get("start_date"),
                                      "total_obligation": api.get("total_obligation")}
        except Exception as e:  # noqa: BLE001
            res["usaspending_api"] = {"error": str(e)[:100]}
    res["ok"] = ok
    return res


def check_scoring(t, committee_ok_value, contract_value):
    score = 0
    if t["committee_conflict"]:
        score += 45
    if t["has_federal_contract"]:
        score += 30
    late = None
    if t["original_filed_date"] and t["date_flag"] in (None, "stale_2y_corroborated"):
        days = (iso(t["original_filed_date"]) - iso(t["transaction_date"])).days
        late = days > 45
        late_ok = (days == t["days_to_file"]) and (late == t["stock_act_late"])
    else:
        late_ok = t["days_to_file"] is None and t["stock_act_late"] is None
    if late:
        score += 15
    if (t["amount_max"] or 0) >= 250_000:
        score += 10
    score = min(score, 100)
    tier = "score_70_plus" if score >= 70 else "score_45_69" if score >= 45 else "score_20_44" if score >= 20 else "score_under_20"
    n_reasons = int(bool(t["committee_conflict"])) + int(bool(t["has_federal_contract"])) + int(bool(late)) + int((t["amount_max"] or 0) >= 250_000)
    ok = (score == t["conflict_score"] and tier == t["conflict_tier"] and n_reasons == len(t["conflict_reasons"] or []) and late_ok)
    return {"expected_score": score, "expected_tier": tier, "stored_score": t["conflict_score"], "stored_tier": t["conflict_tier"],
            "late_days_recomputed": (iso(t["original_filed_date"]) - iso(t["transaction_date"])).days if t["original_filed_date"] else None,
            "reasons": len(t["conflict_reasons"] or []), "ok": ok}


def pick(sb, n, seed, where):
    ids, start = [], 0
    while True:
        q = sb.table("congress_trades").select("id")
        for col, op, val in where:
            q = getattr(q, op)(col, val)
        chunk = q.order("id").range(start, start + 999).execute().data
        ids += [r["id"] for r in chunk]
        if len(chunk) < 1000:
            break
        start += 1000
    random.Random(seed).shuffle(ids)
    return ids[:n], len(ids)


def linked_tickers(sb):
    """{ticker: [links]} of every link the join rule could accept (any date) that has at least one award, via award_tickers."""
    with_awards, start = set(), 0
    while True:
        chunk = sb.table("award_tickers").select("company_ticker_id").order("award_id").order("company_ticker_id").range(start, start + 999).execute().data
        with_awards |= {r["company_ticker_id"] for r in chunk}
        if len(chunk) < 1000:
            break
        start += 1000
    out, start = {}, 0
    while True:
        chunk = (sb.table("company_tickers").select("id,ticker,valid_from,valid_to").in_("status", ["auto_confirmed", "manual_confirmed"])
                 .in_("instrument_class", ["common", "adr", "preferred"]).in_("window_status", ["same_entity", "checked"])
                 .order("id").range(start, start + 999).execute().data)
        for L in chunk:
            if L["id"] in with_awards:
                out.setdefault(L["ticker"].upper(), []).append(L)
        if len(chunk) < 1000:
            break
        start += 1000
    return out


def pool_ids(sb, where, linked, lo=None, hi=None):
    """ids of trades matching `where` whose ticker has a join-rule link with awards valid on the trade date."""
    ids, start = [], 0
    while True:
        q = sb.table("congress_trades").select("id,ticker,transaction_date,date_flag")
        for col, op, val in where:
            q = getattr(q, op)(col, val)
        chunk = q.order("id").range(start, start + 999).execute().data
        for r in chunk:
            d = iso(r["transaction_date"])
            if r["date_flag"] in UNRELIABLE_DATE_FLAGS or d < date(2020, 10, 1):
                continue
            if any((not L["valid_from"] or d >= iso(L["valid_from"])) and (not L["valid_to"] or d <= iso(L["valid_to"]))
                   for L in linked.get((r["ticker"] or "").upper(), [])):
                ids.append(r["id"])
        if len(chunk) < 1000:
            break
        start += 1000
    return ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20, help="random rows with conflict_score > 0")
    ap.add_argument("--committee", type=int, default=0, help="extra random rows with committee_conflict = true")
    ap.add_argument("--options", type=int, default=0, help="extra random option rows with a signal")
    ap.add_argument("--contractor", type=int, default=0, help="extra random rows with has_federal_contract = true (trade + award + link URLs)")
    ap.add_argument("--nodata", type=int, default=0, help="extra random rows whose committee_basis is no_committee_data_since_*")
    ap.add_argument("--precoverage", type=int, default=0, help="extra random trades dated before the awards table starts that the R6c rule would have flagged (must be NULL)")
    ap.add_argument("--later", type=int, default=0, help="extra random trades on or after the awards start with a linked company whose awards were all signed AFTER the trade (must be false)")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--repo")
    ap.add_argument("--out")
    args = ap.parse_args()
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    plan = [("conflict_score>0", args.n, [("conflict_score", "gt", 0)]),
            ("committee_conflict", args.committee, [("committee_conflict", "eq", True)]),
            ("has_federal_contract", args.contractor, [("has_federal_contract", "eq", True)]),
            ("option row with a signal", args.options, []),
            ("no committee data (new Congress)", args.nodata, []),
            ("pre-coverage, linked (NULL)", args.precoverage, []),
            ("linked, awards all later (false)", args.later, [])]
    results, pools = [], {}
    for label, n, where in plan:
        if not n:
            continue
        where = [(c, op, v) for c, op, v in where]
        ids = None
        if label.startswith("no committee"):
            q = sb.table("congress_trades").select("id").like("committee_basis", "no_committee_data_since_%").order("id").execute().data
            ids, total = [r["id"] for r in q], len(q)
            random.Random(args.seed + 11).shuffle(ids)
            ids = ids[:n]
        elif label.startswith(("pre-coverage", "linked, awards")):
            linked = linked_tickers(sb)
            if label.startswith("pre-coverage"):
                ids = pool_ids(sb, [("transaction_date", "lt", AWARDS_COVERAGE_START.isoformat())], linked)
            else:
                ids = pool_ids(sb, [("transaction_date", "gte", AWARDS_COVERAGE_START.isoformat()), ("has_federal_contract", "eq", False)], linked)
            total = len(ids)
            random.Random(args.seed + 23).shuffle(ids)
            ids = ids[:n]
        elif label.startswith("option"):
            q = sb.table("congress_trades").select("id").not_.is_("option_type", "null").gt("conflict_score", 0).order("id").execute().data
            ids, total = [r["id"] for r in q], len(q)
            random.Random(args.seed + 7).shuffle(ids)
            ids = ids[:n]
        else:
            ids, total = pick(sb, n, args.seed, where)
        pools[label] = total
        for tid in ids:
            t = sb.table("congress_trades").select(FIELDS).eq("id", tid).execute().data[0]
            c, k = check_committee(sb, t, args.repo), check_contractor(sb, t)
            s = check_scoring(t, c, k)
            results.append({"sample": label, "id": tid, "member": t["member_name"], "ticker": t["ticker"], "date": t["transaction_date"],
                            "instrument": t["instrument"], "trade_url": t["disclosure_url"], "committee": c, "contractor": k, "scoring": s,
                            "ok": bool(c.get("ok") and k.get("ok") and s["ok"])})
    ok = sum(1 for r in results if r["ok"])
    print(f"verified {ok}/{len(results)} (pools {pools})")
    for r in results:
        flag = "OK " if r["ok"] else "MISS"
        print(f"  {flag} [{r['sample'][:9]}] {r['member']} {r['ticker']} {r['date']} "
              f"committee={r['committee'].get('ok')} contractor={r['contractor'].get('ok')} score={r['scoring']['ok']}")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        json.dump({"seed": args.seed, "pools": pools, "awards_coverage_start": AWARDS_COVERAGE_START.isoformat(),
                   "verified": ok, "n": len(results), "results": results}, open(args.out, "w", encoding="utf-8"), indent=1, default=str)
        urls_path = os.path.splitext(args.out)[0] + "-urls.csv"
        with open(urls_path, "w", encoding="utf-8", newline="") as fh:                  # the URLs a reader opens, one row per sampled trade
            w = csv.writer(fh)
            w.writerow(["sample", "id", "member", "ticker", "trade_date", "has_federal_contract", "contract_basis", "trade_filing_url",
                        "ticker_link_url", "award_url", "award_id", "award_signed", "award_on_or_before_trade", "ok"])
            for r in results:
                if r["sample"] in ("has_federal_contract", "pre-coverage, linked (NULL)", "linked, awards all later (false)"):
                    li = (r["contractor"].get("links") or [{}])[0]
                    w.writerow([r["sample"], r["id"], r["member"], r["ticker"], r["date"], r["contractor"].get("expected_has_federal_contract"),
                                r["contractor"].get("contract_basis"), r["trade_url"], li.get("link_evidence_url", ""), li.get("top_award_url", ""),
                                li.get("top_award_id", ""), li.get("top_award_signed", ""), li.get("top_award_signed_on_or_before_trade", ""), r["ok"]])
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
