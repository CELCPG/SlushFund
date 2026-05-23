#!/usr/bin/env python3
"""
CapitolTrades scraper for congressional trading data.
Scrapes Senate + House members from CapitolTrades.com and writes to Supabase.
Uses Playwright for JavaScript-rendered pages.

Usage:
  python3 scrape_capitoltrades.py --chamber senate --years 2016 2025
  python3 scrape_capitoltrades.py --chamber house --years 2020 2025
  python3 scrape_capitoltrades.py --all  # Full backfill, takes hours
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime, timedelta
from typing import Optional

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client
from playwright.sync_api import sync_playwright

# ── Supabase client ───────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://jlyrczrtzhtgbsljilwh.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None

# ── Known high-volume Senate traders (2016-2025) ───────────────────────────────
SENATORS = [
    {'name': 'Elizabeth Warren', 'slug': 'warren-elizabeth', 'state': 'MA', 'party': 'Democrat'},
    {'name': 'Tommy Tuberville', 'slug': 'tuberville-tommy', 'state': 'AL', 'party': 'Republican'},
    {'name': 'John Kennedy', 'slug': 'kennedy-john', 'state': 'LA', 'party': 'Republican'},
    {'name': 'Mark Kelly', 'slug': 'kelly-mark', 'state': 'AZ', 'party': 'Democrat'},
    {'name': 'Tim Scott', 'slug': 'scott-tim', 'state': 'SC', 'party': 'Republican'},
    {'name': 'Josh Hawley', 'slug': 'hawley-josh', 'state': 'MO', 'party': 'Republican'},
    {'name': 'Ted Cruz', 'slug': 'cruz-ted', 'state': 'TX', 'party': 'Republican'},
    {'name': 'Marco Rubio', 'slug': 'rubio-marco', 'state': 'FL', 'party': 'Republican'},
    {'name': 'Rick Scott', 'slug': 'scott-rick', 'state': 'FL', 'party': 'Republican'},
    {'name': 'Mike Lee', 'slug': 'lee-mike', 'state': 'UT', 'party': 'Republican'},
    {'name': 'Tommy Tuberville', 'slug': 'tuberville-tommy', 'state': 'AL', 'party': 'Republican'},
    {'name': 'Cynthia Lummis', 'slug': 'lummis-cynthia', 'state': 'WY', 'party': 'Republican'},
    {'name': 'Bill Hagerty', 'slug': 'hagerty-bill', 'state': 'TN', 'party': 'Republican'},
    {'name': 'Roger Marshall', 'slug': 'marshall-roger', 'state': 'KS', 'party': 'Republican'},
    {'name': 'Deb Fischer', 'slug': 'fischer-deb', 'state': 'NE', 'party': 'Republican'},
    {'name': 'Lindsey Graham', 'slug': 'graham-lindsey', 'state': 'SC', 'party': 'Republican'},
    {'name': 'John Cornyn', 'slug': 'cornyn-john', 'state': 'TX', 'party': 'Republican'},
    {'name': 'John Thune', 'slug': 'thune-john', 'state': 'SD', 'party': 'Republican'},
    {'name': 'Mitch McConnell', 'slug': 'mcconnell-mitch', 'state': 'KY', 'party': 'Republican'},
    {'name': 'Dick Durbin', 'slug': 'durbin-dick', 'state': 'IL', 'party': 'Democrat'},
    {'name': 'Ron Wyden', 'slug': 'wyden-ron', 'state': 'OR', 'party': 'Democrat'},
    {'name': 'Sherrod Brown', 'slug': 'brown-sherrod', 'state': 'OH', 'party': 'Democrat'},
    {'name': 'Ben Cardin', 'slug': 'cardin-ben', 'state': 'MD', 'party': 'Democrat'},
    {'name': 'Sheldon Whitehouse', 'slug': 'whitehouse-sheldon', 'state': 'RI', 'party': 'Democrat'},
    {'name': 'Jeff Merkley', 'slug': 'merkley-jeff', 'state': 'OR', 'party': 'Democrat'},
    {'name': 'Chris Van Hollen', 'slug': 'van-hollen-chris', 'state': 'MD', 'party': 'Democrat'},
    {'name': 'Chris Coons', 'slug': 'coons-chris', 'state': 'DE', 'party': 'Democrat'},
    {'name': 'Bob Menendez', 'slug': 'menendez-bob', 'state': 'NJ', 'party': 'Democrat'},
    {'name': 'Catherine Cortez Masto', 'slug': 'cortez-masto-catherine', 'state': 'NV', 'party': 'Democrat'},
    {'name': 'Jacky Rosen', 'slug': 'rosen-jacky', 'state': 'NV', 'party': 'Democrat'},
]

# ── High-volume House traders ──────────────────────────────────────────────────
REPRESENTATIVES = [
    {'name': 'Nancy Pelosi', 'slug': 'pelosi-nancy', 'state': 'CA', 'district': '11', 'party': 'Democrat'},
    {'name': 'Matt Gaetz', 'slug': 'gaetz-matt', 'state': 'FL', 'district': '1', 'party': 'Republican'},
    {'name': 'Don Bacon', 'slug': 'bacon-don', 'state': 'NE', 'district': '2', 'party': 'Republican'},
    {'name': 'Elise Stefanik', 'slug': 'stefanik-elise', 'state': 'NY', 'district': '21', 'party': 'Republican'},
    {'name': 'Mike Waltz', 'slug': 'waltz-mike', 'state': 'FL', 'district': '3', 'party': 'Republican'},
    {'name': 'Dusty Johnson', 'slug': 'johnson-dusty', 'state': 'SD', 'district': '1', 'party': 'Republican'},
    {'name': 'Young Kim', 'slug': 'kim-young', 'state': 'CA', 'district': '40', 'party': 'Republican'},
    {'name': 'Darrell Issa', 'slug': 'issa-darrell', 'state': 'CA', 'district': '48', 'party': 'Republican'},
    {'name': 'Patrick McHenry', 'slug': 'mchenry-patrick', 'state': 'NC', 'district': '10', 'party': 'Republican'},
    {'name': 'Jim Himes', 'slug': 'himes-jim', 'state': 'CT', 'district': '4', 'party': 'Democrat'},
    {'name': 'Maxine Waters', 'slug': 'waters-maxine', 'state': 'CA', 'district': '37', 'party': 'Democrat'},
    {'name': 'Carol Miller', 'slug': 'miller-carol', 'state': 'WV', 'district': '1', 'party': 'Republican'},
    {'name': 'Josh Gottheimer', 'slug': 'gottheimer-josh', 'state': 'NJ', 'district': '5', 'party': 'Democrat'},
    {'name': 'Drew Ferguson', 'slug': 'ferguson-drew', 'state': 'GA', 'district': '3', 'party': 'Republican'},
    {'name': 'Andy Harris', 'slug': 'harris-andy', 'state': 'MD', 'district': '1', 'party': 'Republican'},
    {'name': 'Ralph Norman', 'slug': 'norman-ralph', 'state': 'SC', 'district': '5', 'party': 'Republican'},
    {'name': 'John James', 'slug': 'james-john', 'state': 'MI', 'district': '10', 'party': 'Republican'},
    {'name': 'Lori Chavez-DeRemer', 'slug': 'chavez-deremer-lori', 'state': 'OR', 'district': '5', 'party': 'Republican'},
    {'name': 'Jeff Duncan', 'slug': 'duncan-jeff', 'state': 'SC', 'district': '3', 'party': 'Republican'},
]


def parse_amount_range(size_str: str) -> tuple:
    """Parse '$1M–5M' into (1000000, 5000000)"""
    if not size_str or size_str == 'N/A':
        return None, None
    import re
    nums = re.findall(r'[\d,]+(?:\.\d+)?', size_str.replace('$', '').replace('K', '000').replace('M', '000000').replace('B', '000000000'))
    if not nums:
        return None, None
    nums = [int(n.replace(',', '')) for n in nums]
    return nums[0], nums[-1] if len(nums) > 1 else nums[0]


def parse_date(date_str: str) -> Optional[str]:
    """Parse '11 May 2026' into '2026-05-11'"""
    if not date_str:
        return None
    try:
        from datetime import datetime
        d = datetime.strptime(date_str.strip(), '%d %b %Y')
        return d.strftime('%Y-%m-%d')
    except:
        return None


def parse_trade_type(type_str: str) -> str:
    t = type_str.strip().upper()
    if 'BUY' in t:
        return 'BUY'
    elif 'SELL' in t:
        return 'SELL'
    elif 'EXCHANGE' in t:
        return 'EXCHANGE'
    return type_str.strip()


def scrape_member_page(slug: str, member_name: str, chamber: str, state: str, party: str, district: str = None) -> list:
    """Scrape a CapitolTrades member page and return list of trade dicts."""
    trades = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            extra_http_headers={'Accept-Language': 'en-US,en;q=0.9'}
        )
        page = context.new_page()
        
        url = f'https://www.capitoltrades.com/politicians/{slug}'
        try:
            page.goto(url, timeout=30000)
            page.wait_for_load_state('networkidle', timeout=20000)
            page.wait_for_timeout(2000)
            
            # Click through time range buttons to get historical data
            # Try 3Y button first
            time_buttons = page.query_selector_all('button[class*="time"], [class*="range"], [class*="tab"]')
            for btn in time_buttons:
                txt = btn.inner_text().strip()
                if txt in ['3Y', '5Y', 'All']:
                    try:
                        btn.click()
                        page.wait_for_timeout(2000)
                        break
                    except:
                        pass
            
            page.wait_for_timeout(2000)
            
            # Get trade rows from the table
            # Table structure: TRADE | PUBLISHED | TRADED | FILED AFTER | TYPE | SIZE
            table_rows = page.query_selector_all('table tbody tr, table tr[class*="row"]')
            
            if not table_rows:
                # Try alternative selectors
                table_rows = page.query_selector_all('[class*="trade-row"], [class*="trade-row"], tbody tr')
            
            for row in table_rows:
                cells = row.query_selector_all('td, [class*="cell"]')
                if len(cells) < 5:
                    continue
                
                # Extract cell text
                cell_texts = []
                for cell in cells:
                    cell_texts.append(cell.inner_text().strip())
                
                # Find TYPE and SIZE columns
                type_idx = None
                size_idx = None
                for i, txt in enumerate(cell_texts):
                    if 'BUY' in txt.upper() or 'SELL' in txt.upper():
                        type_idx = i
                    if '$' in txt or 'K' in txt or 'M' in txt:
                        size_idx = i
                
                if type_idx is None:
                    continue
                
                # Get trade date from the "TRADED" column (usually second)
                traded_text = cell_texts[1] if len(cell_texts) > 1 else ''
                filed_text = cell_texts[2] if len(cell_texts) > 2 else ''
                
                trade_date = parse_date(traded_text)
                if not trade_date:
                    trade_date = parse_date(filed_text)
                
                type_str = cell_texts[type_idx] if type_idx < len(cell_texts) else 'BUY'
                size_str = cell_texts[size_idx] if size_idx and size_idx < len(cell_texts) else ''
                
                # Get issuer/ticker from the trade column
                issuer_text = cell_texts[0] if cell_texts else ''
                
                # Parse amount
                amt_min, amt_max = parse_amount_range(size_str)
                
                # Skip US Treasury Bills and non-stock issuers
                if not issuer_text or issuer_text in ['N/A', '']:
                    continue
                issuer_clean = issuer_text.upper()
                if 'TREASURY' in issuer_clean or 'BILL' in issuer_clean:
                    continue
                
                # Simple ticker extraction: try to find ticker in issuer name
                # CapitolTrades shows company name, not ticker, so we use issuer slug
                ticker = ''.join(c for c in issuer_clean if c.isalnum())[:10]
                
                trades.append({
                    'member_name': member_name,
                    'member_chamber': chamber,
                    'member_party': party,
                    'member_state': state,
                    'district': district,
                    'ticker': ticker or issuer_clean[:5],
                    'company_name': issuer_text,
                    'transaction_type': parse_trade_type(type_str),
                    'asset_type': 'Stock',
                    'amount_min': amt_min,
                    'amount_max': amt_max,
                    'amount_range': size_str if size_str else None,
                    'transaction_date': trade_date,
                    'filed_date': parse_date(filed_text) if filed_text else None,
                    'disclosure_year': int(trade_date[:4]) if trade_date else None,
                    'source_system': 'CapitolTrades',
                    'flags': [],
                    'signal_type': 'routine',
                    'has_federal_contract': False,
                })
                
        except Exception as e:
            print(f'  Error scraping {slug}: {e}', file=sys.stderr)
        finally:
            browser.close()
    
    return trades


def dedup_trades(trades: list) -> list:
    """Remove duplicates within this batch."""
    seen = set()
    unique = []
    for t in trades:
        key = (t.get('member_name'), t.get('ticker'), t.get('transaction_date'), t.get('transaction_type'))
        if key not in seen:
            seen.add(key)
            unique.append(t)
    return unique


def write_to_supabase(trades: list) -> int:
    """Write trades to Supabase, return count written."""
    if not trades or not sb:
        return 0
    
    written = 0
    for t in trades:
        try:
            result = sb.table('congress_trades').upsert([t], on_conflict='member_name,ticker,transaction_date,transaction_type').execute()
            written += 1
        except Exception as e:
            print(f'  Upsert error: {e}', file=sys.stderr)
    return written


def run_backfill(chamber: str, years: list, members: list):
    """Main backfill loop."""
    total_written = 0
    total_by_year = {}
    
    for member in members:
        print(f'\nProcessing {member["name"]} ({member["state"]})...')
        
        for year in years:
            # Rate limit: 2 second delay between requests
            time.sleep(2)
            
            # Navigate to member's trading page for this year
            # CapitolTrades shows all trades with date filtering in the UI
            # We scrape the full page and filter by year in post-processing
            
            trades = scrape_member_page(
                slug=member['slug'],
                member_name=member['name'],
                chamber=chamber,
                state=member['state'],
                party=member['party'],
                district=member.get('district'),
            )
            
            # Filter by year
            year_trades = [t for t in trades if t.get('disclosure_year') == year or (t.get('transaction_date') or '').startswith(str(year))]
            
            if not year_trades:
                print(f'  {year}: 0 trades')
                continue
            
            # Dedup
            year_trades = dedup_trades(year_trades)
            
            # Write to Supabase
            written = write_to_supabase(year_trades)
            total_written += written
            total_by_year[year] = total_by_year.get(year, 0) + written
            
            print(f'  {year}: {len(year_trades)} trades, {written} written to DB')
    
    return total_written, total_by_year


def main():
    parser = argparse.ArgumentParser(description='Scrape CapitolTrades for congressional trading data')
    parser.add_argument('--chamber', choices=['senate', 'house', 'both'], default='both')
    parser.add_argument('--years', nargs='+', type=int, default=[2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025])
    parser.add_argument('--all', action='store_true', help='Full backfill (all members, all years)')
    args = parser.parse_args()
    
    print(f'Starting CapitolTrades backfill...')
    print(f'Years: {args.years}')
    print(f'Supabase connected: {sb is not None}')
    
    if args.all:
        years = list(range(2016, 2026))
    else:
        years = args.years
    
    total_written = 0
    
    if args.chamber in ['senate', 'both']:
        print(f'\n=== SENATE BACKFILL ({len(SENATORS)} members) ===')
        w, by_yr = run_backfill('Senate', years, SENATORS)
        total_written += w
        print(f'Senate total written: {w} trades')
    
    if args.chamber in ['house', 'both']:
        print(f'\n=== HOUSE BACKFILL ({len(REPRESENTATIVES)} members) ===')
        w, by_yr = run_backfill('House', years, REPRESENTATIVES)
        total_written += w
        print(f'House total written: {w} trades')
    
    print(f'\n=== BACKFILL COMPLETE ===')
    print(f'Total trades written to Supabase: {total_written}')


if __name__ == '__main__':
    main()