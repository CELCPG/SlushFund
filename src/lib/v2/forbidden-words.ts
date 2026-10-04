/**
 * A7b's forbidden list ("What a page may claim", audit-2026-10-04-slushfund-a7b.md), as patterns for
 * the wording gate in scripts/verify-gates.mjs (D8a). The gate fetches every sitemap URL plus the
 * dynamic samples, strips tags and fails on any match, case-insensitive. A phrase is forbidden even
 * in a negation ("not a clean record"), so pages say what the data supports instead.
 * Plain TypeScript with no imports, so scripts can load it too.
 */

export interface ForbiddenPhrase {
  /** RegExp source, matched with the `gi` flags. */
  re: string;
  /** Which part of A7b's list it comes from. */
  from: 'late filers' | 'signals' | 'contractor';
}

export const FORBIDDEN_PHRASES: readonly ForbiddenPhrase[] = [
  // Late-filers board
  { re: String.raw`\bbroke the law\b`, from: 'late filers' },
  { re: String.raw`\bviolat(?:e|ed|es|ing|ion|ions)\b`, from: 'late filers' },
  { re: String.raw`\billegal(?:ly)?\b`, from: 'late filers' },
  { re: String.raw`\bhid\b`, from: 'late filers' },
  { re: String.raw`\bconceal(?:ed|ing|s)?\b`, from: 'late filers' },
  { re: String.raw`\bfailed to disclose\b`, from: 'late filers' },
  { re: String.raw`\bcaught\b`, from: 'late filers' },
  { re: String.raw`\bfined\b`, from: 'late filers' },
  { re: String.raw`\bpenalt(?:y|ies)\b`, from: 'late filers' },
  { re: String.raw`\b[\d,]+\s+late filings?\b`, from: 'late filers' },
  { re: String.raw`\bno late filings?\b`, from: 'late filers' },
  { re: String.raw`\bon[- ]time\b`, from: 'late filers' },
  { re: String.raw`\bnot late\b`, from: 'late filers' },
  { re: String.raw`\bdates?\b[^.]{0,30}\bdisagree\b`, from: 'late filers' },
  { re: String.raw`\bmost late filers?\b`, from: 'late filers' },
  // Conflict tiers and the committee signal
  { re: String.raw`\bconflicts? of interest\b`, from: 'signals' },
  { re: String.raw`\bconflicted\b`, from: 'signals' },
  { re: String.raw`\bsevere\b`, from: 'signals' },
  { re: String.raw`\bcorrupt(?:ion|ed)?\b`, from: 'signals' },
  { re: String.raw`\binsider trading\b`, from: 'signals' },
  { re: String.raw`\binside information\b`, from: 'signals' },
  { re: String.raw`\bsuspicious\b`, from: 'signals' },
  { re: String.raw`\bprofited from\b`, from: 'signals' },
  { re: String.raw`\bself-dealing\b`, from: 'signals' },
  { re: String.raw`\bjurisdiction over\b`, from: 'signals' },
  { re: String.raw`\boversaw\b`, from: 'signals' },
  { re: String.raw`\bno conflict\b`, from: 'signals' },
  // "clean" as a verdict ("a clean record", "is clean"), not inside a name as filed ("Clean Energy Fuels Corp.").
  { re: String.raw`\bclean (?:record|bill|slate|hands)\b|\b(?:is|are|was|were|looks?|came back) clean\b`, from: 'signals' },
  // Contractor signal
  { re: String.raw`\bheld \$[\d.,]+\s*\w*\s+in federal contracts\b`, from: 'contractor' },
  { re: String.raw`\breceiving \$[\d.,]+\s*\w*\s+from the government\b`, from: 'contractor' },
  { re: String.raw`\bnot a federal contractor\b`, from: 'contractor' },
  { re: String.raw`\bno federal contracts?\b`, from: 'contractor' },
  { re: String.raw`\bfederal contract: no\b`, from: 'contractor' },
  { re: String.raw`\bno[- ]bid\b`, from: 'contractor' },
  { re: String.raw`\bawarded \$[\d.,]+\s*\w*\s+in FY`, from: 'contractor' },
  { re: String.raw`\bFY spending\b`, from: 'contractor' },
  { re: String.raw`\bsuspicious vendors?\b`, from: 'contractor' },
  { re: String.raw`\bflagged contracts?\b`, from: 'contractor' },
  { re: String.raw`\bhigh[- ]risk\b`, from: 'contractor' },
  { re: String.raw`\brisk scores?\b`, from: 'contractor' },
  { re: String.raw`\bfraud(?:ulent)?\b`, from: 'contractor' },
  { re: String.raw`\binflated\b`, from: 'contractor' },
  { re: String.raw`\boverpa(?:y|id|yment|yments)\b`, from: 'contractor' },
];

/**
 * Verbatim source text that may contain a listed word: agency, recipient or program names as the
 * government prints them (R6e's scan found these). A hit inside one of these strings passes. Besides
 * this list, a hit that is all capitals inside a run of all-capital words (a recipient name as
 * USAspending prints it, e.g. "LEXISNEXIS RISK SOLUTIONS") also passes, and the gate reports it.
 */
export const ALLOWED_VERBATIM: readonly string[] = [
  'LEXISNEXIS RISK SOLUTIONS',
  'COUNTER INSIDER THREAT PROGRAM',
  'Severely Disabled',
];
