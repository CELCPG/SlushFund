#!/usr/bin/env python3
"""
Bulk congressional trades loader — House side.

The community "House/Senate Stock Watcher" bulk datasets that this was meant to
consume went offline (their S3 buckets now return 403). This loader instead
pulls the **official House Clerk bulk disclosure index** — the authoritative,
still-public replacement — and parses every Periodic Transaction Report (PTR)
for the requested years:

  index : https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.zip
  PTR   : https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{DocID}.pdf

Senate trades are loaded separately via scrape_senate_ptr.py (the Senate EFD
exposes structured data and needs no PDF parsing).

Usage:
  python3 src/scripts/load_bulk_trades.py --years 2024 2023
  python3 src/scripts/load_bulk_trades.py --all          # 2016-2026
  python3 src/scripts/load_bulk_trades.py --years 2024 --check   # reachability only

Requires SLUSHFUND_VENV (supabase, pdfplumber) — see _venv.py.
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile

from _venv import activate as _activate_venv
_activate_venv()

import pdfplumber
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ROSTER_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "congress_roster.json")
UA = "slushfund-bulk-loader/1.0"

INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf"

TYPE_MAP = {"P": "BUY", "S": "SELL", "E": "EXCHANGE"}
# transaction core: <S|P|E> <transaction date> <notification date>
CORE_RE = re.compile(r"\b([SPE])\s+(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}/\d{1,2}/\d{4})")
# a real equity ticker — 1-5 uppercase letters (excludes CUSIP-style bond ids)
TICKER_RE = re.compile(r"\(([A-Z]{1,5})\)")


def _norm_district(d) -> str:
    try:
        return str(int(d))
    except (TypeError, ValueError):
        return str(d or "0")


def load_roster_index():
    """(last_name_lower, state, district) -> roster member."""
    with open(ROSTER_PATH) as f:
        members = json.load(f)["members"]
    idx = {}
    for m in members:
        if m["chamber"] != "House":
            continue
        key = (m.get("last_name", "").lower(), m["state"], _norm_district(m.get("district")))
        idx[key] = m
    return idx


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def get_ptr_filings(year: int):
    """Return PTR rows from the House Clerk annual index for a year."""
    raw = fetch(INDEX_URL.format(year=year))
    zf = zipfile.ZipFile(io.BytesIO(raw))
    txt_name = next((n for n in zf.namelist() if n.lower().endswith(".txt")), None)
    if not txt_name:
        return []
    text = zf.read(txt_name).decode("utf-8", errors="replace")
    rows = list(csv.DictReader(io.StringIO(text), delimiter="\t"))
    return [r for r in rows if (r.get("FilingType") or "").strip() == "P"]


def parse_amount(text: str):
    """Parse a disclosure amount range into (min, max). Per-token K/M/B suffix."""
    if not text:
        return None, None
    # The K/M/B suffix must be a standalone letter — not the first letter of a
    # following word (e.g. "Bond"), which otherwise scales the amount ×1e9.
    matches = re.findall(r"\$\s*([\d,]+(?:\.\d+)?)\s*([KMB](?![A-Z]))?", text.upper())
    mults = {"K": 1000, "M": 1_000_000, "B": 1_000_000_000}
    nums = []
    for raw, suffix in matches:
        try:
            nums.append(int(float(raw.replace(",", "")) * mults.get(suffix, 1)))
        except ValueError:
            continue
    if not nums:
        return None, None
    return min(nums), max(nums)


def to_iso(d: str, fallback_year: int = None):
    """Convert MM/DD/YYYY to YYYY-MM-DD with year validation.
    
    Returns None if year is impossible (> current+2 or < 2000).
    If invalid and fallback_year provided, returns YYYY-01-01 as a safe guess.
    """
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", d.strip())
    if not m:
        return None
    year = int(m.group(3))
    current_year = datetime.now().year
    if year > current_year + 2 or year < 2000:
        if fallback_year and 2000 <= fallback_year <= current_year + 1:
            return f"{fallback_year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        return None
    return f"{year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"


def parse_ptr_pdf(pdf_bytes: bytes):
    """Parse a House PTR PDF into transaction dicts.

    Works line-by-line off the page text: each transaction has a reliable
    `<S|P|E> <date> <date>` core. The ticker and amount can wrap onto the
    next line for long asset names, so one continuation line is folded in.
    """
    trades = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                lines = (page.extract_text() or "").split("\n")
                for i, line in enumerate(lines):
                    core = CORE_RE.search(line)
                    if not core:
                        continue
                    blob = line
                    # fold in one continuation line if it carries a wrapped
                    # ticker or amount overflow (and isn't a new transaction)
                    if i + 1 < len(lines):
                        nxt = lines[i + 1]
                        if ("(" in nxt or "$" in nxt) and not CORE_RE.search(nxt):
                            blob = f"{blob} {nxt}"

                    tk = TICKER_RE.search(blob)
                    if not tk:
                        continue
                    ticker = tk.group(1)
                    ttype, txn_date, notif_date = core.groups()
                    amt_min, amt_max = parse_amount(blob.split(notif_date, 1)[-1])
                    iso = to_iso(txn_date)
                    if not iso:
                        continue
                    company = blob[: core.start()]
                    company = re.sub(r"^\s*(SP|JT|DC)\s+", "", company)
                    company = re.sub(r"\([A-Z]{1,5}\)|\[[A-Z]+\]", "", company)
                    company = re.sub(r"\s+", " ", company).strip()[:200] or ticker
                    trades.append({
                        "ticker": ticker,
                        "company_name": company,
                        "transaction_type": TYPE_MAP.get(ttype, "BUY"),
                        "transaction_date": iso,
                        "amount_min": amt_min,
                        "amount_max": amt_max,
                    })
    except Exception as e:  # noqa: BLE001 — a bad PDF must not abort the batch
        print(f"    PDF parse error: {e}")
    return trades


def write_trades(sb, trades):
    if not trades:
        return 0
    written = 0
    for i in range(0, len(trades), 200):
        batch = trades[i:i + 200]
        try:
            sb.table("congress_trades").upsert(
                batch, on_conflict="member_name,ticker,transaction_date,transaction_type"
            ).execute()
            written += len(batch)
        except Exception as e:  # noqa: BLE001
            print(f"    upsert error: {e}")
    return written


def run(years, check_only=False, limit=None):
    roster = load_roster_index()
    print(f"Roster: {len(roster)} House members indexed")

    sb = None
    if not check_only:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not set")
            return 1
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    grand_total = 0
    for year in years:
        try:
            filings = get_ptr_filings(year)
        except Exception as e:  # noqa: BLE001
            print(f"{year}: index unreachable — {e}")
            continue
        if limit:
            filings = filings[:limit]
        print(f"\n{year}: {len(filings)} PTR filings")
        if check_only:
            continue

        year_trades = []
        for n, f in enumerate(filings, 1):
            doc = (f.get("DocID") or "").strip()
            last = (f.get("Last") or "").strip()
            first = (f.get("First") or "").strip()
            statedst = (f.get("StateDst") or "").strip()
            state, district = statedst[:2], _norm_district(statedst[2:])
            member = roster.get((last.lower(), state, district))
            member_name = member["name"] if member else f"{first} {last}".strip()
            member_party = member["party"] if member else ""

            try:
                pdf_bytes = fetch(PTR_URL.format(year=year, doc=doc))
            except Exception as e:  # noqa: BLE001
                print(f"  [{n}/{len(filings)}] {member_name}: PDF fetch failed — {e}")
                continue

            for t in parse_ptr_pdf(pdf_bytes):
                t.update({
                    "member_name": member_name,
                    "member_chamber": "House",
                    "member_party": member_party,
                    "member_state": state,
                    "asset_type": "Stock",
                    "disclosure_year": year,
                    "filed_date": to_iso(f.get("FilingDate", "")),
                    "source_system": "House_Clerk",
                    "flags": [],
                    "signal_type": "routine",
                    "has_federal_contract": False,
                })
                year_trades.append(t)

            if n % 50 == 0:
                print(f"  [{n}/{len(filings)}] parsed so far: {len(year_trades)} trades")
            time.sleep(0.3)

        # dedup within the batch on the same key as the DB unique index
        seen, deduped = set(), []
        for t in year_trades:
            key = (t["member_name"], t["ticker"], t["transaction_date"], t["transaction_type"])
            if key not in seen:
                seen.add(key)
                deduped.append(t)

        written = write_trades(sb, deduped)
        grand_total += written
        print(f"{year}: parsed {len(year_trades)}, unique {len(deduped)}, written {written}")

    print(f"\n=== DONE: {grand_total} House trades written ===")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Bulk-load House congressional trades")
    ap.add_argument("--years", nargs="+", type=int)
    ap.add_argument("--all", action="store_true", help="2016-2026")
    ap.add_argument("--check", action="store_true", help="reachability check only")
    ap.add_argument("--limit", type=int, help="cap filings per year (testing)")
    args = ap.parse_args()

    years = list(range(2016, 2027)) if args.all else (args.years or [2024])
    return run(years, check_only=args.check, limit=args.limit)


if __name__ == "__main__":
    sys.exit(main())
