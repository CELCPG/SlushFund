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
  -- Pick the most-used agency_code per awarding_agency. USAspending records
  -- the same agency under both a 3-digit CGAC code (e.g. 097) and a 4-digit
  -- fiscal/funding code (e.g. 9700); grouping by both would split agencies
  -- across two rows. We rank by row count per code and keep the winner.
  with code_counts as (
    select
      awarding_agency,
      awarding_agency_code,
      count(*) as n
    from awards
    where awarding_agency is not null
    group by awarding_agency, awarding_agency_code
  ),
  ranked as (
    select
      awarding_agency,
      awarding_agency_code,
      row_number() over (
        partition by awarding_agency
        order by n desc, awarding_agency_code
      ) as rn
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

-- COVID stats aggregates. The /api/covid-stats route used to scan every
-- award with covid_obligations > 0 and reduce in JS. This function returns
-- the same shape in one round-trip.
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
    -- COVID competition signal: try `flags` first ('no_bid' / 'sole_source'),
    -- fall back to `competition_status` for older awards that don't have
    -- pipeline-inferred flags. The flags array currently has no 'no_bid'
    -- values for COVID awards (only covid_related/matched_connection/large_award/related_party),
    -- so this resolves to 0 — which is the honest answer.
    'covid_no_bid_count', count(*) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')),
    'covid_no_bid_dollars', coalesce(sum(covid_obligations) filter (where 'no_bid' = any(flags) or 'sole_source' = any(flags) or competition_status in ('no_bid', 'sole_source')), 0),
    'by_agency', (
      select coalesce(jsonb_agg(row_to_json(t) order by total_covid_obligations desc), '[]'::jsonb)
      from (
        select
          awarding_agency as agency,
          count(*) as award_count,
          sum(covid_obligations) as total_covid_obligations,
          -- Same combined signal as the top-level field. Currently 0 across
          -- the board for COVID-tagged awards because no row has the right
          -- flag and almost none have a non-'unknown' competition_status.
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

grant execute on function get_covid_stats() to anon, authenticated;

-- ─── Competition status coverage + cross-signal analysis ──────────────────────
-- Two parallel signals exist for "this award was non-competitive":
--   1. competition_status: a real field with values open_competition | no_bid |
--      sole_source | limited_competition | full_competition | unknown
--   2. flags array: may contain no_bid | sole_source | limited_competition |
--      no_compete_high_value
-- They don't fully agree. This RPC returns both so the dashboard can show the
-- honest picture (e.g. "21 from competition_status, 30 from no_compete_high_value
-- flag, 16,129 unknown") instead of a single number that hides the gap.
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

grant execute on function get_competition_coverage() to anon, authenticated;
