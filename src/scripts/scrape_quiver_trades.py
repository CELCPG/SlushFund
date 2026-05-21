#!/usr/bin/env python3
"""
SlushFund — Quiver Quantitative API Scraper
Fetches congressional stock trades from Quiver Quantitative's free API endpoint
and upserts into Supabase.

Usage:
    python3 scrape_quiver_trades.py                    # fetch + upsert
    python3 scrape_quiver_trades.py --dry-run         # fetch + print, no DB
    python3 scrape_quiver_trades.py --members          # also upsert member profiles

Quiver API (free tier, hardcoded token):
    GET /beta/live/congresstrading  → 1000 most recent congress trades

Rate limits: token appears limited to ~1 call/5s. Use --delay 5 between retries.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, date
from typing import Any, Optional

# ── Load env from project dir ─────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env.local'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
QUIVER_TOKEN = "TyTJwjuEC7VV7mOqZ622haRaaUr0x0Ng4nrwSRFKQs7vdoBcJlK9qjAS69ghzhFu"

# ── Supabase client ────────────────────────────────────────────────────────────
HAS_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
sb = None
if HAS_SUPABASE:
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase connected: {SUPABASE_URL[:40]}...")
    except ImportError:
        print("⚠️  pip install supabase")
        HAS_SUPABASE = False

# ── Quiver API ────────────────────────────────────────────────────────────────
QUIVER_BASE = "https://api.quiverquant.com/beta"
HEADERS = {
    "accept": "application/json",
    "X-CSRFToken": QUIVER_TOKEN,
    "Authorization": f"Token {QUIVER_TOKEN}",
}

# ── Known sector map for federal contractor tickers ────────────────────────────
FED_CONTRACTOR_TICKERS = {
    "PLTR": {"sector": "AI/Defense", "company": "Palantir Technologies", "risk": "palantir"},
    "BA":   {"sector": "Defense",     "company": "Boeing",                "risk": "boeing"},
    "RTX":  {"sector": "Defense",     "company": "Raytheon",              "risk": "raytheon"},
    "LMT":  {"sector": "Defense",     "company": "Lockheed Martin",       "risk": "lockheed"},
    "NOC":  {"sector": "Defense",     "company": "Northrop Grumman",      "risk": "northrop"},
    "GD":   {"sector": "Defense",     "company": "General Dynamics",      "risk": "general_dynamics"},
    "LHX":  {"sector": "Defense",     "company": "L3Harris",              "risk": "l3harris"},
    "NVDA": {"sector": "AI/Chips",    "company": "NVIDIA",                "risk": "nvidia"},
    "AMD":  {"sector": "AI/Chips",    "company": "AMD",                   "risk": "amd"},
    "INTC": {"sector": "AI/Chips",    "company": "Intel",                 "risk": "intel"},
    "MSFT": {"sector": "AI/Tech",     "company": "Microsoft",            "risk": "microsoft"},
    "GOOGL":{"sector": "AI/Tech",     "company": "Alphabet (Google)",     "risk": "google"},
    "GOOG": {"sector": "AI/Tech",     "company": "Alphabet (Google)",     "risk": "google"},
    "AMZN": {"sector": "AI/Tech",     "company": "Amazon",                "risk": "amazon"},
    "META": {"sector": "AI/Tech",     "company": "Meta",                 "risk": "meta"},
    "AAPL":{"sector": "AI/Tech",      "company": "Apple",                 "risk": "apple"},
    "TSLA":{"sector": "Auto/Energy",  "company": "Tesla",                 "risk": "tesla"},
    "XOM": {"sector": "Energy",       "company": "Exxon Mobil",           "risk": "exxon"},
    "CVX": {"sector": "Energy",       "company": "Chevron",               "risk": "chevron"},
    "GS":  {"sector": "Finance",      "company": "Goldman Sachs",        "risk": "goldman"},
    "MS":  {"sector": "Finance",      "company": "Morgan Stanley",       "risk": "morgan_stanley"},
    "JPM": {"sector": "Finance",      "company": "JPMorgan Chase",        "risk": "jpmorgan"},
    "BAC": {"sector": "Finance",      "company": "Bank of America",       "risk": "bank_of_america"},
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_quiver(endpoint: str, retries: int = 3, delay: float = 5.0) -> Optional[list]:
    """Fetch from Quiver API with retry + backoff."""
    import requests
    url = f"{QUIVER_BASE}{endpoint}"
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                content_type = r.headers.get("content-type", "")
                if "json" in content_type:
                    return r.json()
                # Sometimes API returns HTML error page
                if r.text.strip().startswith("<"):
                    raise ValueError(f"API returned HTML instead of JSON: {r.text[:200]}")
            elif r.status_code == 500:
                # Rate limited or server error — retry
                print(f"  ⚠️  Attempt {attempt+1}/{retries}: HTTP 500, retrying in {delay}s...")
                time.sleep(delay)
                delay *= 1.5
                continue
            else:
                print(f"  ⚠️  HTTP {r.status_code}: {r.text[:200]}")
                return None
        except Exception as e:
            print(f"  ⚠️  Attempt {attempt+1}/{retries} error: {e}")
            time.sleep(delay)
            delay *= 1.5
    print(f"  ❌ All {retries} attempts failed for {endpoint}")
    return None


def parse_amount_range(range_str: str) -> tuple[Optional[int], Optional[int], str]:
    """Parse Quiver 'Range' field like '$15,001 - $50,000' into min/max ints."""
    if not range_str:
        return None, None, range_str
    import re
    raw = range_str.strip()
    # Extract all numbers
    numbers = re.findall(r"[\d,]+", raw)
    numbers = [int(n.replace(",", "")) for n in numbers if n]
    if not numbers:
        return None, None, raw
    if len(numbers) == 1:
        return numbers[0], numbers[0], raw
    return numbers[0], numbers[-1], raw  # use first and last found


def quiver_to_trade_row(row: dict) -> dict:
    """Map a Quiver congress_trading row to our congress_trades schema."""
    ticker   = (row.get("Ticker") or "").strip().upper()
    tx_type  = (row.get("Transaction") or "BUY").strip().upper()
    range_str= row.get("Range") or ""
    amount   = row.get("Amount")  # numeric, mid-point estimate

    # Ticker type
    ticker_type = (row.get("TickerType") or "ST").upper()
    if ticker_type == "ST":
        asset_type = "Stock"
    elif ticker_type == "OPT":
        asset_type = "Option"
    elif ticker_type == "ETF":
        asset_type = "ETF"
    else:
        asset_type = ticker_type

    # Amount range → min/max
    amt_min, amt_max, _ = parse_amount_range(range_str)

    # Transaction date
    tx_date_raw = row.get("TransactionDate") or row.get("Date")
    tx_date = None
    if tx_date_raw:
        try:
            tx_date = datetime.strptime(str(tx_date_raw)[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            tx_date = None

    filed_raw = row.get("ReportDate") or row.get("Filed")
    filed_date = None
    if filed_raw:
        try:
            filed_date = datetime.strptime(str(filed_raw)[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            filed_date = None

    chamber_raw = str(row.get("House", "Representatives")).strip()
    chamber = "Senate" if chamber_raw.lower() == "senate" else "House"

    party = (row.get("Party") or "Unknown").strip()
    if party not in ("Democrat", "Republican", "Independent"):
        party = "Unknown"

    flags = []
    signal_type = "routine"

    # Contractor flag
    if ticker in FED_CONTRACTOR_TICKERS:
        flags.append("federal_contractor_overlap")

    # Large trade (>$500K max)
    if amt_max and amt_max >= 500_000:
        flags.append("large_trade")
        signal_type = "suspicious"

    # Buy/Sell
    flags.append("buy" if "BUY" in tx_type else "sell")

    # Get company name from our map or use description
    company_name = FED_CONTRACTOR_TICKERS.get(ticker, {}).get("company", row.get("Description") or ticker)

    return {
        "member_name":     (row.get("Representative") or "").strip(),
        "member_chamber": chamber,
        "member_party":   party,
        "member_state":   extract_state_from_name(row.get("Representative") or ""),
        "ticker":         ticker,
        "company_name":   company_name,
        "transaction_type": "BUY" if "BUY" in tx_type else ("SELL" if "SELL" in tx_type else tx_type),
        "asset_type":     asset_type,
        "amount_min":     amt_min,
        "amount_max":     amt_max,
        "amount_range":   range_str or None,
        "transaction_date": tx_date,
        "filed_date":     filed_date,
        "disclosure_year": int(str(filed_date or tx_date or "")[:4]) if (filed_date or tx_date) else None,
        "source_system":  "QuiverQuant",
        "flags":          flags,
        "signal_type":    signal_type,
        "has_federal_contract": ticker in FED_CONTRACTOR_TICKERS,
        "bio_guide_id":   row.get("BioGuideID") or None,
        # related_contracts: populated by separate join query if needed
    }


def extract_state_from_name(name: str) -> str:
    """Extract state code from representative name like 'John Boozman'."""
    # Quiver data sometimes has 'Rep. John Boozman' or just 'John Boozman'
    # State is not in the name — we need to look up from a members table
    # Return Unknown for now; will enrich via member upsert
    return "Unknown"


def build_members_from_trades(trades: list) -> list:
    """Build a member profile from a list of trade rows."""
    # Group by representative
    members = {}
    for t in trades:
        name = t.get("member_name")
        if not name or name in members:
            continue
        members[name] = {
            "name": name,
            "last_name": name.split()[-1] if " " in name else name,
            "first_name": name.split()[0] if " " in name else "",
            "chamber": t.get("member_chamber", "House"),
            "party": t.get("member_party", "Unknown"),
            "state": "Unknown",
            "district": None,
            "state_name": "Unknown",
            "committees": [],
            "in_office": True,
            "disclosure_url": None,
        }
    return list(members.values())


def upsert_trades(trades: list) -> int:
    """Upsert trades into congress_trades. Returns count."""
    if not sb or not trades:
        return 0
    try:
        result = sb.table("congress_trades").upsert(
            trades,
            on_conflict="member_name,ticker,transaction_date,transaction_type",
            ignore_duplicates=False,
        ).execute()
        return len(trades)
    except Exception as e:
        print(f"  ❌ Supabase upsert error: {e}")
        return 0


def upsert_members(members: list) -> int:
    """Upsert members into congress_members. Returns count."""
    if not sb or not members:
        return 0
    try:
        result = sb.table("congress_members").upsert(
            members,
            on_conflict="name,chamber",
            ignore_duplicates=True,
        ).execute()
        return len(members)
    except Exception as e:
        print(f"  ❌ Member upsert error: {e}")
        return 0


def mark_contract_overlap() -> int:
    """Mark trades whose tickers appear in SlushFund awards (DB join)."""
    if not sb:
        return 0
    try:
        # Get all tickers that have federal contracts in our awards table
        # (awards table has company_name, contractor_name, connection_type)
        result = sb.table("congress_trades").select("id, ticker").execute()
        if not result.data:
            return 0
        ticker_set = {r["ticker"] for r in result.data if r.get("ticker")}
        overlap = [t for t in ticker_set if t in FED_CONTRACTOR_TICKERS]
        count = 0
        for ticker in overlap:
            sb.table("congress_trades").update(
                {"has_federal_contract": True, "flags": ["federal_contractor_overlap"]}
            ).eq("ticker", ticker).execute()
            count += 1
        print(f"  🔗 Marked {count} tickers as federal contractor overlap")
        return count
    except Exception as e:
        print(f"  ⚠️  Could not mark contract overlap: {e}")
        return 0


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SlushFund Quiver API scraper")
    parser.add_argument("--dry-run", action="store_true", help="Print trades without DB writes")
    parser.add_argument("--members", action="store_true", help="Also upsert member profiles")
    parser.add_argument("--delay", type=float, default=5.0, help="Retry delay in seconds")
    args = parser.parse_args()

    print("=" * 60)
    print("🏛️  SlushFund — Quiver Quantitative Congress Trading Scraper")
    print("=" * 60)

    # ── Fetch from Quiver ──────────────────────────────────────────────────
    print(f"\n📡 Fetching congress_trading from Quiver API...")
    raw = fetch_quiver("/live/congresstrading", retries=5, delay=args.delay)
    if raw is None:
        print("❌ Failed to fetch from Quiver. Check token / rate limit.")
        sys.exit(1)

    print(f"  ✅ Received {len(raw)} rows from Quiver")

    # ── Parse ──────────────────────────────────────────────────────────────
    print(f"\n🔄 Parsing {len(raw)} rows into trade records...")
    trades = []
    errors = 0
    for row in raw:
        try:
            trade = quiver_to_trade_row(row)
            if trade.get("ticker") and trade.get("member_name"):
                trades.append(trade)
        except Exception as e:
            errors += 1
            print(f"  ⚠️  Parse error: {e} — row: {row}")

    print(f"  ✅ {len(trades)} valid trades, {errors} parse errors")
    if not trades:
        print("❌ No valid trades extracted. Quiver API may have changed format.")
        sys.exit(1)

    # ── Deduplicate ───────────────────────────────────────────────────────
    seen = set()
    unique_trades = []
    for t in trades:
        key = (t["member_name"], t["ticker"], t["transaction_date"], t["transaction_type"])
        if key not in seen:
            seen.add(key)
            unique_trades.append(t)
    print(f"  🔄 {len(trades) - len(unique_trades)} duplicates removed → {len(unique_trades)} unique")

    # ── Print summary ──────────────────────────────────────────────────────
    print(f"\n📊 Summary:")
    print(f"  Trades:       {len(unique_trades)}")
    print(f"  Members:      {len(set(t['member_name'] for t in unique_trades))}")
    print(f"  Tickers:     {len(set(t['ticker'] for t in unique_trades))}")
    chambers = {}
    for t in unique_trades:
        chambers[t["member_chamber"]] = chambers.get(t["member_chamber"], 0) + 1
    for c, n in chambers.items():
        print(f"    {c}: {n}")
    parties = {}
    for t in unique_trades:
        parties[t["member_party"]] = parties.get(t["member_party"], 0) + 1
    for p, n in parties.items():
        print(f"    {p}: {n}")

    tx_types = {}
    for t in unique_trades:
        tx_types[t["transaction_type"]] = tx_types.get(t["transaction_type"], 0) + 1
    for tx, n in tx_types.items():
        print(f"    {tx}: {n}")

    print(f"\n  Top 10 tickers:")
    ticker_counts = {}
    for t in unique_trades:
        ticker_counts[t["ticker"]] = ticker_counts.get(t["ticker"], 0) + 1
    for ticker, count in sorted(ticker_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {ticker}: {count} trades")

    # ── Upsert to Supabase ────────────────────────────────────────────────
    if args.dry_run:
        print(f"\n[DRY RUN] Skipping Supabase write")
    else:
        print(f"\n💾 Upserting {len(unique_trades)} trades to Supabase...")
        count = upsert_trades(unique_trades)
        print(f"  ✅ {count} trades upserted")

        if args.members:
            print(f"\n👤 Upserting member profiles...")
            members = build_members_from_trades(unique_trades)
            m_count = upsert_members(members)
            print(f"  ✅ {m_count} members upserted")

        print(f"\n🔗 Marking federal contractor overlaps...")
        mark_contract_overlap()

    print(f"\n✅ Done — {len(unique_trades)} trades ready")
    print("=" * 60)


if __name__ == "__main__":
    main()
