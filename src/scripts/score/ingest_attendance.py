#!/usr/bin/env python3
"""
Ingest Senate attendance: missed votes and floor speech counts.

Source: ProPublica Congress API
  GET /congress/v1/members/{bioguide}.json
  → member detail including:
    - missed_votes_pct
    - missed_votes
    - total_votes
    - ocd-id (for cross-referencing)

Floor speech counts: not exposed by ProPublica. We approximate via the
senate.gov floor活动 log, or — for Phase 1 — we record a 0 for speeches
and let Pillar 5 degrade gracefully (attendance subscore is 12/20, speeches
is 8/20). Phase 2 will scrape the speech log.

For each senator we record:
  - senator_id
  - week_of (today)
  - missed_votes_pct
  - total_votes
  - missed_votes
  - speeches_count (Phase 1: 0)

Usage:
  python3 ingest_attendance.py
  python3 ingest_attendance.py --dry
"""

import argparse
import json
import os
import sys
import time
from datetime import date

from _common import (
    chunked, get_supabase_admin, report_run,
)

PROPUBLICA_BASE = "https://api.propublica.org/congress/v1"
API_KEY = os.environ.get("PROPUBLICA_API_KEY", "")


def fetch_member_detail(bioguide: str) -> dict | None:
    """GET /members/{bioguide}.json — returns the latest role's stats."""
    from _common import urllib_request
    import urllib.request
    url = f"{PROPUBLICA_BASE}/members/{bioguide}.json"
    try:
        req = urllib_request(url)
        req.add_header("X-API-Key", API_KEY)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"   WARN: {bioguide}: {e}", file=sys.stderr)
        return None
    results = data.get("results") or []
    if not results:
        return None
    # Find a Senate role
    for r in results:
        if r.get("role") == "Senator" or "Senate" in (r.get("chamber") or ""):
            return r
    return results[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not API_KEY:
        print("  ⚠ PROPUBLICA_API_KEY not set — skipping attendance ingest")
        return 0

    week_of = date.today().isoformat()
    print(f"== Ingesting Senate attendance (week_of {week_of}) ==")
    print(f"   source: {PROPUBLICA_BASE}/members/{{bioguide}}.json")

    sb = get_supabase_admin()

    res = sb.table("senators").select("id, bioguide_id, full_name").eq("is_active", True).execute()
    senators = res.data or []
    if args.limit:
        senators = senators[: args.limit]
    print(f"   fetching attendance for {len(senators)} senators")

    all_rows: list[dict] = []
    errors = 0

    for i, sen in enumerate(senators):
        detail = fetch_member_detail(sen["bioguide_id"])
        if not detail:
            errors += 1
            continue
        all_rows.append({
            "senator_id": sen["id"],
            "week_of": week_of,
            "missed_votes_pct": float(detail.get("missed_votes_pct") or 0),
            "total_votes": int(detail.get("total_votes") or 0),
            "missed_votes": int(detail.get("missed_votes") or 0),
            "speeches_count": 0,  # Phase 2 will populate from senate.gov speech log
        })
        if (i + 1) % 10 == 0:
            print(f"   ... {i+1}/{len(senators)} processed")
        time.sleep(0.2)

    print(f"   collected {len(all_rows)} attendance rows")

    if args.dry:
        report_run("senator_attendance", 0, 0, len(all_rows), 0, dry=True)
        return 0

    inserted, db_errors = 0, 0
    for chunk in chunked(all_rows, 200):
        try:
            res = sb.table("senator_attendance").upsert(
                chunk, on_conflict="senator_id,week_of"
            ).execute()
            inserted += len(res.data or [])
        except Exception as e:
            print(f"   WARN: batch failed: {e}", file=sys.stderr)
            db_errors += len(chunk)

    report_run("senator_attendance", inserted, 0, 0, db_errors)
    return 0 if db_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
