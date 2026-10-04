#!/usr/bin/env python3
"""
R6c: spot-check the stale_2y decision against the source PTR PDFs (House only; eFD prints no notification date).

  corroborated   random date_flag = 'stale_2y_corroborated' rows: the PDF line for the row's ticker prints the
                 stored transaction date AND the stored notification date (0-60 days apart), the P/S/E letter
                 matches, and date_flag / days_to_file / stock_act_late recompute from the PDF's dates and the
                 stored original_filed_date.
  suspect        random date_flag = 'stale_2y' House rows: the PDF prints exactly the stored dates (so the
                 inconsistency is in the filing, not in our parse) and they are more than 60 days apart or
                 inverted. Also reports whether a year shift of the transaction date would make the two agree.

The matching is separate from the loader's parser (own regexes, own window scan).

Usage:
  python3 src/scripts/verify_stale_flags.py corroborated --n 10 --seed 1 --out r6c-evidence/v-corroborated.json
  python3 src/scripts/verify_stale_flags.py suspect --n 5 --seed 1 --out r6c-evidence/v-suspect.json
"""
import argparse
import io
import json
import os
import random
import re
import sys
import tempfile
import time
import urllib.request
from datetime import date, datetime

from _venv import activate as _activate_venv
_activate_venv()

import pdfplumber
from supabase import create_client
from trade_fields import date_flag, lateness

UA = "slushfund-bulk-loader/1.0"
COLS = ("id,member_name,ticker,transaction_type,transaction_date,notification_date,filed_date,original_filed_date,"
        "date_flag,days_to_file,stock_act_late,source_doc_id,disclosure_year,disclosure_url,owner")
LETTER = {"BUY": "P", "SELL": "S", "EXCHANGE": "E"}
CACHE = os.path.join(tempfile.gettempdir(), "slushfund-verify-pdfs")
_last = [0.0]


def fetch(url, path):
    if os.path.isfile(path):
        return open(path, "rb").read()
    wait = 1.1 - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return data


def pdf_lines(data):
    out = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            out += [re.sub(r"[\x00-\x1f]", " ", x) for x in (page.extract_text() or "").split("\n")]
    return out


def fmt(d):
    d = datetime.strptime(str(d)[:10], "%Y-%m-%d")
    return rf"0?{d.month}/0?{d.day}/{d.year}"


def find_line(lines, row):
    """(index, printed txn, printed notif) of a line holding '<S|P|E> ... <txn> <notif>' for this row's ticker."""
    tk = re.escape(row["ticker"])
    pair = re.compile(r"\b([SPE])(?:\s*\((?:partial|full)\))?\s+(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}/\d{1,2}/\d{4})", re.I)
    txn_rx = re.compile(r"^" + fmt(row["transaction_date"]) + r"$")
    hits = []
    for i, ln in enumerate(lines):
        m = pair.search(ln)
        if not m or not txn_rx.match(m.group(2)):
            continue
        window = " ".join(lines[max(0, i - 3):i + 4])
        if re.search(r"\(" + tk + r"(?:[./$-][A-Za-z]{1,2})?\)", window, re.I):
            hits.append((i, m.group(1).upper(), m.group(2), m.group(3)))
    return hits


def pdate(s):
    m, d, y = (int(x) for x in s.split("/"))
    return date(y, m, d)


def signed_date(lines):
    for ln in lines:
        m = re.search(r"Digitally Signed:.*?(\d{1,2}/\d{1,2}/\d{4})", ln)
        if m:
            return pdate(m.group(1))
    return None


def sample(sb, flag, n, seed, per_member=False):
    rows, start = [], 0
    while True:
        r = (sb.table("congress_trades").select(COLS).eq("source_system", "House_Clerk").eq("date_flag", flag)
             .order("id").range(start, start + 999).execute().data)
        rows += r
        if len(r) < 1000:
            break
        start += 1000
    random.Random(seed).shuffle(rows)
    if per_member:                       # one random row per member, so one member's 36 lines do not fill the sample
        seen, keep = set(), []
        for r in rows:
            if r["member_name"] not in seen:
                seen.add(r["member_name"])
                keep.append(r)
        return keep[:n], len(rows)
    return rows[:n], len(rows)


def check(row, mode, today):
    url = row["disclosure_url"]
    data = fetch(url, os.path.join(CACHE, f"r6c_{row['source_doc_id']}.pdf"))
    lines = pdf_lines(data)
    res = {"id": row["id"], "member": row["member_name"], "ticker": row["ticker"], "doc": row["source_doc_id"], "url": url,
           "stored": {k: row[k] for k in ("transaction_date", "notification_date", "filed_date", "original_filed_date",
                                         "date_flag", "days_to_file", "stock_act_late")}}
    hits = find_line(lines, row)
    letter_ok = [h for h in hits if h[1] == LETTER.get(row["transaction_type"])]
    res["pdf_matches"] = len(letter_ok)
    if not letter_ok:
        res.update(ok=False, why="no PDF line with this ticker, type and transaction date")
        return res
    printed_notifs = sorted({h[3] for h in letter_ok})
    res["printed_transaction"] = letter_ok[0][2]
    res["printed_notification"] = printed_notifs
    stored_n = row["notification_date"]
    n_ok = any(pdate(p).isoformat() == stored_n for p in printed_notifs)
    gap = (pdate(printed_notifs[0]) - pdate(letter_ok[0][2])).days
    res["gap_days_printed"] = gap
    sd = signed_date(lines)
    res["pdf_signed_date"] = sd.isoformat() if sd else None
    res["signed_equals_filed_date"] = (sd.isoformat() == row["filed_date"]) if sd else None
    if not n_ok:
        res.update(ok=False, why="stored notification_date is not what the PDF prints")
        return res
    flag = date_flag(row["transaction_date"], row["original_filed_date"], row["filed_date"], today, stored_n)
    days, late = lateness(row["transaction_date"], row["original_filed_date"], flag)
    res["recomputed"] = {"date_flag": flag, "days_to_file": days, "stock_act_late": late}
    consistent = (flag == row["date_flag"] and days == row["days_to_file"] and late == row["stock_act_late"])
    if mode == "corroborated":
        ok = consistent and 0 <= gap <= 60 and row["date_flag"] == "stale_2y_corroborated"
        res.update(ok=ok, why="" if ok else f"recompute/gap mismatch (gap {gap}, consistent {consistent})")
    else:
        t = pdate(letter_ok[0][2])
        shift = None
        for k in list(range(-10, 0)) + list(range(1, 11)):
            try:
                t2 = t.replace(year=t.year + k)
            except ValueError:
                continue
            if 0 <= (pdate(printed_notifs[0]) - t2).days <= 60:
                shift = k
                break
        res["year_shift_that_would_agree"] = shift
        ok = consistent and not (0 <= gap <= 60) and row["date_flag"] == "stale_2y" and row["days_to_file"] is None
        res.update(ok=ok, why="" if ok else "unexpected: dates agree or lateness set")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["corroborated", "suspect"])
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--per-member", action="store_true", help="one random row per member")
    ap.add_argument("--out")
    args = ap.parse_args()
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    flag = "stale_2y_corroborated" if args.mode == "corroborated" else "stale_2y"
    rows, pool = sample(sb, flag, args.n, args.seed, args.per_member)
    results = [check(r, args.mode, date.today()) for r in rows]
    ok = sum(1 for r in results if r["ok"])
    print(f"{args.mode} seed {args.seed}: pool {pool}, {ok}/{len(results)} verified")
    for r in results:
        print(f"  {'OK ' if r['ok'] else 'MISS'} {r['member']} {r['ticker']} doc {r['doc']} "
              f"txn {r['stored']['transaction_date']} notif {r['stored']['notification_date']} "
              f"gap {r.get('gap_days_printed')} {r.get('why', '')}")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({"mode": args.mode, "seed": args.seed, "pool": pool, "verified": ok, "n": len(results),
                       "results": results}, f, indent=1, default=str)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
