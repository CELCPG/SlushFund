import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { VENDORS, getVendorBySlug } from '@/lib/vendors';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, toneForConnection } from '@/components/ui/Badge';
import { VendorContracts } from './VendorContracts';

const SITE = 'https://slushfund.net';

// Pre-render every curated vendor at build time for SEO.
export function generateStaticParams() {
  return VENDORS.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = getVendorBySlug(slug);
  if (!vendor) return { title: 'Vendor not found' };

  const title = `${vendor.name}. Federal Contracts & Political Connections`;
  const description = `${vendor.description} Track ${vendor.name}'s federal contracts, no-bid awards, and risk flags on SlushFund.`;
  const og = `/api/og?title=${encodeURIComponent(vendor.name)}&eyebrow=${encodeURIComponent(vendor.connectionLabel)}&stat=${encodeURIComponent('Federal')}&statLabel=${encodeURIComponent('contracts & connections')}`;

  return {
    title,
    description,
    alternates: { canonical: `/vendor/${vendor.slug}` },
    openGraph: {
      type: 'website',
      url: `${SITE}/vendor/${vendor.slug}`,
      title,
      description,
      images: [{ url: og, width: 1200, height: 630, alt: vendor.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
  };
}

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = getVendorBySlug(slug);
  if (!vendor) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vendor.name,
    alternateName: vendor.aliases,
    description: vendor.description,
    url: `${SITE}/vendor/${vendor.slug}`,
    sameAs: vendor.sources,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        eyebrow="Vendor profile"
        title={vendor.name}
        description={vendor.description}
        actions={<Badge tone={toneForConnection(vendor.connection_category)}>{vendor.connectionLabel}</Badge>}
      />

      <Container className="space-y-8 py-8">
        <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All vendors
        </Link>

        <VendorContracts
          searchTerm={vendor.name}
          aliases={vendor.aliases}
          connectionCategory={vendor.connection_category}
        />

        {vendor.aliases.length > 0 && (
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Also known as:</span> {vendor.aliases.join(', ')}
          </div>
        )}

        {vendor.sources.length > 0 && (
          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Sources</div>
            <ul className="space-y-1">
              {vendor.sources.map((s) => (
                <li key={s}>
                  <a href={s} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </div>
  );
}
