-- Sprint 6: Congress trade summary SQL function
-- Replaces 3 paginated PostgREST queries + JS aggregation with a single
-- RPC call. The route was paginating through all windowed trades (up to
-- 2,000+ rows) and doing groupBy/sum/count in JS.
--
-- Returns 4 result sets in one call:
--   - summary: scalar totals (total, volume, buy/sell, flagged, date range)
--   - top_members: leaderboard by estimated_volume
--   - top_stocks: leaderboard by estimated_volume
--   - sector_data: volume grouped by sector
--   - party_breakdown: buy/sell/volume per party
--
-- Plus the lifetime/windowed counts. Caller uses them as-is.

create or replace function get_congress_trades_summary(
  p_window_days int default 180
)
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
        'dateRange', jsonb_build_object(
          'earliest', min(transaction_date),
          'latest', max(transaction_date)
        )
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
    -- Note: sectorData is computed in the route because it requires the
    -- getSector() mapping from lib/sector-map which is JS-only.
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function get_congress_trades_summary(int) to anon, authenticated;
