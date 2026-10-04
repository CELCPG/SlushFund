#!/usr/bin/env python3
"""
Weekly orchestrator for Public Servant Score. Runs all ingest scripts in order
then computes scores. Designed to be called by Vercel cron (Sunday 6am ET).

  1) ingest_senators     (idempotent; re-runs are fast)
  2) ingest_votes         (last 24mo of Senate votes)
  3) ingest_trades        (STOCK Act disclosures, last 24mo)
  4) ingest_bills         (sponsorships, last 24mo)
  5) ingest_attendance    (missed votes, this week)
  6) compute_scores       (writes senator_scores for the week)

If any step fails, we still attempt subsequent steps (graceful degradation),
but we print a clear error summary at the end. The cron is meant to be
re-runnable: if a step already ran this week, the upserts are idempotent.

Usage:
  python3 run_weekly.py                 # run for this week
  python3 run_weekly.py --week 2026-06-08
"""

import argparse
import subprocess
import sys
import time
from datetime import date

STEPS = [
    ("ingest_senators", ["ingest_senators.py"]),
    ("ingest_votes", ["ingest_votes.py"]),
    ("ingest_trades", ["ingest_trades.py"]),
    ("ingest_bills", ["ingest_bills.py"]),
    ("ingest_attendance", ["ingest_attendance.py"]),
    ("compute_scores", ["compute_scores.py"]),
]


def run_step(label: str, args: list) -> tuple[bool, str]:
    """Run a child Python script in the same directory. Return (ok, tail)."""
    here = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
    cmd = [sys.executable, __import__("os").path.join(here, *args)]
    print(f"\n  ── {label} ──")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        ok = result.returncode == 0
        tail = (result.stdout or "")[-2000:]
        if result.stderr:
            tail += "\n  STDERR: " + (result.stderr or "")[-1000:]
        print(tail)
        return ok, tail
    except subprocess.TimeoutExpired:
        return False, f"{label}: TIMEOUT after 1800s"
    except Exception as e:
        return False, f"{label}: EXCEPTION {e}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", default=date.today().isoformat())
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    print(f"== Public Servant Score — weekly run for week {args.week} ==")
    print(f"   steps: {len(STEPS)}")

    start = time.time()
    results: list[tuple[str, bool, str]] = []
    for label, script_args in STEPS:
        cmd_args = list(script_args)
        if args.dry:
            cmd_args.append("--dry")
        if label == "compute_scores":
            cmd_args.extend(["--week", args.week])
        ok, tail = run_step(label, cmd_args)
        results.append((label, ok, tail))

    elapsed = time.time() - start
    print(f"\n== Summary ({elapsed:.1f}s) ==")
    failed = [r for r in results if not r[1]]
    for label, ok, _ in results:
        print(f"  {'✅' if ok else '❌'} {label}")
    if failed:
        print(f"\n{len(failed)} step(s) failed. Re-running weekly cron will retry.")
        return 1
    print("\nAll steps completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
