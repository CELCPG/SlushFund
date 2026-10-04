#!/usr/bin/env python3
"""
Ingest Senate STOCK Act financial disclosures (Periodic Transaction Reports).

Source: Senate Office of Public Records — https://eopds.senate.gov
        (the official, machine-readable PTR index)

PTRs are filed within 30-45 days of a trade. The Senate also publishes a single
filings index JSON at /public/index.json updated daily.

We pull the filings index, filter to PTR-type filings from the last 24 months,
and store the raw transaction rows. We do NOT score them at ingest time —
scoring is done in compute_scores() so the methodology is auditable end-to-end.

For each trade we record:
  - senator_id (resolved by last name match against `senators`)
  - transaction_date
  - ticker (nullable — many disclosures list only asset description)
  - asset_description
  - transaction_type (buy/sell/exchange)
  - amount_low / amount_high (bucketed: 1k-15k, 15k-50k, 50k-100k, 100k-250k, 250k-500k, 500k-1m, 1m+)
  - source_url (the eopds filing URL)
  - source_filing_id

committee_overlap_sectors + conflict_flag are computed at score time using the
senator's current committee assignments.

Usage:
  python3 ingest_trades.py                  # backfill 24mo
  python3 ingest_trades.py --dry            # summary, no writes
  python3 ingest_trades.py --months 6       # override lookback
"""

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
import xml.etree.ElementTree as ET

from _common import (
    SCORE_LOOKBACK_MONTHS, chunked, get_supabase_admin, report_run,
)

EOPDS_BASE = "https://eopds.senate.gov"
# Senate publishes a feed of new filings daily. For bulk historical we need to
# iterate by senator + year, which is also available.


def fetch_filings_index() -> list:
    """Fetch the public filings index (last ~30 days of all senate filings).

    Senate eopds doesn't expose a single 24-month index. Strategy:
      1. Hit the daily index for the last 7 days (cheap).
      2. For historical, page through /api/filings/ with date filters.

    For Phase 1 MVP we use a simpler approach: pull the most recent index
    and rely on weekly cron runs to accumulate history. The list grows
    over time; older trades are rare to find in PTRs anyway.
    """
    from _common import fetch_json
    url = f"{EOPDS_BASE}/public/index.json"
    try:
        return fetch_json(url)
    except Exception as e:
        print(f"   WARN: eopds index fetch failed: {e}", file=sys.stderr)
        return []


def fetch_senator_filings(bioguide: str, year: int) -> list:
    """Fetch all filings for a specific senator + year.

    Senate eopds has an API at /api/filings/ that takes ?filer=lastname&year=...
    """
    from _common import fetch_json
    # Bioguide → last name
    sb = get_supabase_admin()
    res = sb.table("senators").select("last_name, full_name").eq("bioguide_id", bioguide).single().execute()
    if not res.data:
        return []
    last_name = res.data["last_name"]
    url = f"{EOPDS_BASE}/api/filings/?filer={last_name}&year={year}"
    try:
        data = fetch_json(url)
        if isinstance(data, list):
            return data
        return data.get("results", [])
    except Exception as e:
        return []


def parse_amount_range(amount_str: str) -> tuple[int | None, int | None]:
    """PTRs use buckets like '$1,001 - $15,000'. Return (low, high)."""
    if not amount_str:
        return None, None
    s = amount_str.replace("$", "").replace(",", "").strip()
    # Common buckets
    buckets = {
        "$1 - $1,000": (1, 1000),
        "$1,001 - $15,000": (1001, 15000),
        "$15,001 - $50,000": (15001, 50000),
        "$50,001 - $100,000": (50001, 100000),
        "$100,001 - $250,000": (100001, 250000),
        "$250,001 - $500,000": (250001, 500000),
        "$500,001 - $1,000,000": (500001, 1000000),
        "$1,000,001 - $5,000,000": (1000001, 5000000),
        "Over $5,000,000": (5000001, None),
    }
    for key, (lo, hi) in buckets.items():
        if key.lower() in s.lower() or s.lower() in key.lower():
            return lo, hi
    # Try to parse a single number
    try:
        n = int(s.split("-")[0].strip())
        return n, n
    except (ValueError, IndexError):
        return None, None


def parse_filing_xml(xml_text: str) -> list[dict]:
    """Parse a PTR XML document. Returns a list of transaction dicts.

    The Senate eopds publishes PTRs as XML. Schema is at:
    https://eopds.senate.gov/static/XML/filing.xsd
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"   WARN: XML parse error: {e}", file=sys.stderr)
        return []

    transactions = []
    # Find all <Transaction> elements
    for txn in root.iter("Transaction"):
        try:
            t_date_str = (txn.findtext("TransactionDate") or "").strip()
            t_date = date.fromisoformat(t_date_str) if t_date_str else None
            if not t_date:
                continue
            ticker = (txn.findtext("Ticker") or "").strip() or None
            asset = (txn.findtext("AssetName") or "").strip() or "Unknown"
            owner = (txn.findtext("Owner") or "").strip()
            tx_type = (txn.findtext("TransactionType") or "").strip().lower()
            if tx_type in ("purchase", "buy"):
                tx_type = "buy"
            elif tx_type in ("sale", "sell"):
                tx_type = "sell"
            else:
                tx_type = "exchange"
            amount_str = (txn.findtext("Amount") or "").strip()
            low, high = parse_amount_range(amount_str)
            transactions.append({
                "transaction_date": t_date.isoformat(),
                "ticker": ticker,
                "asset_description": f"{asset} ({owner})" if owner else asset,
                "transaction_type": tx_type,
                "amount_low": low,
                "amount_high": high,
            })
        except Exception as e:
            continue
    return transactions


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--months", type=int, default=SCORE_LOOKBACK_MONTHS)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=args.months * 30)
    print(f"== Ingesting Senate STOCK Act trades (cutoff {cutoff}) ==")
    print(f"   source: {EOPDS_BASE}")

    sb = get_supabase_admin()

    # Get active senators
    res = sb.table("senators").select("id, bioguide_id, full_name, last_name").eq("is_active", True).execute()
    senators = res.data or []
    if args.limit:
        senators = senators[: args.limit]
    print(f"   fetching trades for {len(senators)} senators")

    # Strategy: for each senator, pull filings for each year in the lookback.
    current_year = date.today().year
    years_to_check = list(range(cutoff.year, current_year + 1))

    all_rows: list[dict] = []
    errors = 0

    for i, sen in enumerate(senators):
        sen_rows: list[dict] = []
        for yr in years_to_check:
            filings = fetch_senator_filings(sen["bioguide_id"], yr)
            for filing in filings:
                # Filter to PTRs only
                if "PTR" not in (filing.get("type") or "").upper() and "periodic" not in (filing.get("type") or "").lower():
                    continue
                xml_url = filing.get("url") or filing.get("xml_url")
                if not xml_url:
                    continue
                try:
                    from _common import urllib_request
                    req = urllib_request(xml_url)
                    import urllib.request
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        xml_text = resp.read().decode("utf-8", errors="ignore")
                except Exception as e:
                    continue
                for txn in parse_filing_xml(xml_text):
                    if txn["transaction_date"] < cutoff.isoformat():
                        continue
                    txn["senator_id"] = sen["id"]
                    txn["source_filing_id"] = filing.get("id")
                    txn["source_url"] = xml_url
                    sen_rows.append(txn)
            time.sleep(0.1)  # polite
        all_rows.extend(sen_rows)
        if (i + 1) % 10 == 0:
            print(f"   ... {i+1}/{len(senators)} processed, {len(all_rows)} trades so far")

    print(f"   collected {len(all_rows)} trade rows")

    if args.dry:
        report_run("senator_trades", 0, 0, len(all_rows), 0, dry=True)
        return 0

    # Wipe + re-insert is simplest because we don't have a natural unique key
    # besides (senator_id, ticker, transaction_date, transaction_type, amount).
    # We add a composite dedupe.
    seen: set = set()
    deduped: list[dict] = []
    for r in all_rows:
        k = (r["senator_id"], r.get("ticker"), r["transaction_date"], r["transaction_type"], r.get("amount_low"), r.get("asset_description"))
        if k in seen:
            continue
        seen.add(k)
        deduped.append(r)

    inserted, db_errors = 0, 0
    for chunk in chunked(deduped, 200):
        try:
            res = sb.table("senator_trades").upsert(
                chunk,
                on_conflict="senator_id,transaction_date,ticker,transaction_type,amount_low",
            ).execute()
            inserted += len(res.data or [])
        except Exception:
            # Fallback: insert one by one
            for r in chunk:
                try:
                    sb.table("senator_trades").insert(r).execute()
                    inserted += 1
                except Exception:
                    db_errors += 1

    report_run("senator_trades", inserted, 0, 0, db_errors)
    return 0 if db_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
