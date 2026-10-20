#!/usr/bin/env python3
"""
SlushFund R9: one repeatable refresh of the congressional trades.

    python src/scripts/refresh_trades.py [--dry-run] [--since YYYY-MM-DD] [--overlap-days 7]
                                         [--skip-house] [--skip-senate] [--skip-derived] [--cache-root DIR]

What it does (the same parsing, keys, amendment pairing, option handling, date flags and lateness rules as
R3 / R4 / R6a-f: it calls load_bulk_trades.py and load_senate_trades.py, it does not re-implement them):

  1. window     per chamber, start = trade_source_status.newest_filed - overlap days (default 7), so a late-posted
                filing is not missed. --since overrides both.
  2. House      Clerk index for 2021..this year -> filings filed on/after the start -> the members they belong to.
                A transaction can be restated by a later filing of the SAME member, so every House PTR of those
                members is fetched (cached) and parsed, then the loader's build_all rebuilds those members' rows
                (amendment pairing, first report, lateness) and upserts them on the lossless key.
  3. Senate     eFD listing of this year (earlier years' listings are cached) -> reports filed on/after the start ->
                the senators they belong to -> every electronic report of those senators fetched and parsed, then
                the loader's load stage rebuilds and upserts those senators (--only).
  4. prune      rows of the touched members that the rebuild did not write are rows a later filing superseded
                (a different lot / owner shape). They are deleted, capped (--max-prune, default 200): above the cap the
                run FAILS and deletes nothing.
  5. derived    compute_conflicts.py (committee / contractor / late / large signals, scores) then
                refresh_member_conflict_scores(). Both must succeed.
  6. record     logs/refresh-YYYY-MM-DD.jsonl (one JSON object per event), one sync_log row
                (sync_type congress_trades_refresh), a summary JSON next to the log.

Idempotent: caches are keyed by filing, rows are upserts on the lossless key, so a second run adds 0 rows.
Exit codes: 0 ok, 1 failure (sync_log row says why), 3 gaming mode (only with --respect-gaming; no GPU is used, so it is off by default).
Writes only: congress_trades, sync_log, and (through the RPC) the member_conflict_scores view. New members are NOT
created: a filer the member tables do not know fails the run with the name, so it is fixed once, by hand.
Official sources only: House Clerk, Senate eFD, unitedstates/congress-legislators (roster).
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from _venv import activate  # noqa: E402

activate()

import load_bulk_trades as lbt  # noqa: E402
import load_senate_trades as lst  # noqa: E402
from supabase import create_client  # noqa: E402

HOUSE_FIRST_YEAR = 2021          # R3 scope
SENATE_FIRST_YEAR = 2024         # R4 scope
SYNC_TYPE = "congress_trades_refresh"
GAMING_SCRIPT = os.environ.get("SLUSHFUND_GAMING_CHECK") or r"C:\Users\clong\.openclaw\workspace\scripts\gaming-mode.mjs"
FINGERPRINT_SKIP = {"id", "created_at", "updated_at"}


class Gaming(Exception):
    pass


class RefreshError(Exception):
    pass


# -- logging ---------------------------------------------------------------------------------------------------------

class Log:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def event(self, name, **kw):
        rec = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "event": name, **kw}
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, default=str) + "\n")
        short = {k: v for k, v in kw.items() if not isinstance(v, (list, dict)) or len(json.dumps(v, default=str)) < 160}
        print(f"[{rec['ts'][11:19]}] {name} {json.dumps(short, default=str)}", flush=True)


RESPECT_GAMING = False   # Apex 10/19: gaming mode only gates GPU use; Clerk / eFD downloads and DB writes don't need it


def gaming_check():
    if not RESPECT_GAMING or not os.path.exists(GAMING_SCRIPT):
        return
    try:
        rc = subprocess.run(["node", GAMING_SCRIPT, "check"], capture_output=True, timeout=30).returncode
    except Exception:  # noqa: BLE001
        return
    if rc == 3:
        raise Gaming("gaming mode is on")


# -- database helpers --------------------------------------------------------------------------------------------------

def supabase():
    url, key = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        raise RefreshError("Supabase URL / service key missing (.env.local)")
    return create_client(url, key)


def retrying(fn, tries=5):
    """Supabase / Cloudflare answers 5xx (522 timeouts seen 10/19) now and then: retry reads with a growing pause."""
    for attempt in range(tries):
        try:
            return fn()
        except Exception:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            time.sleep(5 * (attempt + 1))


def paged(make_query, size=1000):
    out, start = [], 0
    while True:
        rows = retrying(lambda: make_query().range(start, start + size - 1).execute().data)
        out += rows
        if len(rows) < size:
            return out
        start += size


def source_status(sb):
    """{source_system: {row_count, newest_filed, ...}} from the trade_source_status view."""
    return {r["source_system"]: r for r in retrying(lambda: sb.table("trade_source_status").select("*").execute().data)}


def chamber_ids(sb, chamber):
    return {r["id"] for r in paged(lambda: sb.table("congress_trades").select("id").eq("member_chamber", chamber).order("id"))}


def rows_of(sb, column, values):
    """Every congress_trades row whose `column` is one of `values` (chunked so the URL stays short)."""
    out, values = [], sorted(values)
    for i in range(0, len(values), 20):
        chunk = values[i:i + 20]
        out += paged(lambda: sb.table("congress_trades").select("*").in_(column, chunk).order("id"))
    return out


def fingerprint(row):
    body = {k: v for k, v in row.items() if k not in FINGERPRINT_SKIP}
    return hashlib.sha1(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def prune_superseded(sb, log, chamber, column, values, started_iso, cap, dry):
    """Delete rows of the touched members that this run's rebuild did not write (updated_at before the run began).
    A rebuilt member has every current row rewritten, so what is left was superseded by a later filing."""
    stale = []
    values = sorted(values)
    for i in range(0, len(values), 20):
        chunk = values[i:i + 20]
        stale += paged(lambda: sb.table("congress_trades")
                       .select("id,member_name,ticker,transaction_date,transaction_type,owner,source_doc_id")
                       .eq("member_chamber", chamber).in_(column, chunk).lt("updated_at", started_iso).order("id"))
    log.event("prune_candidates", chamber=chamber, count=len(stale), sample=stale[:5])
    if not stale:
        return 0
    if len(stale) > cap:
        raise RefreshError(f"{chamber}: {len(stale)} rows were not rewritten by the rebuild (cap {cap}); nothing deleted. "
                           "Look at the prune_candidates event, then re-run with --max-prune N if they are right")
    if dry:
        return len(stale)
    ids = [r["id"] for r in stale]
    for i in range(0, len(ids), 100):
        sb.table("congress_trades").delete().in_("id", ids[i:i + 100]).execute()
    log.event("pruned", chamber=chamber, count=len(ids), rows=stale)
    return len(ids)


# -- House -------------------------------------------------------------------------------------------------------------

def house_member_name(matcher, f, year):
    """The member_name build_all will give this index row, and the matched term (None = unknown member)."""
    last, first = (f.get("Last") or "").strip(), (f.get("First") or "").strip()
    statedst = (f.get("StateDst") or "").strip()
    filed = lbt.to_iso(f.get("FilingDate", ""))
    term = matcher.match(last, first, statedst[:2], lbt._norm_district(statedst[2:]),
                         lbt._d(filed) if filed else date(year, 6, 30))
    return matcher.name_for(term, first, last), term


def plan_house(filings_by_year, matcher, start):
    """-> (new filings, member names they belong to, DocIDs to have cached = every PTR of those members)."""
    new, names = [], set()
    named = []
    for year, filings in filings_by_year.items():
        for f in filings:
            name, term = house_member_name(matcher, f, year)
            named.append((year, f, name, term))
            filed = lbt.to_iso(f.get("FilingDate", ""))
            if filed and date.fromisoformat(filed) >= start:
                new.append((year, f, name, term))
                names.add(name)
    wanted = {(f.get("DocID") or "").strip() for _y, f, name, _t in named if name in names}
    return new, names, wanted


def refresh_house(args, sb, log, start, today, cache_root, dry):
    gaming_check()
    cache_dir = str(cache_root / "house")
    os.makedirs(cache_dir, exist_ok=True)
    matcher = lbt.load_matcher()
    years = list(range(HOUSE_FIRST_YEAR, today.year + 1))
    filings_by_year = {}
    for y in years:
        filings_by_year[y] = lbt.get_ptr_filings(y)
    source_newest = max((lbt.to_iso(f.get("FilingDate", "")) or "" for fl in filings_by_year.values() for f in fl), default="")
    new, names, wanted = plan_house(filings_by_year, matcher, start)
    log.event("house_plan", start=start.isoformat(), index_filings=sum(len(v) for v in filings_by_year.values()),
              source_newest_filed=source_newest, new_filings=len(new), members=len(names), docs_to_have=len(wanted))

    ids = lbt.member_ids(sb)
    unknown = sorted({name for _y, _f, name, term in new if term is None})
    no_member_row = sorted({name for _y, _f, name, term in new if term and term["bioguide_id"] not in ids})
    if unknown or no_member_row:
        # only a problem if such a filing has loadable lines, which is known after the fetch below
        log.event("house_unknown_members", not_in_house_terms=unknown, not_in_congress_members=no_member_row)

    before_rows = {r["id"]: fingerprint(r) for r in rows_of(sb, "member_name", names)} if names else {}

    cached_before = sum(1 for d in wanted if _house_cached(cache_dir, d, filings_by_year))
    rc = lbt.run(years, cache_dir=cache_dir, doc_filter=wanted, filings_by_year=filings_by_year, build=False)
    if rc == 3:
        raise Gaming("gaming mode is on (House fetch stopped, checkpointed)")
    if rc:
        raise RefreshError(f"House fetch returned {rc}")

    # every wanted filing must now be in the cache with a usable parse
    missing, parse_errors, scanned = [], [], 0
    recs = {}
    for y in years:
        recs.update(lbt.load_cache(os.path.join(cache_dir, f"{y}.jsonl")))
    for d in sorted(wanted):
        r = recs.get(d)
        if not r:
            missing.append(d)
        elif r["status"] == "parse_error":
            parse_errors.append(d)
        elif r["status"] == "scanned":
            scanned += 1
    if missing or parse_errors:
        raise RefreshError(f"House: {len(missing)} filings not fetched {missing[:8]}, {len(parse_errors)} parse errors {parse_errors[:8]}")
    # a filing of a member the loader cannot name or link would be written with a blank party / no member id
    bad = sorted({(name, f["DocID"]) for _y, f, name, term in new
                  if recs.get((f.get("DocID") or "").strip(), {}).get("trades")
                  and (term is None or term["bioguide_id"] not in ids)})
    if bad:
        raise RefreshError(f"House: filings with loadable lines by members the member tables do not hold: {bad[:8]} "
                           "(regenerate src/data/house_terms.json with gen_house_terms.py and add the member)")
    new_docs = [(f.get("DocID") or "").strip() for _y, f, _n, _t in new]
    log.event("house_fetched", docs_fetched=len(wanted) - cached_before, docs_were_cached=cached_before,
              scanned_not_loaded=scanned, new_filings_with_lines=sum(1 for d in new_docs if recs.get(d, {}).get("trades")),
              new_filings_scanned=[d for d in new_docs if recs.get(d, {}).get("status") == "scanned"])

    started = datetime.now(timezone.utc).isoformat()
    written = lbt.build_all(cache_dir, matcher, ids, None if dry else sb, prune=False)
    log.event("house_built", rows_written=written, dry_run=dry)
    pruned = 0
    if not dry and names:
        pruned = prune_superseded(sb, log, "House", "member_name", names, started, args.max_prune, dry)
    return {"names": names, "new_filings": len(new), "docs_fetched": len(wanted) - cached_before, "written": written,
            "pruned": pruned, "source_newest_filed": source_newest, "before_rows": before_rows,
            "scanned_new": [d for d in new_docs if recs.get(d, {}).get("status") == "scanned"],
            "no_ticker_new": [d for d in new_docs if recs.get(d, {}).get("status") in ("no_ticker", "no_transactions")]}


def _house_cached(cache_dir, doc, filings_by_year):
    for y in filings_by_year:
        if doc in lbt.load_cache(os.path.join(cache_dir, f"{y}.jsonl")):
            return True
    return False


# -- Senate ------------------------------------------------------------------------------------------------------------

def senate_plan(listing_filings, start):
    """-> bioguide ids of the senators with a filing (electronic or paper) filed on/after the start."""
    out = set()
    for f in listing_filings:
        d = lst.parse_date(f["filed"])
        if d and d >= start and f.get("bioguide_id"):
            out.add(f["bioguide_id"])
    return out


def refresh_senate(args, sb, log, start, today, cache_root, dry):
    gaming_check()
    lst.CK = cache_root / "senate"
    lst.REPORTS = lst.CK / "reports"
    lst.CK.mkdir(parents=True, exist_ok=True)
    lst.REPORTS.mkdir(parents=True, exist_ok=True)
    years = list(range(today.year, SENATE_FIRST_YEAR - 1, -1))
    ns = argparse.Namespace(years=years, limit=0, refresh=False, dry_run=dry, only=None, prune=False)
    efd = lst.Efd()
    lst.stage_roster(ns)
    for y in years:     # listings are by submission date: only the years the window touches can have new rows
        lst.stage_list(argparse.Namespace(years=[y], refresh=(y >= start.year)), efd)
    matched, paper, unmatched = lst.stage_match(ns)
    new_unmatched = [u for u in unmatched if (lst.parse_date(u["filed"]) or date.min) >= start]
    if new_unmatched:
        raise RefreshError("Senate: new eFD filings that match no senator in congress_members: "
                           + "; ".join(f"{u['first']} {u['last']} {u['filed']} {u['url']}" for u in new_unmatched[:6]))
    source_newest = max((str(lst.parse_date(f["filed"])) for f in matched + paper if lst.parse_date(f["filed"])), default="")
    affected = senate_plan(matched + paper, start)
    new_filings = [f for f in matched + paper if (lst.parse_date(f["filed"]) or date.min) >= start]
    new_paper = [f for f in paper if (lst.parse_date(f["filed"]) or date.min) >= start]
    restricted = [f for f in matched if f["bioguide_id"] in affected]
    lst.jsave(lst.CK / "matched-all.json", matched)
    lst.jsave(lst.CK / "matched.json", restricted)           # every later stage works on the touched senators only
    already = sum(1 for f in restricted if (lst.REPORTS / f"{f['report_id']}.json").exists())
    log.event("senate_plan", start=start.isoformat(), new_filings=len(new_filings), new_paper_filings=len(new_paper),
              senators=len(affected), reports_to_have=len(restricted), reports_cached=already, source_newest_filed=source_newest)
    if not affected:
        return {"bios": set(), "new_filings": 0, "reports_fetched": 0, "written": 0, "pruned": 0, "before_rows": {},
                "source_newest_filed": source_newest, "new_paper": []}

    before_rows = {r["id"]: fingerprint(r) for r in rows_of(sb, "bio_guide_id", affected)}
    try:
        lst.stage_fetch(ns, efd)
    except lst.Gaming:
        raise Gaming("gaming mode is on (Senate fetch stopped, checkpointed)")
    bad = []
    for f in restricted:
        rec = lst.jload(lst.REPORTS / f"{f['report_id']}.json")
        if rec is None:
            bad.append((f["report_id"], "not fetched"))
        elif rec.get("declared_count") is not None and rec["declared_count"] != len(rec["rows"]):
            bad.append((f["report_id"], f"page says {rec['declared_count']} transactions, parsed {len(rec['rows'])}"))
    if bad:
        raise RefreshError(f"Senate: {len(bad)} reports unusable: {bad[:6]}")

    started = datetime.now(timezone.utc).isoformat()
    ns_load = argparse.Namespace(years=years, limit=0, refresh=True, dry_run=dry, only=sorted(affected), prune=False)
    try:
        lst.stage_load(ns_load)
    except lst.Gaming:
        raise Gaming("gaming mode is on (Senate load stopped; re-run to finish)")
    except SystemExit as e:
        raise RefreshError(f"Senate load stopped: {e}")
    summary = lst.jload(lst.CK / "load-summary.json", {})
    if summary.get("reconcile_gap"):
        raise RefreshError(f"Senate: reconcile_gap {summary['reconcile_gap']} (source lines not all accounted for)")
    pruned = 0
    if not dry:
        pruned = prune_superseded(sb, log, "Senate", "bio_guide_id", affected, started, args.max_prune, dry)
    written = sum(v["rows"] for k, v in lst.jload(lst.CK / "loaded.json", {}).items() if k.split("|")[0] in affected)
    return {"bios": affected, "new_filings": len(new_filings), "reports_fetched": len(restricted) - already,
            "written": written, "pruned": pruned, "before_rows": before_rows, "source_newest_filed": source_newest,
            "new_paper": [f["url"] for f in new_paper], "load_summary": summary}


# -- derived fields ----------------------------------------------------------------------------------------------------

def run_derived(sb, log, logs_dir, dry):
    if dry:
        log.event("derived_skipped", reason="dry run")
        return {}
    out = logs_dir / f"refresh-conflicts-{date.today().isoformat()}.json"
    proc = subprocess.run([sys.executable, str(HERE / "compute_conflicts.py"), "--out", str(out)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(REPO),
                          env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    tail = (proc.stdout or "")[-1500:]
    log.event("compute_conflicts", returncode=proc.returncode, stdout_tail=tail, stderr_tail=(proc.stderr or "")[-800:])
    if proc.returncode:
        raise RefreshError(f"compute_conflicts.py exited {proc.returncode}")
    if "NOT refreshed" in (proc.stdout or ""):
        raise RefreshError("compute_conflicts.py could not refresh member_conflict_scores")
    sb.rpc("refresh_member_conflict_scores").execute()      # explicit and checked (the script above only warns)
    log.event("member_conflict_scores_refreshed")
    return json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}


# -- main --------------------------------------------------------------------------------------------------------------

def run(args, log):
    t0 = time.time()
    today = date.today()
    sb = supabase()
    status = source_status(sb)
    for s in ("House_Clerk", "Senate_EFD"):
        if s not in status or not status[s].get("newest_filed"):
            raise RefreshError(f"trade_source_status has no newest_filed for {s}")
    overlap = timedelta(days=args.overlap_days)
    starts = {
        "House": date.fromisoformat(args.since) if args.since else date.fromisoformat(status["House_Clerk"]["newest_filed"]) - overlap,
        "Senate": date.fromisoformat(args.since) if args.since else date.fromisoformat(status["Senate_EFD"]["newest_filed"]) - overlap,
    }
    before = {"House": chamber_ids(sb, "House"), "Senate": chamber_ids(sb, "Senate")}
    log.event("start", dry_run=args.dry_run, starts={k: v.isoformat() for k, v in starts.items()},
              counts_before={k: len(v) for k, v in before.items()},
              newest_filed_before={k: status[k]["newest_filed"] for k in status})
    sync_id = None
    if not args.dry_run:
        sync_id = sb.table("sync_log").insert({
            "sync_type": SYNC_TYPE, "start_date": min(starts.values()).isoformat(), "end_date": today.isoformat(),
            "status": "running"}).execute().data[0]["id"]
    cache_root = Path(args.cache_root)
    res = {}
    try:
        if not args.skip_house:
            res["House"] = refresh_house(args, sb, log, starts["House"], today, cache_root, args.dry_run)
        if not args.skip_senate:
            res["Senate"] = refresh_senate(args, sb, log, starts["Senate"], today, cache_root, args.dry_run)
        derived = {} if args.skip_derived else run_derived(sb, log, Path(log.path).parent, args.dry_run)
        after_status = source_status(sb)
        after = {"House": chamber_ids(sb, "House"), "Senate": chamber_ids(sb, "Senate")}
        added = {k: sorted(after[k] - before[k]) for k in after}
        removed = {k: sorted(before[k] - after[k]) for k in after}
        changed = {}
        for ch in ("House", "Senate"):
            r = res.get(ch)
            if r and not args.dry_run and r["before_rows"]:
                col, vals = ("member_name", r["names"]) if ch == "House" else ("bio_guide_id", r["bios"])
                now = {x["id"]: fingerprint(x) for x in rows_of(sb, col, vals)}
                changed[ch] = sorted(i for i, fp in r["before_rows"].items() if i in now and now[i] != fp)
        new_rows = []
        if added["House"] or added["Senate"]:
            ids = added["House"] + added["Senate"]
            for i in range(0, len(ids), 100):
                new_rows += sb.table("congress_trades").select(
                    "id,member_chamber,member_name,ticker,transaction_type,transaction_date,filed_date,source_doc_id,date_flag,stock_act_late"
                ).in_("id", ids[i:i + 100]).execute().data
        summary = {
            "date": today.isoformat(), "dry_run": args.dry_run, "starts": {k: v.isoformat() for k, v in starts.items()},
            "counts_before": {k: len(v) for k, v in before.items()},
            "counts_after": {k: len(v) for k, v in after.items()},
            "rows_added": {k: len(v) for k, v in added.items()}, "rows_removed": {k: len(v) for k, v in removed.items()},
            "existing_rows_changed": {k: len(v) for k, v in changed.items()},
            "newest_filed_before": {k: status[k]["newest_filed"] for k in status},
            "newest_filed_after": {k: after_status[k]["newest_filed"] for k in after_status},
            "source_newest_filed": {k: res[k]["source_newest_filed"] for k in res},
            "new_filings": {k: res[k]["new_filings"] for k in res}, "pruned": {k: res[k]["pruned"] for k in res},
            "new_rows_flagged": sum(1 for r in new_rows if r.get("date_flag")),
            "new_scanned_house_filings": res.get("House", {}).get("scanned_new", []),
            "new_paper_senate_filings": res.get("Senate", {}).get("new_paper", []),
            "derived_trades_scored": derived.get("trades"),
        }
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        summary_path = Path(log.path).parent / f"refresh-summary-{stamp}.json"
        summary["summary_file"] = summary_path.name
        summary_path.write_text(
            json.dumps({**summary, "added_ids": added, "changed_ids": changed, "new_rows": new_rows}, indent=1, default=str),
            encoding="utf-8")
        log.event("done", **summary)
        if sync_id:
            sb.table("sync_log").update({
                "status": "complete", "completed_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": int((time.time() - t0) * 1000),
                "records_synced": len(added["House"]) + len(added["Senate"]),
                "records_flagged": summary["new_rows_flagged"],
                "pages_processed": res.get("House", {}).get("docs_fetched", 0) + res.get("Senate", {}).get("reports_fetched", 0),
                "errors": [],
            }).eq("id", sync_id).execute()
        return summary
    except BaseException as e:
        if sync_id:
            try:
                sb.table("sync_log").update({
                    "status": "failed", "completed_at": datetime.now(timezone.utc).isoformat(),
                    "duration_ms": int((time.time() - t0) * 1000),
                    "errors": [{"type": type(e).__name__, "message": str(e)[:900]}],
                }).eq("id", sync_id).execute()
            except Exception as e2:  # noqa: BLE001
                log.event("sync_log_update_failed", error=str(e2)[:300])
        raise


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="plan, fetch and rebuild in memory; write nothing to the database")
    ap.add_argument("--since", help="YYYY-MM-DD: treat filings on/after this date as new (both chambers)")
    ap.add_argument("--overlap-days", type=int, default=7)
    ap.add_argument("--skip-house", action="store_true")
    ap.add_argument("--skip-senate", action="store_true")
    ap.add_argument("--skip-derived", action="store_true")
    ap.add_argument("--respect-gaming", action="store_true", help="stop with exit 3 while gaming mode is on (off by default: no GPU is used)")
    ap.add_argument("--max-prune", type=int, default=200, help="most superseded rows one run may delete per chamber")
    ap.add_argument("--cache-root", default=os.environ.get("SLUSHFUND_CACHE") or str(REPO / ".checkpoints" / "refresh"),
                    help="where fetched filings are kept (default <repo>/.checkpoints/refresh; gitignored)")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    global RESPECT_GAMING
    RESPECT_GAMING = args.respect_gaming
    if args.respect_gaming:
        os.environ.setdefault("SLUSHFUND_GAMING_CHECK", GAMING_SCRIPT)
    else:       # the loaders have their own checks: switch them off too
        os.environ.pop("SLUSHFUND_GAMING_CHECK", None)
        lst.GAMING_CHECK = ""
    log = Log(REPO / "logs" / f"refresh-{date.today().isoformat()}.jsonl")
    try:
        gaming_check()
        run(args, log)
        return 0
    except Gaming as e:
        log.event("deferred_gaming", message=str(e))
        return 3
    except BaseException as e:  # noqa: BLE001
        if isinstance(e, KeyboardInterrupt):
            raise
        log.event("failed", error_type=type(e).__name__, message=str(e)[:1200], trace=traceback.format_exc()[-1800:])
        return 1


if __name__ == "__main__":
    sys.exit(main())
