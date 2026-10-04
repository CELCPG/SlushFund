#!/usr/bin/env python3
"""
Spot-check House trades in congress_trades against their source PTR PDFs.

Samples N random House_Clerk rows per disclosure year, re-opens each row's PTR PDF from its
stored disclosure_url and checks, with matching logic that is separate from the loader's parser:

  member        the PDF's "Name:" line contains the stored member's name
  state/dist    the PDF's "State/District:" equals member_state + district
  ticker/asset  a transaction line with this ticker exists for the stored date
  type          that line's P/S/E letter matches BUY/SELL/EXCHANGE
  amount        the printed band(s) equal amount_range (every lot of a folded row)
  owner         the SP/JT/DC code(s) equal `owner` (no code = Self)
  asset name    (informational) the stored company_name's first word appears in the entry

Usage:
  python3 src/scripts/verify_house_trades.py [--per-year 5] [--seed 2026] [--out result.json]

Needs the supabase client + pdfplumber (see _venv.py). Waits >= 1.1 s between PDF requests.
"""

import argparse
import collections
import io
import json
import os
import random
import re
import sys
import time
import urllib.request

from _venv import activate as _activate_venv
_activate_venv()

import pdfplumber
from supabase import create_client

UA = "slushfund-bulk-loader/1.0"
OWN = {"SP": "Spouse", "JT": "Joint", "DC": "Child"}
COLS = ("id,member_name,company_name,member_state,district,ticker,transaction_type,transaction_date,amount_range,"
        "owner,disclosure_year,disclosure_url,source_doc_id")
DATE_PAIR = re.compile(r"\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}/\d{1,2}/\d{4}")
# the table header repeated at the top of every page; it sits between a band that wraps over a page break
HEADER = re.compile(r"^\s*(?:ID\s+Owner\s+Asset|Type\s+Date\s+Gains|\$200\?\s*$)", re.I)


def num(s):
    return int(s.replace(",", ""))


def sample_rows(sb, per_year, seed):
    ids, start = [], 0
    while True:
        rows = (sb.table("congress_trades").select("id,disclosure_year").eq("source_system", "House_Clerk")
                .order("id").range(start, start + 999).execute().data)
        ids += [(r["disclosure_year"], r["id"]) for r in rows]
        if len(rows) < 1000:
            break
        start += 1000
    rng = random.Random(seed)
    picked = []
    for y in sorted({y for y, _ in ids}, reverse=True):
        pool = sorted(i for yy, i in ids if yy == y)
        picked += rng.sample(pool, min(per_year, len(pool)))
    out = []
    for i in range(0, len(picked), 100):
        out += sb.table("congress_trades").select(COLS).in_("id", picked[i:i + 100]).execute().data
    return sorted(out, key=lambda r: (-r["disclosure_year"], r["id"]))


def pdf_lines(url, cache):
    fp = os.path.join(cache, re.sub(r"\W", "_", url.rsplit("/", 2)[-2] + "_" + url.rsplit("/", 1)[-1]))
    if not os.path.exists(fp):
        time.sleep(1.1)
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()
        with open(fp, "wb") as f:
            f.write(raw)
    lines = []
    with pdfplumber.open(fp) as pdf:
        for p in pdf.pages:
            lines += (p.extract_text() or "").split("\n")
    return lines


def check(r, lines):
    lines = [ln for ln in lines if not HEADER.match(ln)]
    full = "\n".join(lines)
    o = {"year": r["disclosure_year"], "doc": r["source_doc_id"], "member": r["member_name"], "ticker": r["ticker"],
         "date": r["transaction_date"], "type": r["transaction_type"], "amount_range": r["amount_range"],
         "owner": r["owner"]}
    nm = re.search(r"Name:\s*(.+)", full, re.I)
    sd = re.search(r"State/District:\s*([A-Z]{2})(\d+)", full, re.I)
    pn = re.sub(r"[^a-z]", "", (nm.group(1) if nm else "").lower())
    toks = [re.sub(r"[^a-z]", "", w.lower()) for w in r["member_name"].split()]
    o["member_ok"] = bool(pn) and any(t and len(t) > 2 and t in pn for t in toks)
    o["state_ok"] = bool(sd) and sd.group(1).upper() == r["member_state"] and str(int(sd.group(2))) == str(r["district"])
    y, m, d = r["transaction_date"].split("-")
    date = f"{m}/{d}/{y}"
    want = {"BUY": "P", "SELL": "S", "EXCHANGE": "E"}[r["transaction_type"]]
    tkpat = r"\(\s*" + re.escape(r["ticker"]).replace(r"\.", r"[./-]") + r"\s*\)"
    cands = []
    for i, line in enumerate(lines):
        mt = re.search(r"\b([SPE])(?:\s*\((?:partial|full)\))?\s+" + re.escape(date) + r"\s+\d{1,2}/\d{1,2}/\d{4}", line, re.I)
        if not mt:
            continue
        end = i + 1
        while end < min(len(lines), i + 4) and not DATE_PAIR.search(lines[end]):
            end += 1
        win = " ".join(lines[i:end])
        if not re.search(tkpat, win, re.I):
            continue
        band = tuple(num(x) for x in re.findall(r"\$\s*([\d,]+)", win[mt.end():])[:2])
        om = re.match(r"^\s*(?:\d{6,}\s+)?(SP|JT|DC)\s", line)
        cands.append({"type": mt.group(1).upper(), "band": band, "owner": OWN[om.group(1)] if om else "Self",
                      "evidence": re.sub(r"\s+", " ", win)[:200], "win": win})
    same = [c for c in cands if c["type"] == want]
    exp = [(num(a), num(b)) for a, b in re.findall(r"\$([\d,]+) - \$([\d,]+)", r["amount_range"] or "")]
    got, need = collections.Counter(c["band"] for c in same), collections.Counter(exp)
    o["entry_found"] = bool(cands)
    o["type_ok"] = bool(same)
    o["amount_ok"] = bool(exp) and all(got[b] >= n for b, n in need.items()) and len(same) == len(exp)
    o["owner_ok"] = set((r["owner"] or "").split(", ")) == {c["owner"] for c in same}
    # informational (not part of all_ok): the stored asset name's first word appears in the entry
    word = next((w for w in re.findall(r"[A-Za-z0-9]+", r.get("company_name") or "") if len(w) >= 3), "")
    o["asset_name_seen"] = bool(word) and any(word.lower() in c["win"].lower() for c in same)
    o["company_name"] = r.get("company_name")
    o["evidence"] = (same or cands or [{"evidence": ""}])[0]["evidence"]
    o["all_ok"] = all(o[k] for k in ("member_ok", "state_ok", "entry_found", "type_ok", "amount_ok", "owner_ok"))
    return o


def main():
    ap = argparse.ArgumentParser(description="Spot-check House trades against their PTR PDFs")
    ap.add_argument("--per-year", type=int, default=5)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", default="verify_house_result.json")
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "/tmp"), "slushfund-verify-pdfs"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = sample_rows(sb, args.per_year, args.seed)
    results = [check(r, pdf_lines(r["disclosure_url"], args.cache)) for r in rows]
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=1)
    ok = sum(r["all_ok"] for r in results)
    print(f"all fields match: {ok}/{len(results)}")
    for k in ("member_ok", "state_ok", "entry_found", "type_ok", "amount_ok", "owner_ok"):
        print(f"  {k}: {sum(r[k] for r in results)}/{len(results)}")
    print(f"  asset_name_seen (informational): {sum(r['asset_name_seen'] for r in results)}/{len(results)}")
    for r in results:
        if not r["all_ok"]:
            print("MISMATCH", r["year"], r["doc"], r["member"], r["ticker"], r["date"], r["type"],
                  r["amount_range"], r["owner"], "|", r["evidence"][:140])
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
