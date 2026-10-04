-- R6a: make congress_trades rows safe to publish (A7 audit fixes S1, S2, S3, H2).
-- Additive and idempotent. RLS stays on (this file touches no policy or grant).
--
-- S1  option details       : option_type / strike / expiry
-- S3  lossless key support : lot_count (same-day lots folded into one row)
-- H2  date sanity          : date_flag (the filed value is never "corrected")
-- S2  real lateness        : original_filed_date; days_to_file / stock_act_late become
--                            nullable with no default (NULL = not computed)

alter table congress_trades add column if not exists option_type text;
alter table congress_trades add column if not exists strike numeric;
alter table congress_trades add column if not exists expiry date;
alter table congress_trades add column if not exists lot_count int not null default 1;
alter table congress_trades add column if not exists date_flag text;
alter table congress_trades add column if not exists original_filed_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'congress_trades_option_type_valid') then
    alter table congress_trades add constraint congress_trades_option_type_valid
      check (option_type is null or option_type in ('call', 'put', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'congress_trades_date_flag_valid') then
    alter table congress_trades add constraint congress_trades_date_flag_valid
      check (date_flag is null or date_flag in ('after_filing', 'future', 'stale_2y'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'congress_trades_lot_count_valid') then
    alter table congress_trades add constraint congress_trades_lot_count_valid
      check (lot_count >= 1);
  end if;
end $$;

-- Lateness is computed only when it can be done honestly; NULL means "not computed".
alter table congress_trades alter column days_to_file drop default;
alter table congress_trades alter column days_to_file drop not null;
alter table congress_trades alter column stock_act_late drop default;
alter table congress_trades alter column stock_act_late drop not null;

-- A7: 0 true rows existed, every stock_act_late = false was an unpopulated default.
update congress_trades
   set stock_act_late = null, days_to_file = null
 where stock_act_late is not null or days_to_file is not null;

comment on column congress_trades.option_type is 'call | put | unknown (an option whose details could not be read) | NULL for non-options. Never show an option as a plain buy/sell of the stock.';
comment on column congress_trades.strike is 'Option strike price in dollars, as printed in the filing. NULL when not an option or not printed.';
comment on column congress_trades.expiry is 'Option expiry date, as printed in the filing. NULL when not an option or not printed.';
comment on column congress_trades.lot_count is 'Number of same-day lots of the same instrument and owner folded into this row (1 = not folded). amount_range lists every band.';
comment on column congress_trades.date_flag is 'NULL | after_filing (transaction date after the filing date) | future (transaction date after the load date) | stale_2y (transaction more than 2 years before the filing). The filed dates are kept as filed, never corrected.';
comment on column congress_trades.original_filed_date is 'Filing date of the FIRST version of the report. Differs from filed_date when an amendment replaced the row.';
comment on column congress_trades.days_to_file is 'original_filed_date minus transaction_date, in days. NULL = not computed (date_flag set or original filing date unknown). Not a legal finding.';
comment on column congress_trades.stock_act_late is 'days_to_file > 45. NULL = not computed. Not a legal finding: say "days to file", not "broke the law".';
