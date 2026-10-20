"""R10d: apply oge_overrides.json to the executive_trades rows already in the database and log every change.

build_rows() applies the same file on every rebuild from the page cache; this script brings the loaded rows up to date
without a rebuild (the page cache of seven small filings was lost in a %TEMP% clean-up on 2026-10-11, so they cannot be
rebuilt without re-reading them on the GPU). Writes only executive_trades, one filing at a time (upsert on the lossless
key, then delete the lines the overrides drop).

    python src/scripts/apply_r10d.py --changes <r10d-changes.csv> [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_overrides as O  # noqa: E402
from load_executive_trades import client, write_doc  # noqa: E402
from verify_executive_trades import fetch_doc_rows  # noqa: E402

SERVER_COLS = ("id", "created_at", "updated_at")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--changes", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    entries = O.load()
    sb = client()
    docs = sorted({e["doc"] for e in entries})
    log: list[dict] = []
    for doc in docs:
        unid = next(r["source_doc_id"] for r in sb.table("executive_trades").select("source_doc_id")
                    .like("source_doc_id", f"{doc}%").limit(1).execute().data)
        rows = fetch_doc_rows(sb, unid)
        new = O.apply(rows, unid, entries, log)
        if O.check_continuity(new)["ok"] is not True and rows[0]["report_type"] == "278-T":
            raise SystemExit(f"{doc}: continuity still broken after the overrides: {O.check_continuity(new)}")
        clean = [{k: v for k, v in r.items() if k not in SERVER_COLS} for r in new]
        up, pr = (0, 0) if a.dry_run else write_doc(sb, unid, clean)
        print(f"{doc} rows {len(rows)} -> {len(new)} upserted {up} pruned {pr}", flush=True)
    with open(a.changes, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["doc", "page", "line", "action", "n_before", "n_after", "field_changes", "asset_before", "asset_after",
                    "type_before", "type_after", "date_before", "date_after", "band_before", "band_after", "late_before",
                    "late_after", "why"])
        for x in log:
            b, c = x["before"] or {}, x["after"] or {}
            diff = [k for k in ("n", "asset", "type", "date", "amount", "late") if b.get(k) != c.get(k)] if b and c else []
            w.writerow([x["doc"], x["page"], x["line"], x["action"] if (diff or x["action"] != "set") else "checked_ok",
                        b.get("n"), c.get("n"), "+".join(diff), b.get("asset"), c.get("asset"), b.get("type"), c.get("type"),
                        b.get("date"), c.get("date"), b.get("amount"), c.get("amount"), b.get("late"), c.get("late"), x["why"]])
    print(f"{len(log)} entries logged to {a.changes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
