/**
 * Homepage headline and the Members tile's lead number (D8a), in one file so either can change
 * without touching the page. Both are Colin’s choice (HQ A-089, 10/4): the headline, and the Members tile led by
 * the members with trades on file (the full roster is the small line). Plain TypeScript with no imports, so scripts
 * can load it too. The share card (app/opengraph-image.tsx) and its alt text (seo.ts) read HOME_HEADLINE_TEXT.
 */

/** The h1: `lead` + an emphasised `emphasis` + `tail`. */
export const HOME_HEADLINE = {
  lead: 'See where public money goes, and',
  emphasis: 'who trades around it',
  tail: '.',
} as const;

/** The headline as one sentence, for the share card and its alt text. */
export const HOME_HEADLINE_TEXT = `${HOME_HEADLINE.lead} ${HOME_HEADLINE.emphasis}${HOME_HEADLINE.tail}`;

/** Which member count leads the Members tile. The other two stay in the tile's note. */
export type MembersTileLead = 'total' | 'inOffice' | 'withTrades';

export const MEMBERS_TILE_LEAD: MembersTileLead = 'withTrades';

export const MEMBERS_TILE_COPY: Record<MembersTileLead, { label: string; caption: string }> = {
  total: { label: 'Members tracked', caption: 'members of Congress who served from 2016 to today' },
  inOffice: { label: 'Members in office', caption: 'members of Congress in office now' },
  withTrades: { label: 'Members with trades', caption: 'members with trades on file' },
};
