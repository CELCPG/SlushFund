import type { Metadata } from 'next';
import Link from 'next/link';
import EmptyState from '@/components/v2/EmptyState';
import ExplorerForm from '@/components/v2/ExplorerForm';
import LatestFeedList from '@/components/v2/LatestFeedList';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import Pager from '@/components/v2/Pager';
import SourceBar from '@/components/v2/SourceBar';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { buildHref, hasAny, type SP } from '@/lib/v2/explorer';
import { LATEST_MAX_PAGES, LATEST_PAGE_SIZE, LATEST_PARAMS, getLatestPage, parseLatestFilters } from '@/lib/v2/latest';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: 'Latest: new congressional trade reports and contract awards',
    description: 'The newest stock-trade reports filed by members of Congress and the newest federal contract awards, newest first, each with a link to the official record.',
    alternates: {
      canonical: '/latest',
      types: { 'application/rss+xml': [{ url: '/latest.xml', title: 'SlushFund: latest filings and awards' }] },
    },
    robots: hasAny(sp, LATEST_PARAMS) ? { index: false, follow: true } : undefined,
  };
}

// Read from the database on request, cached for 5 minutes.
export const revalidate = 300;

const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

export default async function LatestPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = parseLatestFilters(sp);
  const [feed, statuses] = await Promise.all([getLatestPage(f, sp.page), getDatasetStatuses(['house_trades', 'senate_trades', 'contracts'])]);
  const pagerHref = (page: number) => buildHref('/latest', { chamber: f.chamber, type: f.type && !f.chamber ? f.type : undefined, page: page > 1 ? String(page) : undefined });

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Latest</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">New filings and awards</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          The newest stock-trade reports filed by members of Congress, by the date of the first report, and the newest federal contract awards, by the date signed. Every item links to the official record.
        </p>
        <p className="mt-4">
          <a href="/latest.xml" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/25">
            RSS feed
          </a>
        </p>
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={['house_trades', 'senate_trades', 'contracts']} className="mt-6" />

        <Card className="mt-5">
          <ExplorerForm action="/latest" className="grid grid-cols-[1fr_1fr_auto] gap-3 max-sm:grid-cols-1">
            <div>
              <label htmlFor="lt-type" className={label}>Show</label>
              <select id="lt-type" name="type" defaultValue={f.chamber ? 'trades' : f.type} className={field}>
                <option value="">Trades and awards</option>
                <option value="trades">Trades only</option>
                <option value="awards">Awards only</option>
              </select>
            </div>
            <div>
              <label htmlFor="lt-chamber" className={label}>Chamber</label>
              <select id="lt-chamber" name="chamber" defaultValue={f.chamber} className={field}>
                <option value="">Both</option>
                <option value="House">House</option>
                <option value="Senate">Senate</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="h-11 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:bg-deep max-sm:w-full">Apply</button>
            </div>
          </ExplorerForm>
          <p className="mt-3 text-[13px] text-muted">Awards have no chamber, so choosing a chamber lists trades only.</p>
        </Card>

        <section className="pt-6" aria-label="The feed">
          {feed === null ? (
            <EmptyState title="The feed is unavailable right now" tone="warning" statuses={statuses}>
              The database did not answer, so nothing is shown rather than a stand-in.
            </EmptyState>
          ) : feed.items.length === 0 ? (
            <EmptyState title="Nothing to show" statuses={statuses}>
              No items match these filters.
            </EmptyState>
          ) : (
            <>
              <p className="mb-3 text-[13.5px] text-muted" aria-live="polite">
                Newest first, {LATEST_PAGE_SIZE} per page{feed.page > 1 ? ` · page ${feed.page}` : ''}.
              </p>
              <LatestFeedList items={feed.items} />
              <Pager page={feed.page} pages={feed.pages} href={pagerHref} />
              {feed.page >= LATEST_MAX_PAGES && (
                <p className="mt-3 text-[13.5px] text-muted">
                  The feed stops at page {LATEST_MAX_PAGES}. For older items use the{' '}
                  <Link href="/data/trades?by=filed" className="font-semibold text-trades-ink hover:underline">trades explorer</Link> or the{' '}
                  <Link href="/data/contracts?sort=signed" className="font-semibold text-trades-ink hover:underline">contracts explorer</Link>.
                </p>
              )}
            </>
          )}
        </section>

        <p className="mt-6 max-w-[860px] text-[13px] text-muted">
          A trade is dated by the first report that disclosed it; an amended report does not move it. Trades whose first report is not in our records are left out, and scanned or paper filings have not been read,
          so a missing trade is not a trade that was never made. Awards are dated by the day they were signed, and DoD publishes about 90 days late. What each dataset covers and when it last loaded is on the{' '}
          <Link href="/data/status" className="font-semibold text-trades-ink hover:underline">data status page</Link>. Everything here is unaudited.
        </p>
      </Wrap>
    </div>
  );
}
