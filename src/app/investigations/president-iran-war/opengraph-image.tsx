import { notFound } from 'next/navigation';
import { iranWarStoryLive } from '@/lib/v2/flags';
import { getIranWar } from '@/lib/v2/iran-war';
import { fmtInt } from '@/lib/v2/iran-war-core';
import { DRAFT_UNTIL_AW1, IRAN_WAR_HEADLINE } from '@/lib/v2/iran-war-copy';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = "The President's securities transactions during the Iran war";
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// W2 share card (G2): the headline, one neutral figure with its source, and the site name. Never an event next to a transaction.
export default async function Image() {
  if (!iranWarStoryLive(DRAFT_UNTIL_AW1)) notFound();
  const f = await getIranWar();
  const n = f?.president.windows.P2.all.n;
  return renderOgCard({
    title: IRAN_WAR_HEADLINE,
    eyebrow: 'Investigation',
    type: 'trades',
    typeLabel: 'Securities transactions',
    ...(n !== undefined
      ? { stat: fmtInt(n), statLabel: 'securities transactions, Feb 28 to Mar 31, 2026', source: 'OGE Form 278-T reports', asOf: 'Jul 31, 2026' }
      : {}),
  });
}
