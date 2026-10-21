/**
 * D15: the history of how the President's 278-T data was built and fixed, for /president/data-quality. These are figures from
 * the audit and fix records, NOT from the database: the database holds the corrected rows, not a log of what each fix changed.
 * Each entry names the file it comes from; the report's figure table lists them separately from the live figures.
 * Everything the database can tell (row counts, the perpetual count, the 174 not-computed rows, re-read outcomes) is computed
 * live by president-hub-core.ts and is not in this file. Plain TypeScript, no imports (verify-gates reads it).
 */

export const SOURCE_NOTES = {
  r10f: 'r10f-fixes.md (Builder R10f, rebuild/r10 commit 4290ee7, Oct 19, 2026)',
  r10d: 'r10d-verify.md (Builder R10d, Oct 19, 2026)',
  a11: 'audit-2026-10-19-slushfund-a11.md',
  a11b: 'audit-2026-10-19-slushfund-a11b.md',
} as const;

export const AUDITS = [
  { id: 'A11', file: 'audit-2026-10-19-slushfund-a11.md', date: '2026-10-19', what: 'First audit of the President’s 278-T data. 60 randomly chosen rows were compared with the page images; every row matched on date, asset, type, band and owner. It found five problems outside that sample, listed under “What the audits found and what changed”.', verdict: 'Five must-fix items' },
  { id: 'A11b', file: 'audit-2026-10-19-slushfund-a11b.md', date: '2026-10-19', what: 'Re-check of those five items after the fixes: all five hold. It read 4 more pages row by row (132 of 132 rows matched) and checked all 19 report covers in full.', verdict: 'GO' },
] as const;

/** Figures the audit records state and the database cannot show. */
export const HISTORY = {
  /** R10f M1: broker-format bond lines re-read on 400 DPI crops; entries applied (37 broker rows + 2 municipal). */
  bondLineFixes: 39,
  bondLineFixesBroker: 37,
  /** R10f M1: of those, rows whose coupon had lost its leading digit ("0.5375%" for "05.375%"). */
  bondLineCouponFixes: 28,
  /** R10f M2: the Meta line on AC435308 page 3 (#42): first stored as $50,001 - $100,000, the page prints $5,000,001 - $25,000,000. */
  metaLine: { doc: 'AC435308', page: 3, printed: 42, was: '$50,001 - $100,000', now: '$5,000,001 - $25,000,000' },
  /** R10f M2: AC435308 page 3, printed rows #52 to #59, band and type one row off. */
  shiftedRows: { doc: 'AC435308', page: 3, from: 52, to: 59, count: 8 },
  /** R10f M2: bands checked by eye (the 50 largest rows plus rows matching the row above), on this many pages. */
  bandCheckRows: 225,
  bandCheckPages: 42,
  /** R10f M3: rows whose asset class changed. */
  reclassified: 1379,
  /** A11b M2: pages the auditor added beyond R10f's 42, and the lines on them (132 of 132 matched). */
  a11bExtraPages: 4,
  a11bExtraRows: 132,
  /** A11b M2: pages read row by row in all (R10f's 42 plus A11b's 4) out of about 330 table pages in the large reports. */
  pagesReadRowByRow: 46,
  tablePagesApprox: 330,
  /** R10d: override entries applied after the first full load. */
  r10dOverrides: { total: 339, fixed: 260, handOk: 64, inserted: 9, deleted: 5 },
  /** A11: random sample size. */
  a11Sample: 60,
} as const;
