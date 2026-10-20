"""R10 step 5: check a random sample of loaded executive_trades rows against the hand-checked page truth.

The truth file (r10-evidence/pilot-truth.json) was transcribed by hand from 300 DPI page images. Each sampled
row is matched to the truth line at the same page and position (line_on_page) and compared on date, asset,
type, band and owner (the 278-T prints no owner column; truth = Self unless the line is marked SP/JT/DC).

    python src/scripts/verify_executive_trades.py --truth <pilot-truth.json> --inventory <inventory.csv> --n 30 --seed 10 --out <json>

R10b adds verify_filing() for the unattended load (run_oge_load.py): there is no hand-checked truth for the big
filings, so each sampled row (30 random rows for a filing over 500 lines, 10 otherwise) is re-read from a single-row
400 DPI crop (the load itself reads 200 DPI strips and 300 DPI re-reads) and compared with the stored row on date,
asset, type and band. It is an independent second reading by the same model, not a hand check: a mismatch is a
row to look at, and a pass says the two readings agree.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_extract as X  # noqa: E402
from load_executive_trades import client, owner_of  # noqa: E402


def canon_asset(s: str | None) -> str:
    """Asset text compared up to punctuation and the form's own "Duo" for "Due": the strip reading tends to correct what
    the form prints ("Duo Jul 15, 2026"), the 400 DPI crop copies it; neither is a data error."""
    t = re.sub(r"[.,;:]", ",", X.norm_desc(s))
    return re.sub(r"\bDUO\b", "DUE", re.sub(r"\s*,\s*", ", ", t)).strip()


def fetch_doc_rows(sb, unid: str) -> list[dict]:
    out, off = [], 0
    while True:
        part = (sb.table("executive_trades").select("*").eq("source_doc_id", unid).order("id").range(off, off + 999)
                .execute().data)
        out.extend(part)
        if len(part) < 1000:
            return out
        off += 1000


def verify_filing(sb, rec: dict, cache_root: Path, seed: int = 10) -> dict:
    """Independent 400 DPI single-row re-read of a random sample of one loaded filing. See the module docstring."""
    unid = rec["unid"]
    pdf_path, pc = cache_root / "pdf" / f"{unid}.pdf", cache_root / unid
    rows = fetch_doc_rows(sb, unid)
    plan = {pg: role for pg, role in json.loads((pc / "plan.json").read_text(encoding="utf-8"))}
    pc.mkdir(parents=True, exist_ok=True)
    pool = [r for r in rows if plan.get(r["page_number"]) == "table" and not r["amended_report"]]
    n = 30 if len(rows) > 500 else min(10, len(pool))
    sample = random.Random(seed).sample(pool, min(n, len(pool)))
    fields = {"date": 0, "asset": 0, "type": 0, "band": 0, "all": 0}
    misses, unmapped = [], 0
    pages_cache = {}
    for r in sample:
        pg = r["page_number"]
        if pg not in pages_cache:
            f = pc / f"p{pg:03d}.gemma-r8-d200.json"
            if f.exists():
                g = json.loads(f.read_text(encoding="utf-8"))
                pages_cache[pg] = (g, X.page_bands(X.render(pdf_path, pg, pc, 200), g))
            else:  # R10d: page reading lost (the %TEMP% clean-up of 10/11): fresh bands, mapped by position when they
                # number exactly the page's machine-read lines
                n_lines = sum(1 for x in rows if x["page_number"] == pg and x["line_on_page"] < 100)
                pages_cache[pg] = (None, X.row_bands(X.render(pdf_path, pg, pc, 200)), n_lines)
        pcache = pages_cache[pg]
        g, bands = pcache[0], pcache[1]
        if r["line_on_page"] > 100:  # R10d: a row restored by hand (oge_overrides insert), not in any page reading
            unmapped += 1
            continue
        if g is None:
            bi = r["line_on_page"] - 1 if len(bands) == pcache[2] else None
            ok_bands = True
        else:
            src = g["rows"][r["line_on_page"] - 1]
            bi = X.row_band(g, src)
            ok_bands = len(bands) == g["filled_bands"]
        if bi is None or bi >= len(bands) or not ok_bands:
            unmapped += 1
            continue
        rr = X.gemma_row(pdf_path, pg, pc, bands[bi], f"v{bi:02d}", dpi=400)["row"] or {}
        ok = {"date": r["transaction_date"] == X.norm_date(rr.get("date")),
              "asset": canon_asset(r["asset"]) == canon_asset(rr.get("description")),
              "type": r["transaction_type"] == (X.norm_type(rr.get("type")) if X.norm_type(rr.get("type")) in
                                                 ("purchase", "sale", "exchange") else "other"),
              "band": r["amount_range"] == X.norm_band(rr.get("amount"))}
        for k, v in ok.items():
            fields[k] += int(v)
        fields["all"] += int(all(ok.values()))
        if not all(ok.values()):
            misses.append({"page": pg, "line": r["line_on_page"], "id": r["id"][:8],
                           "stored": {"asset": r["asset"], "date": r["transaction_date"], "type": r["transaction_type"],
                                      "band": r["amount_range"], "reread": r["reread"]},
                           "reread400": {"asset": rr.get("description"), "date": rr.get("date"), "type": rr.get("type"),
                                         "band": rr.get("amount")},
                           "failed": [k for k, v in ok.items() if not v]})
    checked = len(sample) - unmapped
    return {"file": rec["file"], "unid": unid, "rows_in_db": len(rows), "sampled": len(sample), "checked": checked,
            "unmapped": unmapped, "seed": seed, "method": "single-row 400 DPI re-read (independent second reading, not hand-checked)",
            **fields, "misses": misses}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--truth")
    ap.add_argument("--inventory", required=True)
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--seed", type=int, default=10)
    ap.add_argument("--out", required=True, help="output JSON, or with --filings the folder for verify-<tag>-<UNID8>.json")
    ap.add_argument("--filings", nargs="*", help="R10d: run verify_filing on these 278-T filings (file-name substrings; "
                                                  "none = all) instead of the pilot truth")
    ap.add_argument("--cache-dir", help="page cache root (with --filings)")
    ap.add_argument("--tag", default="r10d")
    a = ap.parse_args()
    if a.filings is not None:
        inv = [r for r in csv.DictReader(open(a.inventory, encoding="utf-8")) if r["kind"] == "278-T"
               and (not a.filings or any(f in r["file"] for f in a.filings))]
        sb = client()
        for rec in inv:
            res = verify_filing(sb, rec, Path(a.cache_dir), seed=a.seed)
            Path(a.out, f"verify-{a.tag}-{rec['unid'][:8]}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1),
                                                                         encoding="utf-8")
            print(f"{rec['unid'][:8]} {rec['file'][:44]:44} checked {res['checked']}/{res['sampled']} date {res['date']} "
                  f"asset {res['asset']} type {res['type']} band {res['band']} all {res['all']}", flush=True)
        return 0
    if not a.truth:
        raise SystemExit("--truth or --filings is required")
    truth = json.loads(Path(a.truth).read_text(encoding="utf-8"))
    inv = list(csv.DictReader(open(a.inventory, encoding="utf-8")))
    sb = client()
    pool, tmap = [], {}
    for key, spec in truth.items():
        if key.startswith("_"):
            continue
        rec = next(r for r in inv if r["file"].replace("%20", " ") == spec["file"])
        for i, t in enumerate(spec["rows"], 1):
            tmap[(rec["unid"], spec["page"], i)] = t
        rows = sb.table("executive_trades").select("*").eq("source_doc_id", rec["unid"]).execute().data
        pool.extend(rows)
    random.Random(a.seed).shuffle(pool)
    sample = pool[:a.n]
    fields = {"date": 0, "asset": 0, "type": 0, "band": 0, "owner": 0, "all": 0}
    out = []
    for r in sample:
        t = tmap.get((r["source_doc_id"], r["page_number"], r["line_on_page"]))
        if t is None:
            out.append({"id": r["id"], "result": "no truth line at this page/position"})
            continue
        n, desc, typ, d, over30, band = t
        ok = {"date": r["transaction_date"] == X.norm_date(d),
              "asset": X.norm_desc(r["asset"]) == X.norm_desc(desc),
              "type": r["transaction_type"] == typ,
              "band": r["amount_range"] == X.norm_band(band),
              "owner": r["owner"] == owner_of(desc)}
        for k, v in ok.items():
            fields[k] += int(v)
        fields["all"] += int(all(ok.values()))
        out.append({"id": r["id"][:8], "doc": r["source_doc_id"][:8], "page": r["page_number"], "line": r["line_on_page"],
                    "ok": all(ok.values()), "misses": {k: {"db": r[{"date": "transaction_date", "asset": "asset",
                                                                        "type": "transaction_type", "band": "amount_range",
                                                                        "owner": "owner"}[k]], "page": {"date": d, "asset": desc, "type": typ, "band": band, "owner": owner_of(desc)}[k]}
                                                       for k, v in ok.items() if not v},
                    "read_check": r["read_check"]})
    res = {"sample": len(sample), "pool": len(pool), "seed": a.seed, **fields, "rows": out}
    Path(a.out).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"sample {len(sample)} of {len(pool)}: date {fields['date']} asset {fields['asset']} type {fields['type']} "
          f"band {fields['band']} owner {fields['owner']} all {fields['all']}")
    for o in out:
        if not o.get("ok"):
            print(" MISS", json.dumps(o, ensure_ascii=False)[:300])
    return 0


if __name__ == "__main__":
    sys.exit(main())
