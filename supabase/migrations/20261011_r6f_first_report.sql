-- R6f (A7c G1): store each row's FIRST report, not only its date.
-- Additive / idempotent: every statement can run twice. One transaction; contains NO data (the loaders fill it:
-- load_bulk_trades.py from its PTR cache, load_senate_trades.py from its checkpoints). RLS stays on; anon can only SELECT.
--
-- congress_trades.source_doc_id / disclosure_url name the filing a row is STORED under: when a later filing restates a
-- transaction, the later filing wins (so the row carries the corrected owner, band and amounts). original_filed_date has
-- always been the date of the earliest filing that held the transaction, but the document itself was not kept, so a
-- row restated by a later filing showed one filing's date next to another filing's link, and any "number of reports"
-- built on source_doc_id counted restatements as reports (A7c: Moskowitz 1 vs 2, Fallon 4 vs 3, Newman 3 vs 2,
-- Moulton 2 vs 1, Allen 6 vs 6 or 7).
--
-- The CHECK constraints, member_conflict_scores and the other R6f objects are in 20261012_r6f_counts_and_access.sql, which
-- must run AFTER the loaders have backfilled these columns.

begin;
set local search_path = public;

alter table congress_trades add column if not exists original_source_doc_id text;
alter table congress_trades add column if not exists original_disclosure_url text;
alter table congress_trades add column if not exists original_source_basis text;

comment on column congress_trades.original_source_doc_id is
  'Document id of the FIRST report that held this transaction: the House Clerk DocID or the Senate eFD report id of the earliest filing (filing date, then DocID) that listed it. Equals source_doc_id when this row''s own filing is the first report. NULL together with original_filed_date and original_disclosure_url when the first report cannot be identified (original_source_basis says why). Count reports with count(distinct original_source_doc_id), never source_doc_id.';
comment on column congress_trades.original_disclosure_url is
  'Link to the first report (original_source_doc_id). disclosure_url is the filing the row is stored under, which can be a later filing that restates it.';
comment on column congress_trades.original_source_basis is
  'first_report_this_filing = the filing in source_doc_id is the first report; first_report_earlier_filing = a later filing restates this transaction and original_source_doc_id is the earlier first report; first_report_not_identified = the earliest filing seen is itself an amendment and the original is not in the index or cache (original_filed_date, original_source_doc_id and original_disclosure_url are all NULL).';

create index if not exists congress_trades_late_first_report_idx
  on congress_trades (member_name, original_source_doc_id) where stock_act_late;

commit;
