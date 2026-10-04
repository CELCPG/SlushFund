import type { Metadata } from 'next';
import Link from 'next/link';
import DataSubNav from '@/components/v2/DataSubNav';
import EmptyState from '@/components/v2/EmptyState';
import ExplorerForm from '@/components/v2/ExplorerForm';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import Pager from '@/components/v2/Pager';
import SourceBar from '@/components/v2/SourceBar';
import TradesTable from '@/components/v2/TradesTable';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { EXPORT_ROW_CAP, PAGE_SIZE, STATE_CODES, buildHref, hasAny, one, type SP } from '@/lib/v2/explorer';
import { fmtCount } from '@/lib/v2/format';
import {
  AMOUNT_BANDS, CHAMBERS, DIRECTIONS, INSTRUMENTS, OWNERS, PARTIES, TRADE_PARAMS, TRADE_SORTS,
  getTradePage, parseTradeFilters, tradeParams,
} from '@/lib/v2/trades-explorer';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: 'Congressional stock trades explorer',
    description: 'Every stock trade members of Congress disclosed, filterable by member, party, state, ticker, owner and date, with a link to the official filing on every row and a CSV export.',
    alternates: { canonical: '/data/trades' },
    // Filtered and paged views are permalinks for people; the search index gets the unfiltered page.
    robots: hasAny(sp, TRADE_PARAMS) ? { index: false, follow: true } : undefined,
  };
}

const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink placeholder:text-muted focus:border-trades focus:outline-none';
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

export default async function TradesExplorerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = parseTradeFilters(sp);
  const [result, statuses] = await Promise.all([getTradePage(f, sp.page), getDatasetStatuses(['house_trades', 'senate_trades'])]);
  const params = tradeParams(f);
  const filtered = Object.values(params).some(Boolean);
  const href = (page: number) => buildHref('/data/trades', { ...params, page: page > 1 ? String(page) : undefined });
  const legacyContractor = one(sp.has_contract) === 'true' || one(sp.contractor) === 'true';

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Data</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Stock trades by members of Congress</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          Every transaction members disclosed in their periodic reports, each with a link to the official filing. Filter it, share the address, or download the rows.
          Amounts are the ranges members disclose and are never added up.
        </p>
        <DataSubNav current="/data/trades" />
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={['house_trades', 'senate_trades']} className="mt-6" />

        <section className="pt-6" aria-labelledby="tx-filters">
          <Card>
            <h2 id="tx-filters" className="sr-only">Filters</h2>
            <ExplorerForm action="/data/trades" defaults={{ sort: 'filed', by: 'traded' }} className="grid grid-cols-4 gap-x-3 gap-y-3 max-lg:grid-cols-2">
              <div className="max-sm:col-span-2">
                <label htmlFor="t-member" className={label}>Member</label>
                <input id="t-member" name="member" type="search" defaultValue={f.member} placeholder="Name, or a bioguide ID" className={field} />
              </div>
              <div className="max-sm:col-span-2">
                <label htmlFor="t-ticker" className={label}>Ticker or company</label>
                <input id="t-ticker" name="ticker" type="search" defaultValue={f.ticker} placeholder="NVDA, or part of a name" className={field} />
              </div>
              <div>
                <label htmlFor="t-chamber" className={label}>Chamber</label>
                <select id="t-chamber" name="chamber" defaultValue={f.chamber} className={field}>
                  <option value="">Both</option>
                  {CHAMBERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-party" className={label}>Party</label>
                <select id="t-party" name="party" defaultValue={f.party} className={field}>
                  <option value="">Any party</option>
                  {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-state" className={label}>State</label>
                <select id="t-state" name="state" defaultValue={f.state} className={field}>
                  <option value="">Any state</option>
                  {STATE_CODES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-direction" className={label}>Direction</label>
                <select id="t-direction" name="direction" defaultValue={f.direction} className={field}>
                  <option value="">Any direction</option>
                  {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-owner" className={label}>Owner</label>
                <select id="t-owner" name="owner" defaultValue={f.owner} className={field}>
                  <option value="">Anyone</option>
                  {OWNERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-instrument" className={label}>Instrument</label>
                <select id="t-instrument" name="instrument" defaultValue={f.instrument} className={field}>
                  <option value="">Any instrument</option>
                  {INSTRUMENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-band" className={label}>Amount band</label>
                <select id="t-band" name="band" defaultValue={f.band} className={field}>
                  <option value="">Any amount</option>
                  {AMOUNT_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-by" className={label}>Date range applies to</label>
                <select id="t-by" name="by" defaultValue={f.by} className={field}>
                  <option value="traded">Trade date</option>
                  <option value="filed">First report filed</option>
                </select>
              </div>
              <div>
                <label htmlFor="t-from" className={label}>From</label>
                <input id="t-from" name="from" type="date" defaultValue={f.from} className={field} />
              </div>
              <div>
                <label htmlFor="t-to" className={label}>To</label>
                <input id="t-to" name="to" type="date" defaultValue={f.to} className={field} />
              </div>
              <div className="col-span-2">
                <label htmlFor="t-sort" className={label}>Sort</label>
                <select id="t-sort" name="sort" defaultValue={f.sort} className={field}>
                  {TRADE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-end gap-2">
                <button type="submit" className="h-11 flex-1 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:bg-deep">Apply filters</button>
                {filtered && <Link href="/data/trades" className="grid h-11 place-items-center rounded-xl px-4 text-sm font-semibold text-trades-ink hover:underline">Clear</Link>}
              </div>
            </ExplorerForm>
          </Card>
        </section>

        <section className="pt-6" aria-labelledby="tx-results">
          {result === null ? (
            <EmptyState title="The trades are unavailable right now" tone="warning" statuses={statuses}>
              The database did not answer, so nothing is shown rather than a stand-in. Try again in a few minutes.
            </EmptyState>
          ) : (
            <Card>
              <h2 id="tx-results" className="font-display text-[24px] font-extrabold max-md:text-[22px]">
                {result.total === 0 ? 'No trades match' : <>{fmtCount(result.total)} {result.total === 1 ? 'trade' : 'trades'}{filtered ? ' match' : ''}</>}
              </h2>
              <p className="mb-3 mt-1 text-[13.5px] text-muted" aria-live="polite">
                {result.total > 0 && <>Showing {fmtCount((result.page - 1) * PAGE_SIZE + 1)}–{fmtCount((result.page - 1) * PAGE_SIZE + result.rows.length)}{result.pages > 1 ? ` · page ${fmtCount(result.page)} of ${fmtCount(result.pages)}` : ''}. </>}
                {f.by === 'filed' && (f.from || f.to) && 'Trades whose first report is unknown have no filed date, so a filed-date range leaves them out. '}
              </p>
              {legacyContractor && (
                <p className="mb-3 rounded-2xl bg-stale-tint px-4 py-2.5 text-[13.5px] text-stale-ink">
                  The &ldquo;traded a federal contractor&rdquo; filter is not available here yet: it waits on the check of when each company was listed. This list is not narrowed by it.
                  Company pages show the members who traded a contractor&rsquo;s stock.
                </p>
              )}
              {result.total === 0 ? (
                <p className="rounded-2xl bg-page px-4 py-6 text-center text-[14.5px] text-muted">
                  No disclosed trade matches these filters. <Link href="/data/trades" className="font-semibold text-trades-ink hover:underline">Clear the filters</Link> or widen the dates.
                </p>
              ) : (
                <TradesTable
                  trades={result.rows}
                  caption="Stock trades members of Congress disclosed, in the chosen order"
                  ordered
                  fullDates
                  captionHidden
                  footer={
                    <span>
                      Source: House Clerk PTRs and Senate eFD, one row per disclosed transaction. &ldquo;Filed&rdquo; is the first report; a later amendment is noted under it. Same-day lots show as
                      &ldquo;2 ×&rdquo; their disclosed range. Owner &ldquo;Self&rdquo; includes trusts and accounts filed without an owner. Options are labelled as options.
                      A row with a date note (reported more than two years after the trade, or report dates that disagree) is marked and sorts last when ordered by date.
                    </span>
                  }
                />
              )}
              <Pager page={result.page} pages={result.pages} href={href} />
              {result.total > 0 && (
                <div className="mt-5 rounded-2xl bg-page px-4 py-3 text-[13.5px] text-muted">
                  <a
                    href={buildHref('/data/trades/export', params)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-deep"
                  >
                    Download CSV <span aria-hidden>⇩</span>
                  </a>
                  <span className="ml-3 align-middle">
                    {result.total > EXPORT_ROW_CAP
                      ? <>The CSV holds the first {fmtCount(EXPORT_ROW_CAP)} of {fmtCount(result.total)} matching rows in the order shown. Narrow the dates to export the rest in parts.</>
                      : <>All {fmtCount(result.total)} matching {result.total === 1 ? 'row' : 'rows'}, in the order shown (at most {fmtCount(EXPORT_ROW_CAP)}).</>}
                    {' '}Every row has the official filing&rsquo;s address.
                  </span>
                </div>
              )}
            </Card>
          )}
        </section>

        <p className="mt-6 max-w-[860px] text-[13px] text-muted">
          What is and is not here: House filings from 2021 and Senate filings from 2024, as loaded. Scanned House reports and paper Senate reports have not been read, and lines without a ticker are not loaded,
          so a low count can be a gap rather than little trading; a member&rsquo;s page says when that applies. A trade is a disclosure, not a finding about the member.
          See <Link href="/about/methodology/trades" className="font-semibold text-trades-ink hover:underline">how trades are collected</Link>.
        </p>
      </Wrap>
    </div>
  );
}
