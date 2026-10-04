-- SlushFund v2 schema: ONE consolidated, idempotent migration (2026-10-03, R2).
--
-- Replaces applying supabase/schema*.sql + migrations/2026060*/20260610* by hand.
-- Source of truth for what the recovered production code (recovered/prod-1064a06)
-- needs: openclaw-shared/projects/slushfund/r1-recovery.md (schema map, gaps G1-G10).
--
-- Re-runnable: everything is `if not exists` / `create or replace` / drop-and-recreate,
-- and the whole file runs in one transaction (all or nothing).
-- Contains NO data. Never add seed, demo or mock rows here: only official public
-- records, loaded by the loaders, may ever populate these tables.
--
-- Security model (section 10): RLS on every table; anon/authenticated are SELECT-only
-- on public data and have no access at all to subscriber data or the sync log;
-- every write goes through the service role (Next.js server routes, loaders).
--
-- R6e: this file is the BOOTSTRAP for an EMPTY database. The migrations after it (20261004 .. 20261009) rename and drop
-- objects it creates (awards.risk_score, the 'no_bid' label, the flagged_* / risk_* view and RPC keys, the old tier names,
-- get_covid_fraud_stats ...). Re-applying it over a migrated database would bring those names back, so it refuses
-- (marker: congress_trades.lateness_basis, added by 20261009_r6e_lateness.sql). On an empty database run it first, then
-- every later migration in file-name order.

begin;
set local search_path = public;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'congress_trades' and column_name = 'lateness_basis') then
    raise exception 'v2 bootstrap: this database already has the R6e migrations; re-applying v2 would restore removed names. Apply only newer migrations.';
  end if;
end $$;

-- =============================================================================
-- 1. awards (USAspending). Primary record for contracts/grants/loans.
-- =============================================================================
create table if not exists awards (
  id text primary key,                       -- internal_id from USAspending
  award_id text unique not null,

  -- Recipient
  recipient_name text not null,
  recipient_uei text,
  recipient_duns text,
  recipient_parent_name text,
  recipient_location text,

  -- Amount
  dollar_amount bigint not null,
  total_outlays bigint,
  subsidy_cost numeric,
  loan_value numeric,

  -- Description / classification
  description text,
  assistance_listing text,
  cfda_program text,
  awarding_agency text not null,
  awarding_agency_code text,
  awarding_sub_agency text,
  funding_agency text,
  funding_agency_code text,
  funding_sub_agency text,
  award_category text not null,              -- contract | grant | loan | direct_payment | other
  contract_type text,                        -- original USAspending type code
  competition_status text,                   -- open_competition | limited_competition | no_bid | sole_source | unknown
  extent_competed text,
  extent_competed_code text,
  naics_code text,
  psc_code text,

  -- Dates
  posted_date date,
  performance_start date,
  performance_end date,
  base_obligation_date text,
  last_modified_date text,

  -- Place of performance
  pop_state text,
  pop_country text default 'USA',
  pop_city text,
  primary_place_of_performance text,

  -- Flags
  flags text[],
  competition_flags text[],
  price_flags text[],
  connection_flags text[],
  structural_flags text[],

  -- Political connection
  connection_type text,
  political_connection text,
  confidence text,
  connection_sources text[],

  -- Risk scoring
  risk_score int default 0,
  risk_factors text[],

  -- Inflation analysis
  estimated_market_rate numeric,
  price_premium_pct numeric,

  -- COVID / infrastructure
  covid_obligations bigint,
  covid_outlays bigint,
  infrastructure_obligations bigint,
  infrastructure_outlays bigint,

  -- Links
  fpds_url text,
  usaspending_url text,

  -- Metadata
  notes text,
  source text default 'usaspending',         -- usaspending | fpds | manual
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- G9: /api/v1/contracts selects date_signed and awarding_office, which the awards
-- table never had. They are generated copies of posted_date / awarding_sub_agency,
-- so they can never drift and no loader has to write them.
alter table awards add column if not exists date_signed date generated always as (posted_date) stored;
alter table awards add column if not exists awarding_office text generated always as (awarding_sub_agency) stored;

-- =============================================================================
-- 2. Reference / pre-computed tables
-- =============================================================================
create table if not exists era_snapshots (
  era text primary key,
  total_awards int,
  total_dollars bigint,
  connected_dollars bigint,
  flagged_count int,
  no_bid_count int,
  no_bid_dollars bigint,
  computed_at timestamptz default now()
);

create table if not exists covid_spending_summary (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int,
  quarter text,
  agency text,
  agency_code text,
  total_covid_obligations bigint,
  total_covid_outlays bigint,
  covid_contract_count int,
  covid_no_bid_count int,
  covid_no_bid_dollars bigint,
  top_vendor text,
  top_vendor_dollars bigint,
  updated_at timestamptz default now()
);

create table if not exists political_entities (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  entity_type text not null,                 -- person | company | org
  connection_category text not null,         -- trump_family | elon_musk | trump_ally | gop_donor | lobbyist | mar-a-lago | none
  aliases text[],
  description text,
  sources text[],
  total_contracts int default 0,
  total_grants int default 0,
  total_dollars bigint default 0,
  risk_score_avg numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Server-side only (service role). Holds raw error payloads: never public.
create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,                   -- contracts | grants | full | incremental
  start_date text,
  end_date text,
  pages_processed int default 0,
  records_synced int default 0,
  records_flagged int default 0,
  errors jsonb default '[]',
  duration_ms int,
  status text default 'running',             -- running | complete | failed
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists tax_expenditures (
  id text primary key,
  recipient_name text not null,
  recipient_parent_name text,
  dollar_amount bigint not null,
  tax_provision text,                        -- e.g. '§168 bonus depreciation'
  description text,
  agency text,                               -- e.g. 'IRS'
  fiscal_year int,
  connection_type text,
  political_connection text,
  confidence text,
  connection_sources text[],
  risk_score int default 0,
  risk_factors text[],
  notes text,
  source text default 'irs',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- 3. Congress: members and trades
-- =============================================================================
create table if not exists congress_members (
  id uuid primary key default gen_random_uuid(),
  bioguide_id text,                          -- G6: Bioguide id, key of the official roster
  name text not null,
  first_name text,
  last_name text not null,
  suffix text,
  party text not null,                       -- Democrat | Republican | Independent
  chamber text not null,                     -- Senate | House
  state text not null,
  district text,                             -- House only
  state_name text not null,
  congress_num int,
  in_office boolean default true,
  title text,                                -- Senator | Representative
  committees jsonb default '[]',             -- ["Committee name", ...] (top-level committees; see load_committees.py)
  disclosure_url text,
  last_disclosure_check timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table congress_members add column if not exists bioguide_id text;

-- G7: the old unique(chamber, state, district) cannot hold the roster (328 House
-- seats were held by 2+ people in 2016-2026 and senators have district NULL, so it
-- never de-duplicated them). A seat is not a member: key on the person instead.
alter table congress_members drop constraint if exists congress_members_chamber_state_district_key;
create unique index if not exists congress_members_bioguide_id_key on congress_members (bioguide_id);
create unique index if not exists congress_members_name_chamber_key on congress_members (name, chamber);

create index if not exists congress_members_chamber_idx on congress_members(chamber);
create index if not exists congress_members_party_idx on congress_members(party);
create index if not exists congress_members_state_idx on congress_members(state);
create index if not exists congress_members_office_idx on congress_members(in_office);

create table if not exists congress_trades (
  id uuid primary key default gen_random_uuid(),

  -- Who
  member_id uuid references congress_members(id),
  member_name text not null,
  member_chamber text not null,              -- Senate | House (denormalized)
  member_party text not null,
  member_state text not null,
  bio_guide_id text,                         -- G3: written by the Quiver loaders
  district text,                             -- G4: written by backfill/capitoltrades loaders

  -- What
  ticker text not null,
  company_name text not null,
  transaction_type text not null,            -- BUY | SELL | EXCHANGE | EXERCISE
  asset_type text not null,                  -- Stock | ETF | Option | Mutual Fund | Bond
  amount_min bigint,                         -- disclosed range, never exact
  amount_max bigint,
  amount_range text,                         -- raw string from the disclosure

  -- Dates
  transaction_date date not null,
  filed_date date,                           -- STOCK Act: within 45 days
  disclosure_year int,

  -- Source
  disclosure_url text,
  source_system text not null,               -- House_Clerk | Senate_EFD | QuiverQuant | ...

  -- Signals
  flags text[] default '{}',
  signal_type text,                          -- routine | NULL (no label); see the column comment (R6d)
  related_contracts jsonb default '[]',
  has_federal_contract boolean default false,

  -- G2: conflict-engine output (written only by compute_conflicts.py)
  conflict_score int,                        -- 0-100
  conflict_tier text,                        -- routine | elevated | high | severe
  conflict_reasons text[] default '{}',      -- one cited fact per entry
  committee_conflict boolean default false,
  committee_conflict_detail text,
  stock_act_late boolean default false,
  days_to_file int,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Garbled PDF years (e.g. 3031-04-30) used to need a one-off text fix-up script;
  -- reject them at the door instead.
  constraint congress_trades_dates_sane check (
    transaction_date between date '2000-01-01' and date '2035-12-31'
    and (filed_date is null or filed_date between date '2000-01-01' and date '2035-12-31')
  ),
  constraint congress_trades_conflict_tier_valid check (
    conflict_tier is null or conflict_tier in ('routine', 'elevated', 'high', 'severe')
  )
);

-- Upgrade path for the added columns on a database built from the old SQL files
-- (no-ops on a fresh one).
alter table congress_trades add column if not exists bio_guide_id text;
alter table congress_trades add column if not exists district text;
alter table congress_trades add column if not exists conflict_score int;
alter table congress_trades add column if not exists conflict_tier text;
alter table congress_trades add column if not exists conflict_reasons text[] default '{}';
alter table congress_trades add column if not exists committee_conflict boolean default false;
alter table congress_trades add column if not exists committee_conflict_detail text;
alter table congress_trades add column if not exists stock_act_late boolean default false;
alter table congress_trades add column if not exists days_to_file int;

-- G5: every trade loader upserts with on_conflict=member_name,ticker,transaction_date,transaction_type.
-- Postgres needs a matching unique index or the upsert fails (42P10).
-- R6a replaced this key with the lossless congress_trades_lossless_key (20261006_r6a_trades_key.sql). Once that
-- exists, re-applying this file must not bring the old, lossy index back (it would reject rows that differ
-- only by owner or option contract).
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'congress_trades_lossless_key') then
    create unique index if not exists congress_trades_natural_key
      on congress_trades (member_name, ticker, transaction_date, transaction_type);
  end if;
end $$;

create index if not exists congress_trades_ticker_date_idx on congress_trades(ticker, transaction_date desc);
create index if not exists congress_trades_chamber_idx on congress_trades(member_chamber);
create index if not exists congress_trades_party_idx on congress_trades(member_party);
create index if not exists congress_trades_type_idx on congress_trades(transaction_type);
create index if not exists congress_trades_date_idx on congress_trades(transaction_date);
create index if not exists congress_trades_filed_idx on congress_trades(filed_date);
create index if not exists congress_trades_contract_idx on congress_trades(has_federal_contract);
create index if not exists congress_trades_member_id_idx on congress_trades(member_id) where member_id is not null;
-- sort columns (formerly schema_perf_indexes.sql; they now follow the columns they need)
create index if not exists congress_trades_amount_max_idx on congress_trades (amount_max desc nulls last);
create index if not exists congress_trades_filed_date_idx2 on congress_trades (filed_date desc nulls last);
create index if not exists congress_trades_conflict_idx on congress_trades (conflict_score desc nulls last, transaction_date desc);
-- ticker_idx and member_idx from the old schema are dropped: ticker_date_idx and
-- the natural-key index (member_name leading) already cover them.
drop index if exists congress_trades_ticker_idx;
drop index if exists congress_trades_member_idx;

-- =============================================================================
-- 4. Analytics tables. Created empty: they feed get_analytics_summary() only, and
--    the old seed rows had no source citations, so nothing is loaded here.
-- =============================================================================
create table if not exists cost_overruns (
  id text primary key,
  project_name text not null,
  agency text not null,
  awarding_subagency text,
  contractor text not null,
  subcontractors jsonb default '[]'::jsonb,
  state text,
  start_year int,
  end_year int,
  original_cost bigint not null,
  final_cost bigint not null,
  overrun_pct int not null,
  overrun_dollars bigint not null,
  description text,
  program_description text,
  category text,
  flagged_reason text,
  flags jsonb default '[]'::jsonb,
  competition_status text,
  contract_type text,
  gao_high_risk boolean default false,
  oig_investigation boolean default false,
  oversight_committee text,
  trump_donor boolean default false,
  mar_a_lago_visitor boolean default false,
  delay_years int,
  baseline_revisions int,
  political_connection text,
  source_url text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists stock_holdings (
  id text primary key,
  ticker text not null,
  company_name text not null,
  politician_name text not null,
  shares_owned bigint,
  estimated_value_low bigint,
  estimated_value_high bigint,
  filing_date date,
  filing_type text,
  sector text,
  source_url text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 5. Newsletter. Personal data: service role only, no public SELECT or INSERT.
-- =============================================================================
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  created_at timestamptz not null default now(),
  confirmed boolean not null default false,
  unsubscribed_at timestamptz
);

-- =============================================================================
-- 6. Public Servant Score (senators). Rubric functions are in section 8.
-- =============================================================================
create table if not exists senators (
  id              uuid primary key default gen_random_uuid(),
  bioguide_id     text unique not null,
  name_slug       text unique not null,
  full_name       text not null,
  first_name      text,
  last_name       text,
  state           text not null,
  party           text not null check (party in ('D','R','I')),
  photo_url       text,
  term_start      date,
  term_end        date,
  committees      text[] default '{}',
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists senator_scores (
  senator_id              uuid references senators(id) on delete cascade,
  week_of                 date not null,
  pillar_constituency     numeric(4,1) default 0,
  pillar_stocks           numeric(4,1) default 0,
  pillar_lobbying         numeric(4,1) default 0,
  pillar_productivity     numeric(4,1) default 0,
  pillar_attendance       numeric(4,1) default 0,
  has_constituency_data   boolean default false,
  has_stocks_data         boolean default false,
  has_lobbying_data       boolean default false,
  has_productivity_data   boolean default false,
  has_attendance_data     boolean default false,
  total_score             numeric(5,1) generated always as (
    pillar_constituency + pillar_stocks + pillar_lobbying +
    pillar_productivity + pillar_attendance
  ) stored,
  grade                   text generated always as (
    case
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 90 then 'A'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 80 then 'B'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 70 then 'C'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 60 then 'D'
      else 'F'
    end
  ) stored,
  data_coverage_pct       integer generated always as (
    (case when has_constituency_data then 1 else 0 end +
     case when has_stocks_data then 1 else 0 end +
     case when has_lobbying_data then 1 else 0 end +
     case when has_productivity_data then 1 else 0 end +
     case when has_attendance_data then 1 else 0 end) * 20
  ) stored,
  scoring_version         text not null default '0.1.0',
  computed_at             timestamptz default now(),
  notes                   text,
  primary key (senator_id, week_of)
);

create table if not exists senator_trades (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  transaction_date        date not null,
  ticker                  text,
  asset_description       text not null,
  transaction_type        text not null check (transaction_type in ('buy','sell','exchange')),
  amount_low              integer,
  amount_high             integer,
  committee_overlap_sectors text[] default '{}',
  conflict_flag           boolean default false,
  source_url              text,
  source_filing_id        text,
  ingested_at             timestamptz default now()
);

create table if not exists senator_votes (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  bill_id                 text not null,
  vote_date               date not null,
  vote_position           text not null check (vote_position in ('yea','nay','not_voting','present')),
  bill_title              text,
  is_major_bill           boolean default false,
  state_poll_pct_supporting numeric(4,1),
  poll_source_count       integer default 0,
  aligned_with_poll       boolean,
  ingested_at             timestamptz default now()
);

create table if not exists lobbyist_trips (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  trip_date               date not null,
  sponsor                 text not null,
  destination             text,
  estimated_cost          numeric(10,2) default 0,
  purpose                 text,
  source_url              text,
  ingested_at             timestamptz default now()
);

create table if not exists senator_bills (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  bill_id                 text not null,
  role                    text not null check (role in ('sponsor','cosponsor')),
  introduced_date         date,
  bipartisan_cosponsors   integer default 0,
  passed_chamber          boolean default false,
  signed_into_law         boolean default false,
  ingested_at             timestamptz default now()
);

create table if not exists senator_attendance (
  senator_id              uuid references senators(id) on delete cascade,
  week_of                 date not null,
  missed_votes_pct        numeric(4,1) default 0,
  speeches_count          integer default 0,
  total_votes             integer default 0,
  missed_votes            integer default 0,
  ingested_at             timestamptz default now(),
  primary key (senator_id, week_of)
);

-- G8: the ingesters upsert on these keys. NULLS NOT DISTINCT (PG15+) so rows with a
-- NULL ticker / amount de-duplicate instead of piling up on every re-run.
create unique index if not exists senator_trades_upsert_key
  on senator_trades (senator_id, transaction_date, ticker, transaction_type, amount_low) nulls not distinct;
create unique index if not exists senator_bills_upsert_key on senator_bills (senator_id, bill_id, role);
create unique index if not exists senator_votes_upsert_key on senator_votes (senator_id, bill_id);

-- =============================================================================
-- 7. Indexes (all after the columns they need)
-- =============================================================================
-- awards. The plain awards_posted_idx / awards_risk_idx of the old schema are not
-- created: the DESC NULLS LAST versions below serve the same range/sort queries.
create index if not exists awards_recipient_idx on awards(recipient_name);
create index if not exists awards_recipient_uei_idx on awards(recipient_uei);
create index if not exists awards_agency_idx on awards(awarding_agency);
create index if not exists awards_agency_code_idx on awards(awarding_agency_code);
create index if not exists awards_connection_idx on awards(connection_type);
create index if not exists awards_category_idx on awards(award_category);
create index if not exists awards_competition_idx on awards(competition_status);
create index if not exists awards_naics_idx on awards(naics_code);
create index if not exists awards_flags_idx on awards using gin(flags);
-- G10: date_trunc('year', date) resolves to the timestamptz variant, which is STABLE and
-- cannot be indexed. Cast to timestamp (IMMUTABLE) to make it a valid expression index.
create index if not exists awards_fy_idx on awards (date_trunc('year', posted_date::timestamp));
create index if not exists awards_covid_idx on awards(covid_obligations) where covid_obligations > 0;
create index if not exists awards_dollar_amount_idx on awards (dollar_amount desc);
create index if not exists awards_posted_date_idx2 on awards (posted_date desc nulls last);
create index if not exists awards_risk_score_idx2 on awards (risk_score desc nulls last);
create index if not exists awards_risk_posted_idx on awards (risk_score desc, posted_date desc);
create index if not exists awards_date_signed_idx on awards (date_signed desc nulls last);

create index if not exists political_entities_name_idx on political_entities(entity_name);
create index if not exists political_entities_category_idx on political_entities(connection_category);
create index if not exists political_entities_aliases_idx on political_entities using gin(aliases);

create index if not exists tax_exp_name_idx on tax_expenditures(recipient_name);
create index if not exists tax_exp_connection_idx on tax_expenditures(connection_type);
create index if not exists tax_exp_year_idx on tax_expenditures(fiscal_year);
create index if not exists tax_exp_provision_idx on tax_expenditures(tax_provision);
create index if not exists tax_exp_risk_idx on tax_expenditures(risk_score);

create index if not exists cost_overruns_agency_idx on cost_overruns (agency);
create index if not exists cost_overruns_overrun_pct_idx on cost_overruns (overrun_pct desc);
create index if not exists cost_overruns_category_idx on cost_overruns (category);
create index if not exists stock_holdings_ticker_idx on stock_holdings (ticker);
create index if not exists stock_holdings_value_idx on stock_holdings (estimated_value_high desc);
create index if not exists stock_holdings_sector_idx on stock_holdings (sector);

create index if not exists newsletter_subscribers_created_at_idx on newsletter_subscribers (created_at desc);

create index if not exists senators_state_idx on senators(state);
create index if not exists senators_party_idx on senators(party);
create index if not exists senators_active_idx on senators(is_active);
create index if not exists senator_scores_week_idx on senator_scores(week_of desc);
create index if not exists senator_scores_total_idx on senator_scores(week_of desc, total_score desc);
create index if not exists senator_scores_grade_idx on senator_scores(week_of desc, grade);
create index if not exists senator_trades_senator_idx on senator_trades(senator_id, transaction_date desc);
create index if not exists senator_trades_conflict_idx on senator_trades(senator_id, conflict_flag) where conflict_flag = true;
create index if not exists senator_trades_date_idx on senator_trades(transaction_date desc);
create index if not exists senator_votes_senator_idx on senator_votes(senator_id, vote_date desc);
create index if not exists senator_votes_bill_idx on senator_votes(bill_id);
create index if not exists senator_votes_major_idx on senator_votes(is_major_bill) where is_major_bill = true;
create index if not exists lobbyist_trips_senator_idx on lobbyist_trips(senator_id, trip_date desc);
create index if not exists senator_bills_senator_idx on senator_bills(senator_id, introduced_date desc);
create index if not exists senator_bills_passed_idx on senator_bills(senator_id, passed_chamber) where passed_chamber = true;
create index if not exists senator_attendance_week_idx on senator_attendance(week_of desc);

-- =============================================================================
-- 8. Views. security_invoker: they run with the caller's rights, so RLS on the
--    base tables still applies (default views run as their owner and bypass it).
-- =============================================================================
create or replace view agency_spending_summary with (security_invoker = true) as
select
  awarding_agency,
  awarding_agency_code,
  award_category,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  sum(case when connection_type is not null and connection_type != 'none' then dollar_amount else 0 end) as connected_dollars,
  sum(case when array_length(flags, 1) > 0 then dollar_amount else 0 end) as flagged_dollars,
  avg(risk_score) as avg_risk_score
from awards
where posted_date is not null
group by awarding_agency, awarding_agency_code, award_category;

create or replace view connection_group_summary with (security_invoker = true) as
select
  connection_type,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  avg(risk_score) as avg_risk_score,
  count(case when competition_status = 'no_bid' or competition_status = 'sole_source' then 1 end) as non_competitive_count
from awards
where connection_type is not null and connection_type != 'none'
group by connection_type;

create or replace view top_vendors with (security_invoker = true) as
select
  recipient_name,
  recipient_uei,
  connection_type,
  count(*) as total_awards,
  sum(dollar_amount) as total_dollars,
  avg(risk_score) as avg_risk_score,
  sum(case when array_length(flags, 1) > 0 then 1 else 0 end) as flagged_awards
from awards
where posted_date is not null
group by recipient_name, recipient_uei, connection_type
order by total_dollars desc
limit 100;

create or replace view monthly_spending_trend with (security_invoker = true) as
select
  to_char(posted_date, 'YYYY-MM') as month,
  award_category,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  sum(case when connection_type is not null and connection_type != 'none' then dollar_amount else 0 end) as connected_dollars,
  sum(case when competition_status = 'no_bid' or competition_status = 'sole_source' then dollar_amount else 0 end) as non_competitive_dollars
from awards
where posted_date is not null
group by to_char(posted_date, 'YYYY-MM'), award_category
order by month desc;

create or replace view top_congress_traders with (security_invoker = true) as
select
  ct.member_name,
  ct.member_party,
  ct.member_chamber,
  ct.member_state,
  count(*) as total_trades,
  sum(ct.amount_max) as estimated_volume,
  count(case when ct.transaction_type = 'BUY' then 1 end) as buy_count,
  count(case when ct.transaction_type = 'SELL' then 1 end) as sell_count,
  array_agg(distinct ct.ticker) as tickers_traded,
  count(distinct ct.ticker) as unique_tickers
from congress_trades ct
where ct.transaction_date >= current_date - interval '90 days'
group by ct.member_name, ct.member_party, ct.member_chamber, ct.member_state
order by estimated_volume desc;

create or replace view most_traded_stocks with (security_invoker = true) as
select
  ticker,
  company_name,
  count(*) as total_trades,
  count(case when transaction_type = 'BUY' then 1 end) as buy_count,
  count(case when transaction_type = 'SELL' then 1 end) as sell_count,
  sum(amount_max) as estimated_volume,
  array_agg(distinct member_party) as parties_trading,
  count(distinct member_name) as num_members_trading
from congress_trades
where transaction_date >= current_date - interval '90 days'
group by ticker, company_name
order by estimated_volume desc;

create or replace view sector_trades with (security_invoker = true) as
with known_sectors as (
  select ticker, sector from (
    values
      ('NVDA', 'AI/Chips'), ('AMD', 'AI/Chips'), ('INTC', 'AI/Chips'), ('QCOM', 'AI/Chips'),
      ('MSFT', 'AI/Tech'), ('GOOGL', 'AI/Tech'), ('GOOG', 'AI/Tech'), ('META', 'AI/Tech'),
      ('AMZN', 'AI/Tech'), ('AAPL', 'AI/Tech'), ('NFLX', 'AI/Tech'),
      ('PLTR', 'Defense'), ('BA', 'Defense'), ('RTX', 'Defense'), ('LMT', 'Defense'),
      ('NOC', 'Defense'), ('GD', 'Defense'), ('LHX', 'Defense'),
      ('XOM', 'Energy'), ('CVX', 'Energy'), ('COP', 'Energy'), ('EOG', 'Energy'),
      ('GS', 'Finance'), ('MS', 'Finance'), ('JPM', 'Finance'), ('BAC', 'Finance'),
      ('BLK', 'Finance'), ('SCHW', 'Finance'),
      ('TSLA', 'Auto/Energy'), ('RIVN', 'Auto/Energy'), ('F', 'Auto/Energy'),
      ('SPY', 'ETF'), ('QQQ', 'ETF'), ('VTI', 'ETF'), ('IWM', 'ETF'),
      ('PYPL', 'Fintech'), ('SQ', 'Fintech'), ('COIN', 'Crypto')
  ) as t(ticker, sector)
)
select
  s.sector,
  ct.ticker,
  ct.company_name,
  count(*) as trade_count,
  sum(ct.amount_max) as estimated_volume,
  count(case when ct.transaction_type = 'BUY' then 1 end) as buys,
  count(case when ct.transaction_type = 'SELL' then 1 end) as sells
from congress_trades ct
left join known_sectors s on ct.ticker = s.ticker
where ct.transaction_date >= current_date - interval '180 days'
group by s.sector, ct.ticker, ct.company_name
order by estimated_volume desc;

create or replace view party_trading_summary with (security_invoker = true) as
select
  member_party,
  member_chamber,
  count(*) as total_trades,
  count(distinct member_name) as num_members,
  sum(amount_max) as estimated_volume,
  count(case when transaction_type = 'BUY' then 1 end) as buys,
  count(case when transaction_type = 'SELL' then 1 end) as sells,
  count(distinct ticker) as unique_tickers
from congress_trades
where transaction_date >= current_date - interval '90 days'
group by member_party, member_chamber;

-- G1: the per-member conflict leaderboard behind /api/conflicts. Derived from the
-- columns compute_conflicts.py writes on congress_trades (nothing is stored twice).
-- Member identity is the name; party/chamber/state ignore the 'Unknown' placeholder
-- the Quiver loaders write so one member does not split into two rows.
-- R6c: the late-filing column is late_filing_count (was stock_act_violations: verdict wording); the same
-- column list as 20261007_r6c_conflicts.sql, so re-running this file over a migrated database still works.
create or replace view member_conflict_scores with (security_invoker = true) as
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

-- =============================================================================
-- 9. Functions. All SECURITY INVOKER (RLS applies to the caller); the DO block in
--    section 10 pins search_path on every one and sets who may execute it.
-- =============================================================================
create or replace function get_alert_summary(start_date date default null, end_date date default null)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_awards',     count(*),
    'total_dollars',    coalesce(sum(dollar_amount), 0),
    'contract_count',   count(*) filter (where award_category = 'contract'),
    'grant_count',      count(*) filter (where award_category = 'grant'),
    'connected_count',  count(*) filter (where connection_type is not null and connection_type != 'none'),
    'connected_dollars', coalesce(sum(dollar_amount) filter (where connection_type is not null and connection_type != 'none'), 0),
    'flagged_count',    count(*) filter (where array_length(flags, 1) > 0),
    'flagged_dollars',  coalesce(sum(dollar_amount) filter (where array_length(flags, 1) > 0), 0),
    'no_bid_count',     count(*) filter (where competition_status in ('no_bid', 'sole_source')),
    'no_bid_dollars',   coalesce(sum(dollar_amount) filter (where competition_status in ('no_bid', 'sole_source')), 0)
  ) into result
  from awards
  where (start_date is null or posted_date >= start_date)
    and (end_date is null or posted_date <= end_date);

  return result;
end;
$$;

create or replace function get_top_agencies(
  start_date date default null,
  end_date date default null,
  min_risk int default 50,
  result_limit int default 10
)
returns table (
  agency text,
  agency_code text,
  total bigint,
  connected bigint,
  flagged bigint,
  award_count bigint
)
language sql
stable
as $$
  -- Pick the most-used agency_code per awarding_agency. USAspending records the same
  -- agency under both a 3-digit CGAC code (e.g. 097) and a 4-digit fiscal/funding code
  -- (e.g. 9700); grouping by both would split agencies across two rows.
  with code_counts as (
    select awarding_agency, awarding_agency_code, count(*) as n
    from awards
    where awarding_agency is not null
    group by awarding_agency, awarding_agency_code
  ),
  ranked as (
    select
      awarding_agency,
      awarding_agency_code,
      row_number() over (partition by awarding_agency order by n desc, awarding_agency_code) as rn
    from code_counts
  ),
  canonical as (
    select awarding_agency, awarding_agency_code as canonical_code
    from ranked
    where rn = 1
  )
  select
    a.awarding_agency as agency,
    c.canonical_code as agency_code,
    sum(a.dollar_amount)::bigint as total,
    sum(case when a.connection_type is not null and a.connection_type != 'none' then a.dollar_amount else 0 end)::bigint as connected,
    sum(case when array_length(a.flags, 1) > 0 then a.dollar_amount else 0 end)::bigint as flagged,
    count(*)::bigint as award_count
  from awards a
  join canonical c on c.awarding_agency = a.awarding_agency
  where a.risk_score >= min_risk
    and (start_date is null or a.posted_date >= start_date)
    and (end_date is null or a.posted_date <= end_date)
  group by a.awarding_agency, c.canonical_code
  order by total desc
  limit result_limit;
$$;

create or replace function get_era_stats(start_date date, end_date date)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
  td bigint := 0;
  cd bigint := 0;
  nb bigint := 0;
  fc int := 0;
  ta int := 0;
  cc int := 0;
  gc int := 0;
begin
  select
    count(*),
    coalesce(sum(dollar_amount), 0),
    coalesce(sum(dollar_amount) filter (where connection_type is not null and connection_type != 'none'), 0),
    coalesce(sum(dollar_amount) filter (where competition_status in ('no_bid', 'sole_source')), 0),
    count(*) filter (where array_length(flags, 1) > 0),
    count(*) filter (where award_category = 'contract'),
    count(*) filter (where award_category = 'grant')
  into ta, td, cd, nb, fc, cc, gc
  from awards
  where posted_date >= start_date
    and posted_date <= end_date;

  result := jsonb_build_object(
    'total_awards', ta,
    'total_dollars', td,
    'connected_dollars', cd,
    'connected_pct', case when td > 0 then round((cd::numeric / td::numeric) * 100, 1) else 0 end,
    'flagged_count', fc,
    'no_bid_dollars', nb,
    'breakdown', jsonb_build_object('contracts', cc, 'grants', gc)
  );

  return result;
end;
$$;

-- Writes era_snapshots: service role only (see section 10).
create or replace function backfill_era_snapshots(era_ranges jsonb)
returns int
language plpgsql
as $$
declare
  era_rec record;
  stats jsonb;
  inserted int := 0;
begin
  for era_rec in
    select * from jsonb_to_recordset(era_ranges) as x(era text, start_date date, end_date date)
  loop
    stats := get_era_stats(era_rec.start_date, era_rec.end_date);

    insert into era_snapshots (era, total_awards, total_dollars, connected_dollars, flagged_count, no_bid_count, no_bid_dollars, computed_at)
    values (
      era_rec.era,
      (stats->>'total_awards')::int,
      (stats->>'total_dollars')::bigint,
      (stats->>'connected_dollars')::bigint,
      (stats->>'flagged_count')::int,
      0, -- no_bid_count is not in the get_era_stats response
      (stats->>'no_bid_dollars')::bigint,
      now()
    )
    on conflict (era) do update set
      total_awards = excluded.total_awards,
      total_dollars = excluded.total_dollars,
      connected_dollars = excluded.connected_dollars,
      flagged_count = excluded.flagged_count,
      no_bid_dollars = excluded.no_bid_dollars,
      computed_at = now();

    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

create or replace function get_covid_stats()
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_covid_awards', count(*),
    'total_covid_obligations', coalesce(sum(covid_obligations), 0),
    'total_covid_outlays', coalesce(sum(covid_outlays), 0),
    'covid_no_bid_count', count(*) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')),
    'covid_no_bid_dollars', coalesce(sum(covid_obligations) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')), 0),
    'by_agency', (
      select coalesce(jsonb_agg(row_to_json(t) order by total_covid_obligations desc), '[]'::jsonb)
      from (
        select
          awarding_agency as agency,
          count(*) as award_count,
          sum(covid_obligations) as total_covid_obligations,
          count(*) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')) as no_bid_count,
          coalesce(sum(covid_obligations) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')), 0) as no_bid_dollars
        from awards
        where covid_obligations > 0
        group by awarding_agency
        order by total_covid_obligations desc
      ) t
    ),
    'top_vendors', (
      select coalesce(jsonb_agg(row_to_json(t) order by total_covid_obligations desc), '[]'::jsonb)
      from (
        select
          recipient_name as name,
          sum(covid_obligations) as total_covid_obligations,
          count(*) as award_count
        from awards
        where covid_obligations > 0
        group by recipient_name
        order by total_covid_obligations desc
        limit 20
      ) t
    ),
    'by_quarter', (
      select coalesce(jsonb_object_agg(quarter, total), '{}'::jsonb)
      from (
        select
          'Q' || ceil((extract(month from posted_date)::numeric) / 3)::text || ' FY' || extract(year from posted_date)::text as quarter,
          sum(covid_obligations) as total
        from awards
        where covid_obligations > 0 and posted_date is not null
        group by 1
      ) q
    )
  ) into result
  from awards
  where covid_obligations > 0;

  return result;
end;
$$;

create or replace function get_competition_coverage()
returns jsonb
language sql
stable
as $$
  with totals as (
    select
      count(*)::bigint as total_awards,
      count(*) filter (where 'no_compete_high_value' = any(flags))::bigint as by_no_compete_flag,
      count(*) filter (where competition_status in ('no_bid', 'sole_source'))::bigint as non_competitive_from_status,
      count(*) filter (where competition_status is null or competition_status = 'unknown')::bigint as unknown_or_null,
      count(*) filter (where competition_status is not null and competition_status != 'unknown')::bigint as has_competition_data
    from awards
  )
  select jsonb_build_object(
    'total_awards', (select total_awards from totals),
    'by_competition_status', (
      select coalesce(jsonb_agg(row_to_json(t) order by n desc), '[]'::jsonb)
      from (
        select
          coalesce(competition_status, 'NULL') as status,
          count(*) as n,
          sum(dollar_amount)::bigint as total
        from awards
        group by competition_status
      ) t
    ),
    'by_no_compete_flag', (select by_no_compete_flag from totals),
    'non_competitive_from_status', (select non_competitive_from_status from totals),
    'unknown_or_null', (select unknown_or_null from totals),
    'has_competition_data', (select has_competition_data from totals)
  );
$$;

-- Two definitions of this function were committed together on 2026-06-02 (the schema_
-- file and the migration) and disagreed about what "flagged" means. This keeps the
-- schema_ version: it excludes the meta-flag 'covid_related' (present on EVERY
-- COVID-tagged award, so counting it would flag 100% of them) and counts only price
-- flag 'inflated'. It is the narrower, more conservative reading. DECISION OPEN: the
-- Analyst/Auditor must confirm it before the number is published (r1-recovery.md).
create or replace function get_covid_fraud_stats()
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_awards',           count(*),
    'flagged_count',          count(*) filter (where array_length(flags, 1) > 0 and not (flags = ARRAY['covid_related'])),
    'flagged_dollars',        coalesce(sum(covid_obligations) filter (where array_length(flags, 1) > 0 and not (flags = ARRAY['covid_related'])), 0),
    'price_flagged_count',    count(*) filter (where 'inflated' = ANY(price_flags)),
    'price_flagged_dollars',  coalesce(sum(covid_obligations) filter (where 'inflated' = ANY(price_flags)), 0),
    'connection_flagged_count',   count(*) filter (where array_length(connection_flags, 1) > 0),
    'connection_flagged_dollars', coalesce(sum(covid_obligations) filter (where array_length(connection_flags, 1) > 0), 0),
    'no_bid_count',           count(*) filter (where competition_status in ('no_bid', 'sole_source')),
    'no_bid_dollars',         coalesce(sum(covid_obligations) filter (where competition_status in ('no_bid', 'sole_source')), 0),
    'high_risk_count',        count(*) filter (where risk_score >= 70),
    'high_risk_dollars',      coalesce(sum(covid_obligations) filter (where risk_score >= 70), 0),

    'price_premium_count',    count(*) filter (where price_premium_pct is not null),
    'avg_price_premium_pct',  coalesce(avg(price_premium_pct) filter (where price_premium_pct is not null), 0),
    'total_inflated_overpayment', coalesce(
      sum(coalesce(covid_obligations, 0) - coalesce(estimated_market_rate, 0))
        filter (where price_premium_pct is not null and estimated_market_rate is not null and covid_obligations > estimated_market_rate),
      0
    ),

    'top_suspicious_vendors', (
      select coalesce(jsonb_agg(row_to_json(t) order by flagged_dollars desc), '[]'::jsonb)
      from (
        select
          recipient_name as name,
          count(*) filter (where array_length(flags, 1) > 0 and not (flags = ARRAY['covid_related'])) as flagged_award_count,
          count(*) as award_count,
          coalesce(sum(covid_obligations) filter (where array_length(flags, 1) > 0 and not (flags = ARRAY['covid_related'])), 0) as flagged_dollars,
          coalesce(sum(covid_obligations), 0) as total_dollars,
          max(risk_score) as max_risk_score
        from awards
        where covid_obligations > 0 and array_length(flags, 1) > 0 and not (flags = ARRAY['covid_related'])
        group by recipient_name
        order by flagged_dollars desc
        limit 10
      ) t
    ),

    'flag_breakdown', (
      select coalesce(jsonb_object_agg(flag_value, count), '{}'::jsonb)
      from (
        select flag_value, count(*) as count
        from (
          select unnest(flags) as flag_value
          from awards
          where covid_obligations > 0 and array_length(flags, 1) > 0
        ) expanded
        where flag_value != 'covid_related'
        group by 1
        order by count desc
      ) f
    ),

    'highest_risk_awards', (
      select coalesce(jsonb_agg(row_to_json(t) order by risk_score desc, covid_obligations desc), '[]'::jsonb)
      from (
        select
          award_id,
          recipient_name,
          awarding_agency,
          covid_obligations,
          risk_score,
          risk_factors,
          flags,
          price_flags,
          connection_flags,
          price_premium_pct,
          description
        from awards
        where covid_obligations > 0 and risk_score is not null
        order by risk_score desc, covid_obligations desc
        limit 8
      ) t
    )
  ) into result
  from awards
  where covid_obligations > 0;

  return result;
end;
$$;

create or replace function get_analytics_summary()
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'cost_overruns', coalesce((
      select jsonb_agg(row_to_json(c) order by c.overrun_pct desc)
      from cost_overruns c
    ), '[]'::jsonb),
    'stock_holdings', coalesce((
      select jsonb_agg(row_to_json(s) order by s.estimated_value_high desc)
      from stock_holdings s
    ), '[]'::jsonb),
    'trade_signals', '[]'::jsonb,
    'summary', (
      select jsonb_build_object(
        'total_overrun_projects', count(*)::int,
        'total_original_cost', coalesce(sum(original_cost), 0)::bigint,
        'total_final_cost', coalesce(sum(final_cost), 0)::bigint,
        'total_overrun_dollars', coalesce(sum(final_cost - original_cost), 0)::bigint,
        'avg_overrun_pct', coalesce(round(avg(overrun_pct))::int, 0),
        'total_stock_holdings', (select count(*)::int from stock_holdings),
        'total_stock_value_high', coalesce((select sum(estimated_value_high) from stock_holdings), 0)::bigint,
        'total_trade_signals', 0,
        'total_signal_value', 0::bigint,
        'total_contract_value_linked', 0::bigint,
        'high_confidence_signals', 0
      )
      from cost_overruns
    ),
    'agency_overruns', coalesce((
      select jsonb_agg(row_to_json(a))
      from (
        select
          agency,
          count(*)::int as count,
          sum(original_cost)::bigint as original,
          sum(final_cost)::bigint as final,
          case when sum(original_cost) > 0
               then round(((sum(final_cost) - sum(original_cost))::numeric / sum(original_cost)) * 100)::int
               else 0 end as overrun_pct
        from cost_overruns
        group by agency
        order by sum(final_cost) desc
      ) a
    ), '[]'::jsonb),
    'sector_breakdown', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select
          sector,
          coalesce(sum(estimated_value_high), 0)::bigint as totalValue,
          count(*)::int as count,
          array_agg(distinct company_name) as companies
        from stock_holdings
        group by sector
        order by sum(estimated_value_high) desc
      ) s
    ), '[]'::jsonb),
    'top_signals', '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$$;

create or replace function get_congress_trades_summary(p_window_days int default 180)
returns jsonb
language plpgsql
stable
as $$
declare
  v_today date := current_date;
  v_window_start date := v_today - p_window_days;
  v_result jsonb;
begin
  with windowed as (
    select
      ticker, company_name,
      member_name, member_party, member_chamber, member_state,
      transaction_type, amount_max, transaction_date, flags
    from congress_trades
    where transaction_date <= v_today
      and transaction_date >= v_window_start
  )
  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'totalTrades', (select count(*) from congress_trades where transaction_date <= v_today),
        'windowedCount', count(*),
        'totalVolume', coalesce(sum(amount_max), 0),
        'buyCount', count(*) filter (where transaction_type = 'BUY'),
        'sellCount', count(*) filter (where transaction_type = 'SELL'),
        'flaggedCount', count(*) filter (where flags <> '{}' and flags is not null),
        'dateRange', jsonb_build_object('earliest', min(transaction_date), 'latest', max(transaction_date))
      )
      from windowed
    ),
    'topMembers', coalesce((
      select jsonb_agg(row_to_json(m))
      from (
        select
          member_name,
          max(member_party) as member_party,
          max(member_chamber) as member_chamber,
          max(member_state) as member_state,
          count(*) as total_trades,
          coalesce(sum(amount_max), 0) as estimated_volume,
          count(*) filter (where transaction_type = 'BUY') as buys,
          count(*) filter (where transaction_type = 'SELL') as sells,
          count(distinct ticker) as unique_tickers
        from windowed
        group by member_name
        order by estimated_volume desc
        limit 10
      ) m
    ), '[]'::jsonb),
    'topStocks', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select
          ticker,
          max(company_name) as company_name,
          count(*) as total_trades,
          count(*) filter (where transaction_type = 'BUY') as buys,
          count(*) filter (where transaction_type = 'SELL') as sells,
          coalesce(sum(amount_max), 0) as estimated_volume,
          count(distinct member_name) as num_members
        from windowed
        group by ticker
        order by estimated_volume desc
        limit 10
      ) s
    ), '[]'::jsonb),
    'partyBreakdown', coalesce((
      select jsonb_agg(row_to_json(p))
      from (
        select
          member_party as party,
          count(*) filter (where transaction_type = 'BUY') as buys,
          count(*) filter (where transaction_type = 'SELL') as sells,
          coalesce(sum(amount_max), 0) as volume,
          count(*) as count
        from windowed
        group by member_party
        order by volume desc
      ) p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

drop function if exists get_trade_related_contracts(jsonb);
create or replace function get_trade_related_contracts(trades_json jsonb)
returns table (
  trade_company_name text,
  trade_tx_date text,
  award_id text,
  recipient_name text,
  recipient_parent_name text,
  dollar_amount bigint,
  posted_date text,
  awarding_agency text,
  description text,
  match_rank bigint
)
language plpgsql
stable
as $$
declare
  global_min_date date;
  global_max_date date;
begin
  if jsonb_typeof(trades_json) != 'array' or jsonb_array_length(trades_json) = 0 then
    return;
  end if;

  select
    min((t->>'tx_date')::date) - 30,
    max((t->>'tx_date')::date) + 60
  into global_min_date, global_max_date
  from jsonb_array_elements(trades_json) as t
  where t->>'tx_date' is not null;

  if global_min_date is null or global_max_date is null then
    return;
  end if;

  return query
  with trades_expanded as (
    select
      (t->>'company_name')::text as company_name,
      (t->>'tx_date')::date as tx_date
    from jsonb_array_elements(trades_json) as t
    where t->>'tx_date' is not null and t->>'company_name' is not null
  ),
  -- "key" = first 2 words longer than 2 chars, lowercased (same logic as the JS code)
  trades_with_key as (
    select
      te.company_name,
      te.tx_date,
      lower(
        array_to_string(
          (
            select array_agg(w)
            from (
              select w
              from regexp_split_to_table(
                regexp_replace(te.company_name, '[,.\-]', ' ', 'g'),
                '\s+'
              ) as w
              where length(w) > 2
              limit 2
            ) s
          ),
          ' '
        )
      ) as company_key
    from trades_expanded te
  ),
  candidate_awards as (
    select
      a.recipient_name,
      a.recipient_parent_name,
      a.dollar_amount,
      a.posted_date::text as posted_date,
      a.awarding_agency,
      a.description
    from awards a
    where a.dollar_amount >= 10000000
      and a.posted_date is not null
      and a.posted_date >= global_min_date
      and a.posted_date <= global_max_date
  ),
  matched as (
    select
      t.company_name as trade_company_name,
      t.tx_date::text as trade_tx_date,
      a.recipient_name,
      a.recipient_parent_name,
      a.dollar_amount,
      a.posted_date,
      a.awarding_agency,
      a.description,
      row_number() over (
        partition by t.tx_date, t.company_name
        order by a.dollar_amount desc
      ) as match_rank
    from trades_with_key t
    cross join lateral (
      select *
      from candidate_awards a
      where
        a.posted_date >= (t.tx_date - 30)::text
        and a.posted_date <= (t.tx_date + 60)::text
        and (
          lower(coalesce(a.recipient_name, '')) like '%' || t.company_key || '%'
          or lower(coalesce(a.recipient_parent_name, '')) like '%' || t.company_key || '%'
        )
    ) a
  )
  select
    m.trade_company_name,
    m.trade_tx_date,
    null::text as award_id, -- not used by the route
    m.recipient_name,
    m.recipient_parent_name,
    m.dollar_amount,
    m.posted_date,
    m.awarding_agency,
    m.description,
    m.match_rank
  from matched m
  where m.match_rank <= 3
  order by m.trade_tx_date desc, m.trade_company_name, m.match_rank;
end;
$$;

-- Public Servant Score rubric v0.1.1 (the 0.1.0 body and its Pillar-3 bug are gone:
-- migrations/20260610115500 superseded it). Writes senator_scores: service role only.
create or replace function compute_scores(target_week date, version text default '0.1.0')
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with trade_stats as (
    select
      st.senator_id,
      count(*) filter (where st.conflict_flag)              as conflicts,
      count(*) filter (where not st.conflict_flag)          as clean_trades
    from senator_trades st
    where st.transaction_date >= (target_week - interval '24 months')
    group by st.senator_id
  ),
  pillar2 as (
    select
      s.id as senator_id,
      case
        when ts.conflicts is null and ts.clean_trades is null then 0::numeric
        else greatest(
          0::numeric,
          least(
            20.0,
            20.0
              - coalesce(ts.conflicts, 0) * 2.0
              - coalesce(ts.clean_trades, 0) * 0.5
          )
        )
      end as score,
      (ts.conflicts is not null or ts.clean_trades is not null) as has_data
    from senators s
    left join trade_stats ts on ts.senator_id = s.id
    where s.is_active
  ),
  bill_stats as (
    select
      sb.senator_id,
      count(*) filter (where sb.role = 'sponsor' and sb.passed_chamber) as sponsored_passed,
      count(*) filter (where sb.role = 'sponsor' and sb.bipartisan_cosponsors > 0) as bipartisan_sponsors,
      count(*) as total_bills
    from senator_bills sb
    where sb.introduced_date >= (target_week - interval '24 months')
    group by sb.senator_id
  ),
  chamber_max as (
    select greatest(1.0,
      0.5 * ln(1 + coalesce(max(bs.sponsored_passed), 0)) +
      0.3 * ln(1 + coalesce(max(bs.bipartisan_sponsors), 0)) +
      0.2 * ln(1 + coalesce(max(bs.total_bills), 0))
    ) as max_raw
    from bill_stats bs
  ),
  pillar4 as (
    select
      s.id as senator_id,
      case
        when bs.sponsored_passed is null and bs.bipartisan_sponsors is null and bs.total_bills is null then 0
        else
          least(
            20.0,
            (
              (0.5 * ln(1 + coalesce(bs.sponsored_passed, 0)) +
               0.3 * ln(1 + coalesce(bs.bipartisan_sponsors, 0)) +
               0.2 * ln(1 + coalesce(bs.total_bills, 0)))
              / cm.max_raw
            ) * 20.0
          )
      end as score,
      (bs.total_bills is not null) as has_data
    from senators s
    left join bill_stats bs on bs.senator_id = s.id
    cross join chamber_max cm
    where s.is_active
  ),
  att_latest as (
    select distinct on (sa.senator_id)
      sa.senator_id,
      sa.missed_votes_pct,
      sa.speeches_count
    from senator_attendance sa
    where sa.week_of <= target_week
    order by sa.senator_id, sa.week_of desc
  ),
  speech_median as (
    select percentile_cont(0.5) within group (order by speeches_count) as median_speeches
    from att_latest
  ),
  pillar5 as (
    select
      s.id as senator_id,
      case
        when al.missed_votes_pct is null then 0
        else
          greatest(
            0,
            least(
              20.0,
              (12.0 * (1.0 - al.missed_votes_pct / 100.0)) +
              case
                when al.speeches_count >= sm.median_speeches * 1.5 then 8
                when al.speeches_count >= sm.median_speeches * 0.75 then 6
                when al.speeches_count >= sm.median_speeches * 0.25 then 4
                when al.speeches_count > 0 then 2
                else 0
              end
            )
          )
      end as score,
      (al.missed_votes_pct is not null) as has_data
    from senators s
    left join att_latest al on al.senator_id = s.id
    cross join speech_median sm
    where s.is_active
  ),
  pillar1 as (
    select
      s.id as senator_id,
      0::numeric as score,
      exists(
        select 1 from senator_votes sv
        where sv.senator_id = s.id and sv.state_poll_pct_supporting is not null
      ) as has_data
    from senators s
    where s.is_active
  ),
  lobby_total as (
    select senator_id, coalesce(sum(estimated_cost), 0) as total_cost
    from lobbyist_trips
    where trip_date >= (target_week - interval '24 months')
    group by senator_id
  ),
  pillar3 as (
    select
      s.id as senator_id,
      case
        when lt.total_cost is null then 0::numeric
        when lt.total_cost < 1000 then 20
        when lt.total_cost < 5000 then 16
        when lt.total_cost < 15000 then 12
        when lt.total_cost < 50000 then 8
        when lt.total_cost < 100000 then 4
        else 0
      end as score,
      (lt.total_cost is not null) as has_data
    from senators s
    left join lobby_total lt on lt.senator_id = s.id
    where s.is_active
  )
  insert into senator_scores (
    senator_id, week_of,
    pillar_constituency, pillar_stocks, pillar_lobbying,
    pillar_productivity, pillar_attendance,
    has_constituency_data, has_stocks_data, has_lobbying_data,
    has_productivity_data, has_attendance_data,
    scoring_version
  )
  select
    s.id, target_week,
    p1.score, p2.score, p3.score, p4.score, p5.score,
    p1.has_data, p2.has_data, p3.has_data, p4.has_data, p5.has_data,
    version
  from senators s
  join pillar1 p1 on p1.senator_id = s.id
  join pillar2 p2 on p2.senator_id = s.id
  join pillar3 p3 on p3.senator_id = s.id
  join pillar4 p4 on p4.senator_id = s.id
  join pillar5 p5 on p5.senator_id = s.id
  where s.is_active
  on conflict (senator_id, week_of) do update set
    pillar_constituency   = excluded.pillar_constituency,
    pillar_stocks         = excluded.pillar_stocks,
    pillar_lobbying       = excluded.pillar_lobbying,
    pillar_productivity   = excluded.pillar_productivity,
    pillar_attendance     = excluded.pillar_attendance,
    has_constituency_data = excluded.has_constituency_data,
    has_stocks_data       = excluded.has_stocks_data,
    has_lobbying_data     = excluded.has_lobbying_data,
    has_productivity_data = excluded.has_productivity_data,
    has_attendance_data   = excluded.has_attendance_data,
    scoring_version       = excluded.scoring_version,
    computed_at           = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function get_score_leaderboard(target_week date default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_week date;
  v_result jsonb;
begin
  select max(week_of) into v_week from senator_scores;
  if v_week is null then
    return jsonb_build_object('week', null, 'senators', '[]'::jsonb);
  end if;
  if target_week is not null then v_week := target_week; end if;

  select jsonb_build_object(
    'week', v_week,
    'senators', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sen.id,
        'name_slug', sen.name_slug,
        'full_name', sen.full_name,
        'state', sen.state,
        'party', sen.party,
        'photo_url', sen.photo_url,
        'total_score', ss.total_score,
        'grade', ss.grade,
        'pillar_stocks', ss.pillar_stocks,
        'pillar_productivity', ss.pillar_productivity,
        'pillar_attendance', ss.pillar_attendance,
        'pillar_constituency', ss.pillar_constituency,
        'pillar_lobbying', ss.pillar_lobbying,
        'data_coverage_pct', ss.data_coverage_pct
      ) order by ss.total_score desc, sen.full_name asc
    ), '[]'::jsonb)
  )
  into v_result
  from senator_scores ss
  join senators sen on sen.id = ss.senator_id
  where ss.week_of = v_week
    and sen.is_active = true;

  return v_result;
end;
$$;

-- Fix vs the original: "top_conflicts" had `limit 5` on the aggregate (a no-op), so it
-- returned every conflicted trade. The limit now applies to the rows being aggregated.
create or replace function get_senator_report_card(p_slug text)
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'senator', jsonb_build_object(
      'id', sen.id,
      'name_slug', sen.name_slug,
      'full_name', sen.full_name,
      'state', sen.state,
      'party', sen.party,
      'photo_url', sen.photo_url,
      'term_start', sen.term_start,
      'committees', sen.committees
    ),
    'score', jsonb_build_object(
      'week_of', ss.week_of,
      'total', ss.total_score,
      'grade', ss.grade,
      'pillar_constituency', ss.pillar_constituency,
      'pillar_stocks', ss.pillar_stocks,
      'pillar_lobbying', ss.pillar_lobbying,
      'pillar_productivity', ss.pillar_productivity,
      'pillar_attendance', ss.pillar_attendance,
      'data_coverage_pct', ss.data_coverage_pct,
      'has_constituency_data', ss.has_constituency_data,
      'has_stocks_data', ss.has_stocks_data,
      'has_lobbying_data', ss.has_lobbying_data,
      'has_productivity_data', ss.has_productivity_data,
      'has_attendance_data', ss.has_attendance_data,
      'scoring_version', ss.scoring_version
    ),
    'top_conflicts', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'transaction_date', c.transaction_date,
          'ticker', c.ticker,
          'asset_description', c.asset_description,
          'transaction_type', c.transaction_type,
          'amount_low', c.amount_low,
          'amount_high', c.amount_high,
          'committee_overlap_sectors', c.committee_overlap_sectors
        ) order by c.transaction_date desc
      ), '[]'::jsonb)
      from (
        select st.*
        from senator_trades st
        where st.senator_id = sen.id and st.conflict_flag = true
        order by st.transaction_date desc
        limit 5
      ) c
    )
  )
  into v_result
  from senators sen
  left join senator_scores ss on ss.senator_id = sen.id
    and ss.week_of = (select max(week_of) from senator_scores where senator_id = sen.id)
  where sen.name_slug = p_slug;

  return v_result;
end;
$$;

comment on table senators is 'Canonical Senate roster. Sourced from Bioguide + unitedstates/congress-legislators.';
comment on table senator_scores is 'Weekly grade snapshots. Generated by compute_scores(). Never edit by hand.';
comment on column senator_scores.scoring_version is 'Stamp of the rubric version used. Used to reproduce any historical grade.';
comment on function compute_scores(date, text) is 'Recompute all senator grades for a given week. Pure function of inputs + scoring_version.';
comment on table congress_members is 'Roster from unitedstates/congress-legislators (public domain), keyed on bioguide_id.';
comment on view member_conflict_scores is 'Per-member roll-up of the conflict-engine columns on congress_trades (see compute_conflicts.py).';

-- =============================================================================
-- 10. SECURITY
--   * RLS is ON for every table in public (the loop below is a safety net, so a
--     future table that forgets it is still locked down).
--   * anon / authenticated: SELECT on public data only. No INSERT/UPDATE/DELETE on
--     anything, ever; no access at all to newsletter_subscribers or sync_log.
--   * service_role bypasses RLS: it is the only writer (Next.js server routes,
--     Python loaders, GitHub Actions).
--   * Functions: SECURITY INVOKER only, search_path pinned, EXECUTE revoked from
--     PUBLIC and granted back explicitly. The two writer functions are service-role
--     only; the read RPCs are open to anon because the site calls them.
--   * Adding a table later? Enable RLS, add a "public read <table>" policy ONLY if
--     the data is meant to be public, and the grants below do the rest. Never grant
--     write to anon/authenticated.
-- =============================================================================
do $$
declare
  r record;
  t text;
  public_tables text[] := array[
    'awards', 'era_snapshots', 'covid_spending_summary', 'political_entities',
    'tax_expenditures', 'congress_members', 'congress_trades',
    'cost_overruns', 'stock_holdings',
    'senators', 'senator_scores', 'senator_trades', 'senator_votes',
    'lobbyist_trips', 'senator_bills', 'senator_attendance'
  ];
  public_views text[] := array[
    'agency_spending_summary', 'connection_group_summary', 'top_vendors',
    'monthly_spending_trend', 'top_congress_traders', 'most_traded_stocks',
    'sector_trades', 'party_trading_summary', 'member_conflict_scores'
  ];
  read_rpcs text[] := array[
    'get_alert_summary', 'get_top_agencies', 'get_era_stats', 'get_covid_stats',
    'get_competition_coverage', 'get_covid_fraud_stats', 'get_analytics_summary',
    'get_congress_trades_summary', 'get_trade_related_contracts',
    'get_score_leaderboard', 'get_senator_report_card'
  ];
begin
  -- RLS on for every ordinary/partitioned table in public
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;

  -- policies: drop everything (incl. the old "Admin ... to authenticated" ones and any
  -- INSERT policy), then recreate exactly one SELECT policy per public table
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach t in array public_tables loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'public read ' || t, t);
  end loop;

  -- table/view privileges: wipe, then SELECT-only on the public allowlist
  execute 'revoke all on all tables in schema public from anon, authenticated';
  execute 'revoke all on all sequences in schema public from anon, authenticated';
  foreach t in array public_tables || public_views loop
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
  -- no schema-wide default grants to the API roles for objects created later
  execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
  execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
  execute 'alter default privileges in schema public revoke execute on functions from anon, authenticated';

  -- functions: pin search_path, lock down EXECUTE, then open only the read RPCs
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
    if r.proname = any (read_rpcs) then
      execute format('grant execute on function %s to anon, authenticated', r.sig);
    end if;
  end loop;
end
$$;

commit;
