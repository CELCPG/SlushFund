#!/usr/bin/env python3
"""
Seed the congress_members table from the canonical roster.

Reads src/data/congress_roster.json (refresh via gen_congress_roster.py) and
upserts every 2016-2026 member into Supabase, keyed on bioguide_id.

Usage: python3 src/scripts/seed_congress_members.py
"""

import json
import os
import sys

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ROSTER_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "congress_roster.json")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    with open(ROSTER_PATH) as f:
        members = json.load(f)["members"]

    rows = []
    for m in members:
        rows.append({
            "name": m["name"],
            "first_name": m.get("first_name", ""),
            "last_name": m.get("last_name", ""),
            "party": m["party"],
            "chamber": m["chamber"],
            "state": m["state"],
            "state_name": m.get("state_name", m["state"]),
            "district": m.get("district"),
            "title": "Senator" if m["chamber"] == "Senate" else "Representative",
            "bioguide_id": m["bioguide_id"],
        })

    written = 0
    for i in range(0, len(rows), 200):
        batch = rows[i:i + 200]
        sb.table("congress_members").upsert(batch, on_conflict="bioguide_id").execute()
        written += len(batch)
        print(f"  upserted {written}/{len(rows)}")

    print(f"\nSeeded {written} congress members.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
