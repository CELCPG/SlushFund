"""R10 step 6: size the remaining work without the GPU.

For every 278-T / annual in the inventory: the transaction pages (same rule as the loader), the filled table
rows per page found from the printed rules (oge_extract.row_bands, ink >= 0.03; header bands included, so it
over-counts by ~1 per page), and the text-layer lines the regex parses (under-counts: corrupted lines fail).

    python src/scripts/oge_estimate.py --cache-dir %TEMP%\\slush-r10\\oge --inventory <inventory.csv> --out <csv>
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_extract as X  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-dir", required=True)
    ap.add_argument("--inventory", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--kind", default="278-T")
    a = ap.parse_args()
    cache = Path(a.cache_dir)
    inv = [r for r in csv.DictReader(open(a.inventory, encoding="utf-8")) if r["kind"] == a.kind]
    out, per_page = [], []
    for rec in inv:
        t0 = time.time()
        pdf = cache / "pdf" / f"{rec['unid']}.pdf"
        pc = cache / rec["unid"]
        pc.mkdir(parents=True, exist_ok=True)
        tables = bands = tl = 0
        for pg in range(2, int(rec["pages"]) + 1):  # page 1 = cover; classify every other page from its image
            png = X.render(pdf, pg, pc, 200)
            filled = X.row_bands(png)  # R10b: row_bands returns the filled rows only
            n_tl = len(X.textlayer_rows(pdf, pg))
            kind = "table" if len(filled) >= 3 else "other"
            if pg == int(rec["pages"]):  # OGE's "Summary of Contents" instructions page closes every 278-T
                import pdfplumber
                with pdfplumber.open(str(pdf)) as d:
                    t = d.pages[pg - 1].extract_text() or ""
                kind = "instructions" + ("" if re.search(r"Summary of Co|Privacy Act|Filers need not|Paperwork", t) else "_assumed")
            per_page.append({"file": rec["file"], "unid": rec["unid"], "page": pg, "kind": kind,
                             "filled_bands": len(filled), "textlayer_lines": n_tl})
            if kind == "table":
                tables += 1
                bands += len(filled)
                tl += n_tl
        out.append({"file": rec["file"], "oge_posted": rec["oge_posted"], "pdf_pages": rec["pages"],
                    "table_pages": tables, "filled_bands": bands, "textlayer_lines": tl,
                    "other_pages": int(rec["pages"]) - 1 - tables, "secs": round(time.time() - t0, 1)})
        print(f"{rec['file'][:46]:46} pages {rec['pages']:>4} table {tables:>4} bands {bands:>5} textlayer {tl:>5} other {out[-1]['other_pages']}")
    with open(Path(a.out).with_name("remaining-pages.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(per_page[0]))
        w.writeheader()
        w.writerows(per_page)
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print("TOTAL table_pages", sum(o["table_pages"] for o in out), "other_pages", sum(o["other_pages"] for o in out), "bands", sum(o["filled_bands"] for o in out),
          "textlayer", sum(o["textlayer_lines"] for o in out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
