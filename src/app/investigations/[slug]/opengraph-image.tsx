import { notFound } from 'next/navigation';
import { investigationsV2Enabled } from '@/lib/v2/flags';
import { OG_SIZE, renderOgCard } from '@/lib/v2/og';
import { STORIES, storyBySlug } from '@/lib/v2/story-figures';

export const alt = 'SlushFund investigation';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

// D12 share card: the headline only. No figure and no date on the card (G2: never two dated events side by side).
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const story = storyBySlug((await params).slug);
  if (!story || !investigationsV2Enabled()) notFound();
  return renderOgCard({ title: story.headline, eyebrow: 'Investigation', type: 'contracts' });
}
