-- SlushFund — Supabase Schema
-- Run this in: Supabase → SQL Editor → New Query → Paste and Run

-- ─── Awards Table (primary record) ──────────────────────────────────────────
create table if not exists awards (
  id text primary key, -- internal_id from USAspending
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

  -- Description / Classification
  description text,
  assistance_listing text,
  cfda_program text,
  awarding_agency text not null,
  awarding_agency_code text,
  awarding_sub_agency text,
  funding_agency text,
  funding_agency_code text,
  funding_sub_agency text,
  award_category text not null, -- contract | grant | loan | direct_payment | other
  contract_type text,          -- original USAspending type code
  competition_status text,      -- open_competition | limited_competition | no_bid | sole_source | unknown
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

  -- COVID / Infrastructure
  covid_obligations bigint,
  covid_outlays bigint,
  infrastructure_obligations bigint,
  infrastructure_outlays bigint,

  -- Links
  fpds_url text,
  usaspending_url text,

  -- Metadata
  notes text,
  source text default 'usaspending', -- usaspending | fpds | manual
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists awards_recipient_idx on awards(recipient_name);
create index if not exists awards_recipient_uei_idx on awards(recipient_uei);
create index if not exists awards_agency_idx on awards(awarding_agency);
create index if not exists awards_agency_code_idx on awards(awarding_agency_code);
create index if not exists awards_connection_idx on awards(connection_type);
create index if not exists awards_category_idx on awards(award_category);
create index if not exists awards_competition_idx on awards(competition_status);
create index if not exists awards_posted_idx on awards(posted_date);
create index if not exists awards_risk_idx on awards(risk_score);
create index if not exists awards_naics_idx on awards(naics_code);
create index if not exists awards_flags_idx on awards using gin(flags);

-- ─── Political Entities Table ─────────────────────────────────────────────────
create table if not exists political_entities (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  entity_type text not null, -- person | company | org
  connection_category text not null, -- trump_family | elon_musk | trump_ally | gop_donor | lobbyist | mar-a-lago | none
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

create index if not exists political_entities_name_idx on political_entities(entity_name);
create index if not exists political_entities_category_idx on political_entities(connection_category);
create index if not exists political_entities_aliases_idx on political_entities using gin(aliases);

-- ─── Sync Log (track sync history) ──────────────────────────────────────────
create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null, -- contracts | grants | full | incremental
  start_date text,
  end_date text,
  pages_processed int default 0,
  records_synced int default 0,
  records_flagged int default 0,
  errors jsonb default '[]',
  duration_ms int,
  status text default 'running', -- running | complete | failed
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table awards enable row level security;
alter table political_entities enable row level security;
alter table sync_log enable row level security;

create policy "Public read awards" on awards for select using (true);
create policy "Public read entities" on political_entities for select using (true);
create policy "Public read sync_log" on sync_log for select using (true);

-- Admin write policies (for sync operations)
create policy "Admin insert awards" on awards for insert to authenticated with check (true);
create policy "Admin update awards" on awards for update to authenticated using (true);
create policy "Admin insert entities" on political_entities for insert to authenticated with check (true);
create policy "Admin update entities" on political_entities for update to authenticated using (true);

-- ─── Aggregation Views ────────────────────────────────────────────────────────

-- Agency spending summary
create or replace view agency_spending_summary as
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
where posted_date >= '2024-10-01'
group by awarding_agency, awarding_agency_code, award_category;

-- Connection group summary
create or replace view connection_group_summary as
select
  connection_type,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  avg(risk_score) as avg_risk_score,
  count(case when competition_status = 'no_bid' or competition_status = 'sole_source' then 1 end) as non_competitive_count
from awards
where connection_type is not null and connection_type != 'none'
group by connection_type;

-- Top vendors by spend
create or replace view top_vendors as
select
  recipient_name,
  recipient_uei,
  connection_type,
  count(*) as total_awards,
  sum(dollar_amount) as total_dollars,
  avg(risk_score) as avg_risk_score,
  sum(case when array_length(flags, 1) > 0 then 1 else 0 end) as flagged_awards
from awards
where posted_date >= '2024-10-01'
group by recipient_name, recipient_uei, connection_type
order by total_dollars desc
limit 100;

-- Monthly trend
create or replace view monthly_spending_trend as
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
-- ─── Tax Expenditures Table ──────────────────────────────────────────────────
create table if not exists tax_expenditures (
  id text primary key,
  recipient_name text not null,
  recipient_parent_name text,
  dollar_amount bigint not null,
  tax_provision text, -- e.g. '§168 bonus depreciation'
  description text,
  agency text, -- e.g. 'IRS'
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

create index if not exists tax_exp_name_idx on tax_expenditures(recipient_name);
create index if not exists tax_exp_connection_idx on tax_expenditures(connection_type);
create index if not exists tax_exp_year_idx on tax_expenditures(fiscal_year);
create index if not exists tax_exp_provision_idx on tax_expenditures(tax_provision);
create index if not exists tax_exp_risk_idx on tax_expenditures(risk_score);

alter table tax_expenditures enable row level security;
create policy "Public read tax_expenditures" on tax_expenditures for select using (true);
create policy "Admin insert tax_expenditures" on tax_expenditures for insert to authenticated with check (true);
create policy "Admin update tax_expenditures" on tax_expenditures for update to authenticated using (true);
