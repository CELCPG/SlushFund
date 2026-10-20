import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';

/**
 * D9: President Trump's periodic transaction reports (OGE Form 278-T), from executive_trades (R10-R10f).
 * Only office = 'President' and report_type = '278-T' rows: the 10 Vance pilot rows (278e annual, Part 7) are never read
 * here, so they are in no President figure (A11). Amounts stay OGE bands; aggregates are a band range with the method
 * stated (G3). Wording rules: audit-2026-10-19-slushfund-a11.md "Wording rules for the D9 President page".
 */

export interface ExecTrade {
  id: string;
  asset: string;
  instrument_class: string | null;
  transaction_type: string;
  transaction_date: string;
  notification_over_30_days: boolean | null;
  filed_date: string | null;
  original_filed_date: string | null;
  amount_range: string | null;
  amount_min: number | null;
  amount_max: number | null;
  days_to_file: number | null;
  stock_act_late: boolean | null;
  late_basis: string | null;
  disclosure_url: string;
  source_doc_id: string;
  page_number: number | null;
  row_number_printed: number | null;
  restated: boolean | null;
  restates_original: { amount_range?: string } | null;
}

const COLS = 'id, asset, instrument_class, transaction_type, transaction_date, notification_over_30_days, filed_date, original_filed_date, amount_range, amount_min, amount_max, days_to_file, stock_act_late, late_basis, disclosure_url, source_doc_id, page_number, row_number_printed, restated, restates_original';

export interface ExecFiling {
  docId: string;
  url: string;
  /** The OGE file name as posted, e.g. "Donald J. Trump 10.20.2025 278-T (2)". */
  fileName: string;
  /** Date the President signed the report (the first report for an amended file). */
  signed: string | null;
  /** Date of an amendment that restated lines in this report, if any. */
  amendedOn: string | null;
  transactions: number;
  firstTrade: string | null;
  lastTrade: string | null;
  over45: number;
  notComputed: number;
  longestGap: number | null;
}

export interface PresidentData {
  trades: ExecTrade[];
  filings: ExecFiling[];
}

export const getPresidentTrades = memo(async (): Promise<PresidentData | null> => {
  if (!supabase) return null;
  const rows = await readAll<ExecTrade>((from, to) =>
    supabase!
      .from('executive_trades')
      .select(COLS, { count: 'exact' })
      .eq('office', 'President')
      .eq('report_type', '278-T')
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    30_000,
  );
  if (!rows) return null;
  const by = new Map<string, ExecFiling>();
  for (const r of rows) {
    const f = by.get(r.source_doc_id) ?? {
      docId: r.source_doc_id,
      url: r.disclosure_url,
      fileName: fileNameOf(r.disclosure_url),
      signed: null, amendedOn: null, transactions: 0, firstTrade: null, lastTrade: null, over45: 0, notComputed: 0, longestGap: null,
    };
    const signed = r.original_filed_date ?? r.filed_date;
    if (signed && (!f.signed || signed < f.signed)) f.signed = signed;
    if (r.restated && r.filed_date && r.filed_date !== signed) f.amendedOn = r.filed_date;
    f.transactions += 1;
    if (!f.firstTrade || r.transaction_date < f.firstTrade) f.firstTrade = r.transaction_date;
    if (!f.lastTrade || r.transaction_date > f.lastTrade) f.lastTrade = r.transaction_date;
    if (r.stock_act_late === true) f.over45 += 1;
    if (r.stock_act_late == null) f.notComputed += 1;
    if (r.days_to_file != null && (f.longestGap == null || r.days_to_file > f.longestGap)) f.longestGap = r.days_to_file;
    by.set(r.source_doc_id, f);
  }
  const filings = [...by.values()].sort((a, b) => (a.signed ?? '').localeCompare(b.signed ?? '') || a.fileName.localeCompare(b.fileName));
  return { trades: rows, filings };
});

function fileNameOf(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop() ?? '').replace(/\.pdf$/i, '');
  } catch {
    return url;
  }
}

/**
 * The reviewer's cover notes (A11 M5) live in executive_filings, whose migration is pending Apex. 'missing' while the
 * table does not exist: the page then shows nothing about fees or the compliance opinion.
 */
export interface ExecFilingNote {
  source_doc_id: string;
  [k: string]: unknown;
}
export const getExecutiveFilings = memo(async (): Promise<{ state: 'missing' | 'error' } | { state: 'ok'; rows: ExecFilingNote[] }> => {
  if (!supabase) return { state: 'error' };
  const { data, error } = await supabase.from('executive_filings').select('*');
  if (error) return error.code === 'PGRST205' || error.code === '42P01' ? { state: 'missing' } : { state: 'error' };
  return { state: 'ok', rows: (data ?? []) as ExecFilingNote[] };
});

export const CLASS_LABEL: Record<string, string> = { stock: 'Stock', bond: 'Bond', fund: 'Fund' };
export const NOT_REQUIRED_SENTENCE =
  'Not computed: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.';
export const FORM_RULE_SENTENCE =
  'The form asks for each transaction to be reported within 30 days of the filer learning of it, and no later than 45 days after it.';
export const DAYS_METHOD_SENTENCE =
  'We count calendar days and do not adjust for weekends or holidays. Filing extensions, if any were granted, are kept in the report file and are not shown on the posted report.';
