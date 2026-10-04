-- R6d (Apex decisions 1 and 2): time-aligned contractor signal + verdict-wording cleanup.
-- Additive / idempotent: every statement can run twice. One transaction; contains NO data.
-- RLS stays on for every table; anon and authenticated can only SELECT (unchanged).
--
-- 1. congress_trades.contract_basis: why has_federal_contract has its value. The awards table only holds awards
--    signed from 2023-10-01, so a trade dated earlier cannot be answered from it: has_federal_contract is NULL
--    (not computed), never false. The constant lives in compute_conflicts.py (AWARDS_COVERAGE_START).
-- 2. Drop the empty table insider_trading_signals (and its policy). Stops with an error, and rolls everything back,
--    if the table has rows. get_analytics_summary was the only database object that read it; it is recreated
--    below with the key insider_signals renamed trade_signals (and total_insider_signals -> total_trade_signals).
-- 3. signal_type comment: describe only the values that exist.

begin;
set local search_path = public;

-- 1. contract_basis ---------------------------------------------------------------------------------------
alter table congress_trades add column if not exists contract_basis text;

comment on column congress_trades.contract_basis is
  'Basis of has_federal_contract. awards_signed_from_2023-10-01 = computed: true when a linked company had an award signed on or before the trade date, false when it had none (the awards table covers awards signed from that date). not_computed_trade_before_2023-10-01 = the trade predates the awards table, which cannot answer: has_federal_contract is NULL. date_not_reliable_<flag> = the transaction date is flagged unreliable: NULL. Written by compute_conflicts.py.';
comment on column congress_trades.has_federal_contract is
  'true = the linked company had an award signed on or before the trade date (see related_contracts); false = it had none, for a trade the awards table can answer; NULL = not computed (contract_basis says why), never read as false.';
comment on column congress_trades.signal_type is
  'routine = the default label the House loader sets (load_bulk_trades.py); NULL = no label (Senate rows). No other value is stored. The conflict signals are conflict_tier, conflict_reasons, committee_conflict and has_federal_contract.';

-- 2. drop insider_trading_signals ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.insider_trading_signals') is not null then
    if exists (select 1 from public.insider_trading_signals) then
      raise exception 'R6d: insider_trading_signals has rows; not dropping it. Stop and report.';
    end if;
    drop policy if exists "public read insider_trading_signals" on public.insider_trading_signals;
    drop table public.insider_trading_signals;
  end if;
end $$;

-- get_analytics_summary read the dropped table. Same shape and attributes, with the renamed keys; the table was empty,
-- so these values are empty / zero exactly as before. Per-trade signals live on congress_trades (conflict_*).
create or replace function public.get_analytics_summary()
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
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
    'trade_signals', '[]'::jsonb,
    'summary', (
      select jsonb_build_object(
        'total_overrun_projects', count(*)::int,
        'total_original_cost', coalesce(sum(original_cost), 0)::bigint,
        'total_final_cost', coalesce(sum(final_cost), 0)::bigint,
        'total_overrun_dollars', coalesce(sum(final_cost - original_cost), 0)::bigint,
        'avg_overrun_pct', coalesce(round(avg(overrun_pct))::int, 0),
        'total_stock_holdings', (select count(*)::int from stock_holdings),
        'total_stock_value_high', coalesce((select sum(estimated_value_high) from stock_holdings), 0)::bigint,
        'total_trade_signals', 0,
        'total_signal_value', 0::bigint,
        'total_contract_value_linked', 0::bigint,
        'high_confidence_signals', 0
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
    'top_signals', '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$function$;

commit;
