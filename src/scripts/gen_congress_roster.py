#!/usr/bin/env python3
"""
Generate the canonical congressional roster for SlushFund's 10-year backfill.

Source: unitedstates/congress-legislators (public domain), the authoritative
machine-readable roster of every member of Congress. We pull current + historical
JSON and keep anyone who served at any point in the 2016-2026 backfill window.

Output: src/data/congress_roster.json  — consumed by:
  - src/lib/congress-members.ts        (TS roster)
  - src/scripts/backfill_congress_trades.py and the other scrapers (Python roster)

Usage: python3 src/scripts/gen_congress_roster.py
Stdlib only — no venv required.
"""

import json
import os
import sys
import urllib.request
from datetime import date

WINDOW_START = date(2016, 1, 1)
WINDOW_END = date(2026, 12, 31)

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
    "PR": "Puerto Rico", "GU": "Guam", "VI": "U.S. Virgin Islands",
    "AS": "American Samoa", "MP": "Northern Mariana Islands",
}

SOURCES = {
    "current": "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    "historical": "https://unitedstates.github.io/congress-legislators/legislators-historical.json",
}

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "congress_roster.json")


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "slushfund-roster/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_date(s: str) -> date:
    return date.fromisoformat(s)


def normalize_party(p: str) -> str:
    if not p:
        return "Independent"
    p = p.strip()
    if p.startswith("Democrat"):
        return "Democrat"
    if p.startswith("Republican"):
        return "Republican"
    return "Independent"


def in_window(term: dict) -> bool:
    try:
        start = parse_date(term["start"])
        end = parse_date(term["end"])
    except (KeyError, ValueError):
        return False
    return start <= WINDOW_END and end >= WINDOW_START


def build_roster():
    members = {}  # bioguide_id -> member dict
    for label, url in SOURCES.items():
        print(f"Fetching {label}: {url}")
        data = fetch(url)
        print(f"  {len(data)} legislators")
        for person in data:
            bioguide = person.get("id", {}).get("bioguide")
            if not bioguide:
                continue
            name = person.get("name", {})
            full_name = name.get("official_full") or " ".join(
                x for x in [name.get("first"), name.get("last")] if x
            )
            window_terms = [t for t in person.get("terms", []) if in_window(t)]
            if not window_terms:
                continue
            # most recent in-window term defines current chamber/state/district/party
            term = max(window_terms, key=lambda t: t["start"])
            chamber = "Senate" if term.get("type") == "sen" else "House"
            entry = {
                "name": full_name,
                "first_name": name.get("first", ""),
                "last_name": name.get("last", ""),
                "bioguide_id": bioguide,
                "chamber": chamber,
                "state": term.get("state", ""),
                "state_name": STATE_NAMES.get(term.get("state", ""), term.get("state", "")),
                "party": normalize_party(term.get("party", "")),
            }
            if chamber == "House":
                entry["district"] = str(term.get("district", "0"))
            # historical file may re-list someone; current wins (processed last? no —
            # current is processed first). Keep the entry with the latest term start.
            existing = members.get(bioguide)
            if existing is None or term["start"] > existing["_term_start"]:
                entry["_term_start"] = term["start"]
                members[bioguide] = entry

    roster = []
    for m in members.values():
        m.pop("_term_start", None)
        roster.append(m)
    roster.sort(key=lambda m: (m["chamber"], m["state"], m["name"]))
    return roster


def main():
    roster = build_roster()
    senate = [m for m in roster if m["chamber"] == "Senate"]
    house = [m for m in roster if m["chamber"] == "House"]
    out = {
        "generated": date.today().isoformat(),
        "source": "unitedstates/congress-legislators",
        "window": [WINDOW_START.year, WINDOW_END.year],
        "counts": {"total": len(roster), "senate": len(senate), "house": len(house)},
        "members": roster,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"\nWrote {len(roster)} members ({len(senate)} Senate, {len(house)} House)")
    print(f"  -> {os.path.relpath(OUT_PATH)}")


if __name__ == "__main__":
    sys.exit(main())
