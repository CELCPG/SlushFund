-- SlushFund — Congress Trades Schema
-- Adds congressman stock trading to the existing SlushFund Supabase project
-- Run this AFTER schema.sql in Supabase SQL Editor

-- ─── Congress Members Table ───────────────────────────────────────────────────
create table if not exists congress_members (
  id uuid primary key default gen_random_uuid(),
  
  -- Biographical
  name text not null,
  first_name text,
  last_name text not null,
  suffix text,
  party text not null, -- Democrat | Republican | Independent
  chamber text not null, -- Senate | House
  state text not null,
  district text, -- only for House members
  state_name text not null,
  
  -- Congress-specific
  congress_num int, -- 118, 119, etc.
  in_office boolean default true,
  title text, -- "Senator", "Representative"
  
  -- Committee assignments (JSON array)
  committees jsonb default '[]', -- [{name, code, jurisdiction}]
  
  -- Financial disclosure
  disclosure_url text,
  last_disclosure_check timestamptz,
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Unique constraint
  unique(chamber, state, district)
);

create index if not exists congress_members_chamber_idx on congress_members(chamber);
create index if not exists congress_members_party_idx on congress_members(party);
create index if not exists congress_members_state_idx on congress_members(state);
create index if not exists congress_members_office_idx on congress_members(in_office);

-- ─── Congressional Trades Table ───────────────────────────────────────────────
create table if not exists congress_trades (
  id uuid primary key default gen_random_uuid(),
  
  -- Who
  member_id uuid references congress_members(id),
  member_name text not null,
  member_chamber text not null, -- Senate | House (denormalized for easier queries)
  member_party text not null,
  member_state text not null,
  
  -- What
  ticker text not null,
  company_name text not null,
  transaction_type text not null, -- BUY | SELL | EXCHANGE | EXERCISE
  asset_type text not null, -- Stock | ETF | Option | Mutual Fund | Bond
  
  -- Amount (ranges, not exact)
  amount_min bigint, -- minimum of disclosed range
  amount_max bigint, -- maximum of disclosed range
  amount_range text, -- "1M-5M" raw string from disclosure
  
  -- Dates
  transaction_date date not null, -- when trade was executed
  filed_date date, -- when disclosed (STOCK Act: within 45 days)
  disclosure_year int,
  
  -- Source
  disclosure_url text,
  source_system text not null, -- House_Clerk | Senate_EFD
  
  -- Risk / Signal flags
  flags text[] default '{}',
  signal_type text, -- routine | suspicious | insider_like
  
  -- Related federal contracts (join with awards table)
  related_contracts jsonb default '[]', -- [{award_id, dollar_amount, agency, date}]
  has_federal_contract boolean default false,
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists congress_trades_ticker_idx on congress_trades(ticker);
create index if not exists congress_trades_member_idx on congress_trades(member_name);
create index if not exists congress_trades_chamber_idx on congress_trades(member_chamber);
create index if not exists congress_trades_party_idx on congress_trades(member_party);
create index if not exists congress_trades_type_idx on congress_trades(transaction_type);
create index if not exists congress_trades_date_idx on congress_trades(transaction_date);
create index if not exists congress_trades_filed_idx on congress_trades(filed_date);
create index if not exists congress_trades_contract_idx on congress_trades(has_federal_contract);
create index if not exists congress_trades_ticker_date_idx on congress_trades(ticker, transaction_date desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table congress_members enable row level security;
alter table congress_trades enable row level security;

create policy "Public read congress_members" on congress_members for select using (true);
create policy "Public read congress_trades" on congress_trades for select using (true);
create policy "Admin insert congress_members" on congress_members for insert to authenticated with check (true);
create policy "Admin update congress_members" on congress_members for update to authenticated using (true);
create policy "Admin insert congress_trades" on congress_trades for insert to authenticated with check (true);
create policy "Admin update congress_trades" on congress_trades for update to authenticated using (true);

-- ─── Aggregation Views ────────────────────────────────────────────────────────

-- Top traders by volume (last 90 days)
create or replace view top_congress_traders as
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

-- Most traded stocks (last 90 days)
create or replace view most_traded_stocks as
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

-- Sector analysis (tagged by known sector categories)
create or replace view sector_trades as
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

-- Party trading breakdown
create or replace view party_trading_summary as
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
