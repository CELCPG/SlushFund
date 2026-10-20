"""R10: load the President's and Vice President's disclosed transactions into executive_trades.

Source: OGE PDFs listed in r10-evidence/inventory.csv (oge_inventory.py). Each transaction page is read by
local vision (oge_extract.gemma_page: Gemma on 8-row strips cut on the table's rules, 200 DPI) and cached per
page, so a re-run only reads pages it has not read yet. The cover page (filer signature date, OGE RECEIVED
stamp) is read the same way. Every row is cross-checked against the PDF's own OCR text layer (read_check).

    python src/scripts/load_executive_trades.py --cache-dir %TEMP%\\slush-r10\\oge --inventory <inventory.csv> \\
        --file "9.3.25" --file "JD-Vance-2026" [--dry-run] [--out rows.json]

Writes: officials (upsert on name, office, start_date) and executive_trades (upsert on the lossless key
source_doc_id + page_number + line_on_page; lines of a re-loaded filing that no longer exist are deleted).
Exit 3 = Colin is gaming (no GPU work).

R10b adds: page roles (tail pages, the AMENDED file's Exhibit A), the asset-text re-read (single-row 300 DPI crop for
read_check = differs and for lines whose neighbour has the identical description), the restatement / same-day
duplicate rules (oge_restate.py), and group-aware writing: filings filed the same day are written together once all
of them are read.
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_extract as X  # noqa: E402
import oge_overrides as O  # noqa: E402
import oge_restate as R  # noqa: E402
from trade_fields import date_flag as tf_date_flag  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TERM_START = "2025-01-20"
OGE_LISTING = "https://www.oge.gov/web/OGE.nsf/Officials%20Individual%20Disclosures%20Search%20Collection"
OFFICIALS = {
    "Donald J. Trump": {"office": "President", "oge_filer_name": "Trump, Donald J"},
    "JD Vance": {"office": "Vice President", "oge_filer_name": "Vance, JD"},
}
METHOD = "gemma-r8-d200"
PIPELINE_VERSION = "r10b-2"  # bump when build_rows output changes: the runner then rewrites every loaded filing from the cache
ROWS_PER_STRIP, DPI = 8, 200

BANDS, BAND_TEXT = X.BANDS, X.BAND_TEXT  # the official OGE value bands (oge_extract.official_band validates every reading)

COVER_PROMPT = (
    "This is the cover page of a U.S. OGE financial disclosure report. Read the dates exactly as written. "
    'Return JSON: {"filer_signed":"date next to the filer\'s signature (as written, may be handwritten)",'
    '"filer_signed_iso":"YYYY-MM-DD or null if unclear","ethics_official_signed":"as written or null",'
    '"oge_received":"date in the OGE RECEIVED stamp, as printed, or null","amended":true/false}'
)


def band(text: str | None):
    b = X.norm_band(text)
    return b, *(BAND_TEXT.get(b, (None, None)) if b else (None, None))


_OPTION = re.compile(r"\b(?:CALL|PUT)\s+OPTIONS?\b|\bOPTIONS?\s+CONTRACTS?\b")
_COUPON = re.compile(r"\d+(?:\.\d+)?\s?%")
_DUE = re.compile(r"\bDUE\b(?!\s+BILLS?\b)")  # "WITH DUE BILLS" is a stock-dividend note, not a maturity
_FUND = re.compile(r"\bETFS?\b|\bETNS?\b|\bEFT\b|\bMONEY\s+(?:MARKET\s+)?FUND\b|\bINDEX\s+FUN\b|\bISHARES\b|\bSPDR\b"
                   r"|\bVANGUARD\b|\bINVESCO\s+(?:QQQ|EXCHANGE)|\bEXCHANGE[- ]TRADED\b|\bTRUST,?\s+SERIES\b|\bPORTFOLIO\b"
                   r"|\bMUTUAL\s+FUND\b|\bFUND\b|\bL\.?P\.?$")
_BOND = re.compile(r"\bNTS?\b|\bBDS\b|\bNOTES?\b|\bDEBS?\b|\bDEBENTURES?\b|\bB/E\b|\bBE/R/?|\bREV\b|\bRFDG\b|\bPERP\b"
                   r"|\b12/31/49\b|\bCTFS?\s+(?:PARTN|OBLIG)\b|\bCOPS?\b|\bSCH\s+DIST\b|\bINDPT\b|\bCNTY\b|\bMUD\b"
                   r"|\bGO\s+(?:LTX|UTX)\b|\bCMNTY\s+DEV\b|\bHSG\s+(?:FIN|DEV)\b|\bMUN\b|\bAUTH\b|\bAGY\b|\bTRANSN\b|\bSUBORDINATED\b")
_STOCK = re.compile(r"\b(?:INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|PLC|LLC|HOLDINGS?|HLDGS|GROUP|GRP|COM|CL|CLASS|SHS|ORD"
                    r"|REIT|N\s?V|NV|AG|SA|SE|ASA|LABS?|LABORATORIES|TECHNOLOGIES|SYS|SYSTEMS|BANCORP|BANCSHARES|FINL|FINANCIAL"
                    r"|INDS|INDUSTRIES|ENERGY|PHARMACEUTICALS?|COS|PFD|PREFERRED)\b|COMMON STOCK|\bSHARES\b|\.COM\b")
_STOCK_NAMES: set[str] | None = None


def _stock_names() -> set[str]:
    global _STOCK_NAMES
    if _STOCK_NAMES is None:
        p = Path(__file__).resolve().parent / "oge_stock_names.json"
        _STOCK_NAMES = set(json.loads(p.read_text(encoding="utf-8"))["names"]) if p.exists() else set()
    return _STOCK_NAMES


def instrument_class(desc: str) -> str:
    """R10f (A11 M3). bond = a coupon, DUE, NTS, BDS, a note / debenture or a municipal marker; fund = mutual fund, ETF,
    money-market fund; option = only when the line says call / put option contracts (no 278-T line does: "CALL@MW" and
    "CALLABLE" are bond call features); stock = common or preferred shares of a company; anything else = other."""
    d = re.sub(r"\s+", " ", desc.upper().strip())
    if _OPTION.search(d):
        return "option"
    coupon_or_due = bool(_COUPON.search(d) or _DUE.search(d))
    if _FUND.search(d) and not coupon_or_due:
        return "fund"
    if re.search(r"\bPFD\b|\bPREFERRED\b", d) and not re.search(r"\bNTS?\b|\bNOTES?\b|\bDEBS?\b|\bDUE\b", d):
        return "stock"  # preferred shares (a PFD line with a coupon is still shares)
    if coupon_or_due or _BOND.search(d):
        return "bond"
    if _STOCK.search(d) or re.sub(r"\s+(?:UNSOLICITED|UNSOLICITIED)$", "", d) in _stock_names():
        return "stock"
    return "other"


def ticker_of(desc: str) -> str | None:
    m = re.match(r"^\s*([A-Z]{1,5}(?:\.[A-Z])?)\s*[-–—]\s+\S", desc)
    return m.group(1) if m else None


def cusip_of(desc: str) -> str | None:
    m = re.search(r"\bCUSIP[:#\s]*([0-9A-Z]{9})\b", desc, re.I)
    return m.group(1).upper() if m else None


def owner_of(desc: str) -> str:
    d = desc.upper()
    if re.search(r"\(SP\)|\bSPOUSE\b", d):
        return "Spouse"
    if re.search(r"\(JT\)|\bJOINT\b", d):
        return "Joint"
    if re.search(r"\(DC\)|DEPENDENT CHILD", d):
        return "Child"
    return "Self"


def ttype(t: str | None) -> str:
    n = X.norm_type(t)
    return n if n in ("purchase", "sale", "exchange") else "other"


def read_check(row: dict, tl_rows: list[dict]) -> tuple[str, dict | None]:
    """Compare a vision-read row with the PDF's OCR text layer. Fields the text layer could not read
    (an invalid date, an unparsed band) are not compared. Returns (label, the matched OCR line or None)."""
    best, bs = None, 0.0
    for t in tl_rows:
        s = difflib.SequenceMatcher(None, X.norm_desc(t["description"]), X.norm_desc(row.get("description"))).ratio()
        if s > bs:
            best, bs = t, s
    if best is None or bs < 0.8:
        return "no_textlayer_line", None
    same = bs >= 0.97
    td, tb = X.norm_date(best["date"]), X.norm_band(best["amount"])
    if td is not None and td != X.norm_date(row.get("date")):
        same = False
    if tb is not None and tb != X.norm_band(row.get("amount")):
        same = False
    return ("agree" if same else "differs"), best


# ---------- asset-text re-read (R10b rule 2) ----------
def _tokens(s: str | None) -> set[str]:
    return {t.strip(".,;:") for t in X.norm_desc(s).split() if t.strip(".,;:")}


def decide_reread(strip: dict, row: dict | None, ocr: dict | None) -> tuple[dict, str, str | None]:
    """Choose between the strip reading and the single-row 300 DPI reading of one line.
    Description: the reading whose distinguishing tokens the OCR layer also holds wins (a dropped "PTC" is in the OCR
    line, not in the strip reading). Date, band and type: the reading equal to the OCR layer's valid value wins.
    Where the readings differ and the OCR layer cannot decide, the single-row reading is stored (the strip reading is
    the one with the known failure modes: dropped tokens and fields copied from an identical neighbour) and the other
    asset text is kept in reread_other_asset. Returns (fields to store, status, other asset text)."""
    if row is None or not X.valid_row(row):
        return {}, "unresolved", None
    out, status, other = {}, "strip_kept", None
    sa, ra = X.norm_desc(strip.get("description")), X.norm_desc(row.get("description"))
    if sa != ra:
        ot = _tokens(ocr["description"]) if ocr else set()
        a_sup = len((_tokens(sa) - _tokens(ra)) & ot)
        b_sup = len((_tokens(ra) - _tokens(sa)) & ot)
        if a_sup > b_sup:
            other = row.get("description")
        else:
            out["description"], other = row.get("description"), strip.get("description")
            status = "row_taken" if b_sup > a_sup else "unresolved"
    norm = {"date": X.norm_date, "amount": X.norm_band, "type": X.norm_type}
    for f, fn in norm.items():
        sv, rv = fn(strip.get(f)), fn(row.get(f))
        if sv == rv or rv is None:
            continue
        ov = fn(ocr.get(f)) if ocr else None
        if ov is not None and ov == sv:
            continue
        out[f] = row.get(f)
        if status == "strip_kept":
            status = "row_taken" if ov == rv else "unresolved"
    return out, status, other


def needs_reread(row: dict, label: str, neighbours: list[dict]) -> str | None:
    if label == "differs":
        return "differs"
    d = X.norm_desc(row.get("description"))
    if d and any(X.norm_desc(n.get("description")) == d for n in neighbours):
        return "dup_neighbor"
    return None


def rows_per_strip(role: str) -> int:
    return 0 if role in ("exhibit_a", "whole") else ROWS_PER_STRIP


def read_page(pdf_path: Path, pc: Path, pg: int, role: str, kind: str) -> dict:
    """Everything the GPU does for one page: Gemma strips, then the single-row re-reads. Idempotent from cache.
    Returns {"g": page reading, "items": [{row, label, reread, reread_reason, other_asset}]}."""
    g = X.gemma_page(pdf_path, pg, pc, rows_per_strip(role), dpi=DPI)
    tl = X.textlayer_rows(pdf_path, pg)
    rows = g["rows"]
    bands = X.page_bands(X.render(pdf_path, pg, pc, DPI), g) if role == "table" else []
    items = []
    for i, r in enumerate(rows):
        label, ocr = read_check(r, tl)
        item = {"row": dict(r), "label": label, "reread": None, "reread_reason": None, "other_asset": None}
        reason = needs_reread(r, label, rows[max(0, i - 2):i] + rows[i + 1:i + 3]) if role in ("table", "whole") else None
        if reason:
            bi = X.row_band(g, r) if role == "table" else None  # a whole-page reading ties no row to a band
            item["reread_reason"] = reason
            if bi is None or bi >= len(bands) or len(bands) != g["filled_bands"]:
                item["reread"] = "not_mappable"
            else:
                rr = X.gemma_row(pdf_path, pg, pc, bands[bi], f"{bi:02d}")
                fields, status, other = decide_reread(r, rr["row"], ocr)
                item["row"].update(fields)
                item["reread"], item["other_asset"] = status, other
        items.append(item)
    return {"g": g, "items": items}


# ---------- page roles ----------
SPECIAL = {  # inventory file-name substring -> hand-checked facts (R10b, read from the page images 2026-10-04)
    "08.12.2025-278T(2)%20AMENDED": {
        # p1 amendment letter, p2 OGE certification, p3 Exhibit A ("in place of line item #27/#52/#71/#123"),
        # p4 the original report's certification page (signed 8/12/25, OGE stamp 8/19/2025), p5-p9 the original
        # report itself (pages 2-6 of 6), p10 OGE instructions.
        "roles": {2: "skip", 3: "exhibit_a", 4: "skip"},
        "cover": {"filer_signed_iso": "2026-01-14", "ethics_official_signed": "1/14/2026", "oge_received": "2025-08-19",
                  "amended": True, "basis": "hand-checked: amendment letter p1 signed 1/14/26; original certification p4 "
                                            "signed 8/12/25, OGE RECEIVED 8/19/2025"},
        "original_filed": "2025-08-12", "amendment_filed": "2026-01-14",
    },
}


def special(rec: dict) -> dict | None:
    f = rec["file"]
    return next((v for k, v in SPECIAL.items() if k in f), None)


def transaction_pages(pdf_path: Path, kind: str, cache: Path | None = None, rec: dict | None = None) -> list[tuple[int, str]]:
    """[(page, role)] for the pages to read. 278-T: every page except the cover (1) and OGE's closing instructions page
    (last) whose image shows at least 3 filled table rows (the text layer is too damaged to find them; the old >= 6
    rule skipped short last pages: 08.12.2025 (3) p3 holds 4 rows, 4.20.2026 p4 holds 3). SPECIAL pages carry a role.
    Annual 278e: the pages whose text layer carries the "Part 7: Transactions" header."""
    import pdfplumber
    cache = cache or pdf_path.parent
    plan_f = cache / "plan.json"
    if plan_f.exists():
        return [tuple(x) for x in json.loads(plan_f.read_text(encoding="utf-8"))]
    sp = special(rec) if rec else None
    pages: list[tuple[int, str]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        n = len(pdf.pages)
        if kind == "278-T":
            for i in range(2, n):
                role = (sp or {}).get("roles", {}).get(i)
                if role is None:
                    png = X.render(pdf_path, i, cache, DPI)
                    role = "table" if len(X.row_bands(png)) >= 3 else "skip"
                if role != "skip":
                    pages.append((i, role))
        else:
            for i, p in enumerate(pdf.pages, 1):
                if re.search(r"Part\s*7\s*:\s*Transactions", p.extract_text() or ""):
                    pages.append((i, "whole"))  # Part 7 has no rule grid the strip cutter can use: whole page (pilot: 10/10)
    plan_f.write_text(json.dumps(pages), encoding="utf-8")
    return pages


def cover(pdf_path: Path, cache: Path, rec: dict | None = None) -> dict:
    f = cache / "p001.cover.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    sp = special(rec) if rec else None
    if sp:  # the AMENDED file's page 1 is the amendment letter, not the form's certification page: hand-checked
        f.write_text(json.dumps(sp["cover"], ensure_ascii=False, indent=1), encoding="utf-8")
        return sp["cover"]
    if X.gaming_active():
        print("gaming mode active: stopping GPU work", file=sys.stderr)
        sys.exit(3)
    png = X.render(pdf_path, 1, cache, DPI)
    import subprocess
    r = subprocess.run(["node", X.LOCAL_LLM, "--model", "gemma", "--json", "--max-tokens", "800", "--image", str(png),
                        COVER_PROMPT], capture_output=True, text=True, encoding="utf-8", timeout=600,
                       creationflags=X.NOWIN)
    if r.returncode != 0:
        raise RuntimeError(f"cover read failed: {r.stderr[-200:]}")
    d = json.loads(r.stdout)
    f.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    return d


def filename_date(name: str) -> str | None:
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", name.replace("%20", " "))
    return X.norm_date(f"{m.group(1)}/{m.group(2)}/{m.group(3)}") if m else None


def iso_any(s: str | None) -> str | None:
    if not s:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s.strip()):
        return s.strip()
    return X.norm_date(s.strip())


def warm_page(rec: dict, cache_root: Path, pg: int, role: str) -> dict:
    """GPU work for one page (strips + re-reads), then a done-marker. Returns a one-line summary."""
    unid = rec["unid"]
    pdf_path, pc = cache_root / "pdf" / f"{unid}.pdf", cache_root / unid
    marker = pc / f"p{pg:03d}.page-done.json"
    if marker.exists():
        return json.loads(marker.read_text(encoding="utf-8"))
    rp = read_page(pdf_path, pc, pg, role, rec["kind"])
    items = rp["items"]
    summ = {"lines": len(rp["g"]["rows"]), "filled_bands": rp["g"]["filled_bands"], "flags": rp["g"].get("flags", []),
            "rereads": sum(1 for i in items if i["reread"]),
            "reread_taken": sum(1 for i in items if i["reread"] == "row_taken"),
            "reread_unresolved": sum(1 for i in items if i["reread"] == "unresolved"),
            "strip_retries": sum(1 for n in rp["g"]["notes"] if n.get("attempt") == 2 or n.get("ok") is False),
            "unreadable": rp["g"].get("unreadable") or [],
            "unreadable_bands": sum((u.get("count") or 0) for u in rp["g"].get("unreadable") or [])}
    marker.write_text(json.dumps(summ), encoding="utf-8")
    return summ


def page_is_done(rec: dict, cache_root: Path, pg: int) -> bool:
    return (cache_root / rec["unid"] / f"p{pg:03d}.page-done.json").exists()


def continuity(rows: list[dict]) -> dict:
    """Completeness check from the form's own running # column: read in page order the printed numbers must run
    n, n+1, ...; a break is a missed, doubled or misread line. n_max is the filing's own transaction count when
    the numbering starts at 1 and never restarts (the thin-ruled form prints a running number, #595-#627 on p20)."""
    seq = sorted((r["page_number"], r["line_on_page"], r["row_number_printed"]) for r in rows if not r.get("amended_report"))
    breaks, prev = [], None
    for pg, ln, n in seq:
        if n is None or (prev is not None and n != prev + 1):
            breaks.append([pg, ln, prev, n])
        if n is not None:
            prev = n
    ns = [n for _, _, n in seq if n is not None]
    return {"rows": len(seq), "n_first": ns[0] if ns else None, "n_max": max(ns) if ns else None,
            "breaks": len(breaks), "first_breaks": breaks[:6]}


def fill_gap_ranges(gaps: list[dict], rows: list[dict]) -> list[dict]:
    """Printed # range of every gap that the page itself could not give (a whole page, or a band run with no numbered
    neighbour on its page): from the nearest numbered rows on earlier and later pages."""
    ns = sorted((r["page_number"], r["line_on_page"], r["row_number_printed"]) for r in rows
                if r.get("row_number_printed") is not None and not r.get("amended_report"))
    for g in gaps:
        if g.get("n_from") is not None and g.get("n_to") is not None:
            continue
        prev = next((n for pg, _, n in reversed(ns) if pg < g["page"]), None)
        nxt = next((n for pg, _, n in ns if pg > g["page"]), None)
        cnt = g.get("count")
        lo = prev + 1 if prev is not None else None
        hi = nxt - 1 if nxt is not None else None
        if lo is None and hi is not None and cnt:
            lo = hi - cnt + 1
        if hi is None and lo is not None and cnt:
            hi = lo + cnt - 1
        g["n_from"], g["n_to"] = lo, hi
    return gaps


def build_rows(rec: dict, cache_root: Path, official_id: str | None, allow_read: bool = True) -> tuple[list[dict], dict]:
    """allow_read=False (the unattended runner's write step) never asks the GPU: a page without its page-done marker
    is a gap, listed in meta["gaps"] with its printed # range."""
    unid = rec["unid"]
    pdf_path = cache_root / "pdf" / f"{unid}.pdf"
    pc = cache_root / unid
    pc.mkdir(parents=True, exist_ok=True)
    kind = rec["kind"]
    sp = special(rec)
    cov = cover(pdf_path, pc, rec)
    fn_date = filename_date(rec["file"])
    signed = iso_any(cov.get("filer_signed_iso"))
    # filed_date: the filer's signature date. OGE names 278-T files by it (9.3.25 = "Sept 3/25" on the cover);
    # the cover signature is often handwritten and vision misreads it (pilot: "SEPT 8/25", after the ethics
    # official's 9/4/25 and OGE's 9/6 posting), so the file-name date wins and the cover reading is the fallback.
    filed = (sp or {}).get("original_filed") or fn_date or signed
    if filed and filed > rec["oge_posted"]:
        filed = None  # a filing date after OGE posted the report is impossible: not computed
    received = iso_any(cov.get("oge_received"))
    meta = {"file": rec["file"], "unid": unid, "kind": kind, "cover": cov, "filename_date": fn_date,
            "filed_date_basis": "hand_checked_cover" if sp else ("file_name" if fn_date else ("cover" if signed else None)),
            "filed_date": filed, "pages": []}
    rows, gaps = [], []
    for pg, role in transaction_pages(pdf_path, kind, pc, rec):
        if not allow_read and not page_is_done(rec, cache_root, pg):  # read_page would ask the GPU for what is missing
            meta["pages"].append({"page": pg, "role": role, "rows": 0, "filled_bands": None, "seconds": 0,
                                  "flags": [{"flag": "page_not_read"}]})
            gaps.append({"page": pg, "bands": None, "count": None, "n_from": None, "n_to": None, "why": "page not read"})
            continue
        rp = read_page(pdf_path, pc, pg, role, kind)
        g = rp["g"]
        meta["pages"].append({"page": pg, "role": role, "rows": len(g["rows"]), "filled_bands": g["filled_bands"],
                              "seconds": g["seconds"], "flags": g.get("flags", [])})
        for u in g.get("unreadable") or []:
            gaps.append({"page": pg, **u, "why": "page unreadable" if u.get("page") else "rows unreadable"})
        amended_page = role == "exhibit_a"
        row_filed = sp["amendment_filed"] if amended_page else filed
        orig_filed = sp["original_filed"] if amended_page else filed
        for it in rp["items"]:
            r = it["row"]
            desc = re.sub(r"\s+", " ", (r.get("description") or "")).strip()
            desc = re.sub(r"(?<=\s)\|(?=\s)", "I", desc)  # a lone pipe is a misread capital I (T-MOBILE USA, I 3.375%)
            txt_date = (r.get("date") or "").strip()
            txn = X.norm_date(txt_date)
            rng, lo, hi = band(r.get("amount"))
            over30 = str(r.get("over30") or "").strip().lower()
            if txn is None:
                flag = "unreadable"
            else:
                flag = tf_date_flag(txn, orig_filed, row_filed)
            days, late, basis = O.lateness_fields(kind, txn, flag, orig_filed, desc, instrument_class(desc))
            try:
                printed_n = int(str(r.get("n")).strip(". ")) if r.get("n") not in (None, "") else None
            except ValueError:
                printed_n = None
            rows.append({
                "official_id": official_id, "official_name": rec["official"], "office": rec["office"],
                "report_type": kind, "asset": desc, "ticker": ticker_of(desc), "cusip": cusip_of(desc),
                "instrument_class": instrument_class(desc), "transaction_type": ttype(r.get("type")),
                "transaction_date": txn, "transaction_date_text": txt_date or "(blank)",
                "notification_date": None,
                "notification_over_30_days": (over30.startswith("y") if over30[:1] in ("y", "n") else None) if kind == "278-T" else None,
                "filed_date": row_filed, "original_filed_date": orig_filed,
                "oge_received_date": None if amended_page else received,
                "amount_range": rng or (r.get("amount") or "(blank)"), "amount_min": lo, "amount_max": hi,
                "owner": owner_of(desc), "date_flag": flag, "days_to_file": days, "stock_act_late": late,
                "late_basis": basis, "disclosure_url": rec["url"], "source_doc_id": unid, "page_number": pg,
                "line_on_page": r["line_on_page"], "row_number_printed": printed_n, "extract_method": METHOD,
                "read_check": it["label"],
                "amended_report": amended_page, "restated": None, "restate_basis": None, "amendment_pair_doc_id": None,
                "restates_original": None, "duplicate_sources": None,
                "reread": it["reread"], "reread_reason": it["reread_reason"], "reread_other_asset": it["other_asset"],
            })
    rows = O.apply(rows, unid)  # R10d: hand-checked corrections (oge_overrides.json)
    meta["continuity"] = continuity(rows)
    meta["gaps"] = fill_gap_ranges(gaps, rows)
    if sp:
        res = R.apply_amendment(rows)
        rows, meta["amendment"] = res["rows"], res["stats"]
    return rows, meta


def client():
    from dotenv import load_dotenv
    load_dotenv(REPO / ".env.local")
    from supabase import create_client
    url, key = os.getenv("NEXT_PUBLIC_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Supabase URL / service key missing (.env.local)")
    return create_client(url, key)


def ensure_officials(sb) -> dict[str, str]:
    ids = {}
    for name, o in OFFICIALS.items():
        res = sb.table("officials").upsert({"name": name, "office": o["office"], "start_date": TERM_START,
                                            "oge_filer_name": o["oge_filer_name"], "source_url": OGE_LISTING},
                                           on_conflict="name,office,start_date").execute()
        ids[name] = res.data[0]["id"]
    return ids


def write_doc(sb, unid: str, rows: list[dict]) -> tuple[int, int]:
    """Upsert one filing's rows on the lossless key and delete rows of that filing that are no longer in the set
    (superseded originals, merged duplicates, lines of a re-read page). Returns (upserted, pruned)."""
    for i in range(0, len(rows), 400):
        sb.table("executive_trades").upsert(rows[i:i + 400], on_conflict="source_doc_id,page_number,line_on_page").execute()
    keep = {(r["page_number"], r["line_on_page"]) for r in rows}
    have, off = [], 0
    while True:  # PostgREST returns at most 1000 rows per request
        part = (sb.table("executive_trades").select("id,page_number,line_on_page").eq("source_doc_id", unid)
                .order("id").range(off, off + 999).execute().data)
        have.extend(part)
        if len(part) < 1000:
            break
        off += 1000
    stale = [h["id"] for h in have if (h["page_number"], h["line_on_page"]) not in keep]
    for i in range(0, len(stale), 100):
        sb.table("executive_trades").delete().in_("id", stale[i:i + 100]).execute()
    return len(rows), len(stale)


def report_order(rec: dict) -> int:
    m = re.search(r"\((\d)\)", rec["file"].replace("%20", " "))
    return int(m.group(1)) if m else 1


def day_groups(inv: list[dict]) -> dict[str, list[dict]]:
    """278-T filings filed the same day (file-name date), in report order ((1) first). One-member groups included."""
    g: dict[str, list[dict]] = {}
    for r in inv:
        if r["kind"] == "278-T":
            g.setdefault(filename_date(r["file"]) or r["unid"], []).append(r)
    for v in g.values():
        v.sort(key=report_order)
    return g


def finalize(sb, recs: list[dict], cache_root: Path, off_ids: dict, out_meta: list | None = None, dry: bool = False,
             allow_read: bool = True) -> dict:
    """Build every filing of one same-day group from the page cache, apply the same-day duplicate rule, write.
    The CLI reads what is missing (allow_read); the runner calls it once every page is read or given up, and a page
    that is not in the cache then becomes a gap (status complete_with_gaps), never a GPU request."""
    built = [(rec, *build_rows(rec, cache_root, off_ids.get(rec["official"]), allow_read)) for rec in recs]
    docs = [rows for _, rows, _ in built]
    merge = {"merged_duplicates": 0}
    if len(docs) > 1:
        docs, merge = R.merge_same_day(docs)
    summary = {"merged_duplicates": merge["merged_duplicates"], "files": []}
    for (rec, _rows, meta), rows in zip(built, docs):
        up = pr = 0
        if sb and not dry:
            up, pr = write_doc(sb, rec["unid"], rows)
        meta["rows_final"] = len(rows)
        if out_meta is not None:
            out_meta.append({"meta": meta, "rows": rows})
        summary["files"].append({"file": rec["file"], "unid": rec["unid"], "rows": len(rows), "upserted": up, "pruned": pr,
                                 "filed": meta["filed_date"], "amendment": meta.get("amendment"),
                                 "continuity": meta.get("continuity"), "gaps": meta.get("gaps") or []})
    return summary


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-dir", required=True)
    ap.add_argument("--inventory", required=True)
    ap.add_argument("--file", action="append", required=True, help="substring of the inventory file name")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-group", action="store_true", help="do not add the same-day filings to the selection")
    ap.add_argument("--out", help="write the built rows + per-page meta here (JSON)")
    a = ap.parse_args()
    inv = list(csv.DictReader(open(a.inventory, encoding="utf-8")))
    recs = [r for r in inv if any(s in r["file"] for s in a.file)]
    if not recs:
        raise SystemExit("no inventory file matches")
    sb = None if a.dry_run else client()
    off_ids = ensure_officials(sb) if sb else {}
    groups = day_groups(inv)
    done, out = set(), []
    for rec in recs:
        if rec["unid"] in done:
            continue
        grp = [rec] if (a.no_group or rec["kind"] != "278-T") else groups[filename_date(rec["file"]) or rec["unid"]]
        done.update(g["unid"] for g in grp)
        summ = finalize(sb, grp, Path(a.cache_dir), off_ids, out, dry=a.dry_run)
        for f in summ["files"]:
            print(f"{f['file'][:48]:48} rows {f['rows']} filed {f['filed']} upserted {f['upserted']} pruned {f['pruned']}")
        if summ["merged_duplicates"]:
            print(f"  same-day duplicates merged: {summ['merged_duplicates']}")
    if a.out:
        Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
