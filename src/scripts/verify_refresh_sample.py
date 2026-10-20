#!/usr/bin/env python3
"""R9: field-by-field spot check of rows a refresh added. Draws N random House rows created on/after --since
(UTC timestamp) and re-checks each against its Clerk PDF with verify_house_trades.check (member, state/district,
ticker + date line, P/S/E type, amount band, owner, asset name, first report).

    python src/scripts/verify_refresh_sample.py --since 2026-10-20T01:00:00Z --n 20 --seed 9 --out sample.json

Senate rows are checked with verify_senate_trades.py (it samples by seed, not by creation time); a refresh that
added no Senate rows has nothing to draw here.
"""
import argparse
import json
import os
import random
import sys

from _venv import activate

activate()
from supabase import create_client  # noqa: E402

import verify_house_trades as v  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", required=True)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--seed", type=int, default=9)
    ap.add_argument("--out", default="refresh_sample.json")
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "/tmp"), "slushfund-verify-pdfs"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    ids, start = [], 0
    while True:
        page = (sb.table("congress_trades").select("id").eq("member_chamber", "House").gte("created_at", args.since)
                .order("id").range(start, start + 999).execute().data)
        ids += [r["id"] for r in page]
        if len(page) < 1000:
            break
        start += 1000
    picked = random.Random(args.seed).sample(sorted(ids), min(args.n, len(ids)))
    rows = sb.table("congress_trades").select(v.COLS).in_("id", picked).execute().data
    idx_cache = {}
    results = [v.check(r, v.pdf_lines(r["disclosure_url"], args.cache), args.cache, idx_cache, True) for r in rows]
    json.dump({"since": args.since, "rows_in_pool": len(ids), "seed": args.seed, "results": results},
              open(args.out, "w", encoding="utf-8"), indent=1, default=str)
    ok = sum(r["all_ok"] for r in results)
    print(f"pool {len(ids)} new House rows; sampled {len(results)}; all fields match: {ok}/{len(results)}")
    for k in results[0]["checks"] if results else []:
        print(f"  {k}: {sum(r[k] for r in results)}/{len(results)}")
    for r in results:
        if not r["all_ok"]:
            print("MISMATCH", r["year"], r["doc"], r["member"], r["ticker"], r["date"], r["type"], r["amount_range"],
                  r["owner"], [k for k in r["checks"] if not r[k]], "|", r["evidence"][:160])
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
