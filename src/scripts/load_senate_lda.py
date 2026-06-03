#!/usr/bin/env python3
"""
Senate LDA (Lobbying Disclosure Act) loader.

Pulls federal lobbying filings from the official Senate Office of Public Records
REST API (https://lda.senate.gov/api/) — free, no scraping required. An API key
raises the rate limit but is optional for light use.

Outputs two JSON files consumed by /lobbying:
  src/data/lobbying/lda_top_spenders.json  → top lobbying clients by spend
  src/data/lobbying/lda_by_issue.json      → spend aggregated by issue area

Usage:
  python3 load_senate_lda.py                 # current year, write JSON
  python3 load_senate_lda.py --year 2024
  python3 load_senate_lda.py --dry           # print summary, don't write
  python3 load_senate_lda.py --pages 20      # how many 25-row API pages to pull

Env:
  LDA_API_KEY   optional — get one free at https://lda.senate.gov/api/register/
"""

import argparse
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

from _venv import activate as _activate_venv

_activate_venv()

API_BASE = "https://lda.senate.gov/api/v1/filings/"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "lobbying")


def _request(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "SlushFund/1.0"})
    key = os.environ.get("LDA_API_KEY")
    if key:
        req.add_header("Authorization", f"Token {key}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_filings(year: int, pages: int):
    """Yield filing dicts from the LDA API for a given filing year."""
    for page in range(1, pages + 1):
        qs = urllib.parse.urlencode({"filing_year": year, "page": page, "page_size": 25})
        url = f"{API_BASE}?{qs}"
        try:
            data = _request(url)
        except Exception as e:  # noqa: BLE001
            print(f"  ! page {page} failed: {e}", file=sys.stderr)
            break
        results = data.get("results", [])
        if not results:
            break
        for f in results:
            yield f
        if not data.get("next"):
            break


def amount(filing: dict) -> int:
    raw = filing.get("income") or filing.get("expenses") or 0
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return 0


def aggregate(year: int, pages: int):
    by_client = defaultdict(lambda: {"amount": 0, "filings": 0, "registrant": ""})
    by_issue = defaultdict(lambda: {"amount": 0, "filings": 0, "code": ""})

    n = 0
    for f in fetch_filings(year, pages):
        n += 1
        amt = amount(f)
        client = (f.get("client") or {}).get("name") or "Unknown"
        registrant = (f.get("registrant") or {}).get("name") or ""
        c = by_client[client]
        c["amount"] += amt
        c["filings"] += 1
        c["registrant"] = registrant or c["registrant"]

        for activity in f.get("lobbying_activities", []) or []:
            issue = activity.get("general_issue_code_display") or activity.get("general_issue_code") or "Other"
            code = activity.get("general_issue_code") or ""
            i = by_issue[issue]
            # Attribute the filing amount across its issues (avoids double-count blow-up).
            acts = max(1, len(f.get("lobbying_activities", []) or []))
            i["amount"] += amt // acts
            i["filings"] += 1
            i["code"] = code or i["code"]

    print(f"  processed {n} filings")
    return by_client, by_issue


def to_sorted(d: dict, key_name: str, limit: int):
    rows = [{key_name: k, **v} for k, v in d.items()]
    rows.sort(key=lambda r: r["amount"], reverse=True)
    return rows[:limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=datetime.date.today().year)
    ap.add_argument("--pages", type=int, default=40)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    print(f"Fetching Senate LDA filings for {args.year} (up to {args.pages} pages)…")
    by_client, by_issue = aggregate(args.year, args.pages)

    spenders = to_sorted(by_client, "client", 20)
    issues = to_sorted(by_issue, "issue", 10)

    meta = {
        "source": "https://lda.senate.gov/api/v1/filings/ (Senate Office of Public Records, LDA)",
        "cycle": str(args.year),
        "generated": datetime.date.today().isoformat(),
        "note": "Regenerate with: python3 src/scripts/load_senate_lda.py",
    }
    spenders_doc = {**meta, "data": spenders}
    issues_doc = {**meta, "data": issues}

    if args.dry:
        print(json.dumps({"top_spenders": spenders[:5], "by_issue": issues[:5]}, indent=2))
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "lda_top_spenders.json"), "w") as f:
        json.dump(spenders_doc, f, indent=2)
    with open(os.path.join(OUT_DIR, "lda_by_issue.json"), "w") as f:
        json.dump(issues_doc, f, indent=2)
    print(f"Wrote {len(spenders)} spenders + {len(issues)} issues to {OUT_DIR}")


if __name__ == "__main__":
    main()
