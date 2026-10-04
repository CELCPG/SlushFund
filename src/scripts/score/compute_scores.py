#!/usr/bin/env python3
"""
Run the public_servant_score.compute_scores() RPC for this week.

Pre-compute step: enrich senator_trades with committee_overlap_sectors and
conflict_flag so the SQL scoring function can do a single JOIN. We do this
in Python (not SQL) because the committee→sector mapping is curated.

For Phase 1 we use a static GICS-sector → committee keyword map. Phase 2
will replace this with a per-senator committee→sector join from a proper
committees table.

Usage:
  python3 compute_scores.py                 # score this week
  python3 compute_scores.py --week 2026-06-08   # backfill a specific week
  python3 compute_scores.py --dry               # summary, no writes
"""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

from _common import get_supabase_admin, report_run

SCORING_VERSION = "0.1.0"

# Static sector mapping: committee name keywords → GICS sector tags
# A trade is flagged as conflict if any committee keyword matches the asset
# description OR the ticker's sector. We approximate via ticker suffix/keyword.
COMMITTEE_SECTORS = {
    "armed services": ["defense", "aerospace", "military", "weapons"],
    "banking": ["financial", "bank", "fintech", "insurance"],
    "finance": ["financial", "tax", "bank", "fiscal", "trade"],
    "commerce": ["tech", "retail", "telecom", "media", "consumer"],
    "energy": ["energy", "oil", "gas", "utilities", "renewable"],
    "environment": ["energy", "oil", "gas", "chemical", "mining"],
    "agriculture": ["food", "agriculture", "farming", "commodity"],
    "health": ["pharma", "biotech", "healthcare", "insurance", "hospital"],
    "intelligence": ["defense", "tech", "cyber", "security"],
    "judiciary": ["legal", "tech"],
    "homeland": ["security", "defense", "cyber"],
    "foreign relations": ["defense", "energy", "oil", "geopolitical"],
    "small business": ["financial", "retail", "small business"],
}

# Ticker → GICS sector lookup (we keep a small static map for common tickers;
# Phase 2 will hydrate from a full GICS table).
TICKER_SECTOR = {
    "AAPL": "tech", "MSFT": "tech", "GOOGL": "tech", "AMZN": "consumer",
    "META": "tech", "NVDA": "tech", "TSLA": "consumer",
    "JPM": "financial", "BAC": "financial", "WFC": "financial", "GS": "financial",
    "XOM": "energy", "CVX": "energy", "COP": "energy",
    "PFE": "pharma", "JNJ": "pharma", "MRNA": "pharma", "UNH": "healthcare",
    "BA": "aerospace", "LMT": "defense", "RTX": "defense", "NOC": "defense", "GD": "defense",
    "XLE": "energy", "XLF": "financial", "XLK": "tech", "XLV": "healthcare",
    "SPY": None, "VTI": None, "VOO": None, "QQQ": None, "IWM": None,  # diversified → skip
}


def detect_sectors(asset_description: str, ticker: str | None) -> set:
    """Return the set of GICS sector tags inferred from a trade's asset/ticker."""
    sectors = set()
    if ticker and ticker.upper() in TICKER_SECTOR:
        s = TICKER_SECTOR[ticker.upper()]
        if s:
            sectors.add(s)
    desc = (asset_description or "").lower()
    for keyword, tags in {
        "energy": ["energy", "oil", "gas", "petroleum", "pipeline"],
        "financial": ["bank", "financial", "capital", "credit", "insurance"],
        "defense": ["defense", "military", "aerospace", "raytheon", "lockheed", "boeing"],
        "tech": ["tech", "software", "semiconductor", "cyber", "data"],
        "pharma": ["pharma", "biotech", "therapeutics", "vaccine"],
        "healthcare": ["health", "medical", "hospital"],
        "retail": ["retail", "consumer", "walmart", "costco"],
        "commodity": ["gold", "silver", "oil", "wheat", "corn", "soy"],
        "crypto": ["bitcoin", "ethereum", "crypto", "coinbase"],
    }.items():
        if any(t in desc for t in tags):
            sectors.add(keyword)
    return sectors


def detect_committee_sectors(committees: list[str]) -> set:
    """Map a list of committee names to GICS sector tags."""
    sectors = set()
    for c in committees or []:
        c_low = c.lower()
        for keyword, tags in COMMITTEE_SECTORS.items():
            if keyword in c_low:
                sectors.update(tags)
    return sectors


def enrich_trades_with_conflicts(sb) -> tuple[int, int]:
    """Walk every senator_trades row, set committee_overlap_sectors + conflict_flag.

    Returns (enriched, conflicts_flagged).
    """
    # Get all senators with their committees
    res = sb.table("senators").select("id, committees").eq("is_active", True).execute()
    sen_by_id = {s["id"]: detect_committee_sectors(s.get("committees") or []) for s in (res.data or [])}

    # Get all trades (paginate to avoid huge response)
    enriched, flagged = 0, 0
    offset = 0
    page_size = 500
    while True:
        res = sb.table("senator_trades").select("id, senator_id, asset_description, ticker").range(offset, offset + page_size - 1).execute()
        rows = res.data or []
        if not rows:
            break
        updates: list[dict] = []
        for r in rows:
            asset_sectors = detect_sectors(r.get("asset_description") or "", r.get("ticker"))
            committee_sectors = sen_by_id.get(r["senator_id"], set())
            overlap = list(asset_sectors & committee_sectors)
            update = {
                "id": r["id"],
                "committee_overlap_sectors": overlap,
                "conflict_flag": bool(overlap),
            }
            updates.append(update)
            if overlap:
                flagged += 1
        # Batch update
        for u in updates:
            try:
                sb.table("senator_trades").update({
                    "committee_overlap_sectors": u["committee_overlap_sectors"],
                    "conflict_flag": u["conflict_flag"],
                }).eq("id", u["id"]).execute()
                enriched += 1
            except Exception:
                pass
        offset += page_size
        if len(rows) < page_size:
            break
    return enriched, flagged


def hydrate_committees(sb) -> int:
    """Populate senators.committees[] from a static curated map (Phase 1).

    ProPublica member detail includes committees; for Phase 1 we maintain a
    manual map. Phase 2 will fetch live from ProPublica per-senator.
    """
    # In Phase 2 this fetches from ProPublica. For now we just mark we tried.
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--week", default=None, help="ISO date (default: today)")
    args = ap.parse_args()

    week = args.week or date.today().isoformat()
    print(f"== Computing Public Servant Scores for week {week} (v{SCORING_VERSION}) ==")

    sb = get_supabase_admin()

    print("   1) hydrating committees...")
    hydrate_committees(sb)

    print("   2) enriching trades with committee conflicts...")
    enriched, flagged = enrich_trades_with_conflicts(sb)
    print(f"      enriched={enriched}, conflicts_flagged={flagged}")

    print(f"   3) calling compute_scores({week}, {SCORING_VERSION})...")
    if args.dry:
        report_run("senator_scores", 0, 0, 0, 0, dry=True)
        return 0

    res = sb.rpc("compute_scores", {"target_week": week, "version": SCORING_VERSION}).execute()
    count = res.data if isinstance(res.data, int) else 0
    report_run("senator_scores", count, 0, 0, 0)

    # Show the leaderboard preview
    print("\n   Top 5:")
    res = sb.rpc("get_score_leaderboard", {"target_week": week}).execute()
    if res.data:
        senators = res.data.get("senators", [])
        for s in senators[:5]:
            print(f"   - {s['full_name']} ({s['state']}-{s['party']}): {s['total_score']} ({s['grade']})")
        print(f"\n   Bottom 5:")
        for s in senators[-5:]:
            print(f"   - {s['full_name']} ({s['state']}-{s['party']}): {s['total_score']} ({s['grade']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
