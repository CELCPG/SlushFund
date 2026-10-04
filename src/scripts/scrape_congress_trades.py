#!/usr/bin/env python3
"""
SlushFund — Congress Trades Scraper
Uses CapitolGains to pull STOCK Act disclosures from House Clerk + Senate EFD,
then loads into Supabase.

Usage:
    python3 scrape_congress_trades.py --years 2024 2025 2026
    python3 scrape_congress_trades.py --member "Pelosi" --state CA --chamber house
    python3 scrape_congress_trades.py --full-backfill

Requirements:
    pip install capitolgains python-dotenv supabase psycopg2-binary
"""

import argparse
import json
import os
import sys
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

# ── Setup ─────────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()

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
from capitolgains.core.representative import Representative
from capitolgains.core.senator import Senator

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
    
    # Handle ranges like $1M-$5M
    if '-' in range_str:
        parts = range_str.split('-')
        lo = parse_val(parts[0])
        hi = parse_val(parts[1]) if len(parts) > 1 else lo
        return lo, hi, raw
    
    # Handle >$1M or <$500K
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
    if op:
        if op in ('>', '<'):
            lo = val if op == '>' else None
            hi = val if op == '<' else None
        else:
            lo, hi = None, val
        return lo, hi, raw
    
    return val, val, raw


def normalize_ticker(raw_ticker: str) -> str:
    """Normalize ticker symbols."""
    t = raw_ticker.strip().upper()
    t = re.sub(r'[^A-Z0-9.\-]', '', t)
    return t or raw_ticker


def detect_signal_flags(trade: Dict[str, Any], member_committees: List[Dict]) -> List[str]:
    """Detect suspicious trading patterns."""
    flags = []
    
    ticker = trade.get('ticker', '').upper()
    tx_type = trade.get('transaction_type', '').upper()
    
    # Known AI/defense/energy tickers that overlap with federal contracting
    FED_CONTRACT_TICKERS = {
        'PLTR': {'sector': 'AI/Defense', 'risk': 'palantir'},
        'BA': {'sector': 'Defense', 'risk': 'boeing'},
        'RTX': {'sector': 'Defense', 'risk': 'raytheon'},
        'LMT': {'sector': 'Defense', 'risk': 'lockheed'},
        'NOC': {'sector': 'Defense', 'risk': 'northrop'},
        'GD': {'sector': 'Defense', 'risk': 'general_dynamics'},
        'LHX': {'sector': 'Defense', 'risk': 'l3harris'},
        'NVDA': {'sector': 'AI/Chips', 'risk': 'nvidia'},
        'AMD': {'sector': 'AI/Chips', 'risk': 'amd'},
        'MSFT': {'sector': 'AI/Tech', 'risk': 'microsoft'},
        'GOOGL': {'sector': 'AI/Tech', 'risk': 'google'},
        'GOOG': {'sector': 'AI/Tech', 'risk': 'google'},
        'AMZN': {'sector': 'AI/Tech', 'risk': 'amazon'},
        'META': {'sector': 'AI/Tech', 'risk': 'meta'},
        'TSLA': {'sector': 'Auto/Energy', 'risk': 'tesla'},
        'XOM': {'sector': 'Energy', 'risk': 'exxon'},
        'CVX': {'sector': 'Energy', 'risk': 'chevron'},
    }
    
    if ticker in FED_CONTRACT_TICKERS:
        flags.append('federal_contractor_overlap')
    
    # Large trades (>$5M) flagged
    if trade.get('amount_max', 0) and trade['amount_max'] >= 5_000_000:
        flags.append('large_trade')
    
    # Sell immediately after buy (round-trip)
    # (would need historical tracking — flag for now)
    if tx_type == 'SELL':
        flags.append('sell')
    elif tx_type == 'BUY':
        flags.append('buy')
    
    return flags


def insert_trades(trades: List[Dict]) -> int:
    """Insert trades into Supabase. Returns count inserted."""
    if not sb or not trades:
        return 0
    
    try:
        # Upsert — handle duplicates by member + ticker + date + type
        result = sb.table('congress_trades').upsert(
            trades,
            on_conflict='member_name,ticker,transaction_date,transaction_type',
            ignore_duplicates=False
        ).execute()
        
        # If count not available, count what we tried
        return len(trades)
    except Exception as e:
        print(f"    ❌ Supabase insert error: {e}")
        return 0


def insert_members(members: List[Dict]) -> int:
    if not sb or not members:
        return 0
    try:
        result = sb.table('congress_members').upsert(
            members,
            on_conflict='chamber,state,district',
            ignore_duplicates=True
        ).execute()
        return len(members)
    except Exception as e:
        print(f"    ❌ Member insert error: {e}")
        return 0


# ── Scraping ──────────────────────────────────────────────────────────────────

def scrape_house_member(name: str, state: str, district: Optional[str], year: str) -> List[Dict]:
    """Scrape House member disclosures for a given year."""
    try:
        disclosures = Representative.get_member_disclosures(
            name=name,
            year=year,
            state=state,
            district=district,
            headless=True
        )
    except Exception as e:
        print(f"    ⚠️  CapitolGains error for {name} ({state}): {e}")
        return []
    
    trades = []
    for disclosure in disclosures.get('trades', []):
        # Parse the disclosure into our schema
        ticker = normalize_ticker(disclosure.get('ticker', ''))
        if not ticker:
            continue
        
        raw_amount = disclosure.get('amount', '')
        amt_min, amt_max, _ = parse_amount_range(raw_amount)
        
        tx_date_str = disclosure.get('transaction_date') or disclosure.get('date')
        if tx_date_str:
            try:
                tx_date = datetime.strptime(tx_date_str, '%Y-%m-%d').date()
            except:
                tx_date = None
        else:
            tx_date = None
        
        trade = {
            'member_name': f"{name}",
            'member_chamber': 'House',
            'member_party': 'Unknown',  # Will enrich later
            'member_state': state,
            'ticker': ticker,
            'company_name': disclosure.get('company_name', disclosure.get('issuer', ticker)),
            'transaction_type': (disclosure.get('type') or 'BUY').upper(),
            'asset_type': disclosure.get('asset_type', 'Stock'),
            'amount_min': amt_min,
            'amount_max': amt_max,
            'amount_range': raw_amount,
            'transaction_date': tx_date.isoformat() if tx_date else None,
            'disclosure_year': int(year) if year.isdigit() else None,
            'source_system': 'House_Clerk',
            'disclosure_url': disclosure.get('pdf_url') or disclosure.get('url', ''),
        }
        
        trade['flags'] = detect_signal_flags(trade, [])
        trades.append(trade)
    
    return trades


def scrape_senator(name: str, state: str, year: str) -> List[Dict]:
    """Scrape Senate member disclosures for a given year."""
    first_name = name.split()[0] if ' ' in name else name
    
    try:
        disclosures = Senator.get_member_disclosures(
            name=name,
            first_name=first_name,
            year=year,
            state=state,
            headless=True
        )
    except Exception as e:
        print(f"    ⚠️  CapitolGains error for {name} ({state}): {e}")
        return []
    
    trades = []
    for disclosure in disclosures.get('trades', []):
        ticker = normalize_ticker(disclosure.get('ticker', ''))
        if not ticker:
            continue
        
        raw_amount = disclosure.get('amount', '')
        amt_min, amt_max, _ = parse_amount_range(raw_amount)
        
        tx_date_str = disclosure.get('transaction_date') or disclosure.get('date')
        if tx_date_str:
            try:
                tx_date = datetime.strptime(tx_date_str, '%Y-%m-%d').date()
            except:
                tx_date = None
        else:
            tx_date = None
        
        trade = {
            'member_name': name,
            'member_chamber': 'Senate',
            'member_party': 'Unknown',
            'member_state': state,
            'ticker': ticker,
            'company_name': disclosure.get('company_name', disclosure.get('issuer', ticker)),
            'transaction_type': (disclosure.get('type') or 'BUY').upper(),
            'asset_type': disclosure.get('asset_type', 'Stock'),
            'amount_min': amt_min,
            'amount_max': amt_max,
            'amount_range': raw_amount,
            'transaction_date': tx_date.isoformat() if tx_date else None,
            'disclosure_year': int(year) if year.isdigit() else None,
            'source_system': 'Senate_EFD',
            'disclosure_url': disclosure.get('pdf_url') or disclosure.get('url', ''),
        }
        
        trade['flags'] = detect_signal_flags(trade, [])
        trades.append(trade)
    
    return trades


# ── Top Members List ───────────────────────────────────────────────────────────

# Key members to track (high-profile traders + committee chairs)
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
]

REPRESENTATIVES_TO_TRACK = [
    ('Pelosi', 'CA', 11), ('McCarthy', 'CA', 20), ('Jeffries', 'NY', 8),
    ('Scalise', 'LA', 1), ('Emmer', 'MN', 6), ('Trump', 'FL', 27),
    ('Jordan', 'OH', 4), ('Banks', 'IN', 3), ('Gaetz', 'FL', 1),
    ('Roy', 'TX', 21), ('Biggs', 'AZ', 5), ('Gym', 'CA', 17),
    ('Maloney', 'NY', 18), ('Cox', 'CA', 45), ('Parker', 'FL', 22),
    ('Miller', 'WI', 5), ('Wilson', 'SC', 2), ('Arrington', 'TX', 19),
    ('Feenstra', 'IA', 4), ('Nunn', 'IA', 3), ('Burlison', 'MO', 7),
    ('Mace', 'SC', 1), ('Grothman', 'WI', 6), (' Nehls', 'TX', 22),
    ('Cawthorn', 'NC', 11), ('Bice', 'OK', 5), ('Eagle', 'TX', 15),
    ('Van Duyne', 'TX', 24), ('Steil', 'WI', 1), ('Fischer', 'NE', 1),
]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Scrape congressional stock trades')
    parser.add_argument('--years', nargs='+', default=['2024', '2025'], help='Years to scrape')
    parser.add_argument('--full-backfill', action='store_true', help='Scrape all years 2012-present')
    parser.add_argument('--member', type=str, help='Specific member last name')
    parser.add_argument('--state', type=str, help='Member state (2-letter)')
    parser.add_argument('--chamber', type=str, choices=['house', 'senate'], help='Chamber')
    args = parser.parse_args()

    years = []
    if args.full_backfill:
        years = [str(y) for y in range(2012, datetime.now().year + 1)]
    else:
        years = args.years or ['2024', '2025']

    total_trades = 0
    total_members = 0

    # Specific member targeted
    if args.member and args.state:
        chamber = args.chamber or 'house'
        for year in years:
            if chamber == 'house':
                trades = scrape_house_member(args.member, args.state, None, year)
            else:
                trades = scrape_senator(args.member, args.state, year)
            print(f"  Year {year}: {len(trades)} trades")
            total_trades += len(trades)
            insert_trades(trades)
        print(f"✅ Done — {total_trades} trades scraped")
        return

    # Full scrape of known members
    print(f"📋 Scraping {len(SENATORS_TO_TRACK)} senators + {len(REPRESENTATIVES_TO_TRACK)} representatives")
    print(f"   Years: {years}")
    
    for year in years:
        print(f"\n📅 Year {year}")
        
        # Senate
        print("  🏛️  Senate...")
        for name, state in SENATORS_TO_TRACK:
            try:
                trades = scrape_senator(name, state, year)
                print(f"    {name} ({state}): {len(trades)} trades")
                total_trades += len(trades)
                insert_trades(trades)
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"    ❌ Error scraping {name}: {e}")
        
        # House
        print("  🏛️  House...")
        for name, state, district in REPRESENTATIVES_TO_TRACK:
            try:
                trades = scrape_house_member(name, state, district, year)
                print(f"    {name} ({state}-{district}): {len(trades)} trades")
                total_trades += len(trades)
                insert_trades(trades)
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"    ❌ Error scraping {name}: {e}")

    print(f"\n✅ Complete — {total_trades} trades scraped")


if __name__ == '__main__':
    main()
