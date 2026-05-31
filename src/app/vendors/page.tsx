import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VENDORS } from '@/lib/vendors';
import { CONNECTION_LABELS, type ConnectionCategory } from '@/lib/political-entities';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, toneForConnection } from '@/components/ui/Badge';

const OG = `/api/og?title=${encodeURIComponent('Vendor Directory')}&eyebrow=${encodeURIComponent('SlushFund')}&stat=${encodeURIComponent(String(VENDORS.length))}&statLabel=${encodeURIComponent('politically connected vendors')}`;

export const metadata: Metadata = {
  title: 'Vendor Directory — Politically Connected Federal Contractors',
  description: `Browse ${VENDORS.length} federal contractors with documented political connections — Trump family, Elon Musk companies, Trump allies, and major donors. Track their contracts and conflicts on SlushFund.`,
  alternates: { canonical: '/vendors' },
  openGraph: {
    type: 'website',
    url: 'https://slushfund.net/vendors',
    title: 'SlushFund Vendor Directory',
    description: 'Federal contractors with documented political connections. Track their contracts and conflicts.',
    images: [{ url: OG, width: 1200, height: 630, alt: 'SlushFund Vendor Directory' }],
  },
  twitter: { card: 'summary_large_image', title: 'SlushFund Vendor Directory', images: [OG] },
};

// Display order for connection groups.
const GROUP_ORDER: ConnectionCategory[] = ['trump_family', 'elon_musk', 'trump_ally', 'gop_donor', 'lobbyist', 'mar-a-lago', 'none'];

export default function VendorsPage() {
  const byGroup = GROUP_ORDER.map((cat) => ({
    cat,
    label: CONNECTION_LABELS[cat],
    vendors: VENDORS.filter((v) => v.connection_category === cat),
  })).filter((g) => g.vendors.length > 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Programmatic directory"
        title="Vendor Directory"
        description={`${VENDORS.length} federal contractors with documented political connections. Every profile tracks their contracts, no-bid awards, and risk flags — with sources.`}
      />

      <Container className="space-y-10 py-10">
        {byGroup.map((group) => (
          <section key={group.cat}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">{group.label}</h2>
              <Badge tone={toneForConnection(group.cat)}>{group.vendors.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.vendors.map((v) => (
                <Link key={v.slug} href={`/vendor/${v.slug}`} className="group">
                  <Card padding="md" className="h-full transition-colors hover:border-slate-600">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-white group-hover:text-emerald-400">{v.name}</h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-emerald-400" />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{v.description}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </div>
  );
}
