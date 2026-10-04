-- R6c steps 2-4 (Apex decisions 2, 3, 4): conflicts recomputed on the fixed trades and ticker links.
-- Additive and idempotent: every statement can run twice. One transaction; contains NO data.
-- RLS stays on for every table; anon and authenticated can only SELECT.
--
-- 1. committee seat history (decision 4): public records of who sat on which committee when, built from the
--    git history of unitedstates/congress-legislators (committee-membership-current.yaml), loaded by
--    src/scripts/load_committee_history.py. committee_snapshots lists the commits used; committee_seats holds
--    one row per uninterrupted run of a member on a committee ("as of" snapshot semantics: a member held the
--    seat on day D when the latest snapshot on or before D lists it).
-- 2. congress_trades.committee_basis (which snapshot the committee signal used) and congress_trades.instrument
--    (decision 2: security | option, derived from option_type so it can never drift).
-- 3. member_conflict_scores.stock_act_violations -> late_filing_count (decision 3). A view column cannot be
--    renamed in place, so the view is dropped and recreated with the same 13 columns.

begin;
set local search_path = public;

-- 1. committee seat history ------------------------------------------------------------------------------
create table if not exists committee_snapshots (
  commit_sha     text primary key,
  snapshot_date  date not null,
  source_url     text not null,
  committees_url text not null,
  created_at     timestamptz not null default now()
);
alter table committee_snapshots add column if not exists seat_count int;   -- top-level seats listed; 0 = the file is empty (a new Congress, before assignments)
alter table committee_snapshots add column if not exists house_seats int;
alter table committee_snapshots add column if not exists senate_seats int;
alter table committee_snapshots add column if not exists house_complete boolean;   -- >= 80% of the median House seat count: usable as data for House members
alter table committee_snapshots add column if not exists senate_complete boolean;  -- same for the Senate (at a new Congress the Senate's assignments reach the file first)
create index if not exists committee_snapshots_date_idx on committee_snapshots (snapshot_date);

create table if not exists committee_seats (
  id               bigint generated always as identity primary key,
  bioguide_id      text not null,
  committee_id     text not null,
  committee_name   text not null,
  chamber          text,
  title            text,
  valid_from       date not null,
  valid_to         date,
  first_commit_sha text not null,
  created_at       timestamptz not null default now(),
  constraint committee_seats_order_check check (valid_to is null or valid_from <= valid_to),
  constraint committee_seats_unique unique (bioguide_id, committee_id, committee_name, valid_from)
);
create index if not exists committee_seats_member_idx on committee_seats (bioguide_id, valid_from);

alter table committee_snapshots enable row level security;
alter table committee_seats enable row level security;
drop policy if exists "public read committee_snapshots" on committee_snapshots;
create policy "public read committee_snapshots" on committee_snapshots for select to anon, authenticated using (true);
drop policy if exists "public read committee_seats" on committee_seats;
create policy "public read committee_seats" on committee_seats for select to anon, authenticated using (true);
revoke all on committee_snapshots, committee_seats from anon, authenticated;
grant select on committee_snapshots, committee_seats to anon, authenticated;

comment on table committee_snapshots is 'R6c: the commits of unitedstates/congress-legislators (committee-membership-current.yaml) used as committee-membership snapshots. source_url is the raw file at that commit.';
comment on table committee_seats is 'R6c: one row per uninterrupted run of a member on a top-level committee, from consecutive snapshots of committee-membership-current.yaml. valid_from = date of the first snapshot that lists the seat, valid_to = day before the first snapshot that does not (NULL = still listed in the latest). Every run is closed on Jan 2 of an odd year (a new Congress) and restarts at the first populated snapshot of the new Congress. Approximate: the file lags real appointments by days to weeks.';
comment on column committee_seats.committee_id is 'thomas_id of the top-level committee (HSAS = House Armed Services).';

-- 2. conflict-row columns --------------------------------------------------------------------------------
alter table congress_trades add column if not exists committee_basis text;
alter table congress_trades add column if not exists instrument text
  generated always as (case when option_type is null then 'security' else 'option' end) stored;

comment on column congress_trades.committee_basis is 'Which committee data the committee signal used: congress_legislators_snapshot_<YYYY-MM-DD> = the seats listed in the latest snapshot on or before the trade date (committee_seats); no_committee_data_since_<YYYY-MM-DD> = a new Congress began on that date and the file has no assignments yet (committee signal not computed, committee_conflict NULL); no_snapshot_before_<YYYY-MM-DD> = the trade predates the first snapshot (not computed); date_not_reliable_<date_flag> = the transaction date as filed looks wrong, so no date-dependent signal was computed; current_as_of_<YYYY-MM-DD> = the member''s current seats (fallback only).';
comment on column congress_trades.instrument is 'security | option (option_type IS NOT NULL). Derived. Pages label or separate options: never render an option row as a plain buy or sell of the stock.';
comment on column congress_trades.conflict_reasons is 'Plain-language facts behind conflict_score, each with a primary source. Not a legal conclusion.';

-- 3. member_conflict_scores: rename stock_act_violations -> late_filing_count --------------------------------
-- late_filing_count = trades with stock_act_late = true, i.e. filed more than 45 days after the trade. It counts
-- only trades whose lateness could be computed (days_to_file NOT NULL); NULL lateness is not "on time".
drop view if exists member_conflict_scores;
create view member_conflict_scores with (security_invoker = true) as
select
  ct.member_name,
  coalesce(max(nullif(ct.member_party, 'Unknown')), 'Unknown')   as member_party,
  coalesce(max(nullif(ct.member_chamber, 'Unknown')), 'Unknown') as member_chamber,
  coalesce(max(nullif(ct.member_state, 'Unknown')), 'Unknown')   as member_state,
  count(*)                                                        as total_trades,
  count(*) filter (where ct.conflict_score > 0)                   as conflicted_trades,
  count(*) filter (where ct.stock_act_late)                       as late_filing_count,
  count(*) filter (where ct.committee_conflict)                   as committee_conflicts,
  count(*) filter (where ct.has_federal_contract)                 as contractor_trades,
  count(*) filter (where ct.conflict_tier in ('high', 'severe'))  as high_conflict_trades,
  coalesce(sum(ct.amount_max), 0)::bigint                         as estimated_volume,
  coalesce(max(ct.conflict_score), 0)                             as peak_conflict_score,
  coalesce(round(avg(ct.conflict_score), 1), 0)                   as avg_conflict_score
from congress_trades ct
group by ct.member_name;

revoke all on member_conflict_scores from anon, authenticated;
grant select on member_conflict_scores to anon, authenticated;
comment on view member_conflict_scores is 'Per-member roll-up of the conflict columns on congress_trades (see compute_conflicts.py). late_filing_count counts trades filed more than 45 days after the trade; trades whose lateness could not be computed are not counted. Counts include option rows (congress_trades.instrument = option).';

commit;
