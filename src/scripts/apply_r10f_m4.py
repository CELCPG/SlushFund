"""R10f M4 (A11): no lateness for lines the 278-T does not require (Treasury securities, fund / ETF / money-market lines).
Sets days_to_file and stock_act_late NULL and late_basis = 'not_required_on_278T' on those executive_trades rows and
prints the before / after lateness counts (rows and reports with a gap over 45 days).

    python src/scripts/apply_r10f_m4.py --changes <r10f-changes.csv> [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_overrides as O  # noqa: E402
from load_executive_trades import client  # noqa: E402


def stats(rows: list[dict]) -> dict:
    t = [r for r in rows if r["report_type"] == "278-T"]
    late = [r for r in t if r["stock_act_late"] is True]
    return {"rows_278T": len(t), "late_true": len(late), "late_false": sum(1 for r in t if r["stock_act_late"] is False),
            "late_null": sum(1 for r in t if r["stock_act_late"] is None),
            "reports_with_late": len({r["source_doc_id"] for r in late}),
            "late_gt75": sum(1 for r in t if (r["days_to_file"] or 0) > 75 and r["stock_act_late"]),
            "reports_gt75": len({r["source_doc_id"] for r in t if (r["days_to_file"] or 0) > 75 and r["stock_act_late"]})}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--changes", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    sb = client()
    rows, off = [], 0
    while True:
        part = sb.table("executive_trades").select("*").order("id").range(off, off + 999).execute().data
        rows += part
        if len(part) < 1000:
            break
        off += 1000
    hit = [r for r in rows if r["report_type"] == "278-T" and O.not_required_on_278t(r["asset"], r["instrument_class"])
           and (r["days_to_file"] is not None or r["stock_act_late"] is not None or r["late_basis"] != "not_required_on_278T")]
    print("before", stats(rows))
    print("to NULL", len(hit), "of which flagged late", sum(1 for r in hit if r["stock_act_late"]), "class", dict(Counter(r["instrument_class"] for r in hit)))
    if not a.dry_run:
        ids = [r["id"] for r in hit]
        for i in range(0, len(ids), 100):
            sb.table("executive_trades").update({"days_to_file": None, "stock_act_late": None, "late_basis": "not_required_on_278T"}) \
                .in_("id", ids[i:i + 100]).execute()
    byid = {r["id"]: r for r in hit}
    after = [({**r, "days_to_file": None, "stock_act_late": None} if r["id"] in byid else r) for r in rows]
    print("after ", stats(after))
    newfile = not os.path.exists(a.changes)
    with open(a.changes, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if newfile:
            w.writerow(["step", "doc", "page", "line", "printed_n", "action", "field_changes", "asset_before", "asset_after",
                        "band_before", "band_after", "class_before", "class_after", "late_before", "late_after", "why"])
        for r in hit:
            w.writerow(["M4", r["source_doc_id"][:8], r["page_number"], r["line_on_page"], r["row_number_printed"], "set",
                        "days_to_file+stock_act_late+late_basis", r["asset"], r["asset"], "", "", r["instrument_class"],
                        r["instrument_class"], r["stock_act_late"], None,
                        f"R10f M4 (A11): not required on a 278-T (days_to_file was {r['days_to_file']})"])
    print("done" if not a.dry_run else "dry run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
