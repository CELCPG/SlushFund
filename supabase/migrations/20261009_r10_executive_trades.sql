-- R10: the White House's own disclosed trades (OGE Form 278-T, and Part 7 of the annual 278e), next to Congress's.
-- Additive / idempotent: every statement can run twice. One transaction; contains NO data (the loader
-- src/scripts/load_executive_trades.py upserts the officials rows and the trades).
-- RLS on for both tables; anon and authenticated can only SELECT.
--
-- Semantics mirror congress_trades (R6a): rows trace to the filing (disclosure_url + page_number + line_on_page),
-- amounts are the disclosed OGE bands, and dates/lateness are computed or left NULL with a reason.
-- Lossless key: one row per printed transaction line = (source_doc_id, page_number, line_on_page).
-- Nothing is folded: two identical printed lines are two rows.

begin;
set local search_path = public;

-- officials ---------------------------------------------------------------------------------------------------
create table if not exists officials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  office text not null,
  start_date date not null,
  end_date date,
  oge_filer_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint officials_term_key unique (name, office, start_date)
);
comment on table officials is
  'Executive-branch officials whose OGE financial disclosures are loaded (R10: the President and the Vice President, term from 2025-01-20). One row per person, office and term.';
comment on column officials.oge_filer_name is 'Filer name exactly as OGE lists it (the API listing "name"), e.g. "Trump, Donald J".';
comment on column officials.source_url is 'OGE listing the filings come from (official source).';

-- executive_trades --------------------------------------------------------------------------------------------
create table if not exists executive_trades (
  id uuid primary key default gen_random_uuid(),
  official_id uuid not null references officials(id),
  official_name text not null,
  office text not null,
  report_type text not null,
  asset text not null,
  ticker text,
  cusip text,
  instrument_class text not null,
  transaction_type text not null,
  transaction_date date,
  transaction_date_text text not null,
  notification_date date,
  notification_over_30_days boolean,
  filed_date date,
  original_filed_date date,
  oge_received_date date,
  amount_range text not null,
  amount_min bigint,
  amount_max bigint,
  owner text not null default 'Self',
  date_flag text,
  days_to_file integer,
  stock_act_late boolean,
  late_basis text,
  disclosure_url text not null,
  source_doc_id text not null,
  page_number integer not null,
  line_on_page integer not null,
  row_number_printed integer,
  extract_method text not null,
  read_check text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint executive_trades_lossless_key unique (source_doc_id, page_number, line_on_page),
  constraint executive_trades_report_type_chk check (report_type in ('278-T', '278e annual')),
  constraint executive_trades_instrument_class_chk check (instrument_class in ('stock', 'bond', 'fund', 'option', 'other')),
  constraint executive_trades_type_chk check (transaction_type in ('purchase', 'sale', 'exchange', 'other')),
  constraint executive_trades_owner_chk check (owner in ('Self', 'Spouse', 'Joint', 'Child')),
  constraint executive_trades_date_flag_chk check (date_flag is null or date_flag in ('unreadable', 'after_filing', 'future', 'stale_2y', 'stale_2y_corroborated')),
  constraint executive_trades_amount_chk check (amount_min is null or amount_max is null or amount_min <= amount_max),
  constraint executive_trades_late_chk check (stock_act_late is null or days_to_file is not null),
  constraint executive_trades_page_chk check (page_number >= 1 and line_on_page >= 1)
);

create index if not exists executive_trades_official_date_idx on executive_trades (official_id, transaction_date);
create index if not exists executive_trades_ticker_idx on executive_trades (ticker) where ticker is not null;
create index if not exists executive_trades_doc_idx on executive_trades (source_doc_id);

comment on table executive_trades is
  'Transactions the President and Vice President disclosed to OGE (278-T periodic transaction reports; Part 7 of the annual 278e). One row per printed line; every row links to the PDF page it was read from. Loaded by src/scripts/load_executive_trades.py (R10). Read from scanned PDFs by local vision (extract_method); see read_check.';
comment on column executive_trades.asset is 'Asset description exactly as printed on the form (OGE prints no ticker for most bonds).';
comment on column executive_trades.ticker is 'Ticker only where the filing prints one (e.g. "SPY - SPDR S&P 500 ETF"); never inferred.';
comment on column executive_trades.cusip is 'CUSIP only where the filing prints one; never inferred.';
comment on column executive_trades.instrument_class is 'stock / bond / fund / option / other, from the printed description (coupon + maturity = bond; ETF, fund, portfolio = fund). Most of the President''s 278-T lines are municipal and corporate bonds: never call a bond line "stock".';
comment on column executive_trades.transaction_type is 'purchase / sale / exchange as printed (OGE also prints "sale (partial)" -> sale); other = anything else.';
comment on column executive_trades.transaction_date is 'Transaction date as printed, parsed. NULL when it cannot be read (date_flag = unreadable; transaction_date_text keeps what was read).';
comment on column executive_trades.notification_date is 'Date the filer was notified of the transaction. OGE Form 278-T does not print it: NULL for every row loaded so far.';
comment on column executive_trades.notification_over_30_days is 'The 278-T column "Notification Received Over 30 Days Ago" (Yes = true). NULL on annual-report rows (no such column).';
comment on column executive_trades.filed_date is 'Date the filer signed the report at disclosure_url (filer certification date). NULL if not readable.';
comment on column executive_trades.original_filed_date is 'Filing date of the first report that held this transaction (an amended report restates an earlier one). Equal to filed_date until amendments are matched.';
comment on column executive_trades.oge_received_date is 'OGE RECEIVED stamp printed on the report, as printed (it can disagree with the signature date).';
comment on column executive_trades.amount_range is 'Disclosed OGE value band, normalized spacing, e.g. "$1,001 - $15,000" or "Over $50,000,000".';
comment on column executive_trades.amount_min is 'Lower bound of the band in dollars. NULL when the band text is not an OGE band.';
comment on column executive_trades.amount_max is 'Upper bound of the band; NULL for "Over $50,000,000" (open-ended) or an unknown band.';
comment on column executive_trades.owner is 'Self, Spouse, Joint or Child. The 278-T has no owner column: Spouse/Joint/Child only when the line is marked (SP)/(JT)/(DC); otherwise Self.';
comment on column executive_trades.date_flag is 'NULL = dates plausible. unreadable = the date could not be read; after_filing / future / stale_2y as in congress_trades (trade_fields.date_flag). Show no lateness for a flagged row.';
comment on column executive_trades.days_to_file is 'original_filed_date - transaction_date in days. NULL = not computed (late_basis says why).';
comment on column executive_trades.stock_act_late is 'days_to_file > 45 (a 278-T is due within 30 days of notification and no later than 45 days after the transaction). NULL = not computed, never "on time". No verdict wording.';
comment on column executive_trades.late_basis is 'Why days_to_file / stock_act_late are or are not computed: computed_278T | date_flag_<flag> | filed_date_unknown | annual_report_part7 (the 45-day 278-T rule is not applied to annual-report lines).';
comment on column executive_trades.source_doc_id is 'OGE document UNID (the 32-hex id in the PDF URL).';
comment on column executive_trades.page_number is 'PDF page (1-based) the line is printed on.';
comment on column executive_trades.line_on_page is 'Position of the transaction line on that page, top to bottom (1-based).';
comment on column executive_trades.row_number_printed is 'The "#" the form prints for the line, as read (can repeat across pages of one report).';
comment on column executive_trades.extract_method is 'How the line was read, e.g. gemma-r8-d200 = Gemma 4 26B-A4B (local) on 8-row strips of a 200 DPI page image.';
comment on column executive_trades.read_check is 'Cross-check against the PDF''s own OCR text layer: agree = description, date and band all match a text-layer line; differs = a text-layer line matches the description but date or band differ, or the description differs slightly; no_textlayer_line = no text-layer line matched.';

-- RLS: public read, no anon/authenticated writes --------------------------------------------------------------
alter table officials enable row level security;
alter table executive_trades enable row level security;
drop policy if exists "public read officials" on officials;
create policy "public read officials" on officials for select to anon, authenticated using (true);
drop policy if exists "public read executive_trades" on executive_trades;
create policy "public read executive_trades" on executive_trades for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on officials, executive_trades from anon, authenticated;
grant select on officials, executive_trades to anon, authenticated;

commit;
