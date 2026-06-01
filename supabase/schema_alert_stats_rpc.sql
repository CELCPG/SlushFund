-- SlushFund — Alert Stats RPC
-- Replaces JS-side reduce() over up to 50k rows in /api/alerts
-- Run this in: Supabase → SQL Editor → New Query → Paste and Run

-- Returns global summary stats for an optional date range.
-- The single round-trip replaces 3 SELECT scans of the awards table.
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

-- Top-N agencies by total dollars, optionally filtered by min risk score and date range.
-- Replaces the agencyData scan + JS groupBy in /api/alerts.
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
  select
    awarding_agency as agency,
    awarding_agency_code as agency_code,
    sum(dollar_amount)::bigint as total,
    sum(case when connection_type is not null and connection_type != 'none' then dollar_amount else 0 end)::bigint as connected,
    sum(case when array_length(flags, 1) > 0 then dollar_amount else 0 end)::bigint as flagged,
    count(*)::bigint as award_count
  from awards
  where risk_score >= min_risk
    and (start_date is null or posted_date >= start_date)
    and (end_date is null or posted_date <= end_date)
  group by awarding_agency, awarding_agency_code
  order by total desc
  limit result_limit;
$$;

-- Grant access to the anonymous role (the views + table already have it).
grant execute on function get_alert_summary(date, date) to anon, authenticated;
grant execute on function get_top_agencies(date, date, int, int) to anon, authenticated;

-- Returns aggregated stats for a single era window. Used by /api/era-stats as
-- the fallback when era_snapshots is empty. Returns the exact JSON shape the
-- Next.js route builds in JS, so the caller can swap one for the other.
create or replace function get_era_stats(
  start_date date,
  end_date date
)
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
    'breakdown', jsonb_build_object(
      'contracts', cc,
      'grants', gc
    )
  );

  return result;
end;
$$;

grant execute on function get_era_stats(date, date) to anon, authenticated;

-- Backfill all era_snapshots in a single pass. Driven by the application
-- layer's ERA_FYS definition: this RPC writes the current snapshot for every
-- era in the same transaction, so /api/era-stats fast-path is always hit
-- after the first run.
create or replace function backfill_era_snapshots(
  era_ranges jsonb
)
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
      0, -- no_bid_count not in get_era_stats response; can add if needed
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

grant execute on function backfill_era_snapshots(jsonb) to service_role;
