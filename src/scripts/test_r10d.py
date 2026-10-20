"""R10d self-test (no GPU, no network, no database): band cuts snapped to the printed rules, the bottom-band extension,
the hand-checked overrides (set / merge / insert / delete, idempotent on rows read back from the database), the
1..N continuity check and the 45-day lateness boundary.

    python src/scripts/test_r10d.py
"""
from __future__ import annotations

import copy
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_extract as X  # noqa: E402
import oge_overrides as O  # noqa: E402


def _form(two_line: bool, rows: int = 30, pitch: int = 48) -> Path:
    """A synthetic 278-T page: yellow header, a # column between two vertical rules, black horizontal rules, one number
    per row (at the TOP of the cell on the two-line form, centred on the one-line form) and a description line."""
    from PIL import Image, ImageDraw
    w, h = 1700, 2200
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)
    top = 300
    d.rectangle((150, 200, 1550, top), fill=(255, 240, 120))  # yellow header
    for x in (160, 250, 1540):
        d.line((x, top, x, top + rows * pitch), fill="black", width=3)
    for i in range(rows + 1):
        d.line((160, top + i * pitch, 1540, top + i * pitch), fill="black", width=2)
    for i in range(rows):
        y = top + i * pitch
        ny = y + 4 if two_line else y + pitch // 2 - 6
        d.rectangle((175, ny, 205, ny + 12), fill="black")  # the printed number
        dy = y + pitch - 16 if two_line else y + pitch // 2 - 6
        d.rectangle((270, dy, 900, dy + 10), fill="black")  # the description
    p = Path(tempfile.mkdtemp()) / "p002.200.png"
    im.save(p)
    return p


def test_bands_two_line_form() -> None:
    png = _form(two_line=True)
    b = X.row_bands_numbers(png)
    assert len(b) == 30, b  # the first row right under the header is found (the old +8 offset sliced its #)
    for i, band in enumerate(b):
        cell_top, cell_bot = 300 + i * 48, 300 + (i + 1) * 48
        assert abs(band["y0"] - cell_top) <= 4 and abs(band["y1"] - cell_bot) <= 4, (i, band)  # snapped to the rules
    print("two-line form: 30 bands on the printed rules")


def test_bands_one_line_form() -> None:
    png = _form(two_line=False)
    b = X.row_bands_numbers(png)
    assert len(b) == 30, b
    for i, band in enumerate(b):
        mid = 300 + i * 48 + 24
        assert band["y0"] < mid < band["y1"], (i, band)  # each band holds its own row
    print("one-line form: 30 bands, one row each")


def test_snap_rejects_second_blob_in_cell() -> None:
    rowfrac = [0.0] * 300
    for y in (40, 88, 136, 184):
        rowfrac[y] = 1.0
    blobs = [(44, 56), (92, 104), (140, 152), (160, 172)]  # the last "number" is a border segment inside cell 3
    e = X.snap_to_rules(rowfrac, blobs, 48)
    assert e == [40, 88, 136, 184], e
    print("snap_to_rules: phantom blob in an occupied cell dropped")


def test_extend_bottom() -> None:
    best = [{"y0": 300 + 39 * i, "y1": 339 + 39 * i, "ink": 0.05} for i in range(5)]
    other = [dict(b) for b in best] + [{"y0": 497, "y1": 536, "ink": 0.03}, {"y0": 540, "y1": 700, "ink": 0.03}]
    out = X.extend_bottom(best, [other])
    assert len(out) == 6 and out[-1]["y1"] == 536, out  # the lost last row comes back; a tall band does not
    assert X.extend_bottom(best, [[{"y0": 497, "y1": 536, "ink": 0.001}]]) == best  # an empty band is not a row
    print("extend_bottom: last row restored")


def _row(page: int, line: int, n: int | None, **kw) -> dict:
    r = {"source_doc_id": "AAAA1111BBBB", "page_number": page, "line_on_page": line, "row_number_printed": n,
         "report_type": "278-T", "asset": f"ASSET {n}", "transaction_type": "purchase", "transaction_date_text": "1/2/2026",
         "transaction_date": "2026-01-02", "amount_range": "$1,001 - $15,000", "amount_min": 1001, "amount_max": 15000,
         "filed_date": "2026-02-20", "original_filed_date": "2026-02-20", "date_flag": None, "days_to_file": 49,
         "stock_act_late": True, "late_basis": "computed_278T", "reread": None, "amended_report": False,
         "notification_over_30_days": True, "id": f"id-{page}-{line}"}
    r.update(kw)
    return r


def test_overrides() -> None:
    rows = [_row(1, 1, 1), _row(1, 2, 3), _row(1, 3, None, asset="FRAGMENT", transaction_type="other",
                                                    transaction_date_text="not stated", amount_range="not stated"),
            _row(1, 4, 4, transaction_date_text="1/2/2006", transaction_date="2006-01-02", date_flag="stale_2y",
                 days_to_file=None, stock_act_late=None, late_basis="date_flag_stale_2y")]
    entries = [
        {"doc": "AAAA1111", "page": 1, "line": 2, "action": "set", "fields": {"n": 2, "asset_sub": ["ASSET 3", "ASSET 2"],
                                                                             "amount": "$1,000,001 - $5,000,000"}},
        {"doc": "AAAA1111", "page": 1, "line": 3, "action": "delete"},
        {"doc": "AAAA1111", "page": 1, "line": 4, "action": "set", "fields": {"n": 3, "date": "1/7/2026"}},
        {"doc": "AAAA1111", "page": 1, "line": 101, "action": "insert",
         "fields": {"n": 4, "asset": "AAPL - APPLE INC", "type": "sale", "date": "1/6/2026", "over30": "No",
                    "amount": "$15,001 - $50,000"}},
        {"doc": "AAAA1111", "page": 1, "line": 1, "action": "set", "fields": {}},
    ]
    log: list = []
    out = O.apply(copy.deepcopy(rows), "AAAA1111BBBB", entries, log)
    by = {r["line_on_page"]: r for r in out}
    assert set(by) == {1, 2, 4, 101}
    assert by[2]["asset"] == "ASSET 2" and by[2]["amount_min"] == 1000001 and by[2]["reread"] == "hand_fixed"
    assert by[4]["transaction_date"] == "2026-01-07" and by[4]["date_flag"] is None
    assert by[4]["days_to_file"] == 44 and by[4]["stock_act_late"] is False and by[4]["late_basis"] == "computed_278T"
    assert by[101]["ticker"] == "AAPL" and by[101]["transaction_type"] == "sale" and by[101]["reread"] == "hand_inserted"
    assert by[101]["notification_over_30_days"] is False and "id" not in by[101]
    assert by[1]["reread"] == "hand_ok"
    assert O.check_continuity(out)["ok"] is True and O.check_continuity(rows)["ok"] is False
    assert len(log) == 5
    again = O.apply(copy.deepcopy(out), "AAAA1111BBBB", entries)  # idempotent on rows read back from the database
    assert [(r["line_on_page"], r["asset"], r["row_number_printed"]) for r in again] == \
           [(r["line_on_page"], r["asset"], r["row_number_printed"]) for r in out]
    try:
        O.apply(copy.deepcopy(rows), "AAAA1111BBBB", [{"doc": "AAAA1111", "page": 1, "line": 1, "action": "set",
                                                      "fields": {"amount": "$1,001,000 - $5,000,000"}}])
        raise AssertionError("a non-OGE band must be refused")
    except ValueError:
        pass
    print("overrides: set / delete / insert / checked-ok, idempotent, non-OGE band refused")


def test_lateness_boundary() -> None:
    assert O.lateness_fields("278-T", "2026-07-24", None, "2026-09-07") == (45, False, "computed_278T")
    assert O.lateness_fields("278-T", "2026-07-24", None, "2026-09-08") == (46, True, "computed_278T")
    assert O.lateness_fields("278-T", "2016-07-24", "stale_2y", "2026-09-08") == (None, None, "date_flag_stale_2y")
    assert O.lateness_fields("278e annual", "2025-06-27", None, "2026-06-25") == (None, None, "annual_report_part7")
    print("lateness: 45 days on time, 46 late; flagged dates and annual reports not computed")


def test_override_file() -> None:
    entries = O.load()
    assert entries, "oge_overrides.json is missing or empty"
    for e in entries:
        assert e["action"] in ("set", "delete", "insert") and set(e.get("fields") or {}) <= O.FIELDS, e
        if e["action"] == "insert":
            assert e["line"] >= 101, e
        if "amount" in (e.get("fields") or {}):
            assert X.official_band(e["fields"]["amount"]), e
    print(f"oge_overrides.json: {len(entries)} entries well formed")


if __name__ == "__main__":
    test_bands_two_line_form()
    test_bands_one_line_form()
    test_snap_rejects_second_blob_in_cell()
    test_extend_bottom()
    test_overrides()
    test_lateness_boundary()
    test_override_file()
    print("R10d self-test: all passed")
