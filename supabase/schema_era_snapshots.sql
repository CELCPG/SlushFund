-- SlushFund — era_snapshots table
-- Pre-computed era aggregates so /api/era-stats doesn't need to scan awards.
-- Run this in: Supabase → SQL Editor, OR via `supabase db query --linked --file`

create table if not exists public.era_snapshots (
  era text primary key,
  total_awards int,
  total_dollars bigint,
  connected_dollars bigint,
  flagged_count int,
  no_bid_count int,
  no_bid_dollars bigint,
  computed_at timestamptz default now()
);

alter table public.era_snapshots enable row level security;
create policy "Public read era_snapshots" on public.era_snapshots for select using (true);
create policy "Service role write era_snapshots" on public.era_snapshots for all to service_role using (true) with check (true);
