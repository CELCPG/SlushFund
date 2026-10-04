/**
 * Corrections log: the data file behind /about/corrections.
 *
 * Rules
 *  - Nothing here renders publicly while its status is 'draft'. /about/corrections shows only
 *    'published' entries. To preview drafts locally, run the server with
 *    SHOW_DRAFT_CORRECTIONS=1 (never set it on a deployed environment).
 *  - To publish an entry: Colin approves the wording, a lawyer reads it, then change its status
 *    to 'published' and set `date` to the publication date. That is the whole flip.
 *  - Newest first on the page; keep entries here in any order, the page sorts by date.
 *  - Wording rule: say what was wrong with the process or the figures, never repeat a withdrawn
 *    claim, never name a person from a withdrawn story.
 *
 * Source for the numbers below: openclaw-shared/projects/slushfund/takedown.md.
 */

export type CorrectionKind = 'withdrawal' | 'story-fix' | 'data-fix';

export interface CorrectionEntry {
  id: string;
  /** ISO date the entry is (or will be) published. */
  date: string;
  kind: CorrectionKind;
  title: string;
  /** One-paragraph summary shown in the list. */
  summary: string;
  /** What changed, as short plain-English points. */
  changes: string[];
  /** Pages the entry applies to, shown as plain paths. */
  affects?: string[];
  status: 'draft' | 'published';
  /** Shown only on a DRAFT entry: what must happen before it can be published. */
  draftNotes?: string[];
}

export const CORRECTIONS: CorrectionEntry[] = [
  {
    id: 'c-2026-10-withdrawn-17',
    date: '2026-10-03',
    kind: 'withdrawal',
    title: '17 stories withdrawn for re-verification (Oct 2026)',
    summary:
      'We withdrew all 17 stories we had published before this rebuild. An audit checked each story’s figures against official public records. It found figures that did not match those records and figures we could not trace to any source. Rather than correct the stories in place, we took them down in full. Each one returns only after every figure has a cited public source and has passed a second check.',
    changes: [
      'All 17 story addresses now answer “withdrawn pending re-verification” instead of showing the story.',
      'We have not republished any part of the withdrawn stories, and none of their claims is repeated on this site.',
      'We also removed older pages whose figures had not been verified, and rebuilt the data pages from official records: House and Senate periodic transaction reports and USAspending.gov.',
      'Going forward, a story is published only with a numbered source for every figure and a “last verified” date, and its corrections appear on this page.',
      'If you were named in one of the withdrawn stories, or you spot an error anywhere on the site, see “Report an error” on the About page.',
    ],
    affects: ['/investigations', '/blog'],
    status: 'draft',
    draftNotes: [
      'Needs Colin’s OK on the wording.',
      'Needs a lawyer read before publishing (growth strategy, legal item 1: the RCFP hotline is the free first stop).',
      'Decide whether to say that some figures came from placeholder data, and whether to tell the people named. This draft does neither.',
      'Set status to ‘published’ and the date to the publication date to turn it on.',
    ],
  },
];

/** Entries the page may show: published ones, plus drafts only when previewing locally. */
export function visibleCorrections(showDrafts = process.env.SHOW_DRAFT_CORRECTIONS === '1'): CorrectionEntry[] {
  return CORRECTIONS.filter((c) => c.status === 'published' || showDrafts).sort((a, b) => b.date.localeCompare(a.date));
}

/** True when at least one entry is public (used by the sitemap and the footer note). */
export function hasPublishedCorrections(): boolean {
  return CORRECTIONS.some((c) => c.status === 'published');
}
