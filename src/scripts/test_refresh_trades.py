#!/usr/bin/env python3
"""Self-test for refresh_trades.py (R9). Run: python src/scripts/test_refresh_trades.py

Offline (always run): the planning rules, the prune cap, and the idempotency of the House rebuild (the loader's
real build_all against an in-memory database): build twice -> the second run adds 0 rows, changes none, and a
later filing that restates a transaction replaces it instead of duplicating it.

Live (SLUSHFUND_LIVE_TEST=1 only, needs network and .env.local): runs refresh_trades.main() twice against the real
database and asserts the second run adds 0 rows in both chambers.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import load_bulk_trades as lbt  # noqa: E402
import refresh_trades as rt  # noqa: E402


# -- in-memory stand-in for the supabase client (just what build_all / prune_superseded call) ---------------------------

class Result:
    def __init__(self, data=None, count=None):
        self.data, self.count = data or [], count


class Query:
    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.filters, self.mode, self.payload, self.want_count, self.rng = [], "select", None, False, None

    def select(self, cols="*", count=None):
        self.mode, self.want_count = "select", bool(count)
        return self

    def eq(self, k, v):
        self.filters.append(lambda r: r.get(k) == v)
        return self

    def lt(self, k, v):
        self.filters.append(lambda r: r.get(k) is not None and r.get(k) < v)
        return self

    def in_(self, k, vs):
        vs = set(vs)
        self.filters.append(lambda r: r.get(k) in vs)
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, a, b):
        self.rng = (a, b)
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def upsert(self, rows, on_conflict):
        self.mode, self.payload, self.conflict = "upsert", rows, on_conflict.split(",")
        return self

    def execute(self):
        t = self.db.tables.setdefault(self.table_name, {})
        if self.mode == "upsert":
            for r in self.payload:
                key = tuple(r.get(c) for c in self.conflict)
                if key in t:
                    t[key].update(r)
                else:
                    self.db.inserted += 1
                    t[key] = dict(r, id=len(t) + 1000 + self.db.inserted)
            return Result()
        rows = [r for r in t.values() if all(f(r) for f in self.filters)]
        if self.mode == "delete":
            for k in [k for k, r in t.items() if r in rows]:
                del t[k]
            self.db.deleted += len(rows)
            return Result()
        total = len(rows)
        if self.rng:
            rows = rows[self.rng[0]:self.rng[1] + 1]
        return Result(rows, total if self.want_count else None)


class FakeDB:
    def __init__(self):
        self.tables, self.inserted, self.deleted = {}, 0, 0

    def table(self, name):
        return Query(self, name)

    def rows(self):
        return list(self.tables.get("congress_trades", {}).values())


# -- synthetic House cache -----------------------------------------------------------------------------------------------

class Matcher:
    """Stands in for MemberMatcher: Smith (CA-1) and Jones (TX-2) are known; anyone else is unknown."""
    terms = {"Smith": {"bioguide_id": "S000001", "party": "Democrat"}, "Jones": {"bioguide_id": "J000002", "party": "Republican"}}

    def match(self, last, first, state, district, on):
        return self.terms.get(last)

    def name_for(self, term, first, last):
        return f"{first} {last}".strip()


def trade(ticker="AAPL", day="2026-08-03", kind="BUY", owner="Self", status="New", band="$1,001 - $15,000", lo=1001, hi=15000):
    return {"ticker": ticker, "company_name": ticker + " Inc", "transaction_type": kind, "transaction_date": day,
            "notification_date": day, "amount_min": lo, "amount_max": hi, "amount_range": band, "asset_type": "Stock",
            "owner": owner, "desc": "", "filing_status": status}


def filing(doc, last, first, filed):
    return {"DocID": doc, "Last": last, "First": first, "StateDst": "CA01" if last == "Smith" else "TX02",
            "FilingDate": filed, "FilingType": "P"}


def write_cache(cache_dir, year, filings, trades_by_doc):
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{year}-index.json").write_text(json.dumps(filings), encoding="utf-8")
    with open(cache_dir / f"{year}.jsonl", "w", encoding="utf-8") as f:
        for fl in filings:
            trades = trades_by_doc.get(fl["DocID"], [])
            rec = {"doc": fl["DocID"], "year": year, "parser": lbt.PARSER_VERSION,
                   "status": "ok" if trades else "no_ticker",
                   "stats": {"pages": 1, "chars": 999, "txn_lines": len(trades), "loaded": len(trades)}, "trades": trades}
            f.write(json.dumps(rec) + "\n")


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="refresh-test-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def build(self, db, ids=None):
        return lbt.build_all(self.tmp, Matcher(), ids or {"S000001": 1, "J000002": 2}, db, prune=False)

    # planning -----------------------------------------------------------------------------------------------------------
    def test_plan_house_takes_every_filing_of_a_member_with_a_new_one(self):
        fb = {2025: [filing("1", "Smith", "Ann", "3/1/2025"), filing("2", "Jones", "Bo", "4/1/2025")],
              2026: [filing("3", "Smith", "Ann", "10/2/2026"), filing("4", "Jones", "Bo", "6/1/2026")]}
        new, names, wanted = rt.plan_house(fb, Matcher(), date(2026, 9, 24))
        self.assertEqual([f["DocID"] for _y, f, _n, _t in new], ["3"])
        self.assertEqual(names, {"Ann Smith"})
        self.assertEqual(wanted, {"1", "3"})           # Smith's 2025 filing too: a new filing can restate it; Jones untouched

    def test_plan_house_nothing_new(self):
        fb = {2026: [filing("4", "Jones", "Bo", "6/1/2026")]}
        new, names, wanted = rt.plan_house(fb, Matcher(), date(2026, 9, 24))
        self.assertEqual((new, names, wanted), ([], set(), set()))

    def test_senate_plan_counts_electronic_and_paper(self):
        listing = [{"filed": "10/02/2026", "bioguide_id": "A1"}, {"filed": "01/02/2026", "bioguide_id": "B2"},
                   {"filed": "09/24/2026", "bioguide_id": "C3"}]
        self.assertEqual(rt.senate_plan(listing, date(2026, 9, 24)), {"A1", "C3"})

    # idempotency (the point of R9) ------------------------------------------------------------------------------------
    def test_second_run_adds_zero_rows(self):
        fl = [filing("100", "Smith", "Ann", "8/10/2026"), filing("101", "Jones", "Bo", "8/12/2026")]
        write_cache(self.tmp, 2026, fl, {"100": [trade("AAPL"), trade("MSFT", kind="SELL")], "101": [trade("XOM")]})
        db = FakeDB()
        self.build(db)
        first = len(db.rows())
        self.assertEqual((first, db.inserted), (3, 3))
        snapshot = {r["id"]: {k: v for k, v in r.items() if k != "updated_at"} for r in db.rows()}
        db.inserted = 0
        self.build(db)
        self.assertEqual(db.inserted, 0, "second run inserted rows")
        self.assertEqual(len(db.rows()), first)
        self.assertEqual(snapshot, {r["id"]: {k: v for k, v in r.items() if k != "updated_at"} for r in db.rows()},
                         "second run changed a stored row")

    def test_new_filing_adds_only_its_rows_then_settles(self):
        fl = [filing("100", "Smith", "Ann", "8/10/2026")]
        write_cache(self.tmp, 2026, fl, {"100": [trade("AAPL")]})
        db = FakeDB()
        self.build(db)
        fl.append(filing("102", "Smith", "Ann", "10/05/2026"))
        write_cache(self.tmp, 2026, fl, {"100": [trade("AAPL")], "102": [trade("NVDA", day="2026-09-30")]})
        db.inserted = 0
        self.build(db)
        self.assertEqual(db.inserted, 1)
        db.inserted = 0
        self.build(db)
        self.assertEqual((db.inserted, len(db.rows())), (0, 2))

    def test_amendment_restates_instead_of_duplicating(self):
        fl = [filing("100", "Smith", "Ann", "8/10/2026"), filing("103", "Smith", "Ann", "10/05/2026")]
        original = trade("AAPL", band="$1,001 - $15,000")
        amended = trade("AAPL", band="$15,001 - $50,000", lo=15001, hi=50000, status="Amended")
        write_cache(self.tmp, 2026, fl, {"100": [original], "103": [amended]})
        db = FakeDB()
        self.build(db)
        rows = db.rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["source_doc_id"], rows[0]["amount_range"]), ("103", "$15,001 - $50,000"))
        self.assertEqual((rows[0]["original_source_doc_id"], rows[0]["original_filed_date"]), ("100", "2026-08-10"))
        db.inserted = 0
        self.build(db)
        self.assertEqual((db.inserted, len(db.rows())), (0, 1))

    # prune cap ----------------------------------------------------------------------------------------------------------
    def test_prune_over_the_cap_fails_and_deletes_nothing(self):
        db = FakeDB()
        t = db.tables.setdefault("congress_trades", {})
        for i in range(5):
            t[i] = {"id": i, "member_chamber": "House", "member_name": "Ann Smith", "updated_at": "2026-01-01T00:00:00+00:00",
                    "ticker": f"T{i}", "transaction_date": "2026-01-01", "transaction_type": "BUY", "owner": "Self",
                    "source_doc_id": "1"}
        log = rt.Log(Path(self.tmp) / "log.jsonl")
        with self.assertRaises(rt.RefreshError):
            rt.prune_superseded(db, log, "House", "member_name", {"Ann Smith"}, "2026-10-19T00:00:00+00:00", 3, False)
        self.assertEqual((len(db.rows()), db.deleted), (5, 0))
        self.assertEqual(rt.prune_superseded(db, log, "House", "member_name", {"Ann Smith"}, "2026-10-19T00:00:00+00:00", 10, False), 5)
        self.assertEqual((len(db.rows()), db.deleted), (0, 5))

    def test_prune_leaves_rows_written_this_run(self):
        db = FakeDB()
        t = db.tables.setdefault("congress_trades", {})
        t[1] = {"id": 1, "member_chamber": "House", "member_name": "Ann Smith", "updated_at": "2026-10-19T01:00:00+00:00"}
        t[2] = {"id": 2, "member_chamber": "House", "member_name": "Other One", "updated_at": "2026-01-01T00:00:00+00:00"}
        log = rt.Log(Path(self.tmp) / "log.jsonl")
        self.assertEqual(rt.prune_superseded(db, log, "House", "member_name", {"Ann Smith"}, "2026-10-19T00:00:00+00:00", 10, False), 0)
        self.assertEqual(len(db.rows()), 2)


@unittest.skipUnless(os.environ.get("SLUSHFUND_LIVE_TEST") == "1", "live test: set SLUSHFUND_LIVE_TEST=1")
class LiveIdempotency(unittest.TestCase):
    def test_second_refresh_adds_zero_rows(self):
        out = Path(os.environ.get("SLUSHFUND_LIVE_OUT") or tempfile.gettempdir())
        for run in (1, 2):
            rc = rt.main(["--skip-derived"])
            self.assertEqual(rc, 0, f"run {run} failed (see logs/refresh-*.jsonl)")
            newest = max((rt.REPO / "logs").glob("refresh-summary-*.json"), key=lambda p: p.stat().st_mtime)
            summary = json.loads(newest.read_text(encoding="utf-8"))
            shutil.copy(newest, out / f"live-run{run}-summary.json")
            if run == 2:
                self.assertEqual(summary["rows_added"], {"House": 0, "Senate": 0})
                self.assertEqual(summary["rows_removed"], {"House": 0, "Senate": 0})


if __name__ == "__main__":
    unittest.main(verbosity=2)
