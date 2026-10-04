#!/usr/bin/env python3
"""
R6c: committee-seat history from the git history of unitedstates/congress-legislators (public domain).

committee-membership-current.yaml is committed to that repo every few weeks. Each commit is a snapshot of
who sat on which committee. This loader reads every snapshot since --since (default 2016-06-01, before the
oldest trade date we hold apart from two 2015 rows) and writes:

  committee_snapshots   one row per snapshot commit (date, raw URL of the file at that commit)
  committee_seats       one row per uninterrupted run of a member on a TOP-LEVEL committee
                        (valid_from = date of the first snapshot that lists the seat, valid_to = day before the
                        first snapshot that does not; NULL = still listed in the latest snapshot)

"Seat held on the trade date" = the latest snapshot on or before the trade date lists the seat. The file lags
real appointments by days to weeks (and by months at the start of a Congress), so this is an approximation that
compute_conflicts.py labels with the snapshot date in congress_trades.committee_basis.

Committees end with each Congress (Jan 3 of an odd year). The file is emptied around then (4 empty snapshots:
2021-01-01, 2021-01-18, 2022-12-25, 2025-01-03) and refilled in stages (the Senate's assignments first: 3
Senate-only snapshots at 400-445 seats, then the House's). So: a snapshot is data for a chamber only when it is
COMPLETE for it (>= 80% of that chamber's median seat count; committee_snapshots.house_complete / senate_complete);
every seat run is closed on Jan 2 of an odd year (a virtual break) and a seat only starts again at the first
snapshot of the new Congress that is complete for its chamber. Trades between Jan 3 and that snapshot have no
committee data (compute_conflicts.py: committee_basis no_committee_data_since_<date>).

Usage (gaming check first; reads .env.local for the Supabase service key):
  python3 src/scripts/load_committee_history.py [--repo DIR] [--since 2016-06-01] [--dry-run] [--out summary.json]
The repo is cloned blobless into %TEMP%\\slushfund-congress-legislators when --repo is not given.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta

from _venv import activate as _activate_venv
_activate_venv()

from supabase import create_client

REPO_URL = "https://github.com/unitedstates/congress-legislators.git"
RAW = "https://raw.githubusercontent.com/unitedstates/congress-legislators/{sha}/{path}"
MEMBERSHIP = "committee-membership-current.yaml"
COMMITTEES = "committees-current.yaml"
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def git(repo, *args):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, timeout=300)
    if r.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode('utf-8', 'replace')[:200]}")
    return r.stdout.decode("utf-8")


def parse_membership(text):
    """{committee_id: [{bioguide, title}]} from committee-membership-current.yaml (a flat list per committee id)."""
    out, cid, cur = {}, None, None
    for ln in text.splitlines():
        m = re.match(r"^([A-Za-z0-9]+):\s*$", ln)
        if m:
            cid, cur = m.group(1), None
            out[cid] = []
            continue
        if cid is None:
            continue
        if ln.startswith("- "):
            cur = {"bioguide": None, "title": None}
            out[cid].append(cur)
            ln = "  " + ln[2:]
        if cur is not None:
            k = re.match(r"^  (bioguide|title):\s*(.*?)\s*$", ln)
            if k:
                cur[k.group(1)] = k.group(2).strip("'\"") or None
    return out


def parse_committees(text):
    """{thomas_id: (name, type)} for the TOP-LEVEL committees in committees-current.yaml (subcommittees skipped)."""
    out, cur = {}, None
    for ln in text.splitlines():
        m = re.match(r"^- type:\s*(\S+)", ln)
        if m:
            cur = {"type": m.group(1), "name": None, "id": None}
            continue
        if cur is None:
            continue
        m = re.match(r"^  name:\s*(.+?)\s*$", ln)
        if m:
            cur["name"] = m.group(1).strip("'\"")
        m = re.match(r"^  thomas_id:\s*(\S+)\s*$", ln)
        if m:
            cur["id"] = m.group(1).strip("'\"")
        if cur["name"] and cur["id"]:
            out[cur["id"]] = (cur["name"], cur["type"])
            cur = None
    return out


def snapshots(repo, since):
    """[(sha, commit date)] oldest first, one per calendar day (the day's last commit)."""
    log = git(repo, "log", "--format=%H %cI", f"--since={since}", "--", MEMBERSHIP).split("\n")
    rows = []
    for ln in log:
        if ln.strip():
            sha, ts = ln.split()
            dt = datetime.fromisoformat(ts)
            rows.append((sha, dt.date(), dt))
    rows.sort(key=lambda r: r[2])
    by_day = {}
    for sha, d, _dt in rows:
        by_day[d] = sha                     # the day's last commit wins
    return sorted(((s, d) for d, s in by_day.items()), key=lambda r: r[1])


def snapshot_meta(repo, since):
    """R6e (A7b F10): {sha: {"committed_at": ISO time with offset, "superseded": [{sha, committed_at, subject}]}} for the commit
    kept for each calendar day and the earlier commits of that same day it replaces. The date is the commit's own (local) date:
    e5bdfbb2 "added House assignments" (2021-03-01T21:21:22-05:00, 2021-03-02 in UTC) was corrected three minutes later by
    b7b9089c "removed Greene and Wright", which is the 2021-03-01 snapshot we keep, so a 2021-03-02 trade already uses the
    corrected file. Recording the superseded commits makes every commit of the file accounted for."""
    log = git(repo, "log", "--format=%H|%cI|%s", f"--since={since}", "--", MEMBERSHIP).split("\n")
    rows = []
    for ln in log:
        if ln.strip():
            sha, ts, subject = ln.split("|", 2)
            dt = datetime.fromisoformat(ts)
            rows.append((dt, sha, ts, subject))
    rows.sort(key=lambda r: r[0])           # the same stable order snapshots() uses, so the same commit wins each day
    by_day = defaultdict(list)
    for r in rows:
        by_day[r[0].date()].append(r)
    meta = {}
    for _d, items in by_day.items():
        _dt, sha, ts, _subject = items[-1]
        meta[sha] = {"committed_at": ts,
                     "superseded": [{"sha": s, "committed_at": t, "subject": sj[:120]} for (_x, s, t, sj) in items[:-1]]}
    return meta


def build_seats(snaps):
    """snaps: [(sha, date, {(bioguide, committee_id, name, chamber): title})] oldest first -> seat rows."""
    runs, open_runs, seats = [], {}, []
    for i, (sha, d, members) in enumerate(snaps):
        for key, title in members.items():
            if key not in open_runs:
                open_runs[key] = {"from": d, "sha": sha, "title": title}
        for key in list(open_runs):
            if key not in members:
                r = open_runs.pop(key)
                runs.append((key, r, d - timedelta(days=1)))
    for key, r in open_runs.items():
        runs.append((key, r, None))
    for (bio, cid, name, chamber), r, to in runs:
        seats.append({"bioguide_id": bio, "committee_id": cid, "committee_name": name, "chamber": chamber,
                      "title": r["title"], "valid_from": r["from"].isoformat(),
                      "valid_to": to.isoformat() if to else None, "first_commit_sha": r["sha"]})
    return seats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo")
    ap.add_argument("--since", default="2016-06-01")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()
    repo = args.repo or os.path.join(tempfile.gettempdir(), "slushfund-congress-legislators")
    if not os.path.isdir(os.path.join(repo, ".git")):
        subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", "--quiet", REPO_URL, repo], check=True, timeout=600)
    snaps_raw = snapshots(repo, args.since)
    print(f"{len(snaps_raw)} snapshots, {snaps_raw[0][1]} to {snaps_raw[-1][1]}")
    snaps, unknown_ids = [], defaultdict(int)
    for sha, d in snaps_raw:
        names = parse_committees(git(repo, "show", f"{sha}:{COMMITTEES}"))
        mem = parse_membership(git(repo, "show", f"{sha}:{MEMBERSHIP}"))
        members = {}
        for cid, people in mem.items():
            if cid not in names:                # a subcommittee key (HSAS03): top-level committees only
                if not re.search(r"\d", cid):
                    unknown_ids[cid] += 1
                continue
            name, ctype = names[cid]
            for p in people:
                if p["bioguide"]:
                    members[(p["bioguide"], cid, name, ctype)] = p["title"]
        snaps.append((sha, d, members))
    populated = [s for s in snaps if s[2]]
    # A snapshot is COMPLETE for a chamber when it lists at least 80% of that chamber's median seat count. At a new
    # Congress the Senate's assignments reach the file first (2021-01-23: 400 seats, 2025-01-17: 445) and the House's
    # weeks later, so a partial snapshot says nothing about the other chamber: it is not data for it.
    counts = [{c: sum(1 for k in m if k[3] == c) for c in ("house", "senate", "joint")} for _s, _d, m in snaps]
    med = {c: sorted(x[c] for x in counts if x[c])[len([1 for x in counts if x[c]]) // 2] for c in ("house", "senate", "joint")}
    complete = [{c: x[c] >= 0.8 * med[c] and x[c] > 0 for c in x} for x in counts]
    seats = []
    for chamber in ("house", "senate", "joint"):
        need = ("house", "senate") if chamber == "joint" else (chamber,)
        seq = [(s, d, {k: v for k, v in m.items() if k[3] == chamber})
               for (s, d, m), ok in zip(snaps, complete) if all(ok[c] for c in need)]
        for y in range(populated[0][1].year, populated[-1][1].year + 1):
            b = date(y, 1, 3)                   # a new Congress: every seat of the old one ends
            if y % 2 == 1 and seq and seq[0][1] < b <= seq[-1][1]:
                seq.append((None, b, {}))
        seq.sort(key=lambda r: (r[1], 0 if r[0] is None else 1))
        seats += build_seats(seq)
    gaps = [(b[1] - a[1]).days for a, b in zip(populated, populated[1:])]
    summary = {"snapshots": len(snaps), "first": snaps[0][1].isoformat(), "last": snaps[-1][1].isoformat(),
               "max_gap_days": max(gaps), "median_gap_days": sorted(gaps)[len(gaps) // 2],
               "seats": len(seats), "open_seats": sum(1 for s in seats if s["valid_to"] is None),
               "members": len({s["bioguide_id"] for s in seats}),
               "committees": len({s["committee_id"] for s in seats}),
               "membership_keys_not_in_committees_file": dict(unknown_ids),
               "snapshots_with_zero_members": [d.isoformat() for _s, d, m in snaps if not m],
               "median_seats_by_chamber": med,
               "partial_snapshots": [{"date": d.isoformat(), **{c: x[c] for c in x}}
                                     for (_s, d, m), x, ok in zip(snaps, counts, complete) if m and not all(ok.values())]}
    print(json.dumps(summary))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=1)
    if args.dry_run:
        return 0
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not set")
        return 1
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    meta = snapshot_meta(repo, args.since)
    sb.table("committee_snapshots").upsert([
        {"commit_sha": sha, "snapshot_date": d.isoformat(), "source_url": RAW.format(sha=sha, path=MEMBERSHIP),
         "committed_at": meta[sha]["committed_at"], "superseded_commits": meta[sha]["superseded"],
         "committees_url": RAW.format(sha=sha, path=COMMITTEES), "seat_count": len(m),
         "house_seats": x["house"], "senate_seats": x["senate"],
         "house_complete": ok["house"], "senate_complete": ok["senate"]}
        for (sha, d, m), x, ok in zip(snaps, counts, complete)]).execute()
    sb.table("committee_seats").delete().gte("id", 0).execute()          # rebuilt whole: a re-run gives the same rows
    for i in range(0, len(seats), 500):
        sb.table("committee_seats").upsert(seats[i:i + 500], on_conflict="bioguide_id,committee_id,committee_name,valid_from").execute()
    print(f"written: {len(snaps)} snapshots, {len(seats)} seats")
    return 0


if __name__ == "__main__":
    sys.exit(main())
