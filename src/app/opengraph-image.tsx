import { SHARE_CARDS } from '@/lib/v2/seo';
import { HOME_HEADLINE_TEXT } from '@/lib/v2/home-copy';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = SHARE_CARDS.site.alt;
export const size = OG_SIZE;
export const contentType = 'image/png';
// The card carries a live count, so it is regenerated hourly instead of frozen at build time.
export const revalidate = 3600;

// Share card for / (D6a), inherited by pages without their own card. It draws the trade count only
// with its source and as-of date; if the count did not load, the card has no figure at all.
export default async function Image() {
  const title = HOME_HEADLINE_TEXT;
  const [house, senate] = await getDatasetStatuses(['house_trades', 'senate_trades']);
  const ok = [house, senate].every((s) => (s.state === 'fresh' || s.state === 'stale') && s.rowCount != null);
  if (!ok) return renderOgCard({ title, eyebrow: 'Follow the public money' });
  const asOf = [house.lastUpdated, senate.lastUpdated].filter((x): x is string => !!x).sort()[0];
  return renderOgCard({
    title,
    eyebrow: 'Stock trades, from the filings',
    type: 'trades',
    stat: fmtCount(house.rowCount! + senate.rowCount!) ?? undefined,
    statLabel: 'trades disclosed by members of Congress',
    source: 'House Clerk + Senate eFD',
    asOf: asOf ? (fmtDate(asOf) ?? undefined) : undefined,
  });
}
