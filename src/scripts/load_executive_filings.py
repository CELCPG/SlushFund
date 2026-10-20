"""R10f M5: load src/scripts/executive_filings.json into executive_filings (one row per OGE 278-T report of the President).

    python src/scripts/load_executive_filings.py [--dry-run]

Needs migration supabase/migrations/20261014_r10f_executive_filings.sql applied first ("migration pending Apex" until
then: this script says so and exits 2 without writing). Upserts on source_doc_id; writes only executive_filings.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_executive_trades import client  # noqa: E402

DATA = Path(__file__).resolve().parent / "executive_filings.json"
MIGRATION = "supabase/migrations/20261014_r10f_executive_filings.sql"


def load_data(path: Path = DATA) -> tuple[dict, list[dict]]:
    d = json.loads(path.read_text(encoding="utf-8"))
    return d["official"], d["filings"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    official, filings = load_data()
    sb = client()
    try:
        sb.table("executive_filings").select("id").limit(1).execute()
    except Exception as e:  # PostgREST: relation does not exist
        print(f"executive_filings does not exist yet: migration pending Apex ({MIGRATION}). {type(e).__name__}", file=sys.stderr)
        return 2
    oid = sb.table("officials").select("id").eq("name", official["name"]).eq("office", official["office"]).execute().data[0]["id"]
    rows = [{**f, "official_id": oid} for f in filings]
    if a.dry_run:
        print(f"dry run: {len(rows)} filings")
        return 0
    sb.table("executive_filings").upsert(rows, on_conflict="source_doc_id").execute()
    back = sb.table("executive_filings").select("source_doc_id,reviewer_comment").execute().data
    notes = sum(1 for r in back if r["reviewer_comment"] and r["reviewer_comment"].startswith("Filer paid late fee"))
    print(f"loaded {len(rows)} filings; table now {len(back)} rows, {notes} late-fee notes")
    return 0 if len(back) == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
