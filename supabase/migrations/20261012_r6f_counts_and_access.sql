-- R6f (A7c G1, G3, G4, G5): first-report counting, the legacy contracts RPC, the off-by-one summary, the one-off 500s.
-- Idempotent: every statement can run twice. One transaction; contains NO data. Run AFTER 20261011_r6f_first_report.sql and
-- AFTER the loaders have backfilled original_source_doc_id (the CHECK below refuses a half-filled table).
-- RLS stays on for every table; anon can only SELECT (tested: r6f-evidence/anon-rls-test.txt).
--
-- 1. G1  congress_trades_first_report_valid: the three first-report columns agree with each other and with original_filed_date,
--        and a late row always has a first report.
-- 2. G1  member_conflict_scores.late_report_count = count(distinct original_source_doc_id) over the late rows: the number of
--        FIRST reports, not of filings the rows are stored under.
-- 3. G5  member_conflict_scores and monthly_spending_trend are MATERIALIZED (as agency_spending_summary was in R6e, F10).
--        A7c saw each return one HTTP 500 during heavy paging. Both views aggregated a whole table on every call
--        (24,845 and 37,677 rows, 50-500 ms alone) and anon has a 3 s statement_timeout, so a loaded instance tipped them
--        over it. A read is now a few dozen rows from a tiny relation. Refresh after every load:
--        select refresh_member_conflict_scores();  select refresh_monthly_spending_trend();   (service_role only;
--        compute_conflicts.py and load_awards.py do it).
-- 4. G3  get_trade_related_contracts(jsonb) is no longer executable by anon / authenticated (service_role only).
-- 5. G4  get_congress_trades_summary: totalTrades counts every row (24,845), and futureDatedTrades says how many of them
--        are left out of the windowed figures. It used to count only rows dated on or before today, which silently left out
--        the one row whose transaction date as filed is in the future (Steve Cohen SONY 2026-12-26, filed 2026-02-09).

begin;
set local search_path = public;

-- 1 -------------------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.congress_trades'::regclass and conname = 'congress_trades_first_report_valid') then
    alter table congress_trades add constraint congress_trades_first_report_valid check (
      original_source_basis in ('first_report_this_filing', 'first_report_earlier_filing', 'first_report_not_identified')
      and (original_source_doc_id is null) = (original_disclosure_url is null)
      and (original_source_doc_id is null) = (original_filed_date is null)
      and (original_source_basis = 'first_report_not_identified') = (original_source_doc_id is null)
      and (original_source_basis <> 'first_report_this_filing' or original_source_doc_id = source_doc_id)
      and (original_source_basis <> 'first_report_earlier_filing' or original_source_doc_id <> source_doc_id)
      and (stock_act_late is distinct from true or original_source_doc_id is not null)
    );
  end if;
end $$;

-- 2 + 3: member_conflict_scores ---------------------------------------------------------------------------------------
do $$
declare k "char";
begin
  select relkind into k from pg_class where oid = to_regclass('public.member_conflict_scores');
  if k = 'v' then drop view public.member_conflict_scores;
  elsif k = 'm' then drop materialized view public.member_conflict_scores;
  end if;
  select relkind into k from pg_class where oid = to_regclass('public.monthly_spending_trend');
  if k = 'v' then drop view public.monthly_spending_trend;
  elsif k = 'm' then drop materialized view public.monthly_spending_trend;
  end if;
end $$;

create materialized view member_conflict_scores as
select
  ct.member_name,
  coalesce(max(nullif(ct.member_party, 'Unknown')), 'Unknown')   as member_party,
  coalesce(max(nullif(ct.member_chamber, 'Unknown')), 'Unknown') as member_chamber,
  coalesce(max(nullif(ct.member_state, 'Unknown')), 'Unknown')   as member_state,
  count(*)                                                        as total_trades,
  count(*) filter (where ct.conflict_score > 0)                   as signal_trades,
  count(*) filter (where ct.stock_act_late)                       as late_transaction_count,
  count(distinct ct.original_source_doc_id) filter (where ct.stock_act_late) as late_report_count,
  count(*) filter (where ct.committee_conflict)                   as committee_conflicts,
  count(*) filter (where ct.has_federal_contract)                 as contractor_trades,
  count(*) filter (where ct.conflict_tier in ('score_45_69', 'score_70_plus')) as high_signal_trades,
  coalesce(sum(ct.amount_max), 0)::bigint                         as estimated_volume,
  coalesce(max(ct.conflict_score), 0)                             as peak_conflict_score,
  coalesce(round(avg(ct.conflict_score), 1), 0)                   as avg_conflict_score
from congress_trades ct
group by ct.member_name;

create unique index member_conflict_scores_name_idx on member_conflict_scores (member_name);

revoke all on member_conflict_scores from public, anon, authenticated;
grant select on member_conflict_scores to anon, authenticated;

comment on materialized view member_conflict_scores is
  'Per-member roll-up of the conflict-engine columns on congress_trades. MATERIALIZED (A7c G5: the plain view hit the 3 s anon statement timeout under load): run select refresh_member_conflict_scores(); after every trades load or compute_conflicts.py run. late_report_count = number of FIRST reports (distinct original_source_doc_id) that held a transaction filed over 45 days after the trade date, never the number of filings the rows are stored under. Rank late filers by late_report_count or days, never by late_transaction_count: one report can hold hundreds of transactions (Armstrong: 701 transactions, 1 report). signal_trades = trades with conflict_score > 0 (any signal, size and lateness included, not a count of conflicts); high_signal_trades = trades with score >= 45. A score is a prompt to look closer, not a finding. NULL signals are not counted.';

create or replace function refresh_member_conflict_scores()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$ refresh materialized view public.member_conflict_scores; $$;

-- 3: monthly_spending_trend (same select as before) ------------------------------------------------------------------
create materialized view monthly_spending_trend as
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

create index monthly_spending_trend_month_idx on monthly_spending_trend (month desc);

revoke all on monthly_spending_trend from public, anon, authenticated;
grant select on monthly_spending_trend to anon, authenticated;

comment on materialized view monthly_spending_trend is
  'Awards per posting month and category. MATERIALIZED (A7c G5: the plain view aggregated all awards on every call and hit the 3 s anon statement timeout under load): run select refresh_monthly_spending_trend(); after every awards load. non_competitive_dollars = dollars on awards coded not competed (or the FPDS only-one-source code).';

create or replace function refresh_monthly_spending_trend()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$ refresh materialized view public.monthly_spending_trend; $$;

do $$
declare s text;
begin
  for s in select unnest(array['refresh_member_conflict_scores()', 'refresh_monthly_spending_trend()'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', s);
    execute format('grant execute on function %s to service_role', s);
  end loop;
end $$;

-- 4 G3 ------------------------------------------------------------------------------------------------------------
revoke all on function get_trade_related_contracts(jsonb) from public, anon, authenticated;
grant execute on function get_trade_related_contracts(jsonb) to service_role;
comment on function get_trade_related_contracts(jsonb) is
  'LEGACY, not for pages. Matches awards by the first two words of the company name and returns awards up to 60 days AFTER the trade (award_id null), which contradicts the rule that a linked award is signed on or before the trade. The only caller is the gated legacy route app/api/congress/trades/route.ts (service role). A7c G3: anon and authenticated can no longer execute it; use congress_trades.related_contracts (compute_conflicts.py) instead.';

-- 5 G4 ------------------------------------------------------------------------------------------------------------
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
        'totalTrades', (select count(*) from congress_trades),
        'futureDatedTrades', (select count(*) from congress_trades where transaction_date > v_today),
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

comment on function get_congress_trades_summary(integer) is
  'Summary of congress_trades for the last p_window_days days. summary.totalTrades counts EVERY row; summary.futureDatedTrades = rows whose transaction date as filed is after today (left out of the windowed figures, topMembers, topStocks and partyBreakdown).';

commit;
