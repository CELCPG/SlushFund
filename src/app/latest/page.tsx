import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClasses } from '@/components/ui/Button';
import { Rss } from 'lucide-react';
import NewsletterSignup from '@/components/NewsletterSignup';
import { LatestFeed } from './LatestFeed';

const OG = `/api/og?title=${encodeURIComponent('Latest activity: new contracts and congressional trades')}&eyebrow=${encodeURIComponent('Latest')}`;

export const metadata: Metadata = {
  title: 'Latest. New Flagged Contracts & Congressional Trades',
  description:
    'The newest high-risk federal contracts and notable congressional stock trades, updated continuously. Track the money as it moves.',
  alternates: {
    canonical: '/latest',
    types: { 'application/rss+xml': [{ url: '/latest.xml', title: 'SlushFund. Latest Activity' }] },
  },
  openGraph: {
    type: 'website',
    url: 'https://slushfund.net/latest',
    title: 'SlushFund. Latest Activity',
    description: 'The newest high-risk federal contracts and notable congressional stock trades.',
    images: [{ url: OG, width: 1200, height: 630, alt: 'SlushFund Latest Activity' }],
  },
  twitter: { card: 'summary_large_image', title: 'SlushFund. Latest Activity', images: [OG] },
};

export default function LatestPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Latest"
        title="Latest activity"
        description="The newest high-risk federal contracts and notable congressional trades, merged newest-first, from public filings."
        actions={
          <a href="/latest.xml" className={buttonClasses('secondary', 'sm')} target="_blank" rel="noopener noreferrer">
            <Rss className="h-4 w-4" /> RSS
          </a>
        }
      />

      <Container className="space-y-8 py-8">
        <LatestFeed />

        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-red-950/30 via-slate-900 to-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">Get this in your inbox</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            The Slush Report sends the week&apos;s most suspicious contracts and trades straight to you. Free, no spam.
          </p>
          <div className="mt-4">
            <NewsletterSignup source="latest" variant="inline" />
          </div>
        </div>
      </Container>
    </div>
  );
}
