import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';

// D5: the old layout carried a "16 investigations and counting" share card. All stories are
// withdrawn pending re-verification, so the section uses the site-wide card and no stat.
export const metadata: Metadata = pageMetadata({
  path: '/investigations',
  title: 'Investigations',
  description: 'Investigations from SlushFund, published only after every figure is checked against a public source.',
  feeds: [{ url: '/feed.xml', title: 'SlushFund: Investigations' }],
});

export default function InvestigationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
