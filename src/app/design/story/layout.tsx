import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { designPagesEnabled } from '@/lib/v2/flags';
import { Source_Serif_4 } from 'next/font/google';

// Reading serif for long stories (Direction B's layout). Loaded only for this segment, so the
// rest of the site does not pay for it. Stories that adopt the template reuse this layout.
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

// A9 N1: on production the page answers 404 (page.tsx), so its metadata is the site's 404 metadata (no title, no canonical).
export function generateMetadata(): Metadata {
  if (!designPagesEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: '/design/story',
    title: 'Story template',
    robots: { index: false, follow: false },
  });
}

export default function StoryTemplateLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
