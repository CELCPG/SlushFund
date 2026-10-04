#!/usr/bin/env python3
"""
Ingest the canonical Senate roster from Bioguide + unitedstates/congress-legislators.

Bioguide (https:// bioguide.congress.gov) is the Library of Congress's authoritative
source. The unitedstates/congress-legislators project mirrors Bioguide + adds
contact info, terms, and party history. We use the latter because it has stable
JSON and includes current Senators plus historical data we may want later.

Source: https://unitedstates.github.io/congress-legislators/legislators-current.json
Backup: https://bioguide.congress.gov/search/

For each current Senator we extract:
  - bioguide_id       (stable primary key)
  - name_slug         (URL-friendly name)
  - full_name         (display name)
  - first/last name   (parsed)
  - state             (2-letter)
  - party             (R/D/I, derived)
  - photo_url         (Bioguide official photo)
  - term_start/end    (current Senate term)
  - is_active         (true for all current Senators)

Writes to: `senators` table in Supabase.

Usage:
  python3 ingest_senators.py             # ingest all 100 current senators
  python3 ingest_senators.py --dry       # show summary, no writes
"""

import argparse
import json
import os
import sys
from datetime import date

from _common import (
    chunked, get_supabase_admin, report_run,
    short_party, slugify_senator,
)

ROSTER_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json"


def fetch_legislators() -> list:
    """Fetch the legislators-current.json file. Returns a list of dicts."""
    from _common import fetch_json
    data = fetch_json(ROSTER_URL)
    if not isinstance(data, list):
        print(f"  ERROR: Expected list, got {type(data).__name__}", file=sys.stderr)
        sys.exit(1)
    return data


def is_current_senator(leg: dict) -> bool:
    """A legislator is a 'current senator' if the last term in their terms list
    is type 'sen' and end date is in the future (or end date is null/missing)."""
    terms = leg.get("terms", [])
    if not terms:
        return False
    last = terms[-1]
    if last.get("type") != "sen":
        return False
    end = last.get("end")
    if not end:
        return True  # no end date → treat as current
    try:
        y, m, d = (int(x) for x in end.split("-"))
        return date(y, m, d) >= date.today()
    except (ValueError, AttributeError):
        return False


def parse_term_dates(leg: dict) -> tuple:
    """Return (term_start, term_end) for the most recent Senate term."""
    for t in reversed(leg.get("terms", [])):
        if t.get("type") == "sen":
            start = t.get("start")
            end = t.get("end")
            return start, end
    return None, None


def build_senator_row(leg: dict) -> dict | None:
    name = (leg.get("name") or {}).get("official_full") or (leg.get("name") or {}).get("full")
    if not name:
        return None
    bioguide = leg.get("id", {}).get("bioguide")
    if not bioguide:
        return None

    bio = leg.get("bio", {}) or {}
    first = bio.get("first_name", "")
    last = bio.get("last_name", "")

    term_start, term_end = parse_term_dates(leg)

    photo_url = f"https://bioguide.congress.gov/bioguide/photo/{bioguide[0].upper()}/{bioguide}.jpg"

    # Party lives on the most recent term, not in bio.party_history
    # (bio.party_history is null in this dataset; check terms last item).
    last_term = (leg.get("terms") or [{}])[-1]
    party = short_party(last_term.get("party", "Independent"))

    return {
        "bioguide_id": bioguide,
        "name_slug": slugify_senator(name),
        "full_name": name,
        "first_name": first,
        "last_name": last,
        "state": (leg.get("terms", [{}])[-1].get("state") or "").upper(),
        "party": party,
        "photo_url": photo_url,
        "term_start": term_start,
        "term_end": term_end,
        "is_active": True,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="print summary, no writes")
    args = ap.parse_args()

    print("== Ingesting Senate roster from unitedstates/congress-legislators ==")
    print(f"   source: {ROSTER_URL}")

    legislators = fetch_legislators()
    print(f"   fetched {len(legislators)} total legislators")

    senators = [build_senator_row(l) for l in legislators if is_current_senator(l)]
    senators = [s for s in senators if s is not None]
    print(f"   current senators: {len(senators)}")

    # Quick state/party distribution sanity
    by_state: dict[str, int] = {}
    by_party: dict[str, int] = {}
    for s in senators:
        by_state[s["state"]] = by_state.get(s["state"], 0) + 1
        by_party[s["party"]] = by_party.get(s["party"], 0) + 1
    print(f"   by party: {by_party}")
    print(f"   states covered: {len(by_state)}")

    if args.dry:
        print("\n   First 3 rows (DRY):")
        for s in senators[:3]:
            print(f"   - {s['full_name']} ({s['party']}-{s['state']}) bio={s['bioguide_id']}")
        report_run("senators", 0, 0, len(senators), 0, dry=True)
        return 0

    sb = get_supabase_admin()
    inserted, updated, errors = 0, 0, 0

    for chunk in chunked(senators, 50):
        # We don't know the row's internal id, so upsert on bioguide_id.
        try:
            # Use upsert with on_conflict. Supabase-py exposes this via upsert().
            res = sb.table("senators").upsert(chunk, on_conflict="bioguide_id").execute()
            inserted += len(res.data or [])
        except Exception as e:
            print(f"   ERROR: {e}", file=sys.stderr)
            errors += len(chunk)

    # Mark anyone not in the current list as inactive (so we don't score ex-senators)
    # Single SQL call does both: set is_active=true for the current list, false for everyone else.
    active_bioguides = [s["bioguide_id"] for s in senators]
    try:
        from _common import urllib_request  # not used here, but keeps the import pattern
        # Use the PostgREST rpc-style approach: update by is_active bulk first, then set
        # the active set back to true.
        # Step 1: deactivate everyone not in the active list.
        for chunk in chunked(active_bioguides, 100):
            # Use .in_ to mark active ones. Supabase-py: .in_(column, list)
            sb.table("senators").update({"is_active": True}).in_("bioguide_id", chunk).execute()
        # Step 2: deactivate everyone NOT in the active list.
        # We do this with a not-in query.
        all_res = sb.table("senators").select("bioguide_id").execute()
        all_bioguides = [r["bioguide_id"] for r in (all_res.data or [])]
        inactive_set = [b for b in all_bioguides if b not in set(active_bioguides)]
        for chunk in chunked(inactive_set, 100):
            sb.table("senators").update({"is_active": False}).in_("bioguide_id", chunk).execute()
    except Exception as e:
        print(f"   WARN: failed to sync is_active: {e}", file=sys.stderr)

    report_run("senators", inserted, updated, 0, errors)
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
