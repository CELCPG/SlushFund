/**
 * D15 HARD RULE (A11 / A11b): every row /president/largest shows was compared with its OGE page image before the flag flips.
 * This file is that comparison, as data: each entry is the line as read BY EYE on a 200 DPI render of the cached OGE PDF
 * (SlushFund-oge-cache\pdf), on 2026-10-20 by the D15 builder: the printed # , the asset text as printed, the type, the date,
 * the notification answer and the amount band all matched the stored row. The page marks a row "checked" only when the live
 * row still equals this snapshot; any live row at the top band that is not here (or that differs) is shown as
 * "not yet compared with its page" and verify-gates fails until it is re-checked. Plain TypeScript, no imports (verify-gates reads it).
 * Pages read: 2BF91F89 p26, 405E4EC4 p112, AC435308 p3, p6, p40, E590116F p33, F9CA13B9 p33 (all 12 rows at $5M or more).
 */

/** Rows whose lowest band amount is at least this are listed (the "$5,000,001 - $25,000,000" band). */
export const LARGEST_FLOOR = 5_000_000;
export const LARGEST_CHECKED_ON = '2026-10-20';

export interface VerifiedLine {
  doc: string;
  page: number;
  printed: number;
  /** Description as printed on the page image. */
  asset: string;
  type: string;
  date: string;
  band: string;
  notified: boolean;
}

export const VERIFIED_LARGEST: VerifiedLine[] = [
  { doc: '2BF91F890F718ACB85258E5B002DE16B', page: 26, printed: 808, asset: 'VANGUARD DIVIDEND APPRECIATION INDEX FUND ETF SHARES', type: 'sale', date: '2026-06-22', band: '$5,000,001 - $25,000,000', notified: false },
  { doc: '405E4EC4E27BE8D185258DF7002DD1C0', page: 112, printed: 3638, asset: 'VANGUARD DIVIDEND APPRECIATION ETF', type: 'sale', date: '2026-01-12', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: '405E4EC4E27BE8D185258DF7002DD1C0', page: 112, printed: 3639, asset: 'Meta Platforms, Inc', type: 'sale', date: '2026-02-10', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: '405E4EC4E27BE8D185258DF7002DD1C0', page: 112, printed: 3640, asset: 'AMAZON COM INC', type: 'sale', date: '2026-02-10', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: '405E4EC4E27BE8D185258DF7002DD1C0', page: 112, printed: 3641, asset: 'MICROSOFT CORP COM', type: 'sale', date: '2026-02-10', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: 'AC43530823BD60D485258E27002DDEF7', page: 3, printed: 42, asset: 'Meta Platforms, Inc', type: 'purchase', date: '2026-04-17', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: 'AC43530823BD60D485258E27002DDEF7', page: 3, printed: 43, asset: 'MICROSOFT CORP COM', type: 'purchase', date: '2026-04-17', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: 'AC43530823BD60D485258E27002DDEF7', page: 6, printed: 139, asset: 'AMAZON COM INC', type: 'purchase', date: '2026-04-17', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: 'AC43530823BD60D485258E27002DDEF7', page: 40, printed: 1271, asset: 'US TREASUR NT 4% DUE 07/31/30', type: 'sale', date: '2026-04-07', band: '$5,000,001 - $25,000,000', notified: true },
  { doc: 'E590116FC9631E9885258E7A002DE209', page: 33, printed: 1036, asset: 'MICROSOFT CORP', type: 'sale', date: '2026-07-20', band: '$5,000,001 - $25,000,000', notified: false },
  { doc: 'E590116FC9631E9885258E7A002DE209', page: 33, printed: 1039, asset: 'AMAZON INC', type: 'sale', date: '2026-07-20', band: '$5,000,001 - $25,000,000', notified: false },
  { doc: 'F9CA13B970439E8F85258E27002DDF15', page: 33, printed: 1026, asset: 'VANGUARD DIVIDEND APPRECIATION INDEX FUND ETF SHARES', type: 'purchase', date: '2026-05-21', band: '$5,000,001 - $25,000,000', notified: false },
];

export interface LiveLine {
  source_doc_id: string;
  page_number: number | null;
  row_number_printed: number | null;
  asset: string;
  transaction_type: string;
  transaction_date: string;
  amount_range: string | null;
  notification_over_30_days: boolean | null;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();

/** True when the live row equals the line compared with its page image. */
export function isCheckedAgainstPage(t: LiveLine): boolean {
  return VERIFIED_LARGEST.some(
    (v) =>
      v.doc === t.source_doc_id && v.page === t.page_number && v.printed === t.row_number_printed && norm(v.asset) === norm(t.asset) &&
      v.type === t.transaction_type && v.date === t.transaction_date && v.band === t.amount_range && v.notified === t.notification_over_30_days,
  );
}
