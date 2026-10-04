-- R6b (2026-10-03): make company_tickers date-aware and instrument-aware (audit A7 fixes T1-T3).
-- Apply AFTER 20261005_r7_company_tickers.sql. Re-runnable: `add column if not exists`,
-- guarded constraints, `create or replace view`; one transaction; contains NO data.
--
-- Why: a link "contractor X is listed company Y, ticker T" is only true while (a) T is an ordinary
-- ownership line of Y (not a note, ETN or warrant) and (b) the contractor was owned by Y, and Y was
-- listed, on the day that counts (the member's trade date, or the award's signed date).
--
-- instrument_class   what the ticker is: common | adr | preferred | note | etn | warrant | unit | other
--                    NULL = not classified yet; award_tickers hides NULL rows.
-- valid_from/valid_to  first/last day the link is true (NULL = open bound). Both come from the
--                    registrant's listing dates and, for a subsidiary, its acquisition/divestiture date.
-- window_status      same_entity = the recipient is the registrant itself (or a long-held unit of it)
--                                  and the registrant was listed the whole FY2021-26 window (valid_from
--                                  and valid_to are the listing dates, NULL when listed throughout);
--                    checked     = the dates were read from a cited SEC filing (window_source);
--                    unchecked   = ownership dates not verified: do not publish a dated claim.
-- window_source      URL of the SEC EDGAR filing that proves the date (NULL for same_entity rows
--                    unless a listing date is set, then the SEC filing/record that proves it).
-- window_checked_at  when a person or script last verified the window.

begin;
set local search_path = public;

alter table company_tickers add column if not exists instrument_class text;
alter table company_tickers add column if not exists valid_from date;
alter table company_tickers add column if not exists valid_to date;
alter table company_tickers add column if not exists window_status text;
alter table company_tickers add column if not exists window_source text;
alter table company_tickers add column if not exists window_checked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_tickers_instrument_class_check') then
    alter table company_tickers add constraint company_tickers_instrument_class_check
      check (instrument_class is null or instrument_class in
        ('common', 'adr', 'preferred', 'note', 'etn', 'warrant', 'unit', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_tickers_window_status_check') then
    alter table company_tickers add constraint company_tickers_window_status_check
      check (window_status is null or window_status in ('same_entity', 'checked', 'unchecked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_tickers_window_order_check') then
    alter table company_tickers add constraint company_tickers_window_order_check
      check (valid_from is null or valid_to is null or valid_from <= valid_to);
  end if;
end $$;

comment on column company_tickers.instrument_class is 'What the ticker is: common | adr | preferred | note | etn | warrant | unit | other. NULL = unclassified (hidden from award_tickers). Only common/adr/preferred count as "traded the company"; preferred must be labelled "preferred shares".';
comment on column company_tickers.valid_from is 'First day this contractor-to-ticker link is true (listing date of the registrant, or acquisition date of the subsidiary, whichever is later). NULL = open (true since before 2020-10-01).';
comment on column company_tickers.valid_to is 'Last day the link is true (delisting, merger or divestiture). NULL = still true.';
comment on column company_tickers.window_status is 'same_entity | checked | unchecked. unchecked = subsidiary ownership dates not verified; do not publish a dated claim from it.';
comment on column company_tickers.window_source is 'URL of the SEC EDGAR filing (8-K Item 2.01 / 10-K / 10-Q / Form 3 / 10-12B / submissions record) that proves valid_from / valid_to.';
comment on column company_tickers.window_checked_at is 'When window_status/valid_from/valid_to were last verified.';

create index if not exists company_tickers_instrument_class_idx on company_tickers (instrument_class);

-- award -> public company join. security_invoker: the caller's RLS applies to both tables, so anon
-- sees confirmed links only. Since R6b: only ordinary ownership lines (common / adr / preferred), and
-- only when the award's date signed falls inside the link's [valid_from, valid_to] (NULL = open).
-- window_status is exposed: callers decide how to treat 'unchecked' (see r6b-tickers.md).
-- Adding columns to the view's select list requires drop + create when the old column order differs;
-- the new columns are appended, so create or replace is enough.
create or replace view award_tickers with (security_invoker = true) as
select a.id as award_id,
       a.fiscal_year,
       a.recipient_name,
       a.recipient_uei,
       a.recipient_parent_name,
       a.recipient_parent_uei,
       a.obligated_amount,
       a.extent_competed_code,
       a.competition_status,
       c.id as company_ticker_id,
       c.cik,
       c.ticker,
       c.sec_name,
       c.status as link_status,
       c.match_method,
       c.entity_level,
       c.evidence_url,
       c.instrument_class,
       c.window_status,
       c.valid_from,
       c.valid_to,
       a.date_signed
from awards a
join company_tickers c
  on c.recipient_parent_uei = coalesce(a.recipient_parent_uei, a.recipient_uei)
 and (c.recipient_uei is null or c.recipient_uei = a.recipient_uei)
where c.instrument_class in ('common', 'adr', 'preferred')
  and (c.valid_from is null or a.date_signed >= c.valid_from)
  and (c.valid_to is null or a.date_signed <= c.valid_to);

revoke all on award_tickers from anon, authenticated;
grant select on award_tickers to anon, authenticated;

commit;
