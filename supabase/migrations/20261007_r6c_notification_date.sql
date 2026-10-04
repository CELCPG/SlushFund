-- R6c step 1 (Apex decision 1): corroborate stale_2y rows with the filing's own notification date.
-- Additive and idempotent. RLS and policies are untouched.
--
-- A House PTR prints a "notification date" on every transaction line (the date the filer was told of the
-- trade). When a transaction is more than 2 years older than its filing but the filing's own notification
-- date is 0-60 days after the transaction date, the two dates agree: the filing is genuinely years late, not
-- a typo. Those rows get date_flag = 'stale_2y_corroborated' and real days_to_file / stock_act_late. Rows
-- whose notification date is far from the transaction date (or missing: the Senate prints none) keep
-- 'stale_2y' and NULL lateness. The rule lives in src/scripts/trade_fields.py (date_flag).
--
-- notification_date is captured only for the filings that hold stale_2y rows (R6c re-read those 17); it is NULL
-- = "not captured" everywhere else, not "no notification date".

begin;
set local search_path = public;

alter table congress_trades add column if not exists notification_date date;

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'congress_trades_date_flag_valid'
                and conrelid = 'public.congress_trades'::regclass
                and pg_get_constraintdef(oid) not like '%stale_2y_corroborated%') then
    alter table congress_trades drop constraint congress_trades_date_flag_valid;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'congress_trades_date_flag_valid'
                    and conrelid = 'public.congress_trades'::regclass) then
    alter table congress_trades add constraint congress_trades_date_flag_valid
      check (date_flag is null or date_flag in ('after_filing', 'future', 'stale_2y_corroborated', 'stale_2y'));
  end if;
end $$;

comment on column congress_trades.notification_date is 'House PTR only: the notification date printed on the filing line (the date the filer was told of the trade). Captured only for the filings holding stale_2y rows; NULL = not captured. Never a legal finding.';
comment on column congress_trades.date_flag is 'NULL | after_filing (transaction date after the filing date) | future (transaction date after the load date) | stale_2y_corroborated (transaction more than 2 years before the filing, but the filing''s own notification date is 0-60 days after it, so the dates agree: a genuinely late filing; lateness is computed) | stale_2y (more than 2 years before the filing and not corroborated: possible typo; lateness NULL). The filed dates are kept as filed, never corrected.';

commit;
