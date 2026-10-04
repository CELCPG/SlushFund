/**
 * Homepage headline and the Members tile's lead number (D8a), in one file so either can change
 * without touching the page. The values are the ones the page carried before D8a, unchanged: Colin has
 * not decided on either yet. Plain TypeScript with no imports, so scripts can load it too.
 */

/** The h1: `lead` + an emphasised `emphasis` + `tail`. */
export const HOME_HEADLINE = {
  lead: 'See where public money goes, and',
  emphasis: 'who’s on both ends',
  tail: ' of it.',
} as const;

/** Which member count leads the Members tile. The other two stay in the tile's note. */
export type MembersTileLead = 'total' | 'inOffice' | 'withTrades';

export const MEMBERS_TILE_LEAD: MembersTileLead = 'total';

export const MEMBERS_TILE_COPY: Record<MembersTileLead, { label: string; caption: string }> = {
  total: { label: 'Members tracked', caption: 'members of Congress who served from 2016 to today' },
  inOffice: { label: 'Members in office', caption: 'members of Congress in office now' },
  withTrades: { label: 'Members with trades', caption: 'members of Congress with disclosed trades on file' },
};
