-- SlushFund — Public Servant Score function update v0.1.1
-- Fix: Pillar 2 (Stocks) and Pillar 3 (Lobbying) now return 0 with has_data=false
-- when the underlying raw tables are empty for a senator, matching Pillars 1, 4, 5.
-- Previous behavior was to assign a default 20, which inflated scores when no data
-- was present — a violation of the honest-zero policy.

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
