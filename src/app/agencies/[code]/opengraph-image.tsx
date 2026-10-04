import { agencyCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = 'A federal agency on SlushFund: the share of its contract dollars coded not competed, from USAspending.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// Share card for /agencies/[code] (D8b): the agency name and its latest not-competed share, with source and as-of date.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  return renderOgCard(await agencyCard((await params).code));
}
