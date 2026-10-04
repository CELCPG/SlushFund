-- R6e (A7b F2 + F6): lateness basis, the $1,000 reporting-threshold rule, has_federal_contract default.
-- Additive / idempotent: every statement can run twice. One transaction; contains NO data except the backfill below.
-- RLS stays on for every table; anon and authenticated can only SELECT (unchanged).
--
-- 1. congress_trades.lateness_basis: why days_to_file / stock_act_late have their value or are NULL.
--      computed                       days_to_file and stock_act_late are set (days = original filing - transaction)
--      below_reporting_threshold      amount_max <= 1,000: a PTR lists only transactions over $1,000, so the trade
--                                     was never due and cannot be late. stock_act_late NULL; days_to_file is kept for
--                                     information only (A7b F2: 11 Meijer rows were shown as 682-713 days late)
--      original_filing_unknown        the first filing that held the trade is not known (an amendment is the earliest we have)
--      not_computed_date_<flag>       the transaction date as filed is flagged (after_filing | future | stale_2y)
--    The rule lives in src/scripts/trade_fields.py (lateness_detail), shared by both loaders; the CHECK below makes
--    the database refuse a late flag on a row at or under the threshold, whichever loader writes it.
-- 2. has_federal_contract: the column default is NULL (= not computed) instead of false, and the comment says what
--    false does and does not mean (A7b F6).

begin;
set local search_path = public;

alter table congress_trades add column if not exists lateness_basis text;

-- F2: the rule, applied to the rows that exist
update congress_trades set stock_act_late = null
 where amount_max <= 1000 and stock_act_late is not null;

update congress_trades t set lateness_basis = b.v
  from (select id, case
          when date_flag is not null and date_flag <> 'stale_2y_corroborated' then 'not_computed_date_' || date_flag
          when original_filed_date is null then 'original_filing_unknown'
          when amount_max <= 1000 then 'below_reporting_threshold'
          else 'computed' end as v
        from congress_trades) b
 where t.id = b.id and t.lateness_basis is distinct from b.v;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'congress_trades_lateness_basis_valid') then
    alter table congress_trades add constraint congress_trades_lateness_basis_valid
      check (lateness_basis is null
             or lateness_basis in ('computed', 'below_reporting_threshold', 'original_filing_unknown')
             or lateness_basis like 'not_computed_date\_%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'congress_trades_below_threshold_not_late') then
    alter table congress_trades add constraint congress_trades_below_threshold_not_late
      check (amount_max > 1000 or stock_act_late is null);
  end if;
end $$;

comment on column congress_trades.lateness_basis is
  'Why days_to_file / stock_act_late have their value. computed = set from the ORIGINAL filing date. below_reporting_threshold = amount_max <= 1000, so the trade was never reportable and cannot be late (stock_act_late NULL; days_to_file kept for information only). original_filing_unknown = the first filing that held the trade is not known. not_computed_date_after_filing | not_computed_date_future | not_computed_date_stale_2y = the transaction date as filed is flagged (see date_flag); stale_2y means the trade is dated more than two years before the report, lateness not computed. NULL stock_act_late is never "on time".';
comment on column congress_trades.stock_act_late is
  'days_to_file > 45, measured from the original filing. NULL = not computed (read lateness_basis); never "on time". Always NULL when amount_max <= 1000 (below the reporting threshold). Say "filed N days after the trade (the STOCK Act sets 45)", never "violation".';
comment on column congress_trades.days_to_file is
  'original_filed_date - transaction_date in days. NULL = not computed (read lateness_basis). For below_reporting_threshold rows it is kept for information only.';

-- F6
alter table congress_trades alter column has_federal_contract drop default;

comment on column congress_trades.has_federal_contract is
  'Listed-award signal, not "is a federal contractor". true = a company linked to the ticker had at least one award in our listed set signed on or before the trade date (see related_contracts). false = it had none in that set; it does NOT mean the company had no federal contracts: competed awards under $10 million are not in the set (the listed set is contracts not competed of at least $1 million, or any contract of at least $10 million, signed from 2023-10-01). NULL = not computed (contract_basis says why), never read as false. The new-row default is NULL; compute_conflicts.py is the only writer.';

commit;
