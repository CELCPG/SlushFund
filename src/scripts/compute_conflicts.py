#!/usr/bin/env python3
"""
SlushFund Conflict Engine — score every congressional trade for conflict of interest.

For each trade it computes four independent, documentable signals:

  1. Committee jurisdiction — the member sits on a committee that oversees the
     traded company's sector (current committee assignments; see load_committees.py).
  2. Federal contractor — the traded company holds federal contracts, verified
     against the `awards` table.
  3. STOCK Act violation — the trade was disclosed more than 45 days after it
     happened, breaching the STOCK Act's reporting deadline.
  4. Large position — the disclosed amount range tops $250K.

These combine into a 0-100 `conflict_score` and a tier. Every reason is a fact
with a primary source, not a legal conclusion.

Prereqs: run load_committees.py first.
Usage: python3 src/scripts/compute_conflicts.py
"""

import os
import sys

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Ticker → sector ─────────────────────────────────────────────────────────────
SECTOR_MAP = {}
for _tk in "LMT RTX BA NOC GD LHX PLTR HII LDOS BAH KTOS AXON GE HON".split():
    SECTOR_MAP[_tk] = "defense"
for _tk in "MSFT AAPL GOOGL GOOG AMZN META NVDA AMD INTC ORCL CRM CSCO IBM QCOM TXN ADBE NFLX ACN".split():
    SECTOR_MAP[_tk] = "tech"
for _tk in ("PFE MRNA JNJ ABBV MRK LLY AMGN BMY GILD BIIB REGN VRTX UNH CVS CI HUM "
            "ELV CNC MCK ABT TMO DHR ZTS ISRG MDT").split():
    SECTOR_MAP[_tk] = "pharma"
for _tk in "XOM CVX COP EOG SLB OXY PSX VLO MPC KMI WMB NEE DUK SO".split():
    SECTOR_MAP[_tk] = "energy"
for _tk in "JPM BAC GS MS WFC C BLK SCHW AXP USB PNC BX KKR".split():
    SECTOR_MAP[_tk] = "finance"
for _tk in "COIN MSTR HOOD".split():
    SECTOR_MAP[_tk] = "crypto"
for _tk in "TSLA F GM RIVN".split():
    SECTOR_MAP[_tk] = "auto"

# ── Sector → committee-name keywords with jurisdiction over it ──────────────────
JURISDICTION = {
    "defense": ["Armed Services"],
    "tech": ["Energy and Commerce", "Commerce, Science", "Judiciary"],
    "pharma": ["Energy and Commerce", "Health, Education", "Ways and Means", "Finance"],
    "energy": ["Energy and Commerce", "Energy and Natural Resources", "Natural Resources"],
    "finance": ["Financial Services", "Banking, Housing"],
    "crypto": ["Financial Services", "Banking, Housing", "Agriculture"],
    "auto": ["Energy and Commerce", "Commerce, Science"],
}

# ── Tickers whose issuers are significant federal contractors ───────────────────
# value = an uppercase keyword to verify against awards.recipient_name
FEDERAL_CONTRACTORS = {
    "LMT": "LOCKHEED", "RTX": "RAYTHEON", "BA": "BOEING", "NOC": "NORTHROP",
    "GD": "GENERAL DYNAMICS", "LHX": "L3", "PLTR": "PALANTIR", "HII": "HUNTINGTON INGALLS",
    "LDOS": "LEIDOS", "BAH": "BOOZ ALLEN", "KTOS": "KRATOS", "GE": "GENERAL ELECTRIC",
    "HON": "HONEYWELL", "MSFT": "MICROSOFT", "AMZN": "AMAZON", "GOOGL": "GOOGLE",
    "ORCL": "ORACLE", "IBM": "IBM", "ACN": "ACCENTURE", "CSCO": "CISCO",
    "PFE": "PFIZER", "MRNA": "MODERNA", "JNJ": "JOHNSON", "MCK": "MCKESSON",
    "CVS": "CVS", "UNH": "UNITEDHEALTH", "CAT": "CATERPILLAR", "DE": "DEERE",
    "TSLA": "TESLA", "XOM": "EXXON", "CVX": "CHEVRON",
}

SCORE_WEIGHTS = {"committee": 45, "contractor": 30, "stock_act": 15, "large": 10}


def tier_for(score: int) -> str:
    if score >= 70:
        return "severe"
    if score >= 45:
        return "high"
    if score >= 20:
        return "elevated"
    return "routine"


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not set")
        return 1
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── members → committees ────────────────────────────────────────────────────
    members = []
    page = 0
    while True:
        rows = (sb.table("congress_members")
                .select("name,last_name,state,chamber,committees")
                .range(page * 1000, page * 1000 + 999).execute().data)
        members.extend(rows)
        if len(rows) < 1000:
            break
        page += 1
    by_name = {}
    by_last_state = {}
    for m in members:
        committees = m.get("committees") or []
        by_name[(m["name"] or "").lower()] = committees
        key = ((m.get("last_name") or "").lower(), m.get("state") or "")
        by_last_state.setdefault(key, []).extend(committees)
    print(f"Loaded {len(members)} members; {sum(1 for m in members if m.get('committees'))} with committees")

    # ── verify which contractor tickers actually appear in awards ───────────────
    award_names = set()
    page = 0
    while True:
        rows = (sb.table("awards").select("recipient_name")
                .range(page * 1000, page * 1000 + 999).execute().data)
        for r in rows:
            if r.get("recipient_name"):
                award_names.add(r["recipient_name"].upper())
        if len(rows) < 1000:
            break
        page += 1
    verified_contractors = {
        tk for tk, kw in FEDERAL_CONTRACTORS.items()
        if any(kw in name for name in award_names)
    }
    print(f"Loaded {len(award_names)} award recipients; "
          f"{len(verified_contractors)}/{len(FEDERAL_CONTRACTORS)} contractor tickers verified")

    def committees_for(trade):
        name = (trade.get("member_name") or "").lower()
        if name in by_name and by_name[name]:
            return by_name[name]
        last = name.split()[-1] if name else ""
        return by_last_state.get((last, trade.get("member_state") or ""), [])

    # ── score every trade ───────────────────────────────────────────────────────
    updates = []
    page = 0
    stats = {"severe": 0, "high": 0, "elevated": 0, "routine": 0}
    while True:
        # carry NOT NULL columns through so the upsert's INSERT path stays valid
        trades = (sb.table("congress_trades")
                  .select("id,member_name,member_chamber,member_party,member_state,"
                          "ticker,company_name,transaction_type,asset_type,"
                          "transaction_date,filed_date,amount_max,source_system")
                  .range(page * 1000, page * 1000 + 999).execute().data)
        if not trades:
            break
        for t in trades:
            ticker = (t.get("ticker") or "").upper()
            sector = SECTOR_MAP.get(ticker)
            reasons, score = [], 0

            # committee jurisdiction
            committee_conflict = False
            committee_detail = None
            if sector:
                member_committees = committees_for(t)
                for kw in JURISDICTION.get(sector, []):
                    hit = next((c for c in member_committees if kw in c), None)
                    if hit:
                        committee_conflict = True
                        committee_detail = f"{hit} ({sector})"
                        score += SCORE_WEIGHTS["committee"]
                        reasons.append(f"Sits on {hit} — jurisdiction over the {sector} sector")
                        break

            # federal contractor
            has_contract = ticker in verified_contractors
            if has_contract:
                score += SCORE_WEIGHTS["contractor"]
                reasons.append("Traded company holds federal contracts (USAspending)")

            # STOCK Act timeliness
            days_to_file = None
            stock_act_late = False
            td, fd = t.get("transaction_date"), t.get("filed_date")
            if td and fd:
                from datetime import date
                try:
                    days_to_file = (date.fromisoformat(fd) - date.fromisoformat(td)).days
                    if days_to_file > 45:
                        stock_act_late = True
                        score += SCORE_WEIGHTS["stock_act"]
                        reasons.append(
                            f"Disclosed {days_to_file} days after the trade — "
                            f"past the STOCK Act's 45-day deadline")
                except ValueError:
                    pass

            # large position
            if (t.get("amount_max") or 0) >= 250_000:
                score += SCORE_WEIGHTS["large"]
                reasons.append("Large position — disclosed range tops $250K")

            score = min(score, 100)
            tier = tier_for(score)
            stats[tier] += 1
            updates.append({
                "id": t["id"],
                # carried unchanged — required so the upsert INSERT path is valid
                "member_name": t["member_name"],
                "member_chamber": t["member_chamber"],
                "member_party": t["member_party"],
                "member_state": t["member_state"],
                "ticker": t["ticker"],
                "company_name": t["company_name"],
                "transaction_type": t["transaction_type"],
                "asset_type": t["asset_type"],
                "transaction_date": t["transaction_date"],
                "source_system": t["source_system"],
                # computed conflict signals
                "days_to_file": days_to_file,
                "stock_act_late": stock_act_late,
                "committee_conflict": committee_conflict,
                "committee_conflict_detail": committee_detail,
                "conflict_reasons": reasons,
                "conflict_score": score,
                "conflict_tier": tier,
                "has_federal_contract": has_contract,
            })
        if len(trades) < 1000:
            break
        page += 1

    # ── write back ──────────────────────────────────────────────────────────────
    for i in range(0, len(updates), 500):
        sb.table("congress_trades").upsert(updates[i:i + 500]).execute()
        print(f"  updated {min(i + 500, len(updates))}/{len(updates)}")

    print(f"\nScored {len(updates)} trades:")
    for tier in ("severe", "high", "elevated", "routine"):
        print(f"  {tier:9} {stats[tier]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
