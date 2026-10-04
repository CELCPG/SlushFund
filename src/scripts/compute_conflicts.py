#!/usr/bin/env python3
"""
SlushFund Conflict Engine — score every congressional trade on four documented signals.

For each trade (one row of congress_trades = one lossless key, see 20261006_r6a_trades_key.sql):

  1. Committee jurisdiction — the member held a seat on a committee that oversees the traded company's
     sector ON THE TRADE DATE: the seat is listed in the latest snapshot on or before that date of
     unitedstates/congress-legislators' committee-membership-current.yaml that is complete for the member's
     chamber (table committee_seats, loaded by load_committee_history.py; a new Congress's partial or empty
     snapshots are not data). congress_trades.committee_basis names the snapshot used. Fallback when the
     history table is empty (or --current-seats): the member's CURRENT seats, labelled current_as_of_<date>.
  2. Federal contractor — the traded ticker is linked to a federal contract recipient through the R6b join rule
     (r6b-tickers.md, "THE JOIN RULE"): company_tickers link confirmed; instrument class common / adr /
     preferred; window_status same_entity / checked (never `unchecked`); trade date >= 2020-10-01 and inside the
     link's [valid_from, valid_to]; and the award_tickers view holds at least one award for that link SIGNED ON OR
     BEFORE THE TRADE DATE (R6d: time-aligned). The awards table only holds awards signed from
     AWARDS_COVERAGE_START (2023-10-01), so a trade dated before that cannot be answered: has_federal_contract is
     NULL (not computed), never false, and congress_trades.contract_basis says why. Awards are read ONLY through
     the award_tickers view. needs_review links (Crane & Co. -> CR, the 10 subsidiaries not in a recent list) are
     never used.
  3. Late filing — the filing was made more than 45 days after the trade. Read from congress_trades
     (days_to_file / stock_act_late, computed by the loaders from the ORIGINAL filing date, R6a / R6c);
     this script never computes or writes them. NULL = not computed, scored as no signal.
  4. Large position — the disclosed range tops $250K (a row folds same-day lots: amount_max is their sum).

These combine into a 0-100 `conflict_score` and a tier. Every reason is a fact with a primary source, not a
legal conclusion. Rows whose transaction date is flagged as unreliable (after_filing, future, stale_2y) get no
date-dependent signal (committee, contractor): those columns stay NULL = not computed. Option rows are scored
like any other row and carry congress_trades.instrument = 'option' so pages can label or separate them.

Writes only: conflict_score, conflict_tier, conflict_reasons, committee_conflict, committee_conflict_detail,
has_federal_contract, related_contracts, committee_basis, contract_basis. Upserts on the lossless key, in batches.

Prereqs: load_committee_history.py (committee_seats), load_company_tickers.py + load_ticker_windows.py (links).
Usage:   python src/scripts/compute_conflicts.py [--current-seats] [--no-write] [--out summary.json]
"""

import argparse
import json
import os
import sys
from bisect import bisect_right
from collections import Counter, defaultdict
from datetime import date

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Ticker → sector ─────────────────────────────────────────────────────────────
SECTOR_MAP = {}
for _tk in "LMT RTX BA NOC GD LHX PLTR HII LDOS BAH KTOS AXON GE HON".split():
    SECTOR_MAP[_tk] = "defense"
for _tk in "MSFT AAPL GOOGL GOOG AMZN META NVDA AMD INTC ORCL CRM CSCO IBM QCOM TXN ADBE NFLX ACN".split():
    SECTOR_MAP[_tk] = "tech"
for _tk in ("PFE MRNA JNJ ABBV MRK LLY AMGN BMY GILD BIIB REGN VRTX UNH CVS CI HUM "
            "ELV CNC MCK ABT TMO DHR ZTS ISRG MDT").split():
    SECTOR_MAP[_tk] = "pharma"
for _tk in "XOM CVX COP EOG SLB OXY PSX VLO MPC KMI WMB NEE DUK SO".split():
    SECTOR_MAP[_tk] = "energy"
for _tk in "JPM BAC GS MS WFC C BLK SCHW AXP USB PNC BX KKR".split():
    SECTOR_MAP[_tk] = "finance"
for _tk in "COIN MSTR HOOD".split():
    SECTOR_MAP[_tk] = "crypto"
for _tk in "TSLA F GM RIVN".split():
    SECTOR_MAP[_tk] = "auto"

# ── Sector → committee-name keywords with jurisdiction over it ──────────────────
JURISDICTION = {
    "defense": ["Armed Services"],
    "tech": ["Energy and Commerce", "Commerce, Science", "Judiciary"],
    "pharma": ["Energy and Commerce", "Health, Education", "Ways and Means", "Finance"],
    "energy": ["Energy and Commerce", "Energy and Natural Resources", "Natural Resources"],
    "finance": ["Financial Services", "Banking, Housing"],
    "crypto": ["Financial Services", "Banking, Housing", "Agriculture"],
    "auto": ["Energy and Commerce", "Commerce, Science"],
}

SCORE_WEIGHTS = {"committee": 45, "contractor": 30, "late_filing": 15, "large": 10}
LINK_FLOOR = date(2020, 10, 1)                       # R6b: nothing earlier was checked, earlier trades never join
# R6d: the awards table holds only awards signed from this date (FY2024 start; observed min date_signed, R5/R6c). A trade
# dated before it cannot be answered from the table, so the contractor signal is NULL (not computed), never false.
AWARDS_COVERAGE_START = date(2023, 10, 1)
CONTRACT_BASIS = f"awards_signed_from_{AWARDS_COVERAGE_START}"                  # computed: award signed on or before the trade
CONTRACT_BASIS_PRE = f"not_computed_trade_before_{AWARDS_COVERAGE_START}"       # NULL: the table cannot answer
LINK_STATUS_OK = ("auto_confirmed", "manual_confirmed")
LINK_CLASS_OK = ("common", "adr", "preferred")
LINK_WINDOW_OK = ("same_entity", "checked")
UNRELIABLE_DATE_FLAGS = ("after_filing", "future", "stale_2y")
KEY_COLS = ("member_name", "ticker", "transaction_date", "transaction_type", "owner", "asset_type",
            "option_type", "strike", "expiry")
TRADE_COLS = (
    "member_name,member_chamber,member_party,member_state,bio_guide_id,ticker,company_name,transaction_type,"
    "asset_type,owner,option_type,strike,expiry,transaction_date,source_system,amount_max,lot_count,"
    "stock_act_late,days_to_file,date_flag")


# R6e (A7b F3 / F8): the stored tier is a score band, not a verdict word ('severe', 'high conflict'): pages show "70-100".
TIER_BANDS = ("score_70_plus", "score_45_69", "score_20_44", "score_under_20")


def tier_for(score: int) -> str:
    if score >= 70:
        return "score_70_plus"
    if score >= 45:
        return "score_45_69"
    if score >= 20:
        return "score_20_44"
    return "score_under_20"


def fetch_all(query_fn, page_size=1000):
    """Every row of a PostgREST query; query_fn(start, end) -> builder."""
    rows, start = [], 0
    while True:
        chunk = query_fn(start, start + page_size - 1).execute().data
        rows.extend(chunk)
        if len(chunk) < page_size:
            return rows
        start += page_size


def lossless_key(t):
    return tuple(t.get(c) for c in KEY_COLS)


def iso(d):
    return date.fromisoformat(d) if d else None


def load_seat_history(sb):
    """({chamber: snapshot dates that are COMPLETE for it, sorted}, seats by bioguide {bio: [(from, to, name, committee_id)]}).
    An empty or partial snapshot is not data for a chamber (the Senate's assignments reach the file before the House's)."""
    snaps = fetch_all(lambda a, b: sb.table("committee_snapshots").select("snapshot_date,house_complete,senate_complete")
                      .order("snapshot_date").range(a, b))
    seats = fetch_all(lambda a, b: sb.table("committee_seats").select("bioguide_id,committee_id,committee_name,valid_from,valid_to")
                      .order("id").range(a, b))
    by_bio = defaultdict(list)
    for s in seats:
        by_bio[s["bioguide_id"]].append((iso(s["valid_from"]), iso(s["valid_to"]), s["committee_name"], s["committee_id"]))
    dates = {"House": [iso(s["snapshot_date"]) for s in snaps if s["house_complete"]],
             "Senate": [iso(s["snapshot_date"]) for s in snaps if s["senate_complete"]]}
    return dates, by_bio


def load_current_seats(sb):
    """{bioguide: [committee names]} from congress_members.committees (current seats only; the fallback)."""
    members = fetch_all(lambda a, b: sb.table("congress_members").select("bioguide_id,committees").range(a, b))
    return {m["bioguide_id"]: (m.get("committees") or []) for m in members if m.get("bioguide_id")}


def load_links(sb):
    """company_tickers links usable by the join rule, by ticker. The window and class checks happen per trade."""
    rows = fetch_all(lambda a, b: sb.table("company_tickers")
                     .select("id,cik,ticker,sec_name,recipient_name,status,instrument_class,window_status,valid_from,valid_to,evidence_url")
                     .in_("status", list(LINK_STATUS_OK)).in_("instrument_class", list(LINK_CLASS_OK))
                     .in_("window_status", list(LINK_WINDOW_OK)).order("id").range(a, b))
    by_ticker = defaultdict(list)
    for r in rows:
        r["_from"], r["_to"] = iso(r["valid_from"]), iso(r["valid_to"])
        by_ticker[r["ticker"].upper()].append(r)
    return by_ticker, len(rows)


def load_award_summaries(sb):
    """Awards per link, read ONLY through the award_tickers view (it applies the class and award-date rules).
    -> {company_ticker_id: {"dates": sorted signing dates, "totals": running obligated total in cents, "tops": running (award_id, amount)}}
    so a trade can read the awards signed on or before its date (bisect). Only confirmed links with a checked / same_entity
    window are summarised. An award with no signing date cannot be placed before a trade and is skipped (counted)."""
    rows = fetch_all(lambda a, b: sb.table("award_tickers")
                     .select("award_id,company_ticker_id,obligated_amount,date_signed,link_status,window_status")
                     .in_("link_status", list(LINK_STATUS_OK)).in_("window_status", list(LINK_WINDOW_OK))
                     .order("award_id").order("company_ticker_id").range(a, b))
    raw, undated = defaultdict(list), 0
    for r in rows:
        d = iso(r["date_signed"])
        if d is None:
            undated += 1
            continue
        raw[r["company_ticker_id"]].append((d, r["award_id"], r["obligated_amount"] or 0))
    out = {}
    for lid, lst in raw.items():
        lst.sort(key=lambda x: (x[0], x[1]))
        totals, tops, run, top = [], [], 0, None
        for _d, aid, amt in lst:
            run += round(float(amt) * 100)                 # whole cents: the total cannot depend on summation order
            if top is None or amt > top[1]:
                top = (aid, amt)
            totals.append(run)
            tops.append(top)
        out[lid] = {"dates": [x[0] for x in lst], "totals": totals, "tops": tops}
    return out, len(rows), undated


def awards_on_or_before(a, d):
    """The awards of one link signed on or before d -> None, or (count, total, first date, last date, top (id, amount))."""
    n = bisect_right(a["dates"], d)
    if not n:
        return None
    return n, a["totals"][n - 1], a["dates"][0], a["dates"][n - 1], a["tops"][n - 1]


def award_urls(sb, ids):
    out = {}
    ids = sorted(set(ids))
    for i in range(0, len(ids), 100):
        for r in sb.table("awards").select("id,usaspending_url").in_("id", ids[i:i + 100]).execute().data:
            out[r["id"]] = r["usaspending_url"]
    return out


def congress_start(d):
    """Jan 3 of the odd year that began the Congress sitting on date d (committees end with each Congress)."""
    y = d.year if d.year % 2 else d.year - 1
    b = date(y, 1, 3)
    return b if d >= b else date(y - 2, 1, 3)


def link_valid_on(link, d):
    return d >= LINK_FLOOR and (link["_from"] is None or d >= link["_from"]) and (link["_to"] is None or d <= link["_to"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--current-seats", action="store_true", help="use the member's current seats (committee_basis current_as_of_<today>)")
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--out", help="write the run summary (JSON) here")
    args = ap.parse_args()
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not set")
        return 1
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    today = date.today()

    # ── committee data ──────────────────────────────────────────────────────────
    snap_dates, seats_by_bio = ({}, {})
    if not args.current_seats:
        snap_dates, seats_by_bio = load_seat_history(sb)
    use_history = bool(any(snap_dates.values()) and seats_by_bio)
    current_seats = {} if use_history else load_current_seats(sb)
    if use_history:
        print(f"Committee history: complete snapshots House {len(snap_dates['House'])} / Senate {len(snap_dates['Senate'])}, "
              f"{sum(len(v) for v in seats_by_bio.values())} seat runs for {len(seats_by_bio)} members")
    else:
        print(f"Committee data: CURRENT seats only ({len(current_seats)} members); committee_basis = current_as_of_{today}")

    def snapshot_on(d, chamber):
        """latest snapshot complete for the member's chamber on or before d -> date or None"""
        dates = snap_dates.get(chamber) or []
        lo, hi = 0, len(dates)
        while lo < hi:
            mid = (lo + hi) // 2
            if dates[mid] <= d:
                lo = mid + 1
            else:
                hi = mid
        return dates[lo - 1] if lo else None

    # ── ticker links and the awards behind them ─────────────────────────────────
    links_by_ticker, n_links = load_links(sb)
    awards_by_link, n_pairs, n_undated = load_award_summaries(sb)
    print(f"Join rule: {n_links} usable links (confirmed, common/adr/preferred, same_entity/checked), "
          f"{n_pairs} award x link pairs via award_tickers ({n_undated} without a signing date, skipped), {len(awards_by_link)} links with awards")
    first_signed = sb.table("awards").select("date_signed").not_.is_("date_signed", "null").order("date_signed").limit(1).execute().data
    if first_signed and iso(first_signed[0]["date_signed"]) < AWARDS_COVERAGE_START:
        print(f"WARNING: awards holds awards signed {first_signed[0]['date_signed']}, before AWARDS_COVERAGE_START "
              f"{AWARDS_COVERAGE_START}: update the constant")
    # R6e (F5): the date the obligation totals were read (the awards table's load), shown in every contractor reason
    last_seen = sb.table("awards").select("last_seen_at").order("last_seen_at", desc=True).limit(1).execute().data
    awards_asof = (last_seen[0]["last_seen_at"] or "")[:10] if last_seen else ""
    print(f"Contractor signal: computed only for trades on or after {AWARDS_COVERAGE_START} (contract_basis {CONTRACT_BASIS}); "
          f"earlier trades are NULL ({CONTRACT_BASIS_PRE})")

    # ── trades, grouped by the lossless key ─────────────────────────────────────
    trades = fetch_all(lambda a, b: sb.table("congress_trades").select(TRADE_COLS).order("id").range(a, b))
    groups = {}
    for t in trades:
        k = lossless_key(t)
        if k in groups:
            raise SystemExit(f"duplicate lossless key: {k}")
        groups[k] = t
    print(f"Loaded {len(groups)} trades (one per lossless key)")

    updates, stats = [], defaultdict(Counter)
    top_ids = []
    for key, t in groups.items():
        ticker = (t.get("ticker") or "").upper()
        d = iso(t["transaction_date"])
        flag = t.get("date_flag")
        reliable = flag not in UNRELIABLE_DATE_FLAGS
        reasons, score = [], 0
        sector = SECTOR_MAP.get(ticker)

        # 1. committee jurisdiction ------------------------------------------------
        committee_conflict, committee_detail, basis = None, None, None
        member_seats = None                                  # [(name, committee_id)] held on the trade date
        if not reliable:
            basis = f"not_computed_date_{flag}"                # R6e (F9): neutral; the filer's dates are shown as filed
        elif use_history:
            snap = snapshot_on(d, t.get("member_chamber"))
            if snap is None:
                basis = f"no_snapshot_before_{(snap_dates.get(t.get('member_chamber')) or ['?'])[0]}"
            elif snap < congress_start(d):           # a new Congress began after the latest complete snapshot
                basis = f"no_committee_data_since_{congress_start(d)}"
            else:
                basis = f"congress_legislators_snapshot_{snap}"
                member_seats = [(nm, cid) for (f, to, nm, cid) in seats_by_bio.get(t.get("bio_guide_id"), [])
                                if f <= d and (to is None or d <= to)]
        else:
            basis = f"current_as_of_{today}"
            member_seats = [(nm, None) for nm in current_seats.get(t.get("bio_guide_id"), [])]
        if member_seats is not None:
            committee_conflict = False
            if sector:
                for kw in JURISDICTION.get(sector, []):
                    hit = next((nm for nm, _cid in member_seats if kw in nm), None)
                    if hit:
                        committee_conflict = True
                        committee_detail = f"{hit} ({sector})"
                        score += SCORE_WEIGHTS["committee"]
                        # R6e (A7b F8): the sector map is hand-written; say so rather than claim jurisdiction
                        reasons.append(f"Member sat on the {hit}, which our hand-built map links to the {sector} sector "
                                       f"(committee basis: {basis})")
                        break

        # 2. federal contractor, only through the R6b join rule, time-aligned (R6d) -----
        has_contract, related, contract_basis = None, None, None
        if not reliable:
            contract_basis = f"not_computed_date_{flag}"
        elif d < AWARDS_COVERAGE_START:
            contract_basis = CONTRACT_BASIS_PRE            # the awards table cannot answer: NULL, never false
        else:
            contract_basis = CONTRACT_BASIS
            has_contract = False
            ok = []                                        # (link, awards of that link signed on or before the trade date)
            for L in links_by_ticker.get(ticker, []):
                if link_valid_on(L, d) and L["id"] in awards_by_link:
                    got = awards_on_or_before(awards_by_link[L["id"]], d)
                    if got:
                        ok.append((L, got))
            if ok:
                has_contract = True
                score += SCORE_WEIGHTS["contractor"]
                link_infos = []
                for L, (n_aw, total, first_d, last_d, top) in sorted(ok, key=lambda x: -x[1][1])[:3]:
                    top_ids.append(top[0])
                    link_infos.append({
                        "company_ticker_id": L["id"], "ticker": L["ticker"], "instrument_class": L["instrument_class"],
                        "window_status": L["window_status"], "recipient_name": L["recipient_name"], "sec_name": L["sec_name"],
                        "evidence_url": L["evidence_url"], "award_count": n_aw,
                        "obligated_to_date": round(total / 100),     # R6e (F5): today's obligation on those awards, not the amount at the trade
                        "obligated_as_of": awards_asof,
                        "first_award_date": first_d.isoformat(),
                        "last_award_date": last_d.isoformat(),
                        "awards_signed_on_or_before_trade": n_aw,    # award_count and the totals count only these
                        "top_award_id": top[0],
                    })
                related = {"basis": "award_tickers + R6b join rule, awards signed on or before the trade date",
                           "listed_set": "contracts not competed of at least $1 million, or any contract of at least $10 million, "
                                         f"signed from {AWARDS_COVERAGE_START}",
                           "awards_coverage_start": AWARDS_COVERAGE_START.isoformat(),
                           "links": link_infos, "links_matched": len(ok)}
                first = link_infos[0]
                label = {"common": "common stock", "adr": "ADR/OTC shares", "preferred": "preferred shares"}[first["instrument_class"]]
                # R6e (A7b F5 / F7): the total is what is obligated TODAY on awards signed on or before the trade; "linked via"
                # names the ticker's share class (the link), not what was traded (an option row carries option_type).
                reasons.append(
                    f"Linked to a federal contract recipient: {first['recipient_name']} (linked via {first['ticker']} {label}) had "
                    f"{first['award_count']} award(s) in our listed set signed on or before the trade date "
                    f"(signed {first['first_award_date']} to {first['last_award_date']}); obligated to date on them: "
                    f"${first['obligated_to_date']:,} (USAspending, as of {awards_asof})")

        # 3. late filing: read, never computed here ---------------------------------
        if t.get("stock_act_late") is True:
            score += SCORE_WEIGHTS["late_filing"]
            reasons.append(f"Filed {t['days_to_file']} days after the trade (the STOCK Act sets 45)")

        # 4. large position ----------------------------------------------------------
        if (t.get("amount_max") or 0) >= 250_000:
            score += SCORE_WEIGHTS["large"]
            lots = t.get("lot_count") or 1
            reasons.append("Large position: disclosed range tops $250K" + (f" (sum of {lots} same-day lots)" if lots > 1 else ""))

        score = min(score, 100)
        tier = tier_for(score)
        stats["tier"][tier] += 1
        stats["basis"][basis.rsplit("_", 1)[0] if basis.startswith(("congress_legislators", "current_as_of")) else basis] += 1
        if basis.startswith("congress_legislators"):
            stats["snapshot_age_days"][
                "<=30" if (d - iso(basis.rsplit("_", 1)[1])).days <= 30 else
                "31-90" if (d - iso(basis.rsplit("_", 1)[1])).days <= 90 else ">90"] += 1
        stats["committee_conflict"][str(committee_conflict)] += 1
        stats["has_federal_contract"][str(has_contract)] += 1
        stats["contract_basis"][contract_basis] += 1
        stats["instrument"]["option" if t.get("option_type") else "security"] += 1
        if t.get("option_type") and (committee_conflict or has_contract):
            stats["option_rows_with_signal"]["committee" if committee_conflict else "contractor"] += 1
        updates.append({
            # the lossless key (conflict target) and the NOT NULL columns of the upsert's INSERT path, carried unchanged
            **{c: t.get(c) for c in KEY_COLS},
            "member_chamber": t["member_chamber"], "member_party": t["member_party"], "member_state": t["member_state"],
            "company_name": t["company_name"], "source_system": t["source_system"],
            # computed conflict signals (days_to_file / stock_act_late are read above and NOT written)
            "committee_conflict": committee_conflict,
            "committee_conflict_detail": committee_detail,
            "committee_basis": basis,
            "has_federal_contract": has_contract,
            "related_contracts": related,
            "contract_basis": contract_basis,
            "conflict_reasons": reasons,
            "conflict_score": score,
            "conflict_tier": tier,
        })

    # the top award of each linked recipient, with its USAspending URL (so a reader can open the award)
    urls = award_urls(sb, top_ids)
    for u in updates:
        for li in (u["related_contracts"] or {}).get("links", []):
            li["top_award_url"] = urls.get(li["top_award_id"])

    summary = {"trades": len(updates), "awards_coverage_start": AWARDS_COVERAGE_START.isoformat(),
               **{k: dict(v) for k, v in stats.items()},
               "late_filing_true": sum(1 for t in groups.values() if t.get("stock_act_late") is True),
               "committee_basis_kind": "congress_legislators_snapshot" if use_history else "current_as_of"}
    if args.no_write:
        print("no-write:", json.dumps(summary))
        if args.out:
            json.dump(summary, open(args.out, "w", encoding="utf-8"), indent=1)
        return 0

    # ── write back (upsert on the lossless key) ─────────────────────────────────
    for i in range(0, len(updates), 500):
        sb.table("congress_trades").upsert(updates[i:i + 500], on_conflict=",".join(KEY_COLS)).execute()
        print(f"  updated {min(i + 500, len(updates))}/{len(updates)}")

    print(f"\nScored {len(updates)} trades:")
    for tier in TIER_BANDS:
        print(f"  {tier:9} {stats['tier'][tier]}")
    print(json.dumps(summary))
    if args.out:
        json.dump(summary, open(args.out, "w", encoding="utf-8"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
