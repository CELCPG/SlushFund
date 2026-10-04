-- R6e (A7b F4 + F10 timeout): neutral names for everything the anon role can read or execute.
-- Additive / idempotent: every statement can run twice. One transaction.
-- RLS stays on for every table; anon and authenticated can only SELECT / EXECUTE the read RPCs (unchanged).
--
-- A7b's scan list (fraud, suspicious, flagged, risk, inflated, overpay, no_bid, severe, conflicted) found verdict words in
-- the NAMES and VALUES of public objects. Nothing here changes a number except where stated:
--   1. get_covid_fraud_stats DROPPED (top_suspicious_vendors, high_risk_*, total_inflated_overpayment, flagged_dollars). Its
--      "flags" were only the not-competed code; max_risk_score was 0 for every vendor. Nothing in this database needs it
--      (readers: legacy app/api/covid-fraud + CovidFraudSection, listed in r6e-fixes.md for D8).
--   2. awards.competition_status 'no_bid' -> 'not_competed' (the official extent-competed codes B, C, G: the agency's own
--      coding, not a finding); the same label in awards.flags / awards.competition_flags. 26,280 rows. 'sole_source' (FPDS
--      "only one source") is unchanged.
--   3. awards.risk_score / risk_factors DROPPED (0 or empty on every row; the loader never wrote them). Same for the empty
--      tables' risk columns; flagged / no_bid column names on the empty era / covid / cost tables renamed.
--   4. Views and RPC keys: flagged_* / no_bid_* -> not_competed_*; avg_risk_score / max_risk_score / risk_* dropped.
--        top_vendors            flagged_awards -> not_competed_awards (awards coded not competed; was "any flag")
--        agency_spending_summary flagged_dollars -> not_competed_dollars (same change)
--        get_alert_summary      flagged_count / flagged_dollars dropped (superseded by not_competed_*, which counts the
--                               codes exactly: 26,280 awards; "flagged" also counted covid / infrastructure markers, 26,578)
--        get_covid_stats        covid_no_bid_* -> covid_not_competed_*, by_agency[].no_bid_* -> not_competed_*
--        get_era_stats          flagged_count dropped, no_bid_dollars -> not_competed_dollars (+ not_competed_count)
--        get_top_agencies       min_risk argument and the risk filter dropped (it ranked only awards with risk_score >= 50,
--                               which none had, so it always returned nothing); flagged -> not_competed
--        get_congress_trades_summary  flaggedCount dropped (congress_trades.flags is empty on every row)
--   5. F10: agency_spending_summary is a MATERIALIZED view (51 rows). The plain view scanned the 45 MB awards table and hit
--      anon's 3 s statement timeout on a cold cache (HTTP 500). Refresh after every awards load:
--      select refresh_agency_spending_summary();   (load_awards.py does it; service_role only)

begin;
set local search_path = public;

-- 1 -------------------------------------------------------------------------------------------------------------
drop function if exists get_covid_fraud_stats();

-- views that read the columns being changed
do $$
declare k "char";
begin
  select relkind into k from pg_class where oid = to_regclass('public.agency_spending_summary');
  if k = 'v' then drop view public.agency_spending_summary;
  elsif k = 'm' then drop materialized view public.agency_spending_summary;
  end if;
end $$;
drop view if exists connection_group_summary;
drop view if exists top_vendors;

-- 2 / 3 ---------------------------------------------------------------------------------------------------------
update awards set competition_status = 'not_competed' where competition_status = 'no_bid';
update awards set flags = array_replace(flags, 'no_bid', 'not_competed') where 'no_bid' = any(flags);
update awards set competition_flags = array_replace(competition_flags, 'no_bid', 'not_competed') where 'no_bid' = any(competition_flags);
alter table awards drop column if exists risk_score;
alter table awards drop column if exists risk_factors;

comment on column awards.competition_status is
  'Display label derived ONLY from the official extent-competed code: not_competed (B, C, G) | open_competition (A, CDO) | limited_competition (D, E, F) | unknown. not_competed is the agency''s own coding, not a finding.';

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'era_snapshots' and column_name = 'flagged_count') then
    alter table era_snapshots drop column flagged_count;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'era_snapshots' and column_name = 'no_bid_count') then
    alter table era_snapshots rename column no_bid_count to not_competed_count;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'era_snapshots' and column_name = 'no_bid_dollars') then
    alter table era_snapshots rename column no_bid_dollars to not_competed_dollars;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'covid_spending_summary' and column_name = 'covid_no_bid_count') then
    alter table covid_spending_summary rename column covid_no_bid_count to covid_not_competed_count;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'covid_spending_summary' and column_name = 'covid_no_bid_dollars') then
    alter table covid_spending_summary rename column covid_no_bid_dollars to covid_not_competed_dollars;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_overruns' and column_name = 'flagged_reason') then
    alter table cost_overruns rename column flagged_reason to listing_reason;
  end if;
end $$;
alter table cost_overruns drop column if exists gao_high_risk;
alter table political_entities drop column if exists risk_score_avg;
alter table tax_expenditures drop column if exists risk_score;
alter table tax_expenditures drop column if exists risk_factors;

-- 4 views ---------------------------------------------------------------------------------------------------------
create view connection_group_summary with (security_invoker = true) as
select
  connection_type,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  count(case when competition_status = 'not_competed' or competition_status = 'sole_source' then 1 end) as non_competitive_count
from awards
where connection_type is not null and connection_type != 'none'
group by connection_type;

create view top_vendors with (security_invoker = true) as
select
  recipient_name,
  recipient_uei,
  connection_type,
  count(*) as total_awards,
  sum(dollar_amount) as total_dollars,
  sum(case when competition_status = 'not_competed' then 1 else 0 end) as not_competed_awards
from awards
where posted_date is not null
group by recipient_name, recipient_uei, connection_type
order by total_dollars desc
limit 100;

-- R6f: monthly_spending_trend is a MATERIALIZED view from 20261012_r6f_counts_and_access.sql on, so a re-run must drop that first
do $$
begin
  if (select relkind from pg_class where oid = to_regclass('public.monthly_spending_trend')) = 'm' then
    drop materialized view public.monthly_spending_trend;
  end if;
end $$;
create or replace view monthly_spending_trend with (security_invoker = true) as
select
  to_char(posted_date, 'YYYY-MM') as month,
  award_category,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  sum(case when connection_type is not null and connection_type != 'none' then dollar_amount else 0 end) as connected_dollars,
  sum(case when competition_status = 'not_competed' or competition_status = 'sole_source' then dollar_amount else 0 end) as non_competitive_dollars
from awards
where posted_date is not null
group by to_char(posted_date, 'YYYY-MM'), award_category
order by month desc;

-- 5 F10: materialized, so an anon read is 51 rows from a tiny relation, whatever the cache holds
create materialized view agency_spending_summary as
select
  awarding_agency,
  awarding_agency_code,
  award_category,
  count(*) as award_count,
  sum(dollar_amount) as total_dollars,
  sum(case when connection_type is not null and connection_type != 'none' then dollar_amount else 0 end) as connected_dollars,
  sum(case when competition_status = 'not_competed' then dollar_amount else 0 end) as not_competed_dollars
from awards
where posted_date is not null
group by awarding_agency, awarding_agency_code, award_category;

create index agency_spending_summary_agency_idx on agency_spending_summary (awarding_agency_code);

comment on materialized view agency_spending_summary is
  'Per agency and award category roll-up of awards. MATERIALIZED (A7b F10: the plain view timed out for anon on a cold cache): run select refresh_agency_spending_summary(); after every awards load. not_competed_dollars = dollars on awards coded not competed (the agency''s own extent-competed code).';

create or replace function refresh_agency_spending_summary()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$ refresh materialized view public.agency_spending_summary; $$;

-- 6 functions -----------------------------------------------------------------------------------------------------
create or replace function get_alert_summary(start_date date default null, end_date date default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_awards',          count(*),
    'total_dollars',         coalesce(sum(dollar_amount), 0),
    'contract_count',        count(*) filter (where award_category = 'contract'),
    'grant_count',           count(*) filter (where award_category = 'grant'),
    'connected_count',       count(*) filter (where connection_type is not null and connection_type != 'none'),
    'connected_dollars',     coalesce(sum(dollar_amount) filter (where connection_type is not null and connection_type != 'none'), 0),
    'not_competed_count',    count(*) filter (where competition_status in ('not_competed', 'sole_source')),
    'not_competed_dollars',  coalesce(sum(dollar_amount) filter (where competition_status in ('not_competed', 'sole_source')), 0)
  ) into result
  from awards
  where (start_date is null or posted_date >= start_date)
    and (end_date is null or posted_date <= end_date);

  return result;
end;
$$;

drop function if exists get_top_agencies(date, date, integer, integer);
drop function if exists get_top_agencies(date, date, integer);
create or replace function get_top_agencies(
  start_date date default null,
  end_date date default null,
  result_limit int default 10
)
returns table (
  agency text,
  agency_code text,
  total bigint,
  connected bigint,
  not_competed bigint,
  award_count bigint
)
language sql
stable
set search_path = public, pg_temp
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
    sum(case when a.competition_status = 'not_competed' then a.dollar_amount else 0 end)::bigint as not_competed,
    count(*)::bigint as award_count
  from awards a
  join canonical c on c.awarding_agency = a.awarding_agency
  where (start_date is null or a.posted_date >= start_date)
    and (end_date is null or a.posted_date <= end_date)
  group by a.awarding_agency, c.canonical_code
  order by total desc
  limit result_limit;
$$;

create or replace function get_era_stats(start_date date, end_date date)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  td bigint := 0;
  cd bigint := 0;
  nd bigint := 0;
  nc int := 0;
  ta int := 0;
  cc int := 0;
  gc int := 0;
begin
  select
    count(*),
    coalesce(sum(dollar_amount), 0),
    coalesce(sum(dollar_amount) filter (where connection_type is not null and connection_type != 'none'), 0),
    coalesce(sum(dollar_amount) filter (where competition_status in ('not_competed', 'sole_source')), 0),
    count(*) filter (where competition_status in ('not_competed', 'sole_source')),
    count(*) filter (where award_category = 'contract'),
    count(*) filter (where award_category = 'grant')
  into ta, td, cd, nd, nc, cc, gc
  from awards
  where posted_date >= start_date
    and posted_date <= end_date;

  result := jsonb_build_object(
    'total_awards', ta,
    'total_dollars', td,
    'connected_dollars', cd,
    'connected_pct', case when td > 0 then round((cd::numeric / td::numeric) * 100, 1) else 0 end,
    'not_competed_count', nc,
    'not_competed_dollars', nd,
    'breakdown', jsonb_build_object('contracts', cc, 'grants', gc)
  );

  return result;
end;
$$;

create or replace function backfill_era_snapshots(era_ranges jsonb)
returns integer
language plpgsql
set search_path = public, pg_temp
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

    insert into era_snapshots (era, total_awards, total_dollars, connected_dollars, not_competed_count, not_competed_dollars, computed_at)
    values (
      era_rec.era,
      (stats->>'total_awards')::int,
      (stats->>'total_dollars')::bigint,
      (stats->>'connected_dollars')::bigint,
      (stats->>'not_competed_count')::int,
      (stats->>'not_competed_dollars')::bigint,
      now()
    )
    on conflict (era) do update set
      total_awards = excluded.total_awards,
      total_dollars = excluded.total_dollars,
      connected_dollars = excluded.connected_dollars,
      not_competed_count = excluded.not_competed_count,
      not_competed_dollars = excluded.not_competed_dollars,
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
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_covid_awards', count(*),
    'total_covid_obligations', coalesce(sum(covid_obligations), 0),
    'total_covid_outlays', coalesce(sum(covid_outlays), 0),
    'covid_not_competed_count', count(*) filter (where 'not_competed' = any(flags) or 'sole_source' = any(flags) or competition_status in ('not_competed', 'sole_source')),
    'covid_not_competed_dollars', coalesce(sum(covid_obligations) filter (where 'not_competed' = any(flags) or 'sole_source' = any(flags) or competition_status in ('not_competed', 'sole_source')), 0),
    'by_agency', (
      select coalesce(jsonb_agg(row_to_json(t) order by total_covid_obligations desc), '[]'::jsonb)
      from (
        select
          awarding_agency as agency,
          count(*) as award_count,
          sum(covid_obligations) as total_covid_obligations,
          count(*) filter (where 'not_competed' = any(flags) or 'sole_source' = any(flags) or competition_status in ('not_competed', 'sole_source')) as not_competed_count,
          coalesce(sum(covid_obligations) filter (where 'not_competed' = any(flags) or 'sole_source' = any(flags) or competition_status in ('not_competed', 'sole_source')), 0) as not_competed_dollars
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
set search_path = public, pg_temp
as $$
  with totals as (
    select
      count(*)::bigint as total_awards,
      count(*) filter (where 'no_compete_high_value' = any(flags))::bigint as by_no_compete_flag,
      count(*) filter (where competition_status in ('not_competed', 'sole_source'))::bigint as non_competitive_from_status,
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

-- grants: the read RPCs stay open to anon / authenticated; the refresh function and the era backfill are service-only
do $$
declare s text;
begin
  for s in select unnest(array[
      'get_alert_summary(date, date)', 'get_top_agencies(date, date, integer)', 'get_era_stats(date, date)',
      'get_covid_stats()', 'get_competition_coverage()'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', s);
    execute format('grant execute on function %s to anon, authenticated, service_role', s);
  end loop;
  for s in select unnest(array['refresh_agency_spending_summary()', 'backfill_era_snapshots(jsonb)'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', s);
    execute format('grant execute on function %s to service_role', s);
  end loop;
end $$;
grant select on agency_spending_summary, connection_group_summary, top_vendors, monthly_spending_trend to anon, authenticated;

-- get_congress_trades_summary: the same body without the flaggedCount key (congress_trades.flags is empty on every row)
create or replace function get_congress_trades_summary(p_window_days int default 180)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
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
grant execute on function get_congress_trades_summary(integer) to anon, authenticated, service_role;

commit;
