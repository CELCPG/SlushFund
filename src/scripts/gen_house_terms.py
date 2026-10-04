#!/usr/bin/env python3
"""
Generate src/data/house_terms.json: every U.S. House term (2015-2026) from
unitedstates/congress-legislators, one row per term.

load_bulk_trades.py uses it to match a House Clerk PTR filing (last name, state,
district, filing date) to a bioguide id and the party the member held *at that
time*. congress_roster.json cannot do this: it keeps one row per person (their
latest term), so members who moved to the Senate, changed district or switched
party do not match.

Usage: python3 src/scripts/gen_house_terms.py   (stdlib only)
"""

import json
import os
import sys
import urllib.request
from datetime import date

SOURCES = (
    "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    "https://unitedstates.github.io/congress-legislators/legislators-historical.json",
)
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "house_terms.json")
WINDOW_START = "2015-01-01"
WINDOW_END = "2026-12-31"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "slushfund-roster/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def party(p):
    p = (p or "").strip()
    if p.startswith("Democrat"):
        return "Democrat"
    if p.startswith("Republican"):
        return "Republican"
    return "Independent"


def main():
    terms = []
    seen = set()
    for url in SOURCES:
        data = fetch(url)
        print(f"{url.rsplit('/', 1)[-1]}: {len(data)} legislators")
        for person in data:
            bio = person.get("id", {}).get("bioguide")
            if not bio or bio in seen:
                continue
            seen.add(bio)
            name = person.get("name", {})
            for t in person.get("terms", []):
                if t.get("type") != "rep":
                    continue
                if t["end"] < WINDOW_START or t["start"] > WINDOW_END:
                    continue
                terms.append({
                    "bioguide_id": bio,
                    "first": name.get("first", ""),
                    "middle": name.get("middle", ""),
                    "last": name.get("last", ""),
                    "nickname": name.get("nickname", ""),
                    "official_full": name.get("official_full", ""),
                    "state": t["state"],
                    "district": str(t.get("district", 0)),
                    "party": party(t.get("party")),
                    "start": t["start"],
                    "end": t["end"],
                })
    terms.sort(key=lambda t: (t["state"], t["last"], t["start"]))
    out = {"generated": date.today().isoformat(), "source": "unitedstates/congress-legislators",
           "count": len(terms), "terms": terms}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(f"Wrote {len(terms)} House terms -> {os.path.relpath(OUT_PATH)}")


if __name__ == "__main__":
    sys.exit(main())
