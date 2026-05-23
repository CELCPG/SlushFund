#!/usr/bin/env python3
"""
SlushFund — Senate EFD PTR Scraper
Uses CapitolGains to find Senate PTR filings and extract transaction data,
then loads into Supabase.

Usage:
    python3 scrape_senate_ptr.py --senator "Scott" --state FL --year 2024
    python3 scrape_senate_ptr.py --senator "Whitehouse" --state RI --year 2024
    python3 scrape_senate_ptr.py --all-senators --year 2024

Requirements:
    pip install capitolgains python-dotenv supabase psycopg2-binary
"""

import argparse
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

# ── Setup ─────────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# ── Supabase ───────────────────────────────────────────────────────────────────
try:
    from supabase import create_client, Client
    HAS_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
    if HAS_SUPABASE:
        sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    else:
        sb = None
        print("⚠️  Supabase not configured — will print to stdout only")
except ImportError:
    sb = None
    print("⚠️  Supabase client not installed — pip install supabase")
    HAS_SUPABASE = False

# ── CapitolGains ──────────────────────────────────────────────────────────────
from capitolgains.core.senator import Senator
from capitolgains.utils.senator_scraper import SenateDisclosureScraper

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_amount_range(raw: str) -> tuple[Optional[int], Optional[int], str]:
    """Parse amount strings like '$1M - $5M', '$100K - $500K', '>$1M', '≤$15M'."""
    if not raw:
        return None, None, raw
    
    raw = raw.strip()
    range_str = raw.replace('$', '').replace(',', '').replace(' ', '')
    
    def parse_val(v: str) -> Optional[int]:
        v = v.upper().strip()
        if not v or v in ('N/A', 'NONE', '--'):
            return None
        multiplier = 1
        if 'K' in v:
            v = v.replace('K', '')
            multiplier = 1_000
        elif 'M' in v:
            v = v.replace('M', '')
            multiplier = 1_000_000
        elif 'B' in v:
            v = v.replace('B', '')
            multiplier = 1_000_000_000
        try:
            return int(float(v) * multiplier)
        except:
            return None
    
    if '-' in range_str:
        parts = range_str.split('-')
        lo = parse_val(parts[0])
        hi = parse_val(parts[1]) if len(parts) > 1 else lo
        return lo, hi, raw
    
    op = None
    if '>' in range_str:
        op = '>'
        range_str = range_str.replace('>', '')
    elif '<' in range_str:
        op = '<'
        range_str = range_str.replace('<', '')
    elif range_str.startswith('≤') or range_str.startswith('<='):
        op = '<='
        range_str = re.sub(r'^[≤<]=', '', range_str)
    
    val = parse_val(range_str)
    if op in ('>', '<'):
        lo = val if op == '>' else None
        hi = val if op == '<' else None
    else:
        lo, hi = None, val
    return lo, hi, raw


def slugify_asset(text: str, max_len: int = 20) -> str:
    """Create a pseudo-ticker from asset name for non-equity securities (bonds)."""
    if not text:
        return None
    slug = re.sub(r'[^A-Z0-9]', '', text.upper())[:max_len]
    return slug or None


def extract_transactions_from_ptr(ptr_url: str, ptr_info: Dict[str, Any], scraper: SenateDisclosureScraper) -> List[Dict[str, Any]]:
    """Extract transactions from a single PTR filing.
    
    Args:
        ptr_url: URL of the PTR filing
        ptr_info: Dict with first_name, last_name, report_type, date
        scraper: SenateDisclosureScraper instance (must have session established)
    
    Returns:
        List of transaction dicts ready for Supabase
    """
    # Parse the PTR to get transactions
    result = scraper._scrape_ptr_report(ptr_url)
    
    tx_section = result.get('sections', {}).get('transactions', {})
    tx_table = tx_section.get('table', {})
    rows = tx_table.get('rows', [])
    
    member_name = f"{ptr_info['first_name']} {ptr_info['last_name']}"
    state = ptr_info.get('state', '')
    disclosure_year = ptr_info.get('disclosure_year')
    
    trades = []
    for row in rows:
        # Parse transaction date
        tx_date_str = row.get('transaction_date', '')
        if tx_date_str:
            try:
                tx_date = datetime.strptime(tx_date_str.strip(), '%m/%d/%Y').date()
            except:
                tx_date = None
        else:
            tx_date = None
        
        # Parse amount
        raw_amount = row.get('amount', '')
        amt_min, amt_max, _ = parse_amount_range(raw_amount)
        
        # Get asset name (can be a dict with extra details for bonds)
        asset_name_raw = row.get('asset_name', '')
        if isinstance(asset_name_raw, dict):
            asset_name = asset_name_raw.get('name', '')
        else:
            asset_name = asset_name_raw
        
        # Ticker handling
        raw_ticker = row.get('ticker', '--') or '--'
        ticker = raw_ticker.strip() if raw_ticker != '--' else ''
        
        # For non-ticker assets (municipal bonds), create pseudo-ticker
        final_ticker = ticker if ticker else slugify_asset(asset_name)
        
        # Transaction type
        tx_type = row.get('type', 'BUY').upper()
        
        trade = {
            'member_name': member_name,
            'member_chamber': 'Senate',
            'member_party': 'Unknown',
            'member_state': state,
            'ticker': final_ticker,
            'company_name': asset_name or None,
            'transaction_type': tx_type,
            'asset_type': row.get('asset_type', 'Stock'),
            'amount_min': amt_min,
            'amount_max': amt_max,
            'amount_range': raw_amount,
            'transaction_date': tx_date.isoformat() if tx_date else None,
            'disclosure_year': disclosure_year,
            'source_system': 'Senate_EFD',
            'disclosure_url': ptr_url,
        }
        
        trades.append(trade)
    
    return trades


def scrape_senator_ptrs(name: str, state: str, year: str, first_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Scrape all PTR filings for a senator and return transaction data.
    
    Args:
        name: Senator's last name
        state: Two-letter state code
        year: Year to scrape
        first_name: Senator's first name (optional but recommended for accuracy)
    
    Returns:
        List of transaction dicts
    """
    # first_name should only be passed if it was explicitly provided
    # If name is just a last name like 'Scott', don't derive first_name from it
    # The senator search uses first_name for more precise matching, but
    # when name='Scott' and first_name='Scott', the search fails to find Rick Scott
    
    # Get PTR filings
    disclosures = Senator.get_member_disclosures(
        name=name,
        first_name=first_name,
        year=year,
        state=state,
        headless=True
    )
    ptr_filings = disclosures.get('trades', [])
    
    if not ptr_filings:
        return []
    
    all_trades = []
    
    with SenateDisclosureScraper(headless=True) as scraper:
        # Establish session once for all PTRs
        scraper.with_session(f"{scraper.BASE_URL}{scraper.SEARCH_PATH}")
        
        for ptr in ptr_filings:
            ptr_url = ptr['report_url']
            ptr_info = {
                'first_name': ptr['first_name'],
                'last_name': ptr['last_name'],
                'report_type': ptr['report_type'],
                'date': ptr['date'],
                'state': state,
                'disclosure_year': int(year) if year.isdigit() else None,
            }
            
            try:
                trades = extract_transactions_from_ptr(ptr_url, ptr_info, scraper)
                all_trades.extend(trades)
                print(f"    {ptr['report_type']}: {len(trades)} transactions")
            except Exception as e:
                print(f"    ❌ Error processing {ptr['report_type']}: {e}")
    
    return all_trades


def insert_trades(trades: List[Dict]) -> int:
    """Insert trades into Supabase. Returns count inserted."""
    if not sb or not trades:
        return 0
    
    try:
        result = sb.table('congress_trades').upsert(
            trades,
            on_conflict='member_name,ticker,transaction_date,transaction_type',
            ignore_duplicates=True
        ).execute()
        return len(trades)
    except Exception as e:
        print(f"    ❌ Supabase insert error: {e}")
        return 0


# ── Senator list ──────────────────────────────────────────────────────────────

SENATORS_TO_TRACK = [
    ('Schumer', 'NY'), ('McConnell', 'KY'), ('Warren', 'MA'), ('Graham', 'SC'),
    ('Sanders', 'VT'), ('Rubio', 'FL'), ('Menendez', 'NJ'), ('Grassley', 'IA'),
    ('Wyden', 'OR'), ('Crapo', 'ID'), ('Lee', 'UT'), ('Cornyn', 'TX'),
    ('Duckworth', 'IL'), ('Fischer', 'NE'), ('Cramer', 'ND'), ('Booker', 'NJ'),
    ('Scott', 'FL'), ('Warner', 'VA'), ('Barrasso', 'WY'), ('Cantwell', 'WA'),
    ('Padilla', 'CA'), ('Rounds', 'SD'), ('Kelly', 'AZ'), ('Hickenlooper', 'CO'),
    ('Lankford', 'OK'), ('Murphy', 'CT'), ('Bennet', 'CO'), ('Cassidy', 'LA'),
    ('Merkley', 'OR'), ('Durbin', 'IL'), ('Feinstein', 'CA'), ('Collins', 'ME'),
    ('Blunt', 'MO'), ('Portman', 'OH'), ('Toomey', 'PA'), ('Burr', 'NC'),
    ('Cornyn', 'TX'), ('Thune', 'SD'), ('Moran', 'KS'), ('Hoeven', 'ND'),
    ('Brown', 'OH'), ('Casey', 'PA'), ('Kaine', 'VA'), ('Warner', 'VA'),
    ('Whitehouse', 'RI'), (' Reed', 'RI'), ('Daines', 'MT'), ('Sullivan', 'AK'),
    ('Kennedy', 'LA'), ('Van Hollen', 'MD'), ('Cardin', 'MD'), ('Ossoff', 'GA'),
    ('Warnock', 'GA'), ('Butler', 'NC'), ('Tillman', 'AZ'), ('Cruz', 'TX'),
    ('Hawley', 'MO'), ('Tuberville', 'AL'), ('Schitt', 'MS'), (' Hyde-Smith', 'MS'),
]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Scrape Senate EFD PTR filings')
    parser.add_argument('--senator', type=str, help='Senator last name')
    parser.add_argument('--state', type=str, help='Two-letter state code')
    parser.add_argument('--year', type=str, default='2024', help='Year to scrape')
    parser.add_argument('--all-senators', action='store_true', help='Scrape all tracked senators')
    parser.add_argument('--dry-run', action='store_true', help='Print trades without inserting')
    args = parser.parse_args()
    
    if args.all_senators:
        print(f"📋 Scraping all tracked senators for {args.year}")
        total_trades = 0
        
        for name, state in SENATORS_TO_TRACK:
            name = name.strip()
            try:
                print(f"\n🏛️  {name} ({state})...")
                trades = scrape_senator_ptrs(name, state, args.year)
                print(f"   → {len(trades)} transactions")
                
                if trades and not args.dry_run:
                    inserted = insert_trades(trades)
                    print(f"   → {inserted} inserted to Supabase")
                
                total_trades += len(trades)
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        print(f"\n✅ Done — {total_trades} total transactions")
        return
    
    if not args.senator or not args.state:
        parser.error("--senator and --state required (or use --all-senators)")
    
    print(f"🏛️  Scraping {args.senator} ({args.state}) for {args.year}")
    trades = scrape_senator_ptrs(args.senator, args.state, args.year)
    print(f"\n→ {len(trades)} transactions found")
    
    if args.dry_run:
        for t in trades[:10]:
            print(f"  {t['transaction_date']} | {t['transaction_type']} | {t['ticker']} | {t['company_name']} | {t['amount_range']}")
        if len(trades) > 10:
            print(f"  ... and {len(trades) - 10} more")
    else:
        inserted = insert_trades(trades)
        print(f"→ {inserted} inserted to Supabase")
        
        # Verify
        if sb:
            result = sb.table('congress_trades').select('*').eq('member_name', f"{args.senator}").eq('source_system', 'Senate_EFD').execute()
            print(f"→ {len(result.data)} Senate_EFD trades for {args.senator} in DB")

if __name__ == '__main__':
    main()
