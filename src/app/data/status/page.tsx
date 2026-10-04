import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import DataStatusBoard from '@/components/v2/DataStatusBoard';
import DataSubNav from '@/components/v2/DataSubNav';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { STATUS_ORDER, STATUS_OTHER_ORDER, getDatasetStatuses } from '@/lib/v2/datasets';

export const metadata: Metadata = pageMetadata({
  path: '/data/status',
  title: 'Data status: every dataset, its source, coverage and last load',
  description: 'Each dataset on SlushFund: its official source, what it covers, how many rows it holds, when it last loaded and what is missing.',
});

// Read from the database on request, cached for 10 minutes.
export const revalidate = 600;

export default async function DataStatusPage() {
  const [main, other] = await Promise.all([getDatasetStatuses(STATUS_ORDER), getDatasetStatuses(STATUS_OTHER_ORDER)]);
  const all = [...main, ...other];
  const behind = all.filter((s) => s.state === 'stale').length;
  const down = all.filter((s) => s.state === 'unavailable').length;
  const loaded = all.filter((s) => s.state === 'fresh' || s.state === 'stale').length;

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Data</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Data status</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          Every dataset: where it comes from, what it covers, how many rows it holds, when it last loaded and what is known to be missing.
          A dataset turns amber when it falls behind and red when it can&rsquo;t be read; then its figures are hidden instead of guessed.
        </p>
        <DataSubNav current="/data/status" />
      </PageBand>

      <Wrap className="pb-12">
        <p className="mt-6 text-[14.5px]" role="status">
          <b>{loaded} of {all.length}</b> datasets are loaded
          {behind > 0 ? <>, <b className="text-stale-ink">{behind} behind</b></> : <>, none behind</>}
          {down > 0 ? <>, <b className="text-down-ink">{down} unavailable</b></> : null}.
          {' '}Read from the database when this page was built; it refreshes about every 10 minutes.
        </p>

        <section className="pt-4" aria-labelledby="ds-main">
          <SectionHead as="h2" title={<span id="ds-main">Datasets behind the explorers</span>} sub="Trades, awards, ticker links, committee history and signal scores." />
          <DataStatusBoard statuses={main} label="Datasets behind the explorers" />
        </section>

        <section className="pt-8" aria-labelledby="ds-other">
          <SectionHead as="h2" title={<span id="ds-other">Supporting datasets and ones not loaded yet</span>} sub="Used for totals and rosters, or planned." />
          <DataStatusBoard statuses={other} label="Supporting datasets and ones not loaded yet" />
        </section>

        <section className="pt-8" aria-labelledby="ds-read">
          <Card>
            <h2 id="ds-read" className="font-display text-[22px] font-extrabold">How &ldquo;last loaded&rdquo; is read</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14.5px] text-muted">
              <li>
                <b className="text-ink">The loader log is private.</b> When the server can read the loader&rsquo;s own log (<code className="font-mono text-[13px]">sync_log</code>), the time of the last
                completed run is used and the row says so. Otherwise the time is the newest timestamp on the rows themselves, and the row names the column it came from.
              </li>
              <li>
                <b className="text-ink">A row timestamp is not a filing date.</b> It moves when a loader writes or rewrites a row, so it can be later than the newest filing. The newest filing or award is shown
                separately, under Coverage.
              </li>
              <li>
                <b className="text-ink">Amber means behind.</b> A dataset is amber once it has gone longer than its threshold without a load (4 days for trades and awards, 14 for rosters), until the daily
                automations run.
              </li>
            </ul>
            <p className="mt-4 text-[13.5px] text-muted">
              Method for each dataset: <Link href="/about/methodology" className="font-semibold text-trades-ink hover:underline">how we collect and check the data</Link>. Everything on this page describes our own loads and
              counts, read from the database each time; the checks against the filings are described there.
            </p>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
