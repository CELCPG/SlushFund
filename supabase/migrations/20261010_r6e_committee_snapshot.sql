-- R6e (A7b F10): committee_snapshots records WHEN each kept commit was made and which same-day commits it replaces.
-- Additive / idempotent: every statement can run twice. One transaction; contains NO data (load_committee_history.py fills it).
-- RLS stays on; anon can only SELECT (unchanged).
--
-- A7b F10 said the commit e5bdfbb2 (2021-03-02) was missing from committee_snapshots, so 11 House trades on 2021-03-02 used
-- the 03-01 snapshot. The commit dates tell another story: e5bdfbb2 "added House assignments" was made 2021-03-01T21:21:22-05:00
-- (2021-03-02 in UTC) and corrected three minutes later by b7b9089c "removed Greene and Wright" (21:24:15-05:00). The loader
-- keeps ONE commit per calendar day, the day's last, so the stored 2021-03-01 snapshot IS b7b9089c, the corrected file, and a
-- 2021-03-02 trade already uses it. These columns make that checkable: every one of the file's commits is either a snapshot row
-- or listed in the superseded_commits of the snapshot that replaces it.

begin;
set local search_path = public;

alter table committee_snapshots add column if not exists committed_at timestamptz;
alter table committee_snapshots add column if not exists superseded_commits jsonb not null default '[]'::jsonb;

comment on column committee_snapshots.snapshot_date is
  'Calendar date of the commit in the committer''s own time zone (US Eastern for this repo), not UTC. A trade uses the latest snapshot complete for its chamber on or before its date.';
comment on column committee_snapshots.committed_at is
  'Exact commit time, with the committer''s UTC offset.';
comment on column committee_snapshots.superseded_commits is
  'Earlier commits of committee-membership-current.yaml made on the same calendar day as this snapshot and replaced by it (the day''s last commit wins): [{sha, committed_at, subject}].';

commit;
