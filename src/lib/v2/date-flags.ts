/**
 * Reader wording for `congress_trades.date_flag` (D6b). One map in one file: every page that shows a
 * trade with a flag (the shared TradesTable, the late-filers board, the /latest feed, the CSV note
 * column) reads it here, so a raw token such as "stale_2y" never reaches a reader.
 *
 * Values come from R6a and R6c:
 *  - stale_2y_corroborated: the trade is more than two years before the report, and the report's own
 *    notification date sits 0-60 days after the trade date, so the dates agree; the delay is computed.
 *  - stale_2y: more than two years before the report, with no notification date close to the trade
 *    (the lag may be real or unverifiable); no delay is computed. A7b F9: never say the dates
 *    disagree (Axne and Williams print a real notification date years after the trade).
 *  - after_filing / future: the trade date in the report is after the report date, or in the future;
 *    no delay is computed.
 * The Auditor confirms the wording before anything is public. Plain TypeScript with no imports, so
 * scripts can load it too.
 */

export const DATE_FLAG_WORDING: Readonly<Record<string, string>> = {
  stale_2y_corroborated: "Reported more than two years after the trade. The report's own dates agree with each other.",
  stale_2y: 'Trade dated more than two years before this report; lateness not computed.',
  after_filing: "The dates as filed look inconsistent: the trade date is later than the report's own filing date. Lateness not computed.",
  future: 'The dates as filed look inconsistent: the trade date is in the future. Lateness not computed.',
};

/** A flag value this map doesn't know yet still renders as a sentence, never as the token. */
export const DATE_FLAG_FALLBACK = "The dates in this report need a second look before we say anything about its timing.";

/**
 * Reader wording for `congress_trades.lateness_basis` (R6e) when stock_act_late is NULL, in A7b's
 * allowed words ("Lateness not computed: ..."). 'computed' has no sentence. These rows are never
 * called punctual or late.
 */
export const LATENESS_BASIS_WORDING: Readonly<Record<string, string>> = {
  below_reporting_threshold: 'Lateness not computed: below the $1,000 reporting threshold.',
  original_filing_unknown: 'Lateness not computed: the first report that listed this trade is not in our records.',
  not_computed_date_stale_2y: 'Lateness not computed: trade dated more than two years before the report.',
  not_computed_date_after_filing: 'Lateness not computed: the dates as filed look inconsistent, with the trade date after the filing date.',
  not_computed_date_future: 'Lateness not computed: the dates as filed look inconsistent, with the trade date in the future.',
};

export const LATENESS_BASIS_FALLBACK = 'Lateness not computed for this trade.';

/** The sentence for a lateness_basis value, or null when lateness was computed (or the value is empty). */
export function latenessNote(basis: string | null | undefined): string | null {
  if (!basis || basis === 'computed') return null;
  return LATENESS_BASIS_WORDING[basis] ?? LATENESS_BASIS_FALLBACK;
}

/** The sentence for a date_flag value, or null when the row has no flag. */
export function dateFlagNote(flag: string | null | undefined): string | null {
  if (!flag) return null;
  return DATE_FLAG_WORDING[flag] ?? DATE_FLAG_FALLBACK;
}
