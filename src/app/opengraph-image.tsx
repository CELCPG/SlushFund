import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = 'SlushFund: see where public money goes, and who’s on both ends of it.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return renderOgCard({
    title: 'See where public money goes, and who’s on both ends of it.',
    eyebrow: 'Follow the public money',
  });
}
