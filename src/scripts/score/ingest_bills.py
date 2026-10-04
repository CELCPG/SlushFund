#!/usr/bin/env python3
"""
Ingest Senate bill sponsorship + cosponsorship data from the ProPublica Congress API.

Endpoint:
  GET /congress/v1/members/{bioguide}/bills/introduced.json
  → list of bills sponsored or cosponsored by this senator

For each bill we record:
  - senator_id
  - bill_id (ProPublica format: e.g. "s.1234-118")
  - role (sponsor / cosponsor)
  - introduced_date
  - bipartisan_cosponsors (count of cosponsors from opposing party)
  - passed_chamber (true if the bill passed at least one chamber)
  - signed_into_law (true if signed)

PROPUBLICA_API_KEY must be set. Without it, this script is a no-op.

Usage:
  python3 ingest_bills.py
  python3 ingest_bills.py --dry
  python3 ingest_bills.py --months 6
"""

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

from _common import (
    SCORE_LOOKBACK_MONTHS, chunked, get_supabase_admin, report_run,
)

PROPUBLICA_BASE = "https://api.propublica.org/congress/v1"
API_KEY = os.environ.get("PROPUBLICA_API_KEY", "")


def fetch_member_bills(bioguide: str) -> list:
    """GET /members/{bioguide}/bills/introduced.json — last 24mo sponsored/cosponsored."""
    from _common import urllib_request
    import urllib.request
    url = f"{PROPUBLICA_BASE}/members/{bioguide}/bills/introduced.json"
    try:
        req = urllib_request(url)
        req.add_header("X-API-Key", API_KEY)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"   WARN: {bioguide}: {e}", file=sys.stderr)
        return []
    return (data.get("results") or [{}])[0].get("bills") or []


def parse_intro_date(s: str) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--months", type=int, default=SCORE_LOOKBACK_MONTHS)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not API_KEY:
        print("  ⚠ PROPUBLICA_API_KEY not set — skipping bills ingest")
        return 0

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=args.months * 30)
    print(f"== Ingesting Senate bill sponsorships (cutoff {cutoff}) ==")
    print(f"   source: {PROPUBLICA_BASE}/members/{{bioguide}}/bills/introduced.json")

    sb = get_supabase_admin()

    res = sb.table("senators").select("id, bioguide_id, full_name, party").eq("is_active", True).execute()
    senators = res.data or []
    if args.limit:
        senators = senators[: args.limit]
    print(f"   fetching bills for {len(senators)} senators")

    all_rows: list[dict] = []
    errors = 0

    for i, sen in enumerate(senators):
        bills = fetch_member_bills(sen["bioguide_id"])
        for b in bills:
            d = parse_intro_date(b.get("introduced_date", ""))
            if d is None or d < cutoff:
                continue
            all_rows.append({
                "senator_id": sen["id"],
                "bill_id": b.get("bill_id") or f"unknown-{d.isoformat()}",
                "role": b.get("sponsor") or "cosponsor",  # "sponsor" field name in ProPublica
                "introduced_date": d.isoformat(),
                "bipartisan_cosponsors": b.get("cosponsors", 0) or 0,  # raw count; refined in Pillar 4 scoring if needed
                "passed_chamber": bool(b.get("history", {}).get("passed_house") or b.get("history", {}).get("passed_senate")),
                "signed_into_law": bool(b.get("history", {}).get("signed_into_law")),
            })
        if (i + 1) % 10 == 0:
            print(f"   ... {i+1}/{len(senators)} processed, {len(all_rows)} bills so far")
        time.sleep(0.2)

    print(f"   collected {len(all_rows)} bill rows")

    if args.dry:
        report_run("senator_bills", 0, 0, len(all_rows), 0, dry=True)
        return 0

    inserted, db_errors = 0, 0
    for chunk in chunked(all_rows, 200):
        try:
            res = sb.table("senator_bills").upsert(
                chunk, on_conflict="senator_id,bill_id,role"
            ).execute()
            inserted += len(res.data or [])
        except Exception as e:
            print(f"   WARN: batch failed: {e}", file=sys.stderr)
            db_errors += len(chunk)

    report_run("senator_bills", inserted, 0, 0, db_errors)
    return 0 if db_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
