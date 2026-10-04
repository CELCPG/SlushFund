#!/usr/bin/env python3
"""
Spot-check House trades in congress_trades against their source PTR PDFs.

Samples random House_Clerk rows, re-opens each row's PTR PDF from its stored disclosure_url and
checks, with matching logic that is separate from the loader's parser:

  member        the PDF's "Name:" line contains the stored member's name
  state/dist    the PDF's "State/District:" equals member_state + district
  ticker/asset  a transaction line with this ticker exists for the stored date
  type          that line's P/S/E letter matches BUY/SELL/EXCHANGE
  amount        the printed band(s) equal amount_range (every lot of a folded row), lot_count lots
  owner         the SP/JT/DC code of those lots equals `owner` (no code = Self)
  asset name    (informational) the stored company_name's first word appears in the entry
  R6a options   option_type / strike / expiry equal what the entry's description says (own regexes);
                a non-option row must have no call/put option wording in its description
  R6a dates     filed_date equals the PDF's "Digitally Signed" date (informational: the Clerk's index
                date is the loader's source); with --late / --options the ORIGINAL filing is searched
                independently: every PTR of the same member filed from the transaction date up to this
                filing is opened, and the earliest one that holds the same transaction must carry
                original_filed_date; days_to_file / stock_act_late are recomputed from it.

Usage:
  python3 src/scripts/verify_house_trades.py [--per-year 5 | --n 10] [--seed 2026] [--out result.json]
      [--options] [--late] [--amended]

Needs the supabase client + pdfplumber (see _venv.py). Waits >= 1.1 s between PDF requests.
"""

import argparse
import collections
import csv
import io
import json
import os
import random
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date

from _venv import activate as _activate_venv
_activate_venv()

import pdfplumber
from supabase import create_client

UA = "slushfund-bulk-loader/1.0"
OWN = {"SP": "Spouse", "JT": "Joint", "DC": "Child"}
COLS = ("id,member_name,company_name,member_state,district,ticker,transaction_type,transaction_date,amount_range,"
        "owner,disclosure_year,disclosure_url,source_doc_id,asset_type,lot_count,option_type,strike,expiry,"
        "filed_date,original_filed_date,date_flag,days_to_file,stock_act_late,amount_max,lateness_basis,"
        "original_source_doc_id,original_disclosure_url,original_source_basis")
DATE_PAIR = re.compile(r"\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}/\d{1,2}/\d{4}")
# the table header repeated at the top of every page; it sits between a band that wraps over a page break
HEADER = re.compile(r"^\s*(?:ID\s+Owner\s+Asset|Type\s+Date\s+Gains|\$200\?\s*$)", re.I)
INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf"


MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def num(s):
    return int(s.replace(",", ""))


def sample_rows(sb, per_year, n, seed, options, late, amended, late_board=False, first_report=False):
    ids, start = [], 0
    while True:
        rows = (sb.table("congress_trades").select("id,disclosure_year,option_type,days_to_file,filed_date,original_filed_date,stock_act_late,source_doc_id,original_source_doc_id")
                .eq("source_system", "House_Clerk").order("id").range(start, start + 999).execute().data)
        ids += rows
        if len(rows) < 1000:
            break
        start += 1000
    if options:
        ids = [r for r in ids if r["option_type"]]
    if late:
        ids = [r for r in ids if r["days_to_file"] is not None]
    if late_board:
        ids = [r for r in ids if r["stock_act_late"] is True]
    if amended:
        ids = [r for r in ids if r["original_filed_date"] and r["filed_date"] != r["original_filed_date"]]
    if first_report:     # R6f: rows whose first report is another filing than the one they are stored under (also same-day filings)
        ids = [r for r in ids if r["original_source_doc_id"] and r["original_source_doc_id"] != r["source_doc_id"]]
    print(f"{len(ids)} House rows in the sampling pool")
    rng = random.Random(seed)
    if n:
        picked = [r["id"] for r in rng.sample(sorted(ids, key=lambda r: r["id"]), min(n, len(ids)))]
    else:
        picked = []
        for y in sorted({r["disclosure_year"] for r in ids}, reverse=True):
            pool = sorted(r["id"] for r in ids if r["disclosure_year"] == y)
            picked += rng.sample(pool, min(per_year, len(pool)))
    out = []
    for i in range(0, len(picked), 100):
        out += sb.table("congress_trades").select(COLS).in_("id", picked[i:i + 100]).execute().data
    return sorted(out, key=lambda r: (-r["disclosure_year"], r["id"]))


def fetch_cached(url, fp):
    if not os.path.exists(fp):
        time.sleep(1.1)
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()
        with open(fp, "wb") as f:
            f.write(raw)
    return fp


def pdf_lines(url, cache):
    fp = fetch_cached(url, os.path.join(cache, re.sub(r"\W", "_", url.rsplit("/", 2)[-2] + "_" + url.rsplit("/", 1)[-1])))
    lines = []
    with pdfplumber.open(fp) as pdf:
        for p in pdf.pages:
            lines += [re.sub(r"[\x00-\x1f]", " ", ln) for ln in (p.extract_text() or "").split("\n")]
    return lines


def index_rows(year, cache):
    fp = fetch_cached(INDEX_URL.format(year=year), os.path.join(cache, f"index_{year}.zip"))
    zf = zipfile.ZipFile(fp)
    txt = next(n for n in zf.namelist() if n.lower().endswith(".txt"))
    rows = list(csv.DictReader(io.StringIO(zf.read(txt).decode("utf-8-sig", errors="replace")), delimiter="\t"))
    return [r for r in rows if (r.get("FilingType") or "").strip() == "P"]


def mdy(s):
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", s or "")
    if not m:
        return None
    y = int(m.group(3))
    return date(y + 2000 if y < 100 else y, int(m.group(1)), int(m.group(2))).isoformat()


def entries(lines, r):
    """Transaction entries in a PTR that carry the row's ticker on the row's date: type, band, owner, text, description."""
    lines = [ln for ln in lines if not HEADER.match(ln)]
    y, m, d = r["transaction_date"].split("-")
    when = f"{m}/{d}/{y}"
    tkpat = r"\(\s*" + re.escape(r["ticker"]).replace(r"\.", r"[./-]") + r"\s*\)"
    out = []
    for i, line in enumerate(lines):
        mt = re.search(r"\b([SPE])(?:\s*\((?:partial|full)\))?\s+" + re.escape(when) + r"\s+\d{1,2}/\d{1,2}/\d{4}", line, re.I)
        if not mt:
            continue
        end = i + 1
        while end < min(len(lines), i + 4) and not DATE_PAIR.search(lines[end]):
            end += 1
        win = " ".join(lines[i:end])
        if not re.search(tkpat, win, re.I):
            continue
        stop = i + 1
        while stop < min(len(lines), i + 9) and not DATE_PAIR.search(lines[stop]):
            stop += 1
        block = " ".join(lines[i:stop])
        dm = re.search(r"(?:\bD\s*:|DESCRIPTION\s*:)(.*)", block, re.I)
        band = tuple(num(x) for x in re.findall(r"\$\s*([\d,]+)", win[mt.end():])[:2])
        om = re.match(r"^\s*(?:\d{6,}\s+)?(SP|JT|DC)\s", line)
        out.append({"type": mt.group(1).upper(), "band": band, "owner": OWN[om.group(1)] if om else "Self",
                    "evidence": re.sub(r"\s+", " ", win)[:200], "win": win, "desc": re.sub(r"\s+", " ", dm.group(1)) if dm else "",
                    "code": (re.search(r"\[([A-Za-z0-9]{2})\]", win) or [None, ""])[1].upper()})
    return out


def own_option_reading(desc):
    """(option_type, strike, expiry iso) from a description, read with regexes of this script (not the loader's)."""
    words = {w.lower() for w in re.findall(r"\b(call|put)s?\b", desc, re.I)}
    strikes = {float(x.replace(",", "")) for x in re.findall(r"strike[^$\d]{0,20}\$?\s*([\d,]+(?:\.\d+)?)", desc, re.I)}
    exps = {mdy(x) for x in re.findall(r"(?:exp\w*\.?)[^\d]{0,20}(\d{1,2}/\d{1,2}/\d{2,4})", desc, re.I)}
    # option-chain shorthand: 'PUT TSLA Oct 15 21 500.0 P' (month day yy strike C/P) and 'AAPL 20JAN23 180 Call'
    for mon, day, yy, k, letter in re.findall(r"\b([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2})\s+([\d,]*\d(?:\.\d+)?)\s+([CP])\b", desc):
        if mon.lower() in MONTHS:
            strikes.add(float(k.replace(",", "")))
            exps.add(date(2000 + int(yy), MONTHS[mon.lower()], int(day)).isoformat())
            words.add("call" if letter == "C" else "put")
    for day, mon, yy, k in re.findall(r"\b(\d{1,2})([A-Za-z]{3})(\d{2})\s+([\d,]*\d(?:\.\d+)?)\s+(?:calls?|puts?)\b", desc, re.I):
        if mon.lower() in MONTHS:
            strikes.add(float(k.replace(",", "")))
            exps.add(date(2000 + int(yy), MONTHS[mon.lower()], int(day)).isoformat())
    kind = next(iter(words)) if len(words) == 1 else "unknown"
    return kind, (next(iter(strikes)) if len(strikes) == 1 else None), (next(iter(exps)) if len(exps) == 1 and None not in exps else None)


def check(r, lines, cache, idx_cache, orig_scan):
    full = "\n".join(ln for ln in lines if not HEADER.match(ln))
    o = {"year": r["disclosure_year"], "doc": r["source_doc_id"], "member": r["member_name"], "ticker": r["ticker"],
         "date": r["transaction_date"], "type": r["transaction_type"], "amount_range": r["amount_range"],
         "owner": r["owner"], "option": [r["option_type"], r["strike"], r["expiry"]], "lot_count": r["lot_count"],
         "filed": r["filed_date"], "original": r["original_filed_date"], "days_to_file": r["days_to_file"],
         "stock_act_late": r["stock_act_late"], "date_flag": r["date_flag"]}
    nm = re.search(r"Name:\s*(.+)", full, re.I)
    sd = re.search(r"State/District:\s*([A-Z]{2})(\d+)", full, re.I)
    pn = re.sub(r"[^a-z]", "", (nm.group(1) if nm else "").lower())
    toks = [re.sub(r"[^a-z]", "", w.lower()) for w in r["member_name"].split()]
    o["member_ok"] = bool(pn) and any(t and len(t) > 2 and t in pn for t in toks)
    o["state_ok"] = bool(sd) and sd.group(1).upper() == r["member_state"] and str(int(sd.group(2))) == str(r["district"])
    want = {"BUY": "P", "SELL": "S", "EXCHANGE": "E"}[r["transaction_type"]]
    cands = entries(lines, r)
    same_all = [c for c in cands if c["type"] == want]
    want_opt = (r["option_type"], r["strike"] if r["strike"] is None else float(r["strike"]), r["expiry"])

    def opt_of(c):
        if c["code"] == "OP" or re.search(r"\b(?:call|put)s?\s+(?:options?|contracts?)\b", c["desc"], re.I) and not re.search(r"exercis", c["desc"], re.I):
            return own_option_reading(c["desc"])
        return (None, None, None)

    same = [c for c in same_all if c["owner"] == r["owner"] and opt_of(c) == want_opt]
    exp = [(num(a), num(b)) for a, b in re.findall(r"\$([\d,]+) - \$([\d,]+)", r["amount_range"] or "")]
    if not exp:        # an exact amount rather than a band ('$430' for the PDF's '$430.77'; cents are not stored)
        exp = [(num(a),) for a in re.findall(r"^\$([\d,]+)$", (r["amount_range"] or "").strip())]
    width = len(exp[0]) if exp else 2
    got, need = collections.Counter(c["band"][:width] for c in same), collections.Counter(exp)
    o["entry_found"] = bool(cands)
    o["type_ok"] = bool(same_all)
    o["amount_ok"] = bool(exp) and all(got[b] >= n for b, n in need.items()) and len(same) == len(exp)
    o["lot_count_ok"] = len(same) == r["lot_count"]
    o["owner_ok"] = bool(same)
    o["option_ok"] = bool(same)           # `same` already requires call/put, strike and expiry to equal the stored ones
    if not same:
        o["option_seen"] = [list(opt_of(c)) for c in same_all]
    word = next((w for w in re.findall(r"[A-Za-z0-9]+", r.get("company_name") or "") if len(w) >= 3), "")
    o["asset_name_seen"] = bool(word) and any(word.lower() in c["win"].lower() for c in same)
    o["company_name"] = r.get("company_name")
    o["evidence"] = (same or same_all or cands or [{"evidence": ""}])[0]["evidence"]
    o["description"] = (same or [{"desc": ""}])[0]["desc"][:160]
    sg = re.search(r"Digitally\s+Signed:?\s*[^\n]*?(\d{2}/\d{2}/\d{4})", full)
    o["signed"] = mdy(sg.group(1)) if sg else None
    o["filed_matches_signed"] = o["signed"] == r["filed_date"]
    checks = ["member_ok", "state_ok", "entry_found", "type_ok", "amount_ok", "owner_ok", "option_ok", "lot_count_ok"]
    if orig_scan:
        o.update(find_original(r, want, cache, idx_cache))
        orig_ok = o["found_original"] == r["original_filed_date"] or (o["found_original"] is None and r["original_filed_date"] is None)
        o["original_ok"] = orig_ok
        checks.append("original_ok")
        # R6f (A7c G1): the stored first report is the earliest filing (date, then DocID) that holds the transaction,
        # its link points at that document, and the basis agrees
        doc, url = r["original_source_doc_id"], r["original_disclosure_url"]
        o["original_doc"] = doc
        o["original_doc_ok"] = (o["found_original_doc"] == doc and (url or "").endswith(f"/{doc}.pdf")) if doc else (
            o["found_original_doc"] is None and url is None)
        o["original_basis_ok"] = r["original_source_basis"] == (
            "first_report_not_identified" if doc is None else
            "first_report_this_filing" if str(doc) == str(r["source_doc_id"]) else "first_report_earlier_filing")
        checks += ["original_doc_ok", "original_basis_ok"]
        if r["date_flag"] in (None, "stale_2y_corroborated") and r["original_filed_date"]:   # R6c: a corroborated stale row has lateness
            days = (date.fromisoformat(r["original_filed_date"]) - date.fromisoformat(r["transaction_date"])).days
            # R6e: a row at or under the $1,000 reporting threshold was never due: stock_act_late must be NULL
            expect_late = None if (r["amount_max"] is not None and r["amount_max"] <= 1000) else (days > 45)
            o["lateness_ok"] = r["days_to_file"] == days and r["stock_act_late"] == expect_late
        else:
            o["lateness_ok"] = r["days_to_file"] is None and r["stock_act_late"] is None
        checks.append("lateness_ok")
    o["all_ok"] = all(o[k] for k in checks)
    o["checks"] = checks
    return o


def find_original(r, want, cache, idx_cache):
    """Earliest filing date of the same member's PTRs, from the transaction date to this filing, that hold the same
    transaction (ticker, date, direction; an earlier filing that lists another owner or band still counts, as in the loader).
    Scanned PDFs cannot be read: they are counted, not guessed."""
    toks = {re.sub(r"[^a-z]", "", w.lower()) for w in r["member_name"].split()}
    lo, hi = r["transaction_date"], r["filed_date"]
    cand = []
    for yr in range(int(lo[:4]), int(hi[:4]) + 1):
        if yr < 2021:
            continue
        if yr not in idx_cache:
            idx_cache[yr] = index_rows(yr, cache)
        for x in idx_cache[yr]:
            nm = re.sub(r"[^a-z]", "", (x.get("Last") or "").lower())
            fd = mdy(x.get("FilingDate"))
            if nm and nm in toks and (x.get("StateDst") or "")[:2] == r["member_state"] and fd and lo <= fd <= hi:
                cand.append((fd, x["DocID"].strip(), yr))
    cand.sort()
    holders, unreadable = [], 0
    for fd, doc, yr in cand:
        ln = pdf_lines(PTR_URL.format(year=yr, doc=doc), cache)
        if sum(len(x) for x in ln) < 50:
            unreadable += 1
            continue
        held = [c for c in entries(ln, r) if c["type"] == want]
        if held:       # the loader's rule: the same ticker / date / direction in an earlier filing is the same transaction, whoever the owner
            holders.append((fd, doc, any(c["owner"] == r["owner"] for c in held)))
    return {"found_original": holders[0][0] if holders else None, "holder_docs": [d for _, d, _ in holders],
            "found_original_doc": holders[0][1] if holders else None,
            "original_lists_a_different_owner": bool(holders) and not holders[0][2],
            "filings_scanned_in_window": len(cand), "unreadable_in_window": unreadable}


def main():
    ap = argparse.ArgumentParser(description="Spot-check House trades against their PTR PDFs")
    ap.add_argument("--per-year", type=int, default=5)
    ap.add_argument("--n", type=int, default=0, help="draw N rows overall instead of --per-year per year")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", default="verify_house_result.json")
    ap.add_argument("--options", action="store_true", help="sample only option rows (option_type set)")
    ap.add_argument("--late", action="store_true", help="sample only rows with days_to_file computed; also re-derives the original filing")
    ap.add_argument("--amended", action="store_true", help="sample only rows restated by a later filing (filed_date != original_filed_date)")
    ap.add_argument("--first-report", action="store_true", help="R6f: sample only rows whose first report is a different filing than the one they are stored under (use with --late-board)")
    ap.add_argument("--late-board", action="store_true", help="R6e: sample only rows the late-filers board would show (stock_act_late = true); also re-derives the original filing")
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "/tmp"), "slushfund-verify-pdfs"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = sample_rows(sb, args.per_year, args.n, args.seed, args.options, args.late, args.amended, args.late_board, args.first_report)
    idx_cache = {}
    orig_scan = args.late or args.amended or args.late_board or args.first_report
    results = [check(r, pdf_lines(r["disclosure_url"], args.cache), args.cache, idx_cache, orig_scan) for r in rows]
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=1)
    ok = sum(r["all_ok"] for r in results)
    print(f"all fields match: {ok}/{len(results)}")
    for k in results[0]["checks"] if results else []:
        print(f"  {k}: {sum(r[k] for r in results)}/{len(results)}")
    print(f"  asset_name_seen (informational): {sum(r['asset_name_seen'] for r in results)}/{len(results)}")
    print(f"  filed_date == PDF signed date (informational): {sum(r['filed_matches_signed'] for r in results)}/{len(results)}")
    for r in results:
        if not r["all_ok"]:
            print("MISMATCH", r["year"], r["doc"], r["member"], r["ticker"], r["date"], r["type"],
                  r["amount_range"], r["owner"], [k for k in r["checks"] if not r[k]], "|", r["evidence"][:140])
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
