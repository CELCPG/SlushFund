import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataSubNav from '@/components/v2/DataSubNav';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { BarColumns, MultiLine, NumbersTable } from '@/components/v2/AnalyticsCharts';
import { ANALYTICS_PATH, PRESIDENT_PATH, analyticsHubEnabled, gradesEnabled, presidentPageEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate, fmtDateTime, fmtPct, fmtUsdCompact, fmtUsd } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';
import { EXPORT_ROW_CAP } from '@/lib/v2/explorer';
import { getCoverage, getDisclosure, getGradeSnapshot, getMoney, getQuality } from '@/lib/v2/analytics';

export const revalidate = 1800;

// D19: the analytics hub. Behind analyticsHubEnabled() (off on production unless SHOW_ANALYTICS_HUB=1). Sections that show
// figures from another gated feature (grades, campaign money, President trades, investigation transactions) stay behind
// that feature's flag inside the page. Every figure is read from the database when the page is built; none is typed here.
export function generateMetadata(): Metadata {
  if (!analyticsHubEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: ANALYTICS_PATH,
    title: 'Analytics: what SlushFund tracks, how much, and what is changing',
    description: 'Row counts and last-updated dates for every dataset, congressional disclosure volume by month, days from trade to report, campaign receipts, and the health of our own data loads.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const monLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const Unavail = ({ children }: { children?: string }) => <span className="font-semibold text-down-ink">{children ?? 'Unavailable'}</span>;

export default async function AnalyticsPage() {
  if (!analyticsHubEnabled()) notFound();
  const grades = gradesEnabled();
  const [coverage, disclosure, money, snapshot, quality] = await Promise.all([getCoverage(), getDisclosure(), getMoney(), getGradeSnapshot(), getQuality()]);
  const house = coverage.find((c) => c.key === 'house_trades');
  const senate = coverage.find((c) => c.key === 'senate_trades');

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Data</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Analytics</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          What SlushFund tracks, how much of it, and how it is changing. Every figure is read from our database when this page is built (about every 30 minutes) and carries the date of the freshest row behind it.
          A figure that cannot be read shows &ldquo;Unavailable&rdquo;, never zero.
        </p>
        <DataSubNav current="/analytics" />
      </PageBand>

      <Wrap className="pb-12">
        {/* 1. Coverage band */}
        <section className="pt-8" aria-labelledby="an-coverage">
          <SectionHead as="h2" title={<span id="an-coverage">What we hold</span>} sub="Rows in each dataset, and the date of its freshest row. A row is the unit named in the second column." />
          <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {coverage.map((c) => (
              <Card key={c.key} as="article" className="flex flex-col">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.04em]">{c.label}</h3>
                <p className="sf-kpi-value mt-2 font-display text-[40px] font-extrabold leading-[1.1] max-sm:text-[32px]" data-figure={c.key}>
                  {c.count == null ? <Unavail>{c.note ?? 'Unavailable'}</Unavail> : fmtCount(c.count)}
                </p>
                <p className="mt-1 text-[14px] text-muted">{c.measure}</p>
                <p className="mt-auto pt-3 text-[12.5px] text-muted">
                  {c.asOf ? <>As of {fmtDate(c.asOf)} <span className="opacity-80">({c.asOfBasis})</span></> : c.count == null ? 'No date: nothing to date.' : 'As-of date unavailable.'}
                  {c.href && <> &middot; <Link href={c.href} className="font-semibold text-trades-ink underline underline-offset-2">Open</Link></>}
                </p>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            A row-timestamp date moves when a loader writes or rewrites a row, so it can be later than the newest filing. How each date is read, and what each dataset is missing, is on the <Link href="/data/status" className="font-semibold text-trades-ink underline underline-offset-2">data status page</Link>.
          </p>
        </section>

        {/* 2. Disclosure volume */}
        <section className="pt-10" aria-labelledby="an-volume">
          <SectionHead as="h2" title={<span id="an-volume">Reports filed per month</span>} sub="Periodic transaction reports first filed in each of the last 24 months, House and Senate. A report counts once, in the month it was first filed; an amendment does not add a second." />
          <Card>
            {disclosure ? (
              <>
                <MultiLine
                  unit="reports"
                  labels={disclosure.volume.map((p) => monLabel(p.month))}
                  series={[
                    { name: 'House', values: disclosure.volume.map((p) => p.house) },
                    { name: 'Senate', values: disclosure.volume.map((p) => p.senate), dashed: true },
                  ]}
                  summary={`Reports first filed per month, ${monLabel(disclosure.volume[0].month)} to ${monLabel(disclosure.volume[disclosure.volume.length - 1].month)}: House ${fmtCount(disclosure.volumeTotals.house)} in total, Senate ${fmtCount(disclosure.volumeTotals.senate)} in total.`}
                />
                <p className="mt-3 text-[14px]" data-figure="volume-totals">
                  In these 24 months: <b>{fmtCount(disclosure.volumeTotals.house)}</b> House reports and <b>{fmtCount(disclosure.volumeTotals.senate)}</b> Senate reports first filed.
                  {' '}Newest first-filing date in the data: {fmtDate(disclosure.asOf) ?? 'unavailable'}; the current month is partial.
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Only reports we read are counted. {fmtCount(quality.unreadHouse)} scanned House filings and {fmtCount(quality.unreadSenate)} paper Senate filings were not read in our count of {quality.unreadAsOf}, so months are undercounted by those.
                  Each chamber is loaded from its own start date (see the data status page), so a flat stretch can mean no data loaded yet for that chamber, not no reports.
                </p>
                <NumbersTable
                  caption="Congressional periodic transaction reports first filed per month"
                  cols={[{ key: 'm', header: 'Month' }, { key: 'h', header: 'House' }, { key: 's', header: 'Senate' }]}
                  rows={disclosure.volume.map((p) => ({ m: p.month === new Date().toISOString().slice(0, 7) ? `${monLabel(p.month)} (partial)` : monLabel(p.month), h: fmtCount(p.house), s: fmtCount(p.senate) }))}
                />
              </>
            ) : <EmptyState title="Monthly volume is unavailable right now" tone="warning">The trade database did not answer, so no figure is shown.</EmptyState>}
          </Card>
        </section>

        {/* 3. Speed of disclosure */}
        <section className="pt-10" aria-labelledby="an-speed">
          <SectionHead as="h2" title={<span id="an-speed">Days from trade to report</span>} sub="Congressional transactions by the number of calendar days between the trade and the first report that listed it." />
          <Card>
            {disclosure ? (
              <>
                <BarColumns
                  unit="Transactions per range of days (calendar days, trade date to first report)."
                  summary={`Days from trade to first report, ${fmtCount(disclosure.binned)} transactions in eight ranges.`}
                  bars={disclosure.bins.map((b) => ({
                    label: b.label,
                    value: b.count,
                    display: fmtCount(b.count) ?? '',
                    aria: `${b.label} days: ${fmtCount(b.count)} transactions`,
                  }))}
                />
                <p className="mt-3 text-[14px]" data-figure="speed-totals">
                  <b>{fmtCount(disclosure.over45)}</b> of <b>{fmtCount(disclosure.binned)}</b> transactions ({fmtPct(disclosure.binned ? disclosure.over45 / disclosure.binned : null) ?? 'unavailable'}) were reported more than 45 days after the trade.
                  The STOCK Act sets 45 days; this is a count of reports, not a finding about any filer.
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Not in the chart: {fmtCount(disclosure.excluded.belowThreshold)} transactions at or below the $1,000 reporting threshold, {fmtCount(disclosure.excluded.dateNote)} with a date note (the dates as filed look inconsistent), {fmtCount(disclosure.excluded.notComputed)} where the first report is not identified.
                  Days are counted to the first report, not to any amendment.
                  {presidentPageEnabled() && <> The same measure for executive-branch filers is on <Link href={PRESIDENT_PATH} className="font-semibold text-trades-ink underline underline-offset-2">the President page</Link>.</>}
                </p>
                <NumbersTable
                  caption="Congressional transactions by days from trade to first report"
                  cols={[{ key: 'r', header: 'Days' }, { key: 'n', header: 'Transactions' }]}
                  rows={disclosure.bins.map((b) => ({ r: b.label, n: fmtCount(b.count) }))}
                />
              </>
            ) : <EmptyState title="The days-to-report chart is unavailable right now" tone="warning">The trade database did not answer, so no figure is shown.</EmptyState>}
          </Card>
        </section>

        {/* 4. Money trend */}
        <section className="pt-10" aria-labelledby="an-money">
          <SectionHead as="h2" title={<span id="an-money">Campaign receipts, 2025&ndash;26 cycle</span>} sub="Money raised by members' principal campaign committees, as of each member's latest FEC report." />
          <Card>
            {money ? (
              <>
                <p className="text-[15px]" data-figure="money-total">
                  <b className="sf-kpi-value font-display text-[34px] font-extrabold">{fmtUsdCompact(money.raisedTotal)}</b>{' '}
                  reported raised by <b>{fmtCount(money.members - money.missing)}</b> of {fmtCount(money.members)} members with a committee record (exactly {fmtUsd(money.raisedTotal)}).
                  {money.missing > 0 && <> {fmtCount(money.missing)} have no receipts figure and are not added.</>}
                </p>
                <p className="mt-2 text-[14px] text-muted">
                  Our data holds one cycle-to-date total per member, not receipts by day or quarter, so a growth line over time cannot be drawn without inventing it.
                  The bars below group those totals by the quarter of each member&rsquo;s latest report: they show how current the reports are, not how receipts grew.
                </p>
                <div className="mt-4">
                  <BarColumns
                    unit="Receipts reported, grouped by the quarter of the member's latest report."
                    summary={`Receipts grouped by quarter of latest report: ${money.byQuarter.map((q) => `${q.quarter} ${fmtUsdCompact(q.raised)} from ${q.members} members`).join('; ')}.`}
                    bars={money.byQuarter.map((q) => ({
                      label: q.quarter.replace(' ', ' '),
                      value: q.raised,
                      display: fmtUsdCompact(q.raised) ?? '',
                      aria: `${q.quarter}: ${fmtUsd(q.raised)} reported by ${fmtCount(q.members)} members`,
                    }))}
                  />
                </div>
                {money.noDate > 0 && (
                  <p className="mt-2 text-[12.5px] text-muted" data-figure="money-nodate">
                    {money.noDate === 1 ? 'One member' : `${fmtCount(money.noDate)} members`} with no report date on file ($0 reported) {money.noDate === 1 ? 'is' : 'are'} not in a quarter bar.
                  </p>
                )}
                <p className="mt-2 text-[12.5px] text-muted">
                  Latest report dates run from {fmtDate(money.oldest) ?? 'unavailable'} to {fmtDate(money.newest) ?? 'unavailable'}. Figures are what committees reported to the FEC, not audited by us; a later report can change a member&rsquo;s total.
                </p>
                <NumbersTable
                  caption="Campaign receipts by quarter of each member's latest report"
                  cols={[{ key: 'q', header: 'Quarter of latest report' }, { key: 'm', header: 'Members' }, { key: 'r', header: 'Receipts reported' }]}
                  rows={money.byQuarter.map((q) => ({ q: q.quarter, m: fmtCount(q.members), r: fmtUsd(q.raised) }))}
                />
              </>
            ) : <EmptyState title="Campaign receipts are not shown" tone="neutral">Campaign finance data is not public on this site yet, or the database did not answer. No figure is shown.</EmptyState>}
          </Card>
        </section>

        {/* 5. Grades snapshot */}
        {grades && (
          <section className="pt-10" aria-labelledby="an-grades">
            <SectionHead as="h2" title={<span id="an-grades">Stock Trading Grades: snapshot</span>} sub="Today's distribution across members in office. Not a trend: we keep no earlier grade snapshots, so nothing is plotted over time." />
            <Card>
              {snapshot ? (
                <>
                  <p className="inline-block rounded-full border border-line px-3 py-1 text-[12.5px] font-bold uppercase tracking-[0.05em]">Snapshot as of {fmtDate(snapshot.window.end)}</p>
                  <div className="mt-4">
                    <BarColumns
                      unit={`Members in office by grade (${fmtCount(snapshot.members)} members; trades dated ${fmtDate(snapshot.window.start)} to ${fmtDate(snapshot.window.end)}).`}
                      summary={`Grade distribution of ${snapshot.members} members in office.`}
                      bars={(['A', 'NG', 'B', 'C', 'D', 'F'] as const).map((l) => ({
                        label: l === 'NG' ? 'Not graded' : l,
                        value: snapshot.counts[l],
                        display: fmtCount(snapshot.counts[l]) ?? '',
                        aria: `${l === 'NG' ? 'Not graded' : `Grade ${l}`}: ${fmtCount(snapshot.counts[l])} members`,
                      }))}
                    />
                  </div>
                  <p className="mt-3 text-[13px] text-muted">The grade measures reported trading and disclosure timing under one published method. It is not a finding of wrongdoing. <Link href="/about/methodology/report-card" className="font-semibold text-trades-ink underline underline-offset-2">How grades are computed</Link>.</p>
                  <NumbersTable
                    caption="Members in office by Stock Trading Grade"
                    cols={[{ key: 'g', header: 'Grade' }, { key: 'n', header: 'Members' }]}
                    rows={(['A', 'NG', 'B', 'C', 'D', 'F'] as const).map((l) => ({ g: l === 'NG' ? 'Not graded' : l, n: fmtCount(snapshot.counts[l]) }))}
                  />
                </>
              ) : <EmptyState title="The grade snapshot is unavailable right now" tone="warning">The trade database did not answer, so no figure is shown.</EmptyState>}
            </Card>
          </section>
        )}
        {!grades && (
          <section className="pt-10" aria-labelledby="an-grades">
            <SectionHead as="h2" title={<span id="an-grades">Stock Trading Grades</span>} />
            <Card><p className="text-[15px] text-muted" data-figure="grades-gated">Not public yet.</p></Card>
          </section>
        )}

        {/* 6. Data quality */}
        <section className="pt-10" aria-labelledby="an-quality">
          <SectionHead as="h2" title={<span id="an-quality">Our own pipeline</span>} sub="How our data loads are doing, and what we have not read yet." />
          <Card>
            <ul className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              <li>
                <p className="text-[13px] font-bold uppercase tracking-[0.04em]">Scanned or paper filings not read</p>
                <p className="sf-kpi-value mt-1 font-display text-[34px] font-extrabold" data-figure="unread">{fmtCount(quality.unreadHouse + quality.unreadSenate)}</p>
                <p className="text-[13.5px] text-muted">{fmtCount(quality.unreadHouse)} scanned House PDFs and {fmtCount(quality.unreadSenate)} paper Senate reports, waiting for text recognition. Our count of {quality.unreadAsOf}; not redone on each load.</p>
              </li>
              {grades && (
                <li>
                  <p className="text-[13px] font-bold uppercase tracking-[0.04em]">Members not graded</p>
                  <p className="sf-kpi-value mt-1 font-display text-[34px] font-extrabold" data-figure="not-graded">{snapshot ? fmtCount(snapshot.notGraded) : <Unavail />}</p>
                  <p className="text-[13.5px] text-muted">Members in office with a scanned or paper report in the last 24 months we have not read, so no grade is given.</p>
                </li>
              )}
              <li>
                <p className="text-[13px] font-bold uppercase tracking-[0.04em]">Failed loader runs, 30 days</p>
                <p className="sf-kpi-value mt-1 font-display text-[34px] font-extrabold" data-figure="sync-failures">{quality.sync ? fmtCount(quality.sync.reduce((n, s) => n + s.failures30d, 0)) : <Unavail />}</p>
                <p className="text-[13.5px] text-muted">{quality.sync ? 'Runs in the load log that ended in a status other than complete. Detail by loader below.' : 'The load log is private and was not readable here.'}</p>
              </li>
            </ul>
            {quality.sync && (
              <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Loader runs from the sync log (table)">
                <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
                  <caption className="sr-only">Loader runs from the sync log</caption>
                  <thead>
                    <tr className="text-[12px] uppercase tracking-[0.04em] text-muted">
                      <th scope="col" className="px-2 py-1.5">Loader</th>
                      <th scope="col" className="px-2 py-1.5">Last completed</th>
                      <th scope="col" className="px-2 py-1.5">Latest run status</th>
                      <th scope="col" className="px-2 py-1.5 text-right">Failed runs, 30 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quality.sync.map((s) => (
                      <tr key={s.syncType} className="border-t border-line">
                        <th scope="row" className="px-2 py-1.5 font-semibold">{s.syncType}</th>
                        <td className="px-2 py-1.5">{fmtDateTime(s.lastComplete) ?? 'never'}</td>
                        <td className="px-2 py-1.5">{s.lastStatus ?? 'none in 30 days'}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtCount(s.failures30d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* 7. Downloads */}
        <section className="pt-10" aria-labelledby="an-dl">
          <SectionHead as="h2" title={<span id="an-dl">Download the rows</span>} sub="Existing CSV exports. Each has a row cap and carries the address of the official record on every row." />
          <Card>
            <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
              <li><a className="font-semibold text-trades-ink underline underline-offset-2" href="/data/trades/export">Congressional trades (CSV)</a>: the same filters as the <Link className="font-semibold text-trades-ink underline underline-offset-2" href="/data/trades">trades explorer</Link>; with none set, the first {fmtCount(EXPORT_ROW_CAP)} rows.</li>
              <li><a className="font-semibold text-trades-ink underline underline-offset-2" href="/data/contracts/export">Contract awards (CSV)</a>: the non-competed awards matching the <Link className="font-semibold text-trades-ink underline underline-offset-2" href="/data/contracts">contracts explorer</Link> filters.</li>
              <li>All downloads and the documented API: <Link className="font-semibold text-trades-ink underline underline-offset-2" href="/data#downloads">Data downloads</Link>.</li>
            </ul>
            {house && senate && house.count != null && senate.count != null && (
              <p className="mt-3 text-[12.5px] text-muted">The full trades table holds {fmtCount(house.count + senate.count)} rows; the export is capped, so filter to see the rest in pieces.</p>
            )}
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
