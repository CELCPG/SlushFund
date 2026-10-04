#!/usr/bin/env python3
"""
Ingest Senate vote records from the ProPublica Congress API.

ProPublica exposes:
  GET https://api.propublica.org/congress/v1/{congress}/senate/sessions/{session}/votes/{roll-call}.json
  GET https://api.propublica.org/congress/v1/members/{bioguide}/votes.json

We use the member-level endpoint (one call per senator → 100 calls/week) and the
nominal vote endpoint to fetch detailed roll-call data for major bills.

PROPUBLICA_API_KEY must be set in the env. Without it, this script is a no-op
and prints a warning. SlushFund has a key in .env.local.

For each vote we store:
  - senator_id
  - bill_id
  - vote_date
  - vote_position ('yea'/'nay'/'not_voting'/'present')
  - bill_title
  - is_major_bill  (heuristic: roll calls with >100 yes+no votes, or cloture votes)

Phase 1: We store raw votes. Constituency polling (Pillar 1) is Phase 2.
Phase 1 marks every major bill's is_major_bill = true and the poll fields stay NULL.
Pillar 1 is therefore naturally zeroed in compute_scores() until Phase 2 lands.

Usage:
  python3 ingest_votes.py                # backfill last 24 months
  python3 ingest_votes.py --dry          # summary, no writes
  python3 ingest_votes.py --months 6     # override lookback
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

from _common import (
    SCORE_LOOKBACK_MONTHS, chunked, get_supabase_admin, report_run,
)

PROPUBLICA_BASE = "https://api.propublica.org/congress/v1"
API_KEY = os.environ.get("PROPUBLICA_API_KEY", "")


def fetch_member_votes(bioguide: str) -> list:
    """GET /members/{bioguide}/votes.json — last 24mo of votes."""
    from _common import fetch_json
    if not API_KEY:
        return []
    url = f"{PROPUBLICA_BASE}/members/{bioguide}/votes.json"
    try:
        from _common import urllib_request
        req = urllib_request(url)
        req.add_header("X-API-Key", API_KEY)
        import urllib.request
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"   WARN: {bioguide}: {e}", file=sys.stderr)
        return []
    return (data.get("results") or [{}])[0].get("votes") or []


def parse_vote_date(v: dict) -> date | None:
    """ProPublica returns ISO timestamps like 2024-09-25T17:30:00."""
    dt = v.get("date") or ""
    if not dt:
        return None
    try:
        return date.fromisoformat(dt[:10])
    except ValueError:
        return None


def is_major_bill(v: dict) -> bool:
    """Heuristic: roll calls with >100 votes, or tagged as cloture / passage."""
    total = (v.get("total") or {}).get("yes", 0) + (v.get("total") or {}).get("no", 0)
    desc = (v.get("description") or "").lower()
    if total >= 95:  # ~all senators voted → likely a major bill
        return True
    if "cloture" in desc or "passage" in desc:
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--months", type=int, default=SCORE_LOOKBACK_MONTHS)
    ap.add_argument("--limit", type=int, default=0, help="limit to N senators (testing)")
    args = ap.parse_args()

    if not API_KEY:
        print("  ⚠ PROPUBLICA_API_KEY not set — skipping votes ingest")
        return 0

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=args.months * 30)
    print(f"== Ingesting Senate votes (cutoff {cutoff}, {args.months}mo lookback) ==")
    print(f"   source: {PROPUBLICA_BASE}/members/{{bioguide}}/votes.json")

    sb = get_supabase_admin()

    # Get the active senator list
    res = sb.table("senators").select("id, bioguide_id, full_name").eq("is_active", True).execute()
    senators = res.data or []
    if args.limit:
        senators = senators[: args.limit]
    print(f"   fetching votes for {len(senators)} senators")

    all_rows: list[dict] = []
    errors = 0

    for i, sen in enumerate(senators):
        votes = fetch_member_votes(sen["bioguide_id"])
        kept = 0
        for v in votes:
            d = parse_vote_date(v)
            if d is None or d < cutoff:
                continue
            position = v.get("position") or "not_voting"
            if position not in ("yea", "nay", "not_voting", "present"):
                position = "not_voting"
            all_rows.append({
                "senator_id": sen["id"],
                "bill_id": v.get("bill", {}).get("bill_id") or v.get("roll_call", ""),
                "vote_date": d.isoformat(),
                "vote_position": position,
                "bill_title": (v.get("description") or "")[:500],
                "is_major_bill": is_major_bill(v),
            })
            kept += 1
        if (i + 1) % 10 == 0:
            print(f"   ... {i+1}/{len(senators)} processed, {len(all_rows)} votes so far")
        # ProPublica free tier: 5000/day. Pace at 5 req/sec to be polite.
        time.sleep(0.2)

    print(f"   collected {len(all_rows)} vote rows")

    if args.dry:
        report_run("senator_votes", 0, 0, len(all_rows), 0, dry=True)
        return 0

    inserted, db_errors = 0, 0
    for chunk in chunked(all_rows, 200):
        try:
            res = sb.table("senator_votes").upsert(
                chunk, on_conflict="senator_id,bill_id"
            ).execute()
            inserted += len(res.data or [])
        except Exception as e:
            print(f"   WARN: batch failed: {e}", file=sys.stderr)
            db_errors += len(chunk)

    report_run("senator_votes", inserted, 0, 0, db_errors)
    return 0 if db_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
