import type { Metadata } from 'next';
import { Heart, ShieldCheck, Database, Search, ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { buttonClasses } from '@/components/ui/Button';
import NewsletterSignup from '@/components/NewsletterSignup';
import { ONE_TIME_TIERS, MONTHLY_TIERS, tierHref, type DonationTier } from '@/lib/support';

const SUPPORT_OG = '/opengraph-image'; // D8d (A8 L1): /api/og is gone; gated page, fixed site card

export const metadata: Metadata = {
  title: 'Support',
  description:
    'SlushFund is free and reader-funded. Chip in once or become a monthly member to keep federal spending, congressional trades, and PAC money searchable and accountable.',
  alternates: { canonical: '/support' },
  openGraph: {
    type: 'website',
    url: 'https://slushfund.net/support',
    title: 'Support SlushFund',
    description: 'Free and reader-funded. Help keep federal spending and congressional trades accountable.',
    images: [{ url: SUPPORT_OG, width: 1200, height: 630, alt: 'Support SlushFund' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support SlushFund',
    description: 'Free and reader-funded. Help keep federal spending and congressional trades accountable.',
    images: [SUPPORT_OG],
  },
};

const WHAT_YOUR_MONEY_DOES = [
  {
    Icon: Database,
    title: 'Keeps the data flowing',
    body: 'Nightly syncs from USAspending, House & Senate disclosures, FEC, and OpenSecrets plus the servers that make 16k+ contracts and 25k+ trades searchable.',
  },
  {
    Icon: Search,
    title: 'Funds new investigations',
    body: 'Every dollar buys time to chase the next no-bid contract, dark-money PAC, or conflicted trade and to build the tools that surface them.',
  },
  {
    Icon: ShieldCheck,
    title: 'Keeps us independent',
    body: 'No ads, no paywall, no corporate owner. Reader funding is what keeps SlushFund accountable to you instead of advertisers.',
  },
];

function TierGrid({ tiers }: { tiers: DonationTier[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiers.map((tier) => (
        <Card key={tier.id} highlight={tier.featured} padding="lg" className="flex flex-col items-center text-center">
          <div className="font-mono text-3xl font-black text-white">{tier.amount}</div>
          <div className="mt-1 text-sm text-slate-400">{tier.blurb}</div>
          <a
            href={tierHref(tier)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses(tier.featured ? 'primary' : 'secondary', 'md', 'mt-4 w-full')}
          >
            {tier.featured && <Heart className="h-4 w-4" />}
            Give {tier.amount}
          </a>
        </Card>
      ))}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Reader-funded accountability"
        title="Keep the money trackable."
        description="SlushFund is free for everyone reporters, researchers, and citizens. We don't run ads or sell data. We follow the money, and readers like you fund the work."
      />

      <Container className="space-y-12 py-12">
        {/* Monthly membership */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Become a member</h2>
            <p className="mt-1 text-sm text-slate-400">
              Recurring support is what keeps the lights on. Cancel anytime every tier gets the same full access.
            </p>
          </div>
          <TierGrid tiers={MONTHLY_TIERS} />
        </section>

        {/* One-time */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Or give once</h2>
            <p className="mt-1 text-sm text-slate-400">Not ready to commit? A one-time tip helps just as much.</p>
          </div>
          <TierGrid tiers={ONE_TIME_TIERS} />
        </section>

        {/* What your money does */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Where it goes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {WHAT_YOUR_MONEY_DOES.map(({ Icon, title, body }) => (
              <Card key={title} padding="lg">
                <Icon className="h-5 w-5 text-slush-red" />
                <h3 className="mt-3 font-semibold text-slate-100">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            SlushFund is an independent project, not a registered 501(c)(3) contributions support the work but are
            not tax-deductible. Payments are processed securely by Stripe.
          </p>
        </section>

        {/* Free alternative newsletter */}
        <section>
          <Card padding="lg" className="bg-gradient-to-br from-red-950/30 via-slate-900 to-slate-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Can&apos;t give? Spread the signal.</h2>
                <p className="mt-1 max-w-xl text-sm text-slate-400">
                  Subscribing to The Slush Report and sharing an investigation costs nothing and helps just as much.
                </p>
              </div>
              <a href="/blog" className={buttonClasses('ghost', 'md', 'shrink-0')}>
                Read investigations <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-5 border-t border-slate-800 pt-5">
              <NewsletterSignup source="support" variant="inline" />
            </div>
          </Card>
        </section>
      </Container>
    </div>
  );
}
