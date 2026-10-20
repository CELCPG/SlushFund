-- R10b: restatement / same-day duplicate / re-read columns on executive_trades.
-- Additive and idempotent. One transaction; no data.
begin;
set local search_path = public;

alter table executive_trades add column if not exists amended_report boolean not null default false;
alter table executive_trades add column if not exists restated boolean;
alter table executive_trades add column if not exists restate_basis text;
alter table executive_trades add column if not exists amendment_pair_doc_id text;
alter table executive_trades add column if not exists restates_original jsonb;
alter table executive_trades add column if not exists duplicate_sources jsonb;
alter table executive_trades add column if not exists reread text;
alter table executive_trades add column if not exists reread_other_asset text;
alter table executive_trades add column if not exists reread_reason text;

alter table executive_trades drop constraint if exists executive_trades_restate_basis_chk;
alter table executive_trades add constraint executive_trades_restate_basis_chk
  check (restate_basis is null or restate_basis in ('exact_match', 'substituted_by_line_number'));
alter table executive_trades drop constraint if exists executive_trades_reread_reason_chk;
alter table executive_trades add constraint executive_trades_reread_reason_chk
  check (reread_reason is null or reread_reason in ('differs', 'dup_neighbor'));
alter table executive_trades drop constraint if exists executive_trades_reread_chk;
alter table executive_trades add constraint executive_trades_reread_chk
  check (reread is null or reread in ('strip_kept', 'row_taken', 'unresolved', 'not_mappable'));

comment on column executive_trades.amended_report is 'true = the line is on an AMENDED report (an amendment to an earlier periodic transaction report): the Exhibit A "in place of line item #N" lines.';
comment on column executive_trades.restated is 'Amendment pairs only. true = this line comes from the AMENDED report and replaces a line of the original report (the original line is not loaded; restates_original keeps what it said). false = a line only in the original report: the amendment did not restate it, so it stays as filed. NULL = the filing is not part of an amendment pair, or the amended line has no original line to replace.';
comment on column executive_trades.restate_basis is 'How a restated line was matched to its original: exact_match = asset, transaction date, type and band all equal (R10b rule); substituted_by_line_number = the amendment says "in place of line item #N" and the same printed #, type and date exist in the original (every such substitution changes the band, so the exact rule cannot match it).';
comment on column executive_trades.amendment_pair_doc_id is 'source_doc_id of the other report in the amendment pair (the original for an amended line, the amending document for an original-only line). Equals source_doc_id when the OGE PDF carries both (the 08.12.2025 AMENDED file embeds the original report).';
comment on column executive_trades.restates_original is 'For restated = true: the original line this one replaces, {page_number, line_on_page, printed_n, asset, amount_range, transaction_date, filed_date}.';
comment on column executive_trades.duplicate_sources is 'Same-day reports ((1)/(2) pairs) that print an identical line (asset, date, type, band): kept once, with every other source recorded here [{disclosure_url, source_doc_id, page_number, line_on_page}].';
comment on column executive_trades.reread is 'Asset-text re-read: NULL = not needed (vision read agrees with the OCR layer, or no OCR line to compare). row_taken = a single-row 300 DPI re-read agreed better with the OCR layer and replaced the strip reading; strip_kept = the strip reading agreed at least as well; unresolved = the two readings differ and the OCR layer cannot decide: the single-row reading is stored and the other asset text kept in reread_other_asset (or the single-row reading was unusable and the strip reading stands); not_mappable = the line could not be tied to one table row.';
comment on column executive_trades.reread_reason is 'Why the line was re-read from a single-row 300 DPI crop: differs = read_check was differs (strip reading vs the OCR layer); dup_neighbor = the line''s asset text is identical to a line within two rows (the strip reading can copy fields between them).';
comment on column executive_trades.reread_other_asset is 'The asset text of the reading that was not taken, when reread is row_taken / strip_kept / unresolved and the readings differed.';

commit;
