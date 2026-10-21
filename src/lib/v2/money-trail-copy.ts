/**
 * D21: fixed text of the "Follow the money" graphic. Plain TypeScript with no imports, so scripts/verify-gates.mjs checks the
 * exact sentences. The caption prints under every instance (member page and the compact voter-page variant).
 */

export const TRAIL_CAPTION =
  'Money in and disclosed trades shown side by side from public records. Nothing here shows a payment to or from any company, or any coordination. Filings list assets, not reasons.';

export const TRAIL_TITLE = 'Follow the money';

/** Printed on the right panel: ribbon widths are counts, never dollars. */
export const TRAIL_COUNTS_LINE = 'Trade ribbons are counts of transactions, not dollars: trade amounts are filed as ranges and are never added up.';

export const TRAIL_NO_TRADES = 'No individual transactions disclosed in the window';