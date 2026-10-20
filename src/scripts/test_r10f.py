"""R10f tests (A11 M1-M5): instrument_class rules, not_required_on_278T lateness, the filings cover data, the override
file's M1 asset text. Run: python src/scripts/test_r10f.py (no database, no network)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oge_overrides as O  # noqa: E402
from load_executive_trades import instrument_class as ic  # noqa: E402

HERE = Path(__file__).resolve().parent


def test_instrument_class():
    bonds = ["BANK OF AMER CORP NTS 04.948% 072228 DTD072222 FC012223 CALL@MW+30BP YTM = 4.636 UNSOLICITED",
             "OLIN CORP DUE 08/01/2029 05.625%FA 01 DISCRETIONARY ORDER YIELD 5.000 % TO PAR CALL YIELD 16.605 %",
             "ORACLE CORP NTS B/E 04.450% 092630 DTD092625 CALLABLE", "WALLER TEX INDPT SC 5% DUE 02/15/39",
             "CAPITAL ONE FINL CORP PERP S 3.9500%", "ALLEN TEX INDPT SCH DIST UNLTD TAX REF BDS 2025A PERMANENT SCHOOL FUND GUARANTY DUE 02/15/2027",
             "UNITED STATES TREAS BILL DUE 04/16/26 AGENCY SALE", "US TREASUR NT 4% DUE 07/31/30"]
    for d in bonds:
        assert ic(d) == "bond", d
    for d in ["INTUIT", "JOHNSON & JOHNSON", "Intuit", "CRH PUBLIC LIMITED COMPANY", "VERIZON COMMUNICATIONS I",
              "Alphabet Inc Cl A With Due Bills Solicited Order Discretion", "WELLS FARGO & CO NEW - STOCK", "WELLS FARGO & CO NEW PERP PFD CNV A 7.50%"]:
        assert ic(d) == "stock", d
    for d in ["SPY - SPDR S&P 500 ETF", "SCHWAB GOVERNMENT MONEY FUND", "Vanguard Ohio Target Enrollment 2038 Portfolio",
              "VANGUARD SHORT-TERM BOND", "ISHARES GOLD TRUST", "INVESCO QQQ TR"]:
        assert ic(d) == "fund", d
    assert ic("SPY CALL OPTIONS 650 EXP 01/16/26") == "option"
    assert ic("SOME ODD LINE WITH NO MARKER") == "other"
    assert ic("CALL@MW+10BP") != "option"


def test_not_required():
    assert O.lateness_fields("278-T", "2026-01-01", None, "2026-03-01", "SCHWAB GOVERNMENT MONEY FUND", "fund") == (None, None, "not_required_on_278T")
    assert O.lateness_fields("278-T", "2026-01-01", None, "2026-03-01", "UNITED STATES TREAS BILL DUE 04/16/26", "bond") == (None, None, "not_required_on_278T")
    assert O.lateness_fields("278-T", "2026-01-01", None, "2026-03-01", "INTUIT", "stock")[2] == "computed_278T"
    assert O.lateness_fields("278-T", "2026-01-01", None, "2026-03-01", "INTUIT", "stock") == (59, True, "computed_278T")
    assert O.lateness_fields("278-T", "2026-01-01", None, "2026-03-01") == (59, True, "computed_278T")  # old signature still works
    assert O.not_required_on_278t("UNITED STATES TREAS BILL DUE 04/30/26", "bond")
    assert not O.not_required_on_278t("TREASURE ISLAND GROUP INC", "stock")


def test_overrides_m1():
    ents = json.loads((HERE / "oge_overrides.json").read_text(encoding="utf-8"))["entries"]
    r10f = [e for e in ents if (e.get("why") or "").startswith("R10f")]
    assert len(r10f) >= 50
    for e in r10f:
        subs = e["fields"].get("asset_sub")
        if subs:
            pairs = [subs] if isinstance(subs[0], str) else subs
            for old, new in pairs:
                assert old != new
                assert not re.search(r"(?<![\d.])0\.\d{3,4}\s?%", new), new  # the A11 M1 shape check
    keys = [(e["doc"], e["page"], e["line"], e["why"][:12]) for e in r10f]
    assert len(keys) == len(set(keys))


def test_filings_json():
    d = json.loads((HERE / "executive_filings.json").read_text(encoding="utf-8"))
    f = d["filings"]
    assert len(f) == 19 and len({x["source_doc_id"] for x in f}) == 19
    notes = [x for x in f if x["reviewer_comment_kind"] == "late_fee_note"]
    assert len(notes) == 5 and all(x["reviewer_comment"].startswith("Filer paid late fee") for x in notes)
    ident = [x for x in f if x["reviewer_comment_kind"] == "line_identification"]
    assert len(ident) == 1 and ident[0]["source_doc_id"].startswith("BCF60D94")
    assert "Fifth Third Bancorp - DJB 3/3/26" in ident[0]["reviewer_comment"]
    for x in f:
        assert x["filer_signed_date"] and x["daeo_signed_date"] and x["disclosure_url"].startswith("https://extapps2.oge.gov/")
        assert (x["reviewer_comment"] is None) == (x["reviewer_comment_kind"] is None)
        if x["reviewer_comment"]:
            assert x["reviewer_comment_initials"] and x["reviewer_comment_date"]
    am = next(x for x in f if x["source_doc_id"].startswith("024D876A"))
    assert am["amendment_signed_date"] == "2026-01-14" and am["amendment_oge_cert_date"] == "2026-01-15"
    assert sum(x["transaction_count"] for x in f) == 10093


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
