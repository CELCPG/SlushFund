"""R10d: hand-checked corrections to executive_trades rows, kept in oge_overrides.json and applied on every build.

Each correction was read off the page image (400 DPI row crop or the whole page) by a person, so it wins over the
machine reading. build_rows() applies them after reading the page cache, and apply_r10d.py applies the same file to
the rows already in the database, so a reload from the cache reproduces the corrected table.

An entry is keyed by the filing (first 8 characters of the OGE UNID), page and line_on_page of the machine reading:
    {"doc": "87BFE542", "page": 4, "line": 11, "action": "set", "fields": {"n": 68, "date": "11/6/2025"}, "why": "..."}
actions:
    set     change fields of the row. fields: n, asset, asset_sub ([old, new] or a list of pairs), type, date, amount,
            over30. Derived columns (band bounds, date_flag, lateness, ticker, instrument class, owner) are recomputed.
            No fields = the row was checked and agrees with the page.
    delete  drop the row (a fragment of a sliced two-line row, a phantom band).
    insert  add a row the machine reading lost. `line` is the new row's line_on_page: inserted rows are numbered from
            101 so they never collide with a cached reading's lines (the page's own order is the printed #).
Rows touched by an entry get reread = 'hand_fixed' (changed) or 'hand_ok' (checked, unchanged); inserted rows get
'hand_inserted'.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import oge_extract as X
from trade_fields import date_flag as tf_date_flag, lateness as tf_lateness

OVERRIDES = Path(__file__).resolve().parent / "oge_overrides.json"
FIELDS = {"n", "asset", "asset_sub", "type", "date", "amount", "over30"}


def load(path: Path = OVERRIDES) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["entries"] if path.exists() else []


_TREASURY = re.compile(r"\b(?:UNITED STATES|U\.?\s?S\.?|US)\s+TREAS(?:URY|UR)?\b", re.I)


def not_required_on_278t(asset: str | None, instrument_class: str | None) -> bool:
    """R10f (A11 M4): the 278-T Summary of Contents excepts mutual funds and other excepted investment funds, money market
    accounts and U.S. Treasury bills, notes and bonds, so no lateness is computed for them. Whether an ETF is an excepted fund
    cannot be read from the record, so every fund-class line (ETF, mutual fund, money-market fund) is left uncomputed too."""
    return instrument_class == "fund" or bool(_TREASURY.search(asset or ""))


def lateness_fields(kind: str, txn: str | None, flag: str | None, orig_filed: str | None,
                    asset: str | None = None, instrument_class: str | None = None) -> tuple:
    """(days_to_file, stock_act_late, late_basis): the 278-T rule shared by build_rows and the overrides. See
    trade_fields.lateness: days = original filed date - transaction date, late = days > 45. A line the form does not
    require (Treasury securities, funds: not_required_on_278T) gets no gap at all."""
    if kind != "278-T":
        return None, None, "annual_report_part7"
    if not_required_on_278t(asset, instrument_class):
        return None, None, "not_required_on_278T"
    if flag is not None and flag != "stale_2y_corroborated":
        return None, None, f"date_flag_{flag}"
    if orig_filed is None:
        return None, None, "filed_date_unknown"
    days, late = tf_lateness(txn, orig_filed, flag)
    return days, late, "computed_278T"


def rederive(row: dict, changed: set[str]) -> dict:
    """Recompute the columns that depend on the changed printed fields (row is a DB-shaped executive_trades row)."""
    from load_executive_trades import band, cusip_of, instrument_class, owner_of, ticker_of
    if "asset" in changed:
        d = row["asset"]
        row.update(ticker=ticker_of(d), cusip=cusip_of(d), instrument_class=instrument_class(d), owner=owner_of(d))
    if "amount" in changed:
        rng, lo, hi = band(row["amount_range"])
        if rng is None or X.official_band(rng) is None:
            raise ValueError(f"not an OGE band: {row['amount_range']!r}")
        row.update(amount_range=rng, amount_min=lo, amount_max=hi)
    if "date" in changed:
        txn = X.norm_date(row["transaction_date_text"])
        row["transaction_date"] = txn
        row["date_flag"] = "unreadable" if txn is None else tf_date_flag(txn, row.get("original_filed_date"), row.get("filed_date"))
    if "date" in changed or "asset" in changed:
        row["days_to_file"], row["stock_act_late"], row["late_basis"] = lateness_fields(
            row["report_type"], row.get("transaction_date"), row.get("date_flag"), row.get("original_filed_date"),
            row["asset"], row.get("instrument_class"))
    return row


def _set(row: dict, fields: dict) -> set[str]:
    changed = set()
    for k, v in fields.items():
        if k == "n":
            if row.get("row_number_printed") != v:
                row["row_number_printed"] = v
                changed.add("n")
        elif k == "asset":
            if row["asset"] != v:
                row["asset"] = v
                changed.add("asset")
        elif k == "asset_sub":
            pairs = [v] if isinstance(v[0], str) else v
            for old, new in pairs:
                if old not in row["asset"]:
                    if new in row["asset"]:
                        continue  # already applied (rows read back from the database)
                    raise ValueError(f"asset_sub {old!r} not in {row['asset']!r}")
                row["asset"] = row["asset"].replace(old, new, 1)
                changed.add("asset")
        elif k == "type":
            t = X.norm_type(v)
            t = t if t in ("purchase", "sale", "exchange") else "other"
            if row["transaction_type"] != t:
                row["transaction_type"] = t
                changed.add("type")
        elif k == "date":
            if row["transaction_date_text"] != v or row.get("transaction_date") != X.norm_date(v):
                row["transaction_date_text"] = v
                changed.add("date")
        elif k == "amount":
            if row["amount_range"] != X.official_band(v):
                row["amount_range"] = v
                changed.add("amount")
        elif k == "over30":
            o = str(v).strip().lower()
            row["notification_over_30_days"] = o.startswith("y")
            changed.add("over30")
        else:
            raise ValueError(f"unknown override field {k}")
    return changed


def apply(rows: list[dict], unid: str, entries: list[dict] | None = None, log: list | None = None) -> list[dict]:
    """Apply the overrides of filing `unid` to its rows (DB-shaped dicts). Returns the new row list; `log` gets one
    {doc, page, line, action, before, after, why} per entry. An entry whose row is missing raises: the override file
    and the page cache must agree."""
    entries = [e for e in (load() if entries is None else entries) if unid.startswith(e["doc"])]
    if not entries:
        return rows
    by = {(r["page_number"], r["line_on_page"]): r for r in rows}
    drop = set()
    for e in entries:
        key = (e["page"], e["line"])
        if e["action"] == "insert":
            if key in by:
                if by[key].get("reread") == "hand_inserted":
                    continue  # already applied (rows read back from the database)
                raise ValueError(f"insert over an existing line {unid[:8]} {key}")
            tmpl = next((r for r in rows if r["page_number"] == e["page"]), None) or rows[0]
            new = {k: v for k, v in tmpl.items() if k not in ("id", "created_at", "updated_at")}
            new.update(line_on_page=e["line"], asset="", transaction_type="other", transaction_date_text="",
                       amount_range="", row_number_printed=None, read_check=None, reread="hand_inserted",
                       reread_reason=None, reread_other_asset=None, restated=None, restate_basis=None,
                       restates_original=None, duplicate_sources=None, notification_over_30_days=None)
            changed = _set(new, e["fields"]) | {"asset", "amount", "date"}
            rederive(new, changed)
            rows = rows + [new]
            by[key] = new
            if log is not None:
                log.append({"doc": unid[:8], "page": e["page"], "line": e["line"], "action": "insert", "before": None,
                            "after": _brief(new), "why": e.get("why")})
            continue
        row = by.get(key)
        if row is None and e["action"] == "delete":
            continue  # already applied
        if row is None:
            raise ValueError(f"override for a missing row {unid[:8]} {key}")
        before = _brief(row)
        if e["action"] == "delete":
            drop.add(key)
            after = None
        elif e["action"] == "set":
            changed = _set(row, e.get("fields") or {})
            rederive(row, changed)
            if row.get("reread") not in ("hand_inserted",):
                row["reread"] = "hand_fixed" if changed or row.get("reread") == "hand_fixed" else "hand_ok"
            after = _brief(row)
        else:
            raise ValueError(f"unknown action {e['action']}")
        if log is not None:
            log.append({"doc": unid[:8], "page": e["page"], "line": e["line"], "action": e["action"], "before": before,
                        "after": after, "why": e.get("why")})
    return [r for r in rows if (r["page_number"], r["line_on_page"]) not in drop]


def _brief(r: dict) -> dict:
    return {"n": r.get("row_number_printed"), "asset": r["asset"], "type": r["transaction_type"],
            "date": r["transaction_date_text"], "amount": r["amount_range"], "late": r.get("stock_act_late")}


def check_continuity(rows: list[dict]) -> dict:
    """The R10d completeness test: the printed numbers of a 278-T filing (Exhibit A rows included: they carry the
    numbers of the lines they replace, so they fill those numbers) must be exactly 1..N with no number missing or repeated, and the row count N."""
    ns = sorted(r["row_number_printed"] for r in rows if r["row_number_printed"] is not None)
    nulls = sum(1 for r in rows if r["row_number_printed"] is None)
    n = max(ns) if ns else 0
    have = set(ns)
    missing = [i for i in range(1, n + 1) if i not in have]
    dups = sorted({i for i in ns if ns.count(i) > 1}) if len(have) != len(ns) else []
    return {"rows": len(ns) + nulls, "n_max": n, "nulls": nulls, "missing": missing[:20], "n_missing": len(missing),
            "dups": dups[:20], "ok": not missing and not dups and not nulls and len(ns) == n}
