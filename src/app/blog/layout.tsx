import { Metadata } from 'next';
import SchemaMarkup from '@/components/SchemaMarkup';
import { websiteSchema } from '@/lib/schema';

const OG = `/api/og?title=${encodeURIComponent('Investigations')}&eyebrow=${encodeURIComponent('SlushFund')}&stat=${encodeURIComponent('16')}&statLabel=${encodeURIComponent('investigations and counting')}`;

export const metadata: Metadata = {
  title: 'Blog & Investigations — SlushFund',
  description:
    'Original reporting on federal spending, congressional stock trading, and political money flows. No agenda except the truth.',
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'SlushFund — Investigations' }] },
  },
  openGraph: {
    type: 'website',
    url: 'https://slushfund.net/blog',
    title: 'SlushFund Investigations',
    description: 'Original reporting on federal spending, congressional stock trading, and political money flows.',
    images: [{ url: OG, width: 1200, height: 630, alt: 'SlushFund Investigations' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SlushFund Investigations',
    description: 'Original reporting on federal spending, congressional stock trading, and political money flows.',
    images: [OG],
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SchemaMarkup schema={websiteSchema} />
      {children}
    </>
  );
}