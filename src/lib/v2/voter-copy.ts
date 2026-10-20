/**
 * D11: the fixed header text of the voter pages, the same on the index and on every state (G8, G10: no ranking words, no
 * endorsement, no "vote for/against", no race framing). Plain TypeScript with no imports, so scripts/verify-gates.mjs
 * checks the exact sentences.
 */

export const VOTER_TITLE = 'Your members of Congress: the records';

export function voterWhat(moneyOn: boolean): string {
  return `The public records of the people who represent you in Congress today: the stock trades they reported${moneyOn ? ' and the receipts their campaign committees reported to the Federal Election Commission' : ''}. Every member gets the same panels, built from the same filings with the same method, listed alphabetically by last name.`;
}

export const VOTER_SCOPE = 'Current members only: this page does not list every candidate on the ballot.';

export const VOTER_NOT_FINDING = 'These are records the members filed themselves. Nothing on this page is a finding of wrongdoing.';
