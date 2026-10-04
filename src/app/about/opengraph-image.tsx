import { SHARE_CARDS } from '@/lib/v2/seo';
import { aboutCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = SHARE_CARDS.about.alt;
export const size = OG_SIZE;
export const contentType = 'image/png';

// One share card for /about and everything under it, methodology included (D8b). No figure: the page is about method.
export default async function Image() {
  return renderOgCard(aboutCard());
}
