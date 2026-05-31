import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { LobbyingView } from './LobbyingView';
import byIssue from '@/data/lobbying/lda_by_issue.json';

const OG = `/api/og?title=${encodeURIComponent('Federal Lobbying')}&eyebrow=${encodeURIComponent('Influence')}&stat=${encodeURIComponent('LDA')}&statLabel=${encodeURIComponent('disclosure filings, who pays whom')}`;

export const metadata: Metadata = {
  title: 'Federal Lobbying — Who Pays to Influence Congress',
  description:
    'Federal lobbying spend from official Senate LDA disclosure filings — top clients, registrants, and issue areas. Follow the influence money.',
  alternates: { canonical: '/lobbying' },
  openGraph: {
    type: 'website',
    url: 'https://slushfund.net/lobbying',
    title: 'Federal Lobbying — SlushFund',
    description: 'Who pays to influence Congress, from official Senate LDA disclosure filings.',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Federal Lobbying — SlushFund' }],
  },
  twitter: { card: 'summary_large_image', title: 'Federal Lobbying — SlushFund', images: [OG] },
};

export default function LobbyingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Influence"
        title="Federal Lobbying"
        description={`Who pays to influence Congress — from official Senate Lobbying Disclosure Act filings. Cycle ${byIssue.cycle}.`}
      />
      <Container className="py-8">
        <LobbyingView />
      </Container>
    </div>
  );
}
