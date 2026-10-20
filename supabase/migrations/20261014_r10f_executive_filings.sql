-- R10f M5 (A11): the reviewing officials' cover-page data of each report, next to the trades.
-- Idempotent; one transaction; contains NO data (src/scripts/load_executive_filings.py loads src/scripts/executive_filings.json).
-- RLS on; anon / authenticated can only SELECT. Run AFTER 20261009_r10_executive_trades.sql (it references officials).
-- Also (R10f M4): documents late_basis = not_required_on_278T on executive_trades. No DDL change for M3 / M4.
begin;
set local search_path = public;

create table if not exists executive_filings (
  id uuid primary key default gen_random_uuid(),
  official_id uuid not null references officials(id),
  source_doc_id text not null,
  file_name text not null,
  disclosure_url text not null,
  oge_posted_date date,
  oge_posted_note text,
  amended_file boolean not null default false,
  transaction_count integer,
  cover_page integer not null default 1,
  filer_signed_date date,
  filer_signed_text text,
  daeo_signed_date date,
  daeo_signed_text text,
  oge_cert_date date,
  oge_cert_text text,
  oge_cert_signer text,
  oge_received_date date,
  oge_received_note text,
  reviewer_comment text,
  reviewer_comment_initials text,
  reviewer_comment_date date,
  reviewer_comment_kind text,
  reviewer_comment_ref_page integer,
  reviewer_comment_ref_line integer,
  amendment_signed_date date,
  amendment_signed_text text,
  amendment_daeo_date date,
  amendment_daeo_text text,
  amendment_oge_cert_date date,
  amendment_oge_cert_text text,
  amendment_note text,
  read_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint executive_filings_doc_key unique (source_doc_id),
  constraint executive_filings_comment_kind_chk check (reviewer_comment_kind is null or reviewer_comment_kind in ('late_fee_note', 'line_identification')),
  constraint executive_filings_comment_chk check ((reviewer_comment is null) = (reviewer_comment_kind is null)),
  constraint executive_filings_cover_chk check (cover_page >= 1)
);
create index if not exists executive_filings_official_idx on executive_filings (official_id, filer_signed_date);

comment on table executive_filings is 'One row per OGE Form 278-T report of the President: what the cover page prints (filer signature date, agency ethics official''s opinion date, OGE certification, OGE RECEIVED stamp) and the Comments-of-Reviewing-Officials box, read by eye (R10f). Joins to executive_trades on source_doc_id (executive_trades.source_doc_id is the same 32-hex UNID).';
comment on column executive_filings.source_doc_id is 'OGE document UNID (the 32-hex id in the PDF URL); equals executive_trades.source_doc_id.';
comment on column executive_filings.filer_signed_date is 'Date the President signed the report (the filer certification). This is executive_trades.filed_date. For the AMENDED file it is the signature of the original report on page 4 (8/12/25); the amendment letter is in amendment_*.';
comment on column executive_filings.daeo_signed_date is 'Date of the agency ethics official''s opinion that the filer is in compliance with applicable laws and regulations (subject to any comments). Every cover carries it; show it next to any reviewer_comment.';
comment on column executive_filings.oge_cert_date is 'Date of the U.S. Office of Government Ethics certification where the cover has one (a handwritten date, or the date of the digital signature stamp when the Date box is blank: see oge_cert_text).';
comment on column executive_filings.oge_received_date is 'OGE RECEIVED stamp as printed. NEVER use it as a filing date: it can be earlier than the signature (9.3.25 report: stamp 8/19/2025, signed Sept 3/25).';
comment on column executive_filings.reviewer_comment is 'The Comments of Reviewing Officials box, VERBATIM including initials and date. Never recast it as a count, a dollar sum or a verdict. late_fee_note = "Filer paid late fee(s)" (5 reports); line_identification = the reviewer says which issuer a printed line is (BCF60D94: page 4, line 77 = Fifth Third Bancorp).';
comment on column executive_filings.reviewer_comment_ref_line is 'For line_identification: the printed line number the comment refers to (executive_trades.row_number_printed) on reviewer_comment_ref_page.';
comment on column executive_filings.oge_posted_date is 'OGE listing date of the file (API docDate). For the AMENDED 08.12.2025 (2) file it is NOT the date of the amendment: see oge_posted_note.';

alter table executive_filings enable row level security;
drop policy if exists "public read executive_filings" on executive_filings;
create policy "public read executive_filings" on executive_filings for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on executive_filings from anon, authenticated;
grant select on executive_filings to anon, authenticated;

-- R10f M4: executive_trades.late_basis documents the new value (no constraint on late_basis exists).
comment on column executive_trades.late_basis is 'Why days_to_file / stock_act_late are or are not computed: computed_278T | date_flag_<flag> | filed_date_unknown | annual_report_part7 (the 45-day 278-T rule is not applied to annual-report lines) | not_required_on_278T (R10f: Treasury bills / notes / bonds and fund, ETF and money-market lines: the 278-T Summary of Contents says such holdings need not be reported, so no gap is computed). NULL gap = not computed, never "on time".';
comment on column executive_trades.instrument_class is 'R10f: stock = common or preferred shares of a company; bond = a coupon, DUE, NTS, BDS, a note or a municipal marker; fund = mutual fund, ETF, money-market fund; option = only a line that says call / put option contracts (none exists: "CALL@MW" and "CALLABLE" are bond features); other = anything else. Never call a bond line "stock".';

commit;
