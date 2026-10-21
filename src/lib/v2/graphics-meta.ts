import type { DatasetKey } from '@/lib/v2/datasets';
import type { GraphicSlug } from '@/lib/v2/flags';

/** Titles and one-line descriptions of the four D20 graphics (no figures: those are computed from the database). */
export interface GraphicMeta {
  slug: GraphicSlug;
  /** Page heading. */
  title: string;
  /** Index card and meta description; contains no figure. */
  blurb: string;
  datasets: DatasetKey[];
}

export const GRAPHICS: GraphicMeta[] = [
  {
    slug: 'grading-congress',
    title: 'The report card of Congress',
    blurb: 'Every sitting member of Congress as one tile, colored by Stock Trading Grade.',
    datasets: ['house_trades', 'senate_trades', 'members'],
  },
  {
    slug: 'where-the-money-comes-from',
    title: 'Who funds Congress',
    blurb: 'Campaign receipts of members of Congress in the 2025–26 FEC cycle, by source group.',
    datasets: ['campaign'],
  },
  {
    slug: 'trading-while-disclosing',
    title: 'How fast do they report?',
    blurb: 'Days from a congressional stock trade to its report, with the 30-day and 45-day marks.',
    datasets: ['house_trades', 'senate_trades'],
  },
  {
    slug: 'the-presidents-trades',
    title: 'The President’s securities transactions',
    blurb: 'President Trump’s periodic transaction reports on a date axis, sized by the transactions in each.',
    datasets: [],
  },
];

export const graphicBySlug = (slug: string): GraphicMeta | undefined => GRAPHICS.find((g) => g.slug === slug);
