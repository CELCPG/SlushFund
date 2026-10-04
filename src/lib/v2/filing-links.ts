/**
 * Which filing a trade row links (A8 N9). A row is dated by its FIRST report, so the main link opens the
 * first report. When a later report restated the row, disclosure_url is that amendment's address and
 * original_disclosure_url the first report's (R6f); the amendment is offered as a second link.
 * Plain function with no imports: TradesTable (client) and the server pages both use it.
 */
export interface FilingLinkFields {
  disclosure_url?: string | null;
  original_disclosure_url?: string | null;
}

export function filingLinks(t: FilingLinkFields): { first: string | null; amendment: string | null } {
  const first = t.original_disclosure_url || t.disclosure_url || null;
  const amendment = t.original_disclosure_url && t.disclosure_url && t.original_disclosure_url !== t.disclosure_url ? t.disclosure_url : null;
  return { first, amendment };
}
