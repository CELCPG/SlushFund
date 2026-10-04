import { SHARE_CARDS } from '@/lib/v2/seo';
import { dataCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = SHARE_CARDS.data.alt;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// One share card for the /data family (D8b): /data, /data/trades, /data/contracts, /data/status, /data/late-filers.
export default async function Image() {
  return renderOgCard(await dataCard());
}
