import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BuySellMonths from '@/components/v2/BuySellMonths';
import DataSubNav from '@/components/v2/DataSubNav';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SectorHeatmap, { type Measure } from '@/components/v2/SectorHeatmap';
import SourceBar from '@/components/v2/SourceBar';
import { buildHref, one, type SP } from '@/lib/v2/explorer';
import { GRADE_METHOD_PATH, MOST_ACTIVE_PATH, SECTOR_HEATMAP_PATH, gradesEnabled, mostActiveEnabled, sectorHeatmapEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { getRoster } from '@/lib/v2/people';
import { MONTH_CHOICES, UNCLASSIFIED, aggregate, rankTickers, type Aggregate, type MemberCount, type MonthChoice, type TickerAgg } from '@/lib/v2/sector-agg';
import { getSectorTradeRows } from '@/lib/v2/sector-trades';
import { pageMetadata } from '@/lib/v2/seo';
import unreadWindow from '@/data/unread-window.json';
import { unreadInWindow } from '@/lib/v2/grade-method';

export const revalidate = 1800;

// D18. Behind sectorHeatmapEnabled() (off on production unless SHOW_SECTOR_HEATMAP=1). Counts only: PTR amounts are bands.
export function generateMetadata(): Metadata {
  if (!sectorHeatmapEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: SECTOR_HEATMAP_PATH,
    title: 'What Congress is trading: sectors and tickers',
    description: 'Individual-stock purchases and sales reported by members of Congress, counted by sector and by ticker, with the members who traded each.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const SHOWN = 15;
const TOP = 3;
const pill = 'whitespace-nowrap rounded-full border border-line px-3.5 py-1.5 text-[14px] font-semibold text-ink hover:border-ink';
const pillOn = 'border-ink bg-neutral-tint';

function SplitBar({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells;
  const p = total ? Math.round((buys / total) * 100) : 0;
  return (
    <span className="block min-w-[96px]" title={`${buys} purchases, ${sells} sales`}>
      <span aria-hidden className="flex h-3 w-full overflow-hidden border border-line">
        <span className="h-full bg-[color:var(--sf-bar,var(--color-trades))]" style={{ width: `${p}%` }} />
        <span className="h-full flex-1 bg-neutral-tint" />
      </span>
      <span className="mt-0.5 block font-mono text-[11.5px] text-muted">{p}% purchases</span>
    </span>
  );
}

function Members({ list, known }: { list: MemberCount[]; known: Set<string> }) {
  if (!list.length) return <span className="text-muted">none</span>;
  return (
    <span className="block space-y-0.5 text-[13.5px]">
      {list.slice(0, TOP).map((m) => (
        <span key={m.bioguide} className="block">
          {known.has(m.bioguide) ? <Link href={`/people/${m.bioguide}`} className="font-semibold hover:underline">{m.name}</Link> : <span className="font-semibold">{m.name}</span>}{' '}
          <span className="font-mono text-muted">({fmtCount(m.count)})</span>
        </span>
      ))}
    </span>
  );
}

const columns = (sector: boolean): DataTableColumn[] => [
  { key: 'rank', header: '#', numeric: true, sortable: false, mobile: 'hidden' },
  { key: 'ticker', header: 'Ticker', mobile: 'title', sortable: false },
  { key: 'company', header: 'Company as filed', mobile: 'subtitle', sortable: false },
  ...(sector ? [] : [{ key: 'sector', header: 'Sector', sortable: false } as DataTableColumn]),
  { key: 'buys', header: 'Purchases', numeric: true, sortable: false },
  { key: 'sells', header: 'Sales', numeric: true, sortable: false },
  { key: 'split', header: 'Purchase and sale split', sortable: false, csv: false },
  { key: 'members', header: 'Top 3 members by transactions', sortable: false },
];

function tickerRows(list: TickerAgg[], dir: 'buy' | 'sell' | 'both', sectorLabel: (k: string) => string, known: Set<string>): DataTableRow[] {
  return list.map((t, i) => {
    const mem = dir === 'buy' ? t.buyers : dir === 'sell' ? t.sellers : t.traders;
    return {
      id: t.ticker,
      values: {
        rank: i + 1, ticker: t.ticker, company: t.company, sector: sectorLabel(t.sector), buys: t.buys, sells: t.sells, split: null,
        members: mem.slice(0, TOP).map((m) => `${m.name} (${m.count})`).join('; '),
      },
      cells: {
        ticker: <span className="font-mono font-bold">{t.ticker}</span>,
        split: <SplitBar buys={t.buys} sells={t.sells} />,
        members: <Members list={mem} known={known} />,
      },
    };
  });
}

export default async function WhatCongressTradesPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!sectorHeatmapEnabled()) notFound();
  const sp = await searchParams;
  const months = ((MONTH_CHOICES as readonly number[]).includes(Number(one(sp.months))) ? Number(one(sp.months)) : 24) as MonthChoice;
  const measure: Measure = one(sp.measure) === 'net' ? 'net' : 'total';

  const head = (
    <PageBand>
      <h1 className="mt-8 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:mt-5 max-md:text-[30px]">What Congress is trading</h1>
      <p className="mt-2 max-w-[860px] text-[16px] text-on-deep">
        Individual-stock purchases and sales reported by members of Congress, counted by sector and by ticker, from House Clerk and Senate eFD periodic transaction reports.
      </p>
      <DataSubNav current={SECTOR_HEATMAP_PATH} />
    </PageBand>
  );

  const [data, roster] = await Promise.all([getSectorTradeRows(), getRoster()]);
  if (!data) {
    return (
      <div data-v2>
        {head}
        <Wrap className="pb-12 pt-6"><EmptyState title="The trade counts are unavailable right now" tone="warning">The trade database did not answer, so nothing is shown.</EmptyState></Wrap>
      </div>
    );
  }

  const agg: Aggregate = aggregate(data.rows, data.end, months);
  const known = new Set((roster ?? []).map((m) => m.bioguide_id));
  const labelOf = new Map<string, string>([...agg.sectors, agg.unclassified].map((c) => [c.key, c.label]));
  const sectorLabel = (k: string) => labelOf.get(k) ?? k;
  const sel = one(sp.sector);
  const selected = labelOf.has(sel) ? sel : '';
  const href = (over: Record<string, string | undefined>) =>
    buildHref(SECTOR_HEATMAP_PATH, { months: months === 24 ? undefined : String(months), measure: measure === 'total' ? undefined : measure, sector: selected || undefined, ...over });

  const purchases = agg.sectors.reduce((n, c) => n + c.buys, 0) + agg.unclassified.buys;
  const sales = agg.sectors.reduce((n, c) => n + c.sells, 0) + agg.unclassified.sells;
  const lagFrom = agg.trend.length >= 2 ? agg.trend[agg.trend.length - 2].month : undefined;
  const unreadCount = Object.values(unreadWindow as Record<string, string[]>).reduce((n, d) => n + unreadInWindow(d, agg.start), 0);
  const busiest = agg.trend.reduce((b, p) => (p.buys + p.sells > b.buys + b.sells ? p : b), agg.trend[0]);
  const busiestLabel = busiest ? new Date(`${busiest.month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  const bought = rankTickers(agg.tickers, 'buy', SHOWN);
  const sold = rankTickers(agg.tickers, 'sell', SHOWN);
  const drillCell = selected ? (selected === UNCLASSIFIED ? agg.unclassified : agg.sectors.find((c) => c.key === selected)) : undefined;
  const drillTickers = selected ? agg.tickers.filter((t) => t.sector === selected).sort((a, b) => b.total - a.total || a.ticker.localeCompare(b.ticker)).slice(0, SHOWN) : [];
  const drillMembers = selected ? (agg.sectorMembers.get(selected) ?? []).slice(0, 10) : [];

  return (
    <div data-v2>
      {head}
      <Wrap className="pb-12">
        <SourceBar datasets={['house_trades', 'senate_trades']} className="mt-6" />

        <Card className="mt-6">
          <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
            <nav aria-label="Time window">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Trade dates in the last</p>
              <div className="flex flex-wrap gap-1.5">
                {MONTH_CHOICES.map((m) => (
                  <Link key={m} href={href({ months: m === 24 ? undefined : String(m) })} scroll={false} aria-current={m === months ? 'true' : undefined} className={`${pill} ${m === months ? pillOn : ''}`}>{m} months</Link>
                ))}
              </div>
            </nav>
            <nav aria-label="Heatmap measure">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Heatmap shows</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={href({ measure: undefined })} scroll={false} aria-current={measure === 'total' ? 'true' : undefined} className={`${pill} ${measure === 'total' ? pillOn : ''}`}>Transactions (purchases + sales)</Link>
                <Link href={href({ measure: 'net' })} scroll={false} aria-current={measure === 'net' ? 'true' : undefined} className={`${pill} ${measure === 'net' ? pillOn : ''}`}>Net (purchases minus sales)</Link>
              </div>
            </nav>
          </div>
        </Card>

        <section className="pt-8" aria-labelledby="heat">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="heat" className="text-[24px] max-md:text-[22px]">{fmtCount(purchases)} purchases and {fmtCount(sales)} sales of individual stocks, by sector</span>}
              sub={`Trades dated ${fmtDate(agg.start)} to ${fmtDate(agg.end)}. ${measure === 'total' ? 'Each cell is the number of transactions; deeper color means more of them.' : 'Each cell is purchases minus sales, in transactions; the sign and the words say which way, and deeper color means a bigger gap.'} Counts, not money.`}
            />
            {agg.counted === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No individual-stock purchases or sales are dated in this window.</p>
            ) : (
              <SectorHeatmap cells={agg.sectors} unclassified={agg.unclassified} measure={measure} selected={selected} hrefFor={(k) => href({ sector: k }) + '#drill'} />
            )}
            <div className="mt-4 space-y-2 text-[13px] text-muted">
              <p>
                Sectors come from the site&rsquo;s existing ticker list, checked and extended against each company&rsquo;s industry code (SIC) in its SEC EDGAR filings. A ticker with no such source is left unclassified, not guessed. {fmtCount(agg.unclassified.total)} of the {fmtCount(agg.counted)} counted transactions ({agg.counted ? Math.round((agg.unclassified.total / agg.counted) * 100) : 0}%) are in the Unclassified cell: the ticker is not on that list{agg.noTicker ? `, or the filing gave no ticker (${fmtCount(agg.noTicker)} transactions)` : ''}. Unclassified is not a sector and is left out of the color scale.
              </p>
              <p>Select a cell to see its tickers and the members who traded them.</p>
            </div>
          </Card>
        </section>

        {drillCell && (
          <section className="pt-8" aria-labelledby="drillhead" id="drill" tabIndex={-1}>
            <Card>
              <SectionHead
                as="h2"
                title={<span id="drillhead" className="text-[24px] max-md:text-[22px]">{drillCell.label}: {fmtCount(drillCell.buys)} purchases, {fmtCount(drillCell.sells)} sales</span>}
                sub={`${fmtCount(drillCell.tickers)} ${drillCell.tickers === 1 ? 'ticker' : 'tickers'}, trades dated ${fmtDate(agg.start)} to ${fmtDate(agg.end)}. Tickers ranked by transactions (purchases + sales); members ranked by their transactions in this ${drillCell.key === UNCLASSIFIED ? 'group' : 'sector'}.`}
                action={<Link href={href({ sector: undefined }) + '#heat'} scroll={false} className="text-[14px] font-semibold text-trades-ink hover:underline">Close</Link>}
              />
              {drillTickers.length ? (
                <DataTable columns={columns(true)} rows={tickerRows(drillTickers, 'both', sectorLabel, known)} caption={`${drillCell.label}: tickers by transactions`} csv={{ filename: `what-congress-trades-${drillCell.key}` }} />
              ) : (
                <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No transaction with a ticker in this cell.</p>
              )}
              {drillMembers.length > 0 && (
                <div className="mt-5">
                  <h3 className="m-0 font-display text-[18px] font-extrabold">Members with the most transactions here</h3>
                  <ol className="mt-2 grid list-none grid-cols-2 gap-x-6 gap-y-1 p-0 text-[14px] max-md:grid-cols-1">
                    {drillMembers.map((m) => (
                      <li key={m.bioguide}>
                        {known.has(m.bioguide) ? <Link href={`/people/${m.bioguide}`} className="font-semibold hover:underline">{m.name}</Link> : <span className="font-semibold">{m.name}</span>}{' '}
                        <span className="font-mono text-muted">{fmtCount(m.count)} {m.count === 1 ? 'transaction' : 'transactions'}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[12.5px] text-muted">Ranked by number of transactions, not by money. Ties are listed alphabetically.</p>
                </div>
              )}
            </Card>
          </section>
        )}

        <section className="pt-8" aria-labelledby="bought">
          <Card>
            <SectionHead as="h2" title={<span id="bought" className="text-[24px] max-md:text-[22px]">Most-bought tickers</span>} sub={`Ranked by the number of purchase transactions (not dollars), trades dated ${fmtDate(agg.start)} to ${fmtDate(agg.end)}. Members are the three with the most purchases of that ticker.`} />
            {bought.length ? (
              <DataTable columns={columns(false)} rows={tickerRows(bought, 'buy', sectorLabel, known)} caption={`Top ${bought.length} tickers by purchase transactions in the last ${months} months`} csv={{ filename: 'what-congress-trades-most-bought' }} />
            ) : (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No purchases are dated in this window.</p>
            )}
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="sold">
          <Card>
            <SectionHead as="h2" title={<span id="sold" className="text-[24px] max-md:text-[22px]">Most-sold tickers</span>} sub={`Ranked by the number of sale transactions (not dollars), partial sales included. Members are the three with the most sales of that ticker.`} />
            {sold.length ? (
              <DataTable columns={columns(false)} rows={tickerRows(sold, 'sell', sectorLabel, known)} caption={`Top ${sold.length} tickers by sale transactions in the last ${months} months`} csv={{ filename: 'what-congress-trades-most-sold' }} />
            ) : (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No sales are dated in this window.</p>
            )}
            <p className="mt-3 text-[13px] text-muted">Ranking is by count because each trade is disclosed as a range of dollars, never an exact amount; a count is exact, a sum of ranges is not.</p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="trend">
          <Card>
            <SectionHead as="h2" title={<span id="trend" className="text-[24px] max-md:text-[22px]">Purchases and sales per month</span>} sub={`${fmtCount(agg.counted)} counted transactions by the month of the trade date, both chambers, all members.`} />
            <BuySellMonths points={agg.trend} label="Counted purchases and sales per month of the trade date" lagFrom={lagFrom} />
            <p className="mt-2 text-[12.5px] text-muted">The shaded months are still filling in: trades are reported up to 45 days after the trade date, and some later. Counts of transactions, not money.</p>
            {busiest && busiest.buys + busiest.sells > 0 && (
              <p className="mt-1 text-[12.5px] text-muted">One member&rsquo;s reports can move a month. In the busiest month in this window, {busiestLabel}, one member accounts for {fmtCount(busiest.topMember)} of the {fmtCount(busiest.buys + busiest.sells)} counted transactions.</p>
            )}
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="caveats">
          <Card>
            <SectionHead as="h2" title={<span id="caveats" className="text-[24px] max-md:text-[22px]">What these counts are, and are not</span>} />
            <div className="space-y-3 text-[14px] text-muted">
              <p><strong className="text-ink">Ranges, not amounts.</strong> Members disclose each trade as a range of dollars. These pages count transactions and never add the ranges into a dollar figure.</p>
              <p>
                <strong className="text-ink">What is counted.</strong> Counted: stocks and other single-company securities, self, spouse and dependent child, with trade dates in the window as filed. Not counted: funds, ETFs, Treasuries, municipal securities and other assets a stock-trading ban would allow; bonds; rows whose dates carry a date note. Stock options are listed apart and are not counted as purchases or sales of the stock. In this window that leaves out {fmtCount(agg.notCounted.fundsAndOther)} fund, ETF and other-asset rows, {fmtCount(agg.notCounted.options)} option rows, {fmtCount(agg.notCounted.bonds)} bond rows, {fmtCount(agg.notCounted.exchanges)} exchanges and {fmtCount(agg.notCounted.dateNote)} rows with a date note.
              </p>
              <p>
                <strong className="text-ink">Reports we have not read.</strong> {fmtCount(unreadCount)} scanned-image or paper reports filed since {fmtDate(agg.start)} are not read yet, so these counts may be incomplete.{' '}
                {gradesEnabled() ? <>See how the <Link href={GRADE_METHOD_PATH} className="underline">Stock Trading Grade</Link> treats them as &ldquo;Not graded&rdquo;.</> : null}
              </p>
              <p><strong className="text-ink">Reporting delay.</strong> The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade, so the most recent weeks are always still filling in. A gap over 45 days is a measured fact about two dates as the member filed them, not a finding about the filer.</p>
              <p><strong className="text-ink">Sectors.</strong> Cells group tickers by the site&rsquo;s ticker list, with labels checked against each company&rsquo;s SEC industry code. A sector label describes the company, not the member&rsquo;s reason for trading. These are counts from public filings; a count says how much was reported, not why.</p>
              {mostActiveEnabled() && <p>Members ranked by how much they reported: <Link href={MOST_ACTIVE_PATH} className="font-semibold text-trades-ink hover:underline">Most active stock traders in Congress</Link>.</p>}
            </div>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
