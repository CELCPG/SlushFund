#!/usr/bin/env python3
"""
OpenSecrets scraper for lobbying data.
Scrapes 4 pages from opensecrets.org using Playwright and saves JSON.

Pages:
  /federal-lobbying/ranked-sectors   → sector totals
  /federal-lobbying/industries        → industry totals ( pharma = Pharmaceuticals/Health Products)
  /federal-lobbying/top-spenders     → top lobbying clients (PhRMA, Pfizer, etc.)
  /federal-lobbying/top-recipients    → congress members receiving lobby cash

Usage:
  python3 scrape_opensecrets.py         # scrape all 4 pages
  python3 scrape_opensecrets.py --dry  # print without writing
"""

import sys
import os
import json
import argparse

from _venv import activate as _activate_venv
_activate_venv()

from playwright.sync_api import sync_playwright

BASE = "https://www.opensecrets.org"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'opensecrets')

PAGES = [
    {
        "slug": "ranked-sectors",
        "url": f"{BASE}/federal-lobbying/ranked-sectors",
        "filename": "ranked_sectors.json",
        "table_idx": 0,
    },
    {
        "slug": "industries",
        "url": f"{BASE}/federal-lobbying/industries",
        "filename": "industries.json",
        "table_idx": 0,
    },
    {
        "slug": "top-spenders",
        "url": f"{BASE}/federal-lobbying/top-spenders",
        "filename": "top_spenders.json",
        "table_idx": 0,
    },
    {
        "slug": "top-recipients",
        "url": f"{BASE}/federal-lobbying/top-recipients",
        "filename": "top_recipients.json",
        "table_idx": 0,
    },
]


def parse_table(page, table_idx: int = 0):
    """Extract rows from a page table. Returns list of dicts with header keys."""
    tables = page.query_selector_all("table")
    if not tables:
        return []
    table = tables[table_idx]
    headers = [th.inner_text().strip() for th in table.query_selector_all("thead th")]
    if not headers:
        # sometimes headers are in first row
        headers = [th.inner_text().strip() for th in table.query_selector_all("tr:first-child td")]
    rows = []
    for tr in table.query_selector_all("tbody tr"):
        cells = [td.inner_text().strip() for td in tr.query_selector_all("td")]
        if cells and len(cells) == len(headers):
            rows.append(dict(zip(headers, cells)))
    return rows


def scrape_page(url: str, table_idx: int = 0, dry: bool = False):
    """Load a page with Playwright, parse table, return rows."""
    print(f"  Fetching: {url}")
    data = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until='networkidle', timeout=30000)
        # Wait for table to render
        page.wait_for_timeout(3000)
        html = page.content()
        tables = page.query_selector_all("table")
        print(f"  → HTML length: {len(html)}, tables found: {len(tables)}")
        if not tables:
            # Print first 500 chars of body for debug
            body = page.query_selector("body")
            if body:
                print(f"  body snippet: {body.inner_text()[:500]}")
        data = parse_table(page, table_idx)
        browser.close()
    print(f"  → {len(data)} rows")
    return data


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    dry = "--dry" in sys.argv or "--dry-run" in sys.argv

    for page_def in PAGES:
        slug = page_def["slug"]
        url = page_def["url"]
        fname = page_def["filename"]
        tidx = page_def["table_idx"]

        print(f"\n[{slug}]")
        rows = scrape_page(url, tidx)

        if not rows:
            print(f"  ⚠️  No data scraped — check selectors")
            continue

        out = {
            "source": url,
            "slug": slug,
            "count": len(rows),
            "data": rows,
        }

        if not dry:
            fpath = os.path.join(OUT_DIR, fname)
            with open(fpath, "w") as f:
                json.dump(out, f, indent=2)
            print(f"  ✓ Saved → {fpath}")
        else:
            print(f"  [dry] Would write {len(rows)} rows to {fname}")
            print(json.dumps(rows[:3], indent=2))

    print("\n✅ Done")


if __name__ == "__main__":
    main()