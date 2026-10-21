import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import { GRAPHICS_PATH, graphicEnabled, infographicsEnabled } from '@/lib/v2/flags';
import { GRAPHICS } from '@/lib/v2/graphics-meta';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';

// D20 index of the four graphics. Behind infographicsEnabled() (SHOW_INFOGRAPHICS); lists only the graphics whose own feature is public.

export function generateMetadata(): Metadata {
  if (!infographicsEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: GRAPHICS_PATH,
    title: 'Graphics',
    description: 'One graphic per story, built from the public records: each shows its source, the date the figures were retrieved and its address.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

export default function GraphicsIndex() {
  if (!infographicsEnabled()) notFound();
  const live = GRAPHICS.filter((g) => graphicEnabled(g.slug));
  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">SlushFund</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Graphics</h1>
        <p className="mt-3 max-w-[860px] text-[16px] text-on-deep max-md:text-[15px]">
          One graphic per story, made to be shared. Every figure is read from the records when the page loads, and each graphic carries its source, the date the figures were retrieved and its slushfund.net address, so a screenshot keeps its provenance.
        </p>
      </PageBand>
      <Wrap className="pb-12 pt-8">
        {live.length === 0 ? (
          <EmptyState title="No graphics are public yet">Each graphic opens once the records it draws on are published.</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            {live.map((g, i) => (
              <li key={g.slug}>
                <Card className="h-full">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Graphic {i + 1}</p>
                  <h2 className="mt-1 font-display text-[26px] font-extrabold leading-[1.1]">
                    <Link href={`${GRAPHICS_PATH}/${g.slug}`} className="hover:underline">{g.title}</Link>
                  </h2>
                  <p className="mt-2 text-[15px] text-muted">{g.blurb}</p>
                  <p className="mt-4 text-[14.5px]"><Link href={`${GRAPHICS_PATH}/${g.slug}`} className="font-semibold text-trades-ink hover:underline">Open the graphic</Link></p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Wrap>
    </div>
  );
}
