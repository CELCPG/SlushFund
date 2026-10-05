-- F2 (cold read): one cheap read for the trades source bar. Idempotent: every statement can run twice. One transaction;
-- contains NO data and changes no table. Needs no loader step: it is a plain view, so it can never be stale.
--
-- Why: the source bar on /about/methodology/trades (and every page that shows the House or Senate trades dataset) used to
-- send 7 requests per dataset (5 exact counts / ordered reads that each scanned the 27 MB congress_trades heap, ~20 ms warm,
-- 110 ms the first time), so 14 parallel requests and 10 full scans per render. On a fresh deployment the build's first
-- render met a cold backend: in a timing run, 3 of the 7 requests of one burst were refused with HTTP 522 after 19.6 s while
-- the same requests took 100-500 ms a minute later. One failed request marks the whole bar "unavailable", and ISR kept that
-- page for its 60 s failure window. The bar now reads this view: one request, one scan, and the same figures as before.
begin;
set local search_path = public;

create or replace view trade_source_status with (security_invoker = true) as
select
  source_system,
  count(*)                                                              as row_count,
  min(filed_date)                                                       as oldest_filed,
  max(filed_date)                                                       as newest_filed,
  max(updated_at)                                                       as newest_updated,
  count(*) filter (where date_flag is not null)                         as flagged,
  count(*) filter (where original_filed_date is null)                   as no_first_report,
  count(*) filter (where lateness_basis = 'below_reporting_threshold')  as below_threshold
from congress_trades
group by source_system;

comment on view trade_source_status is
  'F2: one row per source_system with the figures the trades source bar shows (row count, filed-date range, newest update, three gap counts). Plain view, always current.';

grant select on trade_source_status to anon, authenticated;

commit;
