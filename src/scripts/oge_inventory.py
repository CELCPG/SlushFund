"""R10 step 1: inventory of the President's and Vice President's OGE filings.

Source (official only): OGE's own listing API behind oge.gov "Officials' Individual
Disclosures Search Collection":
    https://extapps2.oge.gov/201/Presiden.nsf/API.xsp/v3/rest
PDFs are served from https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/<UNID>/$FILE/<name>.pdf

    python src/scripts/oge_inventory.py --cache-dir %TEMP%\\slush-r10\\oge --out <dir>

Writes <out>/inventory.csv (Trump + Vance since 2025-01-20), <out>/oge-listing-summary.csv
(every official with a posted 278-T / annual PDF since 2025-01-20) and caches the full
listing + PDFs in the cache dir (resumable; at most 1 request per second).
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import requests

API = "https://extapps2.oge.gov/201/Presiden.nsf/API.xsp/v3/rest"
UA = "SlushFund research audit@slushfund.net"
TERM_START = "2025-01-20"
OFFICIALS = {"Trump, Donald J": ("Donald J. Trump", "President"), "Vance, JD": ("JD Vance", "Vice President")}

_last = [0.0]


def polite_get(sess: requests.Session, url: str, **kw) -> requests.Response:
    wait = 1.05 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    r = sess.get(url, timeout=120, **kw)
    _last[0] = time.time()
    r.raise_for_status()
    return r


def fetch_listing(sess, cache: Path) -> list[dict]:
    f = cache / "oge-listing.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    rows, start, total = [], 0, None
    while total is None or start < total:
        r = polite_get(sess, API, params={"draw": 1, "start": start, "length": 100})
        d = r.json()
        total = d["recordsTotal"]
        rows.extend(d["data"])
        start += len(d["data"])
        if not d["data"]:
            break
    f.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return rows


def pdf_link(row: dict) -> str | None:
    m = re.findall(r"href='([^']+\.pdf)'", row.get("type", ""), re.I)
    return html.unescape(m[0]) if m else None


def doc_kind(row: dict) -> str:
    t = re.sub(r"<[^>]+>", "", row.get("type", "")).strip()
    if t.startswith("278 Transaction"):
        return "278-T"
    if t.startswith("Annual"):
        return "278e annual"
    return t.split("(")[0].strip()


TOKEN_RE = re.compile(r"[A-Za-z]{3,}")
GOOD_WORDS = {
    "purchase", "sale", "sold", "exchange", "date", "amount", "transaction", "description",
    "bonds", "bond", "municipal", "corporate", "notes", "fund", "inc", "corp", "company",
    "county", "city", "state", "school", "district", "revenue", "series", "over", "trust",
    "authority", "the", "and", "for", "notification", "type", "part", "report",
}


def text_quality(pdf_path: Path) -> tuple[int, str, dict]:
    """Page count + text-layer verdict from a sample of pages.

    usable  = the text layer reads as words (>=50% of 3+ letter tokens are known words or
              band/date patterns are present on most sampled pages)
    garbled = characters present but not readable words
    image_only = no text layer (fewer than 20 chars per sampled page)
    """
    import pdfplumber

    with pdfplumber.open(str(pdf_path)) as pdf:
        n = len(pdf.pages)
        idx = sorted({0, n // 4, n // 2, (3 * n) // 4, n - 1})
        stats = []
        for i in idx:
            t = pdf.pages[i].extract_text() or ""
            toks = [w.lower() for w in TOKEN_RE.findall(t)]
            good = sum(1 for w in toks if w in GOOD_WORDS)
            bands = len(re.findall(r"\$\s?1,001|\$15,000|\$50,000|\$100,000|\$250,000|\$1,000,000", t))
            dates = len(re.findall(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", t))
            stats.append({"page": i + 1, "chars": len(t), "tokens": len(toks), "good": good,
                          "bands": bands, "dates": dates})
    avg_chars = sum(s["chars"] for s in stats) / len(stats)
    good_ratio = sum(s["good"] for s in stats) / max(1, sum(s["tokens"] for s in stats))
    band_pages = sum(1 for s in stats if s["bands"] >= 3 and s["dates"] >= 3)
    if avg_chars < 20:
        verdict = "image_only"
    elif band_pages >= max(1, len(stats) - 1) and good_ratio >= 0.15:
        verdict = "usable"
    else:
        verdict = "garbled"
    return n, verdict, {"avg_chars": round(avg_chars), "good_ratio": round(good_ratio, 3),
                        "band_date_pages": f"{band_pages}/{len(stats)}", "sample": stats}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-download", action="store_true")
    a = ap.parse_args()
    cache, out = Path(a.cache_dir), Path(a.out)
    (cache / "pdf").mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    sess = requests.Session()
    sess.headers["User-Agent"] = UA

    rows = fetch_listing(sess, cache)
    print(f"listing rows: {len(rows)}")

    # Who else has posted (downloadable) 278-T / annual PDFs since the term began.
    summ = defaultdict(Counter)
    meta = {}
    for r in rows:
        if (r.get("docDate") or "")[:10] < TERM_START or not pdf_link(r):
            continue
        k = doc_kind(r)
        if k not in ("278-T", "278e annual"):
            k = "other"
        summ[r["name"]][k] += 1
        meta[r["name"]] = (r.get("agency", ""), r.get("title", ""))
    with open(out / "oge-listing-summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["name", "agency", "title", "pdf_278T_since_2025-01-20", "pdf_annual_since_2025-01-20", "pdf_other"])
        for name in sorted(summ):
            c = summ[name]
            w.writerow([name, *meta[name], c["278-T"], c["278e annual"], c["other"]])
    print(f"officials with a posted PDF since {TERM_START}: {len(summ)}; "
          f"with 278-T PDFs: {sum(1 for c in summ.values() if c['278-T'])}")

    inv = []
    for r in rows:
        if r.get("name") not in OFFICIALS or (r.get("docDate") or "")[:10] < TERM_START:
            continue
        url = pdf_link(r)
        if not url:
            continue
        unid = re.search(r"/([0-9A-F]{32})/", url).group(1)
        inv.append({"official": OFFICIALS[r["name"]][0], "office": OFFICIALS[r["name"]][1],
                    "kind": doc_kind(r), "oge_posted": r["docDate"][:10],
                    "amended": (r.get("amended") or "")[:10], "unid": unid, "url": url,
                    "file": url.rsplit("/", 1)[1]})
    inv.sort(key=lambda x: (x["official"], x["kind"], x["oge_posted"], x["file"]))
    print(f"Trump/Vance PDFs since {TERM_START}: {len(inv)}")

    for d in inv:
        p = cache / "pdf" / f"{d['unid']}.pdf"
        if not p.exists() and not a.no_download:
            r = polite_get(sess, d["url"])
            p.write_bytes(r.content)
        d["bytes"] = p.stat().st_size if p.exists() else ""
        if p.exists():
            n, verdict, st = text_quality(p)
            d.update(pages=n, text_layer=verdict, tl_avg_chars=st["avg_chars"],
                     tl_good_ratio=st["good_ratio"], tl_band_date_pages=st["band_date_pages"])
            (cache / "pdf" / f"{d['unid']}.quality.json").write_text(json.dumps(st), encoding="utf-8")
    cols = ["official", "office", "kind", "file", "oge_posted", "amended", "pages", "bytes",
            "text_layer", "tl_avg_chars", "tl_good_ratio", "tl_band_date_pages", "unid", "url"]
    with open(out / "inventory.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(inv)
    for d in inv:
        print(f"{d['official'][:8]:8} {d['kind']:11} {d['oge_posted']} p={d.get('pages','?'):>4} "
              f"{d.get('text_layer','?'):10} {d['file'][:60]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
