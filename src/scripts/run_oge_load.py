"""R10b: unattended loader for the President's remaining 278-T filings (OGE PDFs -> executive_trades).

Run by the Windows scheduled task "SlushFund OGE load" every 30 minutes (single instance, locked, gaming-gated,
self-disabling). One run reads pages with Gemma on the B65 (one request at a time) until it is done, Colin starts
gaming, or the model keeps failing; the next trigger resumes from the page cache (done markers next to the cached
page readings). Nothing but `officials` and `executive_trades` is written.

    python src/scripts/run_oge_load.py            # a normal (scheduled) run
    python src/scripts/run_oge_load.py --status   # progress summary, no GPU, no lock
    python src/scripts/run_oge_load.py --max-pages 3

Order: smallest filing first (fewest table pages). Per page: gaming check (exit 3 of gaming-mode.mjs = gaming -> exit
cleanly), Gemma strips + single-row re-reads (load_executive_trades.warm_page), one line in run-log.jsonl. When all pages
of a filing are read it is built from the cache and written; same-day reports are written together once every one of them
is read (restatement and duplicate rules, oge_restate.py). A written filing then gets the automatic 400 DPI re-read check
(verify_executive_trades.verify_filing). When every filing is loaded and checked the task disables itself.

Stop it:  schtasks /Change /TN "SlushFund OGE load" /DISABLE      (a run in progress finishes its current request)
          or  schtasks /End /TN "SlushFund OGE load"
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

TASK = "SlushFund OGE load"
EV = Path(r"C:\Users\clong\openclaw-shared\projects\slushfund\r10-evidence")
CACHE = Path(os.environ.get("SLUSHFUND_OGE_CACHE", str(Path(os.environ.get("TEMP", r"C:\Users\clong\AppData\Local\Temp")) / "slush-r10" / "oge")))
INVENTORY = EV / "inventory.csv"
LOG = EV / "run-log.jsonl"
STATE = EV / "run-state.json"
LOCK = CACHE.parent / "run_oge_load.lock"
MAX_ATTEMPTS = 3  # genuine failures of one page (an exception that is not a server fault); a bad reading never raises
MAX_PAGE_FAULTS = 12  # consecutive page exceptions with a HEALTHY server = a code fault: stop and say so (never "Gemma down")
SERVER_WAIT = 600  # seconds to wait for /health while the server restarts or loads its model
NOWIN = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def log(**kw) -> None:
    kw = {"ts": datetime.now().astimezone().isoformat(timespec="seconds"), **kw}
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(kw, ensure_ascii=False, default=str) + "\n")


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"filings": {}, "attempts": {}}


def save_state(st: dict) -> None:
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    os.replace(tmp, STATE)


def acquire_lock():
    """OS-level exclusive lock on a file: released by the OS when the process dies, so a crash never leaves a stale lock."""
    import msvcrt
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOCK, "a+")
    try:
        msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        fh.close()
        return None
    fh.seek(0)
    fh.truncate()
    fh.write(f"pid {os.getpid()} since {datetime.now().isoformat(timespec='seconds')}\n")
    fh.flush()
    return fh


def gaming() -> bool:
    import oge_extract as X
    return X.gaming_active()


def gaps_text(gaps: list[dict]) -> list[str]:
    """['p4:#310-#312', 'p7:#?'] - the printed # ranges a filing is missing."""
    out = []
    for g in gaps:
        lo, hi = g.get("n_from"), g.get("n_to")
        rng = "#?" if lo is None else (f"#{lo}" if lo == hi or hi is None else f"#{lo}-#{hi}")
        out.append(f"p{g['page']}:{rng}")
    return out


def disable_task() -> str:
    r = subprocess.run(["schtasks", "/Change", "/TN", TASK, "/DISABLE"], capture_output=True, text=True, creationflags=NOWIN)
    return (r.stdout + r.stderr).strip()[:200]


def plan_filings(L, inv: list[dict]) -> list[dict]:
    """278-T filings, smallest first (table pages), each with its page plan."""
    recs = [r for r in inv if r["kind"] == "278-T"]
    for r in recs:
        pdf = CACHE / "pdf" / f"{r['unid']}.pdf"
        r["_pages"] = L.transaction_pages(pdf, r["kind"], CACHE / r["unid"], r)
    recs.sort(key=lambda r: (len(r["_pages"]), r["file"]))
    return recs


def filing_pages_state(L, rec: dict, st: dict) -> tuple[list, list, list]:
    """(todo, done, skipped) page lists for one filing."""
    todo, done, skipped = [], [], []
    for pg, role in rec["_pages"]:
        if L.page_is_done(rec, CACHE, pg):
            done.append(pg)
        elif st["attempts"].get(f"{rec['unid']}:{pg}", 0) >= MAX_ATTEMPTS:
            skipped.append(pg)
        else:
            todo.append((pg, role))
    return todo, done, skipped


def status(L, inv: list[dict]) -> None:
    st = load_state()
    recs = plan_filings(L, inv)
    tp = td = 0
    for r in recs:
        todo, done, skipped = filing_pages_state(L, r, st)
        tp += len(r["_pages"])
        td += len(done)
        s = st["filings"].get(r["unid"], {})
        print(f"{r['file'][:44]:44} pages {len(done):3}/{len(r['_pages']):3} skipped {len(skipped)} loaded {s.get('loaded')} "
              f"rows {s.get('rows')} verified {s.get('verified', {}).get('all')}/{s.get('verified', {}).get('checked')}"
              + (f" GAPS {gaps_text(s['gaps'])}" if s.get("gaps") else ""))
    print(f"pages {td}/{tp}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--max-pages", type=int, default=0, help="stop after this many pages (testing)")
    ap.add_argument("--no-disable", action="store_true", help="do not disable the task when everything is done (testing)")
    a = ap.parse_args()
    if sys.stdout is None or os.path.basename(sys.executable).lower() == "pythonw.exe":  # scheduled task: no console
        sys.stdout = sys.stderr = open(EV / "run-stdout.log", "a", encoding="utf-8", buffering=1)
    import load_executive_trades as L
    import oge_extract as X
    import verify_executive_trades as V
    inv = list(csv.DictReader(open(INVENTORY, encoding="utf-8")))
    if a.status:
        status(L, inv)
        return 0
    lock = acquire_lock()
    if lock is None:
        print("another run holds the lock: exiting")
        return 0
    t_start = time.time()
    pages_done_run, consecutive_err = 0, 0
    fatal: list = []  # why the run had to stop (server down / code fault); empty for gaming, --max-pages, done
    if gaming():
        log(event="gaming", note="Colin is gaming: nothing started")
        return 0
    st = load_state()
    if st.get("version") != L.PIPELINE_VERSION:  # build_rows changed: rewrite what is loaded from the cache (no GPU needed)
        for f in st["filings"].values():
            f.pop("loaded", None)
            f.pop("verified", None)
        st["version"] = L.PIPELINE_VERSION
        save_state(st)
        log(event="reload_all", version=L.PIPELINE_VERSION)
    recs = plan_filings(L, inv)
    groups = L.day_groups(inv)
    sb = L.client()
    off_ids = L.ensure_officials(sb)
    log(event="start", filings=len(recs), pages=sum(len(r["_pages"]) for r in recs))
    by_unid = {r["unid"]: r for r in recs}

    def group_of(rec):
        return [by_unid[g["unid"]] for g in groups[L.filename_date(rec["file"]) or rec["unid"]]]

    blips: dict = {}  # server blips per cover/page this run (a restart of the server never burns a page's attempts)

    def on_failure(e: Exception, rec, pg, role, key: str, t0: float) -> str:
        """An exception while reading a cover or page. 'retry' (the server blipped and is back: same page again),
        'next' (a real failure of this page, counted: a page that fails 3 times is skipped, the run goes on),
        'gaming' or 'stop' (the server is not answering after SERVER_WAIT). A bad READING is not an exception any more
        (oge_extract falls back to smaller crops and records the band as unreadable), so Gemma being 'down' is decided
        only by its health endpoint, never by the number of failures."""
        nonlocal consecutive_err
        secs = round(time.time() - t0, 1)
        if isinstance(e, X.GemmaServerError) or X.gemma_health() != "ok":
            if gaming():
                log(event="gaming", filing=rec["file"], page=pg, note="server not answering because Colin started gaming")
                return "gaming"
            if not X.wait_gemma(SERVER_WAIT):
                log(filing=rec["file"], page=pg, role=role, secs=secs, status="err", note=("server down: " + str(e))[:250])
                log(event="stop", note=f"Gemma server (/health) not answering for {SERVER_WAIT // 60} min: exiting, the next trigger retries")
                fatal.append("server down")
                return "stop"
            blips[key] = blips.get(key, 0) + 1
            if blips[key] < 3:
                log(filing=rec["file"], page=pg, role=role, secs=secs, status="err", note=("server blip, back: " + str(e))[:250])
                return "retry"
        st["attempts"][key] = st["attempts"].get(key, 0) + 1
        save_state(st)
        consecutive_err += 1
        skipped = st["attempts"][key] >= MAX_ATTEMPTS
        log(filing=rec["file"], page=pg, role=role, secs=secs, status="skip" if skipped else "err",
            attempt=st["attempts"][key], note=f"{type(e).__name__}: {e}"[:300])
        if consecutive_err >= MAX_PAGE_FAULTS:
            log(event="stop", note=f"{consecutive_err} consecutive page exceptions with a healthy Gemma server: a code fault, exiting")
            fatal.append("code fault")
            return "stop"
        return "next"

    def read_pages(rec) -> str:
        """Returns 'ok' | 'gaming' | 'stop' (max pages / server down / code fault) | 'skip' (cover unreadable)."""
        nonlocal pages_done_run, consecutive_err
        pdf, pc = CACHE / "pdf" / f"{rec['unid']}.pdf", CACHE / rec["unid"]
        ckey = f"{rec['unid']}:cover"
        while not (pc / "p001.cover.json").exists():
            if st["attempts"].get(ckey, 0) >= MAX_ATTEMPTS:
                st.setdefault("fails", {})[rec["unid"]] = MAX_ATTEMPTS  # no cover, no filing: counted as given up
                save_state(st)
                log(event="cover_unreadable", filing=rec["file"], note="cover failed 3 times: filing skipped")
                return "skip"
            if gaming():
                log(event="gaming", filing=rec["file"], page=1)
                return "gaming"
            t0 = time.time()
            try:
                L.cover(pdf, pc, rec)
                consecutive_err = 0
                log(filing=rec["file"], page=1, role="cover", secs=round(time.time() - t0, 1), status="ok")
            except SystemExit:
                return "gaming"
            except Exception as e:  # noqa: BLE001
                act = on_failure(e, rec, 1, "cover", ckey, t0)
                if act in ("gaming", "stop"):
                    return act
        while True:
            todo, _, _ = filing_pages_state(L, rec, st)
            if not todo:
                return "ok"
            pg, role = todo[0]
            if gaming():  # the check before every page
                log(event="gaming", filing=rec["file"], page=pg, note="stopped before page")
                return "gaming"
            key = f"{rec['unid']}:{pg}"
            t0 = time.time()
            try:
                summ = L.warm_page(rec, CACHE, pg, role)
                consecutive_err = 0
                pages_done_run += 1
                ub = summ.get("unreadable_bands") or 0
                log(filing=rec["file"], page=pg, role=role, lines=summ["lines"], filled_bands=summ["filled_bands"],
                    rereads=summ["rereads"], strip_retries=summ.get("strip_retries"), flags=summ.get("flags") or None,
                    unreadable_bands=ub or None, unreadable=gaps_text([{"page": pg, **u} for u in summ.get("unreadable") or []]) or None,
                    secs=round(time.time() - t0, 1), status=("unreadable" if ub and not summ["lines"] else "gaps") if ub else "ok")
            except SystemExit:  # gaming started inside the page
                log(event="gaming", filing=rec["file"], page=pg, note="stopped inside page")
                return "gaming"
            except Exception as e:  # noqa: BLE001
                act = on_failure(e, rec, pg, role, key, t0)
                if act in ("gaming", "stop"):
                    return act
            if a.max_pages and pages_done_run >= a.max_pages:
                return "stop"

    def finish(rec, group_ready: bool) -> None:
        """Write a filing whose pages are all read (or skipped). A same-day group is written together, once every
        member is read; before that a member is written alone ('plain') so its rows are in the table early."""
        members = group_of(rec)
        final = len(members) == 1 or group_ready
        loaded = lambda u: st["filings"].get(u, {}).get("loaded")  # noqa: E731
        if final and all(loaded(m["unid"]) == "group" for m in members):
            return
        if not final and loaded(rec["unid"]) in ("plain", "group"):
            return
        t0 = time.time()
        summ = L.finalize(sb, members if final else [rec], CACHE, off_ids, allow_read=False)  # a page not read is a gap, never GPU work here
        for f in summ["files"]:
            fs = st["filings"].setdefault(f["unid"], {})
            gaps = f.get("gaps") or []
            fs.update({"file": f["file"], "loaded": "group" if final else "plain", "rows": f["rows"], "pruned": f["pruned"],
                       "amendment": f.get("amendment"), "continuity": f.get("continuity"), "gaps": gaps,
                       "status": "complete_with_gaps" if gaps else "complete"})
            log(event="filing_loaded", filing=f["file"], rows=f["rows"], mode=fs["loaded"], pruned=f["pruned"],
                continuity=f.get("continuity"), status=fs["status"], missing=gaps_text(gaps) or None,
                merged_duplicates=summ["merged_duplicates"] or None, secs=round(time.time() - t0, 1))
        save_state(st)

    def verify(rec) -> None:
        s = st["filings"].get(rec["unid"], {})
        if s.get("loaded") != "group" or s.get("verified"):
            return
        t0 = time.time()
        res = V.verify_filing(sb, rec, CACHE)
        (EV / f"verify-{rec['unid'][:8]}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        s["verified"] = {k: res[k] for k in ("sampled", "checked", "unmapped", "date", "asset", "type", "band", "all")}
        save_state(st)
        log(event="verified", filing=rec["file"], secs=round(time.time() - t0, 1), **s["verified"])

    outcome = "ok"
    failed_this_run: set = set()
    try:
        for rec in recs:
            outcome = read_pages(rec)
            if outcome == "skip":  # cover unreadable: logged, counted as given up, the other filings go on
                outcome = "ok"
                continue
            if outcome != "ok":
                break
            _, _, skipped = filing_pages_state(L, rec, st)
            members = group_of(rec)
            ready = all(not filing_pages_state(L, m, st)[0] for m in members)
            try:  # a failing write or check must not stop the other filings: it is logged, counted, retried next run
                finish(rec, ready)
                if ready:
                    for m in members:
                        verify(m)
            except SystemExit:
                raise
            except Exception as e:  # noqa: BLE001
                if rec["unid"] not in failed_this_run:
                    failed_this_run.add(rec["unid"])
                    st.setdefault("fails", {})[rec["unid"]] = st.get("fails", {}).get(rec["unid"], 0) + 1
                    save_state(st)
                log(event="finish_error", filing=rec["file"], fails=st["fails"][rec["unid"]],
                    note=f"{type(e).__name__}: {e}"[:300])
            if a.max_pages and pages_done_run >= a.max_pages:
                outcome = "stop"
                break
        if outcome == "ok":  # everything read: retry skipped pages once, then check completeness
            retry = [(r, p) for r in recs for p in filing_pages_state(L, r, st)[2]]
            if retry and not st.get("skip_retry_done"):
                for r, p in retry:
                    st["attempts"][f"{r['unid']}:{p}"] = MAX_ATTEMPTS - 1
                    for m in group_of(r):  # written with a gap: rebuild (and re-verify) once the page is read
                        st["filings"].get(m["unid"], {}).pop("loaded", None)
                        st["filings"].get(m["unid"], {}).pop("verified", None)
                st["skip_retry_done"] = True
                save_state(st)
                log(event="retry_skipped", pages=[(r["file"], p) for r, p in retry])
                return 0  # the next trigger takes the second chance
            gave_up = [r["file"] for r in recs if st.get("fails", {}).get(r["unid"], 0) >= 3]
            resolved = all((st["filings"].get(r["unid"], {}).get("loaded") == "group" and st["filings"][r["unid"]].get("verified"))
                           or r["file"] in gave_up for r in recs)
            if resolved:
                skipped_all = [(r["file"], p) for r in recs for p in filing_pages_state(L, r, st)[2]]
                with_gaps = {r["file"]: gaps_text(st["filings"][r["unid"]]["gaps"]) for r in recs
                             if st["filings"].get(r["unid"], {}).get("gaps")}
                msg = "" if a.no_disable else disable_task()
                summary = {"event": "complete_with_errors" if gave_up else ("complete_with_gaps" if with_gaps else "complete"),
                           "filings": len(recs), "gave_up_after_3_failed_runs": gave_up, "skipped_pages": skipped_all,
                           "filings_with_gaps": with_gaps,
                           "task": f"disabled: {msg}" if not a.no_disable else "left enabled (--no-disable)",
                           "run_minutes": round((time.time() - t_start) / 60, 1)}
                log(**summary)
                (EV / "run-complete.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    except SystemExit as e:  # gaming check inside finish/verify
        if e.code == 3:
            log(event="gaming", note="stopped inside load/verify")
            return 0
        raise
    except Exception as e:  # noqa: BLE001
        log(event="error", note=f"{type(e).__name__}: {e}"[:300])
        return 2
    log(event="exit", outcome=outcome, pages_this_run=pages_done_run, minutes=round((time.time() - t_start) / 60, 1))
    return 2 if outcome == "stop" and fatal else 0


if __name__ == "__main__":
    sys.exit(main())
