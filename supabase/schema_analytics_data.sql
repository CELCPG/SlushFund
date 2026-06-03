-- Sprint 6: Analytics data tables
-- Cost overruns, insider trading signals, and stock holdings all live in TS
-- files currently. Moving them to the DB so /api/analytics can use the DB
-- (currently always falls through to static data because the tables don't exist).

-- ── COST OVERRUNS ──────────────────────────────────────────────────────────────
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

alter table cost_overruns enable row level security;
drop policy if exists "anon read cost_overruns" on cost_overruns;
create policy "anon read cost_overruns" on cost_overruns for select to anon, authenticated using (true);

create index if not exists cost_overruns_agency_idx on cost_overruns (agency);
create index if not exists cost_overruns_overrun_pct_idx on cost_overruns (overrun_pct desc);
create index if not exists cost_overruns_category_idx on cost_overruns (category);

-- ── INSIDER TRADING SIGNALS ───────────────────────────────────────────────────
create table if not exists insider_trading_signals (
  id text primary key,
  company_ticker text not null,
  company_name text not null,
  politician_name text not null,
  filing_date date,
  transaction_type text,
  shares_estimate bigint,
  estimated_value bigint,
  sector text,
  confidence text,
  analysis_notes text,
  source_url text,
  related_contract_id text,
  related_contract_amount bigint,
  related_contract_agency text,
  related_contract_description text,
  related_contract_date date,
  created_at timestamptz default now()
);

alter table insider_trading_signals enable row level security;
drop policy if exists "anon read insider_trading_signals" on insider_trading_signals;
create policy "anon read insider_trading_signals" on insider_trading_signals for select to anon, authenticated using (true);

create index if not exists its_company_ticker_idx on insider_trading_signals (company_ticker);
create index if not exists its_confidence_idx on insider_trading_signals (confidence);
create index if not exists its_value_idx on insider_trading_signals (estimated_value desc);

-- ── STOCK HOLDINGS ────────────────────────────────────────────────────────────
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

alter table stock_holdings enable row level security;
drop policy if exists "anon read stock_holdings" on stock_holdings;
create policy "anon read stock_holdings" on stock_holdings for select to anon, authenticated using (true);

create index if not exists stock_holdings_ticker_idx on stock_holdings (ticker);
create index if not exists stock_holdings_value_idx on stock_holdings (estimated_value_high desc);
create index if not exists stock_holdings_sector_idx on stock_holdings (sector);
