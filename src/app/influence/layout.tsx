import { Metadata } from 'next';
import SchemaMarkup from '@/components/SchemaMarkup';
import { websiteSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Influence — Crypto, Super PACs & Policy | SlushFund',
  description:
    'How money shapes policy: crypto exchanges, investors, and super PACs traced to the bills, votes, and regulators they fund. PAC donations, FEC-verified totals, legislation tracking, and a vote-vs-money legislator scorecard.',
  keywords: [
    'crypto super PAC',
    'Fairshake PAC',
    'crypto policy',
    'FIT21',
    'GENIUS Act',
    'dark money',
    'campaign finance',
    'legislator scorecard',
  ],
  openGraph: {
    title: 'Influence — Crypto, Super PACs & Policy | SlushFund',
    description:
      'Follow the chain: industry money into PACs, PACs into candidates, candidates into legislation, regulators standing down — and who profits.',
    url: 'https://slushfund.net/influence',
    siteName: 'SlushFund',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Influence — Crypto, Super PACs & Policy | SlushFund',
    description:
      'Crypto exchanges, investors, and super PACs traced to the bills and regulators they fund.',
  },
  alternates: { canonical: 'https://slushfund.net/influence' },
};

export default function InfluenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SchemaMarkup schema={websiteSchema} />
      {children}
    </>
  );
}
