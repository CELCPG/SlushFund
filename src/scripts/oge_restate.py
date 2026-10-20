"""R10b: restatement and same-day duplicate rules for executive_trades rows (pure functions, no DB, no GPU).

Rule 1 (Apex, binding):
  * An AMENDED filing replaces the lines of the filing it amends. A line matches when asset, transaction date, type and
    band all match (tier 1, restate_basis = exact_match). Lines only in the original stay, restated = false.
  * Tier 2 (added in R10b): the amending Exhibit A says "In place of line item #N, substitute the following". Every such
    substitution changes the band, so tier 1 can never match it and the table would count the transaction twice. A
    substitution is matched to the original line with the same printed #, the same type and the same transaction date
    (restate_basis = substituted_by_line_number). The original line is not loaded; restates_original keeps it.
  * Same-day (1)/(2) reports are separate reports: every line is kept. A line printed identically (asset, date, type,
    band) in two reports of the same day is kept once, with the other source recorded in duplicate_sources.
"""
from __future__ import annotations

import difflib
import re
from collections import defaultdict

import oge_extract as X
from trade_fields import date_flag as tf_date_flag, lateness as tf_lateness


def line_key(r: dict):
    """Identity of a printed line for matching: asset, transaction date, type, band."""
    if not r.get("transaction_date"):
        return None
    return (X.norm_desc(r["asset"]), r["transaction_date"], r["transaction_type"], r["amount_range"])


def _snapshot(r: dict) -> dict:
    return {"page_number": r["page_number"], "line_on_page": r["line_on_page"], "printed_n": r.get("row_number_printed"),
            "asset": r["asset"], "amount_range": r["amount_range"], "transaction_date": r["transaction_date"],
            "filed_date": r["filed_date"]}


def apply_amendment(rows: list[dict]) -> dict:
    """One PDF that carries an amendment (rows with amended_report) and the original report (the other rows).
    Mutates rows; returns the rows to load and counts. Superseded original lines are dropped from `keep`."""
    amended = [r for r in rows if r.get("amended_report")]
    orig = [r for r in rows if not r.get("amended_report")]
    used: set[int] = set()
    stats = {"amended_lines": len(amended), "original_lines": len(orig), "exact_match": 0, "by_line_number": 0,
             "unmatched_amended": [], "near_misses": []}
    doc = rows[0]["source_doc_id"] if rows else None
    for a in amended:
        match, basis = None, None
        ka = line_key(a)
        for i, o in enumerate(orig):  # tier 1
            if i not in used and ka is not None and line_key(o) == ka:
                match, basis = i, "exact_match"
                break
        if match is None:  # tier 2: same printed # + type + date
            for i, o in enumerate(orig):
                if (i not in used and a.get("row_number_printed") is not None and o.get("row_number_printed") == a["row_number_printed"]
                        and o["transaction_type"] == a["transaction_type"] and o["transaction_date"] == a["transaction_date"]):
                    match, basis = i, "substituted_by_line_number"
                    break
        a["amendment_pair_doc_id"] = doc
        if match is None:
            stats["unmatched_amended"].append(_snapshot(a))
            continue
        used.add(match)
        o = orig[match]
        a["restated"], a["restate_basis"], a["restates_original"] = True, basis, _snapshot(o)
        a["original_filed_date"] = o["filed_date"]
        # lateness of an amended line is measured from the original report's filing date
        flag = tf_date_flag(a["transaction_date"], o["filed_date"], a["filed_date"]) if a["transaction_date"] else "unreadable"
        a["date_flag"] = flag
        if a["report_type"] == "278-T":
            days, late = tf_lateness(a["transaction_date"], o["filed_date"], flag) if a["transaction_date"] else (None, None)
            a["days_to_file"], a["stock_act_late"] = days, late
            a["late_basis"] = "computed_278T" if days is not None else (f"date_flag_{flag}" if flag else "filed_date_unknown")
        stats["exact_match" if basis == "exact_match" else "by_line_number"] += 1
        sim = difflib.SequenceMatcher(None, X.norm_desc(a["asset"]), X.norm_desc(o["asset"])).ratio()
        stats.setdefault("asset_similarity", []).append(round(sim, 3))
    for i, o in enumerate(orig):
        o["amendment_pair_doc_id"] = doc
        if amended:
            o["restated"] = False if i not in used else None
    keep = [r for r in amended] + [o for i, o in enumerate(orig) if i not in used]
    keep.sort(key=lambda r: (r["page_number"], r["line_on_page"]))
    stats["superseded_dropped"] = len(used)
    return {"rows": keep, "stats": stats}


def merge_same_day(docs: list[list[dict]]) -> tuple[list[list[dict]], dict]:
    """docs = the row lists of the reports filed on one day, in report order ((1) before (2)). A line printed
    identically (asset, date, type, band) in a later report as in an earlier one is kept once (on the earlier
    report) with the later source in duplicate_sources. One-to-one: a line printed twice in the earlier report and
    once in the later keeps both earlier rows and records one duplicate source on the first of them. Lines inside
    one report are never merged."""
    pool: dict[tuple, list[dict]] = defaultdict(list)  # key -> earlier-report rows not yet matched by this later report
    out, merged = [], 0
    for di, rows in enumerate(docs):
        taken: dict[tuple, int] = defaultdict(int)
        keep = []
        for r in rows:
            k = line_key(r)
            cands = [c for c in pool.get(k, []) if c["source_doc_id"] != r["source_doc_id"]] if k else []
            if cands and taken[k] < len(cands):
                host = cands[taken[k]]
                taken[k] += 1
                host.setdefault("duplicate_sources", []).append(
                    {"disclosure_url": r["disclosure_url"], "source_doc_id": r["source_doc_id"],
                     "page_number": r["page_number"], "line_on_page": r["line_on_page"]})
                merged += 1
                continue
            keep.append(r)
        for r in keep:
            k = line_key(r)
            if k:
                pool[k].append(r)
        out.append(keep)
    return out, {"merged_duplicates": merged, "reports": len(docs)}
