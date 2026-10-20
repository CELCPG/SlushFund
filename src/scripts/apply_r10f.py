"""R10f: apply the R10f entries of oge_overrides.json (why starts with "R10f") to the executive_trades rows already
in the database, one filing at a time, and append every change to the R10f change log.

    python src/scripts/apply_r10f.py --step M1 --changes <r10f-changes.csv> [--dry-run]

Same mechanism as apply_r10d.py (O.apply on the rows read back from the database, upsert on the lossless key, prune what
the overrides drop); only the entries tagged R10f are applied, so the R10d entries are not logged a second time.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_overrides as O  # noqa: E402
from load_executive_trades import client, write_doc  # noqa: E402
from verify_executive_trades import fetch_doc_rows  # noqa: E402

SERVER_COLS = ("id", "created_at", "updated_at")
HEAD = ["step", "doc", "page", "line", "printed_n", "action", "field_changes", "asset_before", "asset_after",
        "band_before", "band_after", "class_before", "class_after", "late_before", "late_after", "why"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", required=True, help="label written to the change log (M1, M2, ...)")
    ap.add_argument("--match", default="R10f", help="apply the entries whose why starts with this")
    ap.add_argument("--changes", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    entries = [e for e in O.load() if (e.get("why") or "").startswith(a.match)]
    sb = client()
    log: list[dict] = []
    for doc in sorted({e["doc"] for e in entries}):
        unid = next(r["source_doc_id"] for r in sb.table("executive_trades").select("source_doc_id")
                    .like("source_doc_id", f"{doc}%").limit(1).execute().data)
        rows = fetch_doc_rows(sb, unid)
        before = {(r["page_number"], r["line_on_page"]): dict(r) for r in rows}
        new = O.apply(rows, unid, entries, log)
        for x in log:
            pass
        clean = [{k: v for k, v in r.items() if k not in SERVER_COLS} for r in new]
        up, pr = (0, 0) if a.dry_run else write_doc(sb, unid, clean)
        print(f"{doc} rows {len(rows)} -> {len(new)} upserted {up} pruned {pr}", flush=True)
    newfile = not os.path.exists(a.changes)
    with open(a.changes, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if newfile:
            w.writerow(HEAD)
        for x in log:
            b, c = x["before"] or {}, x["after"] or {}
            diff = [k for k in ("n", "asset", "type", "date", "amount", "late") if b.get(k) != c.get(k)] if b and c else []
            w.writerow([a.step, x["doc"], x["page"], x["line"], b.get("n"), x["action"] if diff or x["action"] != "set" else "checked_ok",
                        "+".join(diff), b.get("asset"), c.get("asset"), b.get("amount"), c.get("amount"), "", "",
                        b.get("late"), c.get("late"), x["why"]])
    print(f"{len(log)} entries logged to {a.changes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
