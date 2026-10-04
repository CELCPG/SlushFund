/**
 * Reader wording for `congress_trades.date_flag` (D6b). One map in one file: every page that shows a
 * trade with a flag (the shared TradesTable, the late-filers board, the /latest feed, the CSV note
 * column) reads it here, so a raw token such as "stale_2y" never reaches a reader.
 *
 * Values come from R6a and R6c:
 *  - stale_2y_corroborated: the trade is more than two years before the report, and the report's own
 *    notification date sits 0-60 days after the trade date, so the dates agree; the delay is computed.
 *  - stale_2y: more than two years before the report, and the report's own dates disagree (or the
 *    report prints no notification date); no delay is computed.
 *  - after_filing / future: the trade date in the report is after the report date, or in the future;
 *    no delay is computed.
 * The Auditor confirms the wording before anything is public. Plain TypeScript with no imports, so
 * scripts can load it too.
 */

export const DATE_FLAG_WORDING: Readonly<Record<string, string>> = {
  stale_2y_corroborated: "Reported more than two years after the trade. The report's own dates agree with each other.",
  stale_2y: "The report's own dates disagree, so we don't compute a delay.",
  after_filing: "The trade date in the report is later than the report's own filing date, so we don't compute a delay.",
  future: "The trade date in the report is in the future, so we don't compute a delay.",
};

/** A flag value this map doesn't know yet still renders as a sentence, never as the token. */
export const DATE_FLAG_FALLBACK = "The dates in this report need a second look before we say anything about its timing.";

/** The sentence for a date_flag value, or null when the row has no flag. */
export function dateFlagNote(flag: string | null | undefined): string | null {
  if (!flag) return null;
  return DATE_FLAG_WORDING[flag] ?? DATE_FLAG_FALLBACK;
}
