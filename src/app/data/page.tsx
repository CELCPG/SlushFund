import type { Metadata } from 'next';
import Link from 'next/link';
import { DataStatusTable } from '@/components/v2/DataStatus';
import EmptyState from '@/components/v2/EmptyState';
import DataSubNav from '@/components/v2/DataSubNav';
import { Card, SectionHead } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import { lateFilersEnabled } from '@/lib/v2/flags';

export const metadata: Metadata = {
  title: 'Data',
  description: 'The datasets behind SlushFund, their sources and freshness, and downloads.',
};
export const revalidate = 600;

// Data hub (D1), with the explorers (D4).
export default function DataHub() {
  const explorers = [
    { href: '/data/trades', title: 'Stock trades', text: 'Every transaction members of Congress disclosed, with a link to the filing on each row. Filter by member, party, state, ticker, owner, date and amount band.', cta: 'Explore trades' },
    { href: '/data/contracts', title: 'Non-competed contracts', text: 'Federal contracts the agency coded not competed, $1 million and up, FY2024–26. Filter by year, agency, company and amount; each row links to USAspending.', cta: 'Explore contracts' },
    ...(lateFilersEnabled()
      ? [{ href: '/data/late-filers', title: 'Late filers (preview)', text: 'The longest gaps between a trade and the first report that disclosed it, stated as days after the trade. Hidden on the live site until audited.', cta: 'See the board' }]
      : []),
  ];
  return (
    <SimplePage
      eyebrow="Data"
      title="The data behind every page"
      dek="Official public records, loaded by code and checked against the source documents. Explore it, check its freshness, or download it."
      nav={<DataSubNav current="/data" />}
    >
      <SectionHead title="Explore" sub="Filters live in the address, so any view can be shared. Every table exports to CSV." />
      <ul className="mb-10 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        {explorers.map((e) => (
          <li key={e.href}>
            <Card className="h-full">
              <h3 className="font-display text-[22px] font-extrabold">{e.title}</h3>
              <p className="mt-2 text-[14.5px] text-muted">{e.text}</p>
              <Link href={e.href} className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-deep">{e.cta} →</Link>
            </Card>
          </li>
        ))}
      </ul>
      <SectionHead title="Datasets" sub={<>Source, coverage and last load for each. The same facts feed the <Link href="/data/status" className="font-semibold text-trades-ink hover:underline">data status page</Link>.</>} />
      <DataStatusTable />
      <section id="downloads" className="scroll-mt-6 pt-10">
        <SectionHead title="Downloads" />
        <EmptyState title="Bulk downloads are not ready yet" icon="⇩">
          Until then, each explorer has a CSV export of the rows that match your filters (up to 10,000 rows), with the official filing&rsquo;s address on every row.
          Other tables export the rows you see.
        </EmptyState>
      </section>
    </SimplePage>
  );
}
