-- Sprint 6: Analytics summary SQL function
-- Replaces 3 parallel PostgREST queries + JS-side aggregation in
-- /api/analytics with a single RPC call. Returns the same shape
-- the JS computeAnalyticsSummary() produces.

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
    'insider_signals', coalesce((
      select jsonb_agg(row_to_json(i) order by i.estimated_value desc)
      from insider_trading_signals i
    ), '[]'::jsonb),
    'summary', (
      select jsonb_build_object(
        'total_overrun_projects', count(*)::int,
        'total_original_cost', coalesce(sum(original_cost), 0)::bigint,
        'total_final_cost', coalesce(sum(final_cost), 0)::bigint,
        'total_overrun_dollars', coalesce(sum(final_cost - original_cost), 0)::bigint,
        'avg_overrun_pct', coalesce(round(avg(overrun_pct))::int, 0),
        'total_stock_holdings', (select count(*)::int from stock_holdings),
        'total_stock_value_high', coalesce((select sum(estimated_value_high) from stock_holdings), 0)::bigint,
        'total_insider_signals', (select count(*)::int from insider_trading_signals),
        'total_signal_value', coalesce((select sum(estimated_value) from insider_trading_signals), 0)::bigint,
        'total_contract_value_linked', coalesce((
          select sum(related_contract_amount) from insider_trading_signals
          where confidence = 'high'
        ), 0)::bigint,
        'high_confidence_signals', (select count(*)::int from insider_trading_signals where confidence = 'high')
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
    'top_signals', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select * from insider_trading_signals
        where confidence = 'high'
        order by estimated_value desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function get_analytics_summary() to anon, authenticated;
