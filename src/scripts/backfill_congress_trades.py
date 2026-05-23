#!/usr/bin/env python3
"""
Congressional trading data backfill using CapitolGains library.
House: Uses CapitolGains PDF parsing (works great!)
Senate: Uses CapitolGains web table scraping (partial - works for some Senators)

Usage:
  python3 backfill_congress_trades.py --chamber house --years 2016 2024
  python3 backfill_congress_trades.py --chamber senate --years 2020 2024
  python3 backfill_congress_trades.py --all  # Full backfill
"""

import sys
import os
import json
import time
import re
import argparse
from datetime import datetime
from typing import Optional, List, Dict, Any

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client
from capitolgains.core.representative import Representative, HouseDisclosureScraper
from capitolgains.core.senator import Senator, SenateDisclosureScraper

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://jlyrczrtzhtgbsljilwh.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
print(f'Supabase connected: {sb is not None}')

# ── Roster ─────────────────────────────────────────────────────────────────────
# Full 2016-2026 roster, generated from unitedstates/congress-legislators.
# Refresh with: python3 src/scripts/gen_congress_roster.py
_ROSTER_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'congress_roster.json')
with open(_ROSTER_PATH) as _f:
    _ROSTER = json.load(_f)['members']

SENATORS = [
    {'first': m['first_name'], 'last': m['last_name'], 'state': m['state']}
    for m in _ROSTER if m['chamber'] == 'Senate'
]
REPRESENTATIVES = [
    {'first': m['first_name'], 'last': m['last_name'],
     'state': m['state'], 'district': m.get('district', '0')}
    for m in _ROSTER if m['chamber'] == 'House'
]


def parse_amount_from_text(text: str) -> tuple:
    """Parse '$100,001 - $250,000' or '$1M - $5M' into (min, max).

    Each amount carries its OWN K/M/B suffix — the multiplier is applied
    per-token, not from a scan of the whole string (which mis-scaled mixed
    ranges like '$15,000 - $1M').
    """
    if not text or text.strip().upper() == 'N/A':
        return None, None
    t = text.upper()
    # The K/M/B suffix must be a standalone letter, not the first letter of a
    # following word (e.g. "Bond"), which otherwise scales the amount ×1e9.
    # Stage 1: $-prefixed amounts, each with its own optional K/M/B suffix.
    matches = re.findall(r'\$\s*([\d,]+(?:\.\d+)?)\s*([KMB](?![A-Z]))?', t)
    # Stage 2: fall back to bare 'number + K/M/B'.
    if not matches:
        matches = re.findall(r'([\d,]+(?:\.\d+)?)\s*([KMB](?![A-Z]))', t)

    mults = {'K': 1000, 'M': 1_000_000, 'B': 1_000_000_000}
    nums = []
    for raw, suffix in matches:
        s = raw.replace(',', '')
        try:
            nums.append(int(float(s) * mults.get(suffix, 1)))
        except ValueError:
            continue
    if not nums:
        return None, None
    return min(nums), max(nums)


def parse_panw_text(text: str) -> Dict[str, Any]:
    """Parse asset text like 'SP Palo Alto Networks, Inc. (PANW) P' into components."""
    # SP = Stock, P = Put, C = Call, O = Other
    # First word is asset type code
    parts = text.strip().split()
    if not parts:
        return {'asset_type_code': '', 'ticker': '', 'company_name': text}
    
    asset_type_code = parts[0]
    
    # Look for ticker in parentheses
    ticker_match = re.search(r'\(([A-Z]+)\)', text)
    ticker = ticker_match.group(1) if ticker_match else ''
    
    # Company name is everything between asset type code and (ticker)
    company_match = re.search(r'(?:SP|C|O)\s+(.+?)\s*(?:\([A-Z]+\)|$)', text)
    company_name = company_match.group(1).strip() if company_match else text
    
    # Put/Call indicator
    put_call = 'P' if ' P ' in text or text.endswith(' P') else ('C' if ' C ' in text or text.endswith(' C') else '')
    
    return {
        'asset_type_code': asset_type_code,
        'ticker': ticker,
        'company_name': company_name,
        'put_call': put_call,
    }


def parse_date_from_text(text: str, filed_date: str = None) -> Optional[str]:
    """Parse date from cell text like '02/12/2024'
    
    Validates year bounds. If parsed year is unreasonable (future year > current+1
    or historical year < 2000), falls back to filed_date if available.
    """
    if not text:
        return None
    text = text.strip()
    # MM/DD/YYYY
    m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
    if not m:
        return None
    try:
        dt = datetime.strptime(f'{m.group(1)}/{m.group(2)}/{m.group(3)}', '%m/%d/%Y')
        year = dt.year
        current_year = datetime.now().year
        # Reject impossible years: future (> current+2) or ancient (< 2000)
        if year > current_year + 2 or year < 2000:
            # Fall back to filed_date if available and valid
            if filed_date:
                try:
                    fallback = datetime.strptime(filed_date[:10], '%Y-%m-%d')
                    fb_year = fallback.year
                    if 2000 <= fb_year <= current_year + 1:
                        return filed_date[:10]
                except Exception:
                    pass
            return None
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return None


def parse_house_pdf_text(text: str) -> List[Dict[str, Any]]:
    """Parse the House PTR PDF text into structured trade records."""
    trades = []
    
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Look for asset type indicators (SP, O, I, C, etc.)
        if re.match(r'^(SP|O|I|C|B)\s+', line):
            # This is an asset line
            asset_text = line
            
            # Parse asset details
            parsed = parse_panw_text(asset_text)
            
            # Next lines might have dates and amounts
            # Look ahead for date lines
            j = i + 1
            pending_info = []
            while j < len(lines) and len(pending_info) < 3:
                l2 = lines[j].strip()
                if re.match(r'^\d{1,2}/\d{1,2}/\d{4}', l2):
                    pending_info.append(l2)
                elif 'New' in l2 or 'Sale' in l2 or 'Exchange' in l2 or 'Purchase' in l2:
                    pending_info.append(l2)
                elif re.search(r'\$[\d,]+', l2):
                    pending_info.append(l2)
                j += 1
            
            # Extract from pending info
            dates = []
            amounts = []
            tx_type = 'BUY'
            for info in pending_info:
                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', info):
                    dates.append(info)
                if '$' in info:
                    amounts.append(info)
                if 'New' in info or 'Purchase' in info:
                    tx_type = 'BUY'
                elif 'Sale' in info:
                    tx_type = 'SELL'
            
            transaction_date = parse_date_from_text(dates[0]) if dates else None
            
            amt_min, amt_max = parse_amount_from_text(' '.join(amounts)) if amounts else (None, None)
            
            trades.append({
                'asset_type_code': parsed['asset_type_code'],
                'ticker': parsed['ticker'],
                'company_name': parsed['company_name'],
                'put_call': parsed['put_call'],
                'transaction_date': transaction_date,
                'amount_min': amt_min,
                'amount_max': amt_max,
                'transaction_type': tx_type,
            })
            
            i = j - 1
        
        i += 1
    
    return trades


def scrape_house_member(scraper, first: str, last: str, state: str, district: str, year: str) -> List[Dict]:
    """Scrape one House member's PTR filings for a given year."""
    try:
        rep = Representative(name=last, state=state, district=district)
        filings = scraper.search_member_disclosures(
            last_name=last, state=state, district=district,
            filing_year=year, report_types=['ptr']
        )
        
        all_trades = []
        for filing in filings:
            try:
                pdf_path = scraper.download_disclosure_pdf(filing['pdf_url'])
                
                import pdfplumber
                with pdfplumber.open(pdf_path) as pdf:
                    full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
                
                os.unlink(pdf_path)
                
                trades = parse_house_pdf_text(full_text)
                
                for t in trades:
                    t['member_name'] = f'{first} {last}'
                    t['member_chamber'] = 'House'
                    t['member_party'] = filing.get('party', '')
                    t['member_state'] = state
                    t['district'] = district
                    t['disclosure_year'] = int(year)
                    t['source_system'] = 'House_Clerk'
                    t['filed_date'] = filing.get('date', '')
                
                all_trades.extend(trades)
                
            except Exception as e:
                print(f'    Error processing PTR {filing.get("pdf_url")}: {e}')
        
        return all_trades
        
    except Exception as e:
        print(f'    Error scraping {first} {last}: {e}')
        return []


def scrape_senate_member(scraper, first: str, last: str, state: str, year: str) -> List[Dict]:
    """Scrape one Senator's PTR filings for a given year."""
    try:
        senator = Senator(name=last, state=state, first_name=first)
        result = senator.get_disclosures(scraper=scraper, year=year)
        
        all_trades = []
        for filing in result.get('trades', []):
            try:
                ptr_data = scraper._scrape_ptr_report(filing['report_url'])
                data = ptr_data.get('data', {})
                txns = data.get('transactions', [])
                
                for tx in txns:
                    # Normalize to our format
                    member_name = f"{tx.get('first_name', first)} {tx.get('last_name', last)}"
                    
                    # Extract amount
                    amount_str = tx.get('amount', tx.get('amount_min', ''))
                    amt_min, amt_max = parse_amount_from_text(str(amount_str))
                    
                    # Extract date
                    date_str = tx.get('date', tx.get('transaction_date', ''))
                    transaction_date = parse_date_from_text(date_str)
                    
                    # Extract ticker
                    asset_name = tx.get('asset_name', tx.get('name', ''))
                    ticker_match = re.search(r'\(([A-Z]+)\)', asset_name)
                    ticker = ticker_match.group(1) if ticker_match else ''
                    
                    all_trades.append({
                        'member_name': member_name,
                        'member_chamber': 'Senate',
                        'member_party': '',
                        'member_state': state,
                        'ticker': ticker,
                        'company_name': asset_name,
                        'transaction_type': tx.get('type', 'BUY').upper(),
                        'asset_type': 'Stock',
                        'amount_min': amt_min,
                        'amount_max': amt_max,
                        'transaction_date': transaction_date,
                        'disclosure_year': int(year) if transaction_date else int(year),
                        'source_system': 'Senate_EFD',
                        'flags': [],
                        'signal_type': 'routine',
                        'has_federal_contract': False,
                    })
                    
            except Exception as e:
                print(f'    Error processing PTR: {e}')
        
        return all_trades
        
    except Exception as e:
        print(f'    Error scraping {first} {last}: {e}')
        return []


def write_trades_to_supabase(trades: List[Dict]) -> int:
    """Write trades to Supabase with dedup check."""
    if not trades or not sb:
        return 0
    
    # Dedup: build set of (member_name, ticker, transaction_date, transaction_type)
    seen = set()
    unique_trades = []
    for t in trades:
        if t.get('transaction_date') and t.get('ticker'):
            key = (t['member_name'], t['ticker'], t['transaction_date'], t.get('transaction_type', 'BUY'))
            if key not in seen:
                seen.add(key)
                unique_trades.append(t)
    
    written = 0
    for t in unique_trades:
        try:
            # Build full record for Supabase
            record = {
                'member_name': t['member_name'],
                'member_chamber': t['member_chamber'],
                'member_party': t.get('member_party', ''),
                'member_state': t['member_state'],
                'district': t.get('district'),
                'ticker': t['ticker'],
                'company_name': t.get('company_name', ''),
                'transaction_type': t.get('transaction_type', 'BUY').upper(),
                'asset_type': t.get('asset_type', 'Stock'),
                'amount_min': t.get('amount_min'),
                'amount_max': t.get('amount_max'),
                'amount_range': t.get('amount_range'),
                'transaction_date': t['transaction_date'],
                'filed_date': t.get('filed_date'),
                'disclosure_year': t.get('disclosure_year'),
                'source_system': t.get('source_system', 'Unknown'),
                'flags': t.get('flags', []),
                'signal_type': t.get('signal_type', 'routine'),
                'has_federal_contract': t.get('has_federal_contract', False),
            }
            
            sb.table('congress_trades').upsert(
                [record],
                on_conflict='member_name,ticker,transaction_date,transaction_type'
            ).execute()
            written += 1
        except Exception as e:
            print(f'  Upsert error: {e}')
    
    return written


def run_backfill(chamber: str, years: List[int]):
    """Main backfill driver."""
    
    if chamber == 'house':
        members = REPRESENTATIVES
        scrape_fn = scrape_house_member
    else:
        members = SENATORS
        scrape_fn = scrape_senate_member
    
    # Use context manager for browser lifecycle
    if chamber == 'house':
        with HouseDisclosureScraper(headless=True) as scraper:
            total_written = 0
            by_year = {}
            
            for member in members:
                name = f"{member['first']} {member['last']}"
                print(f'\nHouse: {name} ({member["state"]}-{member["district"]})')
                
                for year in years:
                    trades = scrape_house_member(
                        scraper,
                        member['first'], member['last'],
                        member['state'], member['district'],
                        str(year)
                    )
                    
                    year_trades = [t for t in trades if str(t.get('disclosure_year')) == str(year)]
                    
                    if year_trades:
                        written = write_trades_to_supabase(year_trades)
                        total_written += written
                        by_year[year] = by_year.get(year, 0) + written
                        print(f'  {year}: {len(year_trades)} trades, {written} written')
                    else:
                        print(f'  {year}: 0 trades')
                    
                    time.sleep(1)  # Rate limit
            
            return total_written, by_year
    else:
        with SenateDisclosureScraper(headless=True) as scraper:
            total_written = 0
            by_year = {}
            
            for member in members:
                name = f"{member['first']} {member['last']}"
                print(f'\nSenate: {name} ({member["state"]})')
                
                for year in years:
                    trades = scrape_senate_member(
                        scraper,
                        member['first'], member['last'],
                        member['state'],
                        str(year)
                    )
                    
                    year_trades = [t for t in trades if str(t.get('disclosure_year', '')) == str(year)]
                    
                    if year_trades:
                        written = write_trades_to_supabase(year_trades)
                        total_written += written
                        by_year[year] = by_year.get(year, 0) + written
                        print(f'  {year}: {len(year_trades)} trades, {written} written')
                    else:
                        print(f'  {year}: 0 trades')
                    
                    time.sleep(1)
            
            return total_written, by_year


def main():
    parser = argparse.ArgumentParser(description='Backfill congressional trading data')
    parser.add_argument('--chamber', choices=['senate', 'house', 'both'], default='both')
    parser.add_argument('--years', nargs='+', type=int, default=[2024, 2023])
    parser.add_argument('--all', action='store_true', help='Full 2016-2025 backfill')
    args = parser.parse_args()
    
    years = list(range(2016, 2026)) if args.all else args.years
    
    total_written = 0
    
    if args.chamber in ['house', 'both']:
        print(f'\n=== HOUSE BACKFILL ({len(REPRESENTATIVES)} members) ===')
        w, by_yr = run_backfill('house', years)
        total_written += w
        print(f'House total: {w} trades written')
        for y, cnt in sorted(by_yr.items()):
            print(f'  {y}: {cnt}')
    
    if args.chamber in ['senate', 'both']:
        print(f'\n=== SENATE BACKFILL ({len(SENATORS)} members) ===')
        w, by_yr = run_backfill('senate', years)
        total_written += w
        print(f'Senate total: {w} trades written')
        for y, cnt in sorted(by_yr.items()):
            print(f'  {y}: {cnt}')
    
    print(f'\n=== COMPLETE: {total_written} total trades written ===')


if __name__ == '__main__':
    main()