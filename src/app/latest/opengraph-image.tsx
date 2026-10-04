import { latestCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = 'SlushFund latest: new congressional trade reports and contract awards, newest first.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// Share card for /latest (D8b): the 30-day count of filed trades, with source and the newest filing date.
export default async function Image() {
  return renderOgCard(await latestCard());
}
