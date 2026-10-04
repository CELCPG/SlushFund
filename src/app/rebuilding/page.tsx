import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import SimplePage from '@/components/v2/SimplePage';
import { matchGatedPage } from '@/lib/v2/redirect-map';

// Served by src/proxy.ts in place of every legacy page that still carried unaudited figures
// (GATED_PAGES in src/lib/v2/redirect-map.ts). HTTP 200, noindex. The old page code never runs.
export const metadata: Metadata = pageMetadata({
  path: null, // served under many addresses (rewrite): no canonical
  title: 'This page is being rebuilt',
  robots: { index: false, follow: false },
});

const ELSEWHERE = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search members, companies and stocks' },
  { href: '/data', label: 'The data, with its sources' },
  { href: '/data/status', label: 'Data status' },
];

export default async function RebuildingPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  // Look the label up in the gate list; never print the raw query value.
  const gated = typeof from === 'string' ? matchGatedPage(from) : undefined;
  const label = gated?.label;

  return (
    <SimplePage
      eyebrow="Being rebuilt"
      title={label ? `${label} is being rebuilt` : 'This page is being rebuilt'}
      dek="We took the old version down. Its figures have not been checked against the official filings, so we are not showing them."
    >
      <section className="max-w-[720px] rounded-card bg-card p-6 shadow-card sm:p-8">
        <p className="text-[16px] leading-relaxed">
          SlushFund is being rebuilt on one rule: every number links to the official record it came from, with the date it was last checked.
          {gated?.home ? <> The new home for this page will be: <b>{gated.home}</b>.</> : null}
        </p>
        <h2 className="mt-5 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">In the meantime</h2>
        <ul className="mt-2 grid gap-2">
          {ELSEWHERE.map((l) => (
            <li key={l.href}><Link href={l.href} className="font-semibold text-trades-ink hover:underline">{l.label} →</Link></li>
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-muted">
          Why we are rebuilding: see the <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections log</Link> and the <Link href="/about/methodology" className="font-semibold text-trades-ink hover:underline">methodology</Link>.
        </p>
      </section>
    </SimplePage>
  );
}
