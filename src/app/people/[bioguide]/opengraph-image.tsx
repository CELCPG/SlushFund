import { personCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = 'A member of Congress on SlushFund: stock trades on file, with the filing source and date.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// Share card for /people/[bioguide] (D8b): name, chamber and state, and the trade count with its source and as-of date.
export default async function Image({ params }: { params: Promise<{ bioguide: string }> }) {
  return renderOgCard(await personCard((await params).bioguide));
}
