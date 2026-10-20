"""R10f M3: recompute executive_trades.instrument_class with load_executive_trades.instrument_class (A11 M3) and update
the rows whose class changes. Writes only executive_trades.instrument_class.

    python src/scripts/apply_r10f_m3.py --changes <r10f-changes.csv> [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_executive_trades import client, instrument_class  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--changes", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    sb = client()
    rows, off = [], 0
    while True:
        part = (sb.table("executive_trades").select("id,source_doc_id,page_number,line_on_page,row_number_printed,asset,instrument_class")
                .order("id").range(off, off + 999).execute().data)
        rows += part
        if len(part) < 1000:
            break
        off += 1000
    before = Counter(r["instrument_class"] for r in rows)
    changed = [(r, instrument_class(r["asset"])) for r in rows if instrument_class(r["asset"]) != r["instrument_class"]]
    after = Counter(instrument_class(r["asset"]) for r in rows)
    print("before", dict(before))
    print("after ", dict(after))
    print("changed", len(changed), dict(Counter((r["instrument_class"], n) for r, n in changed)))
    if not a.dry_run:
        for new in {n for _, n in changed}:
            ids = [r["id"] for r, n in changed if n == new]
            for i in range(0, len(ids), 100):
                sb.table("executive_trades").update({"instrument_class": new}).in_("id", ids[i:i + 100]).execute()
    newfile = not os.path.exists(a.changes)
    with open(a.changes, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if newfile:
            w.writerow(["step", "doc", "page", "line", "printed_n", "action", "field_changes", "asset_before", "asset_after",
                        "band_before", "band_after", "class_before", "class_after", "late_before", "late_after", "why"])
        for r, n in changed:
            w.writerow(["M3", r["source_doc_id"][:8], r["page_number"], r["line_on_page"], r["row_number_printed"], "set",
                        "instrument_class", r["asset"], r["asset"], "", "", r["instrument_class"], n, "", "",
                        "R10f M3 (A11): instrument_class from the printed description"])
    print("done" if not a.dry_run else "dry run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
