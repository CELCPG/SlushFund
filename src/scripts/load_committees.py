#!/usr/bin/env python3
"""
Load current congressional committee assignments into congress_members.committees.

Source: unitedstates/congress-legislators (public domain) — the same authoritative
project behind the roster. Committee jurisdiction is the backbone of the conflict
engine: a member trading a stock their committee oversees is an inherent conflict.

Note: only *current* committee membership is published cleanly, so trades are
scored against present-day assignments (see compute_conflicts.py).

Usage: python3 src/scripts/load_committees.py
"""

import json
import os
import sys
import urllib.request

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
UA = "slushfund-committees/1.0"

COMMITTEES_URL = "https://unitedstates.github.io/congress-legislators/committees-current.json"
MEMBERSHIP_URL = "https://unitedstates.github.io/congress-legislators/committee-membership-current.json"


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not set")
        return 1
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    committees = fetch(COMMITTEES_URL)
    membership = fetch(MEMBERSHIP_URL)
    print(f"Fetched {len(committees)} committees, {len(membership)} membership lists")

    # thomas_id (4-char top-level) -> committee name
    id_to_name = {}
    for c in committees:
        tid = c.get("thomas_id")
        if tid:
            id_to_name[tid] = c.get("name", tid)

    # bioguide -> set of top-level committee names (subcommittee members roll up
    # to their parent committee — they still hold that jurisdiction)
    member_committees = {}
    for committee_id, members in membership.items():
        parent_name = id_to_name.get(committee_id[:4])
        if not parent_name:
            continue
        for m in members:
            bio = m.get("bioguide")
            if bio:
                member_committees.setdefault(bio, set()).add(parent_name)

    print(f"Resolved committee assignments for {len(member_committees)} members")

    # write back, keyed on bioguide_id
    updated = 0
    for bio, names in member_committees.items():
        try:
            res = (
                sb.table("congress_members")
                .update({"committees": sorted(names)})
                .eq("bioguide_id", bio)
                .execute()
            )
            if res.data:
                updated += len(res.data)
        except Exception as e:  # noqa: BLE001
            print(f"  update error for {bio}: {e}")

    print(f"\nUpdated committees on {updated} congress_members rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
