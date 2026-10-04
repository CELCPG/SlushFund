import { companyCard } from '@/lib/v2/og-figures';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';

export const alt = 'A company on SlushFund: federal contract awards from USAspending, with the source and date.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

// Share card for /companies/[slug] (D8b): the company name and the page's first contracts figure, with source and as-of date.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return renderOgCard(await companyCard((await params).slug));
}
