import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataSubNav from '@/components/v2/DataSubNav';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import ExplorerForm from '@/components/v2/ExplorerForm';
import FilingLink from '@/components/v2/FilingLink';
import LateReportList from '@/components/v2/LateReportList';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import Pager from '@/components/v2/Pager';
import SourceBar from '@/components/v2/SourceBar';
import { partyLetter } from '@/components/v2/TradesTable';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { buildHref, one, type SP } from '@/lib/v2/explorer';
import { LATENESS_BASIS_WORDING } from '@/lib/v2/date-flags';
import { lateFilersEnabled, lateFilersPreview } from '@/lib/v2/flags';
import { fmtCount, fmtDateShort, fmtPct } from '@/lib/v2/format';
import {
  MEMBER_SORTS, OVER_OPTIONS, REPORT_SORTS, STOCK_ACT_DAYS, getLateSummary, getReportTrades, pageReports, parseLateFilters, sortMembers, type MemberSort,
} from '@/lib/v2/late-filers';

// Behind lateFilersEnabled(): on in dev and preview, off on the production deployment unless SHOW_LATE_FILERS=1 (F1).
// Titled "Reports filed after the 45-day limit" (A8b W1, Apex): a label on reports, not on the people who filed them.
export const metadata: Metadata = pageMetadata({
  path: '/data/late-filers',
  title: 'Reports filed after the 45-day limit',
  description: 'The stock trades members of Congress reported the longest after the trade date, measured to the first report, grouped by report, each with a link to the filing.',
  robots: lateFilersPreview() ? { index: false, follow: false } : undefined,
});

const MEMBERS_SHOWN = 20;

/** "below the $1,000 reporting threshold" from the shared lateness_basis sentence (one wording source). */
function basisReason(basis: string): string {
  return (LATENESS_BASIS_WORDING[basis] ?? 'other reasons').replace(/^Lateness not computed: /, '').replace(/\.$/, '');
}
const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

export default async function LateFilersPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!lateFilersEnabled()) notFound();
  const sp = await searchParams;
  const f = parseLateFilters(sp);
  const msort: MemberSort = (MEMBER_SORTS.find((m) => m.value === one(sp.msort))?.value) ?? 'gap';
  const showAllMembers = one(sp.members) === 'all';
  const [summary, statuses] = await Promise.all([getLateSummary(), getDatasetStatuses(['house_trades', 'senate_trades'])]);
  const ranked = summary ? sortMembers(summary.members, msort) : [];
  const shownMembers = showAllMembers ? ranked : ranked.slice(0, MEMBERS_SHOWN);
  const rp = summary ? pageReports(summary, f, sp.page) : null;
  const reportItems = rp ? await Promise.all(rp.reports.map(async (report) => ({ report, trades: await getReportTrades(report, f.over) }))) : [];
  const tradeParams = {
    chamber: f.chamber,
    over: f.over === STOCK_ACT_DAYS ? '' : String(f.over),
    rsort: f.rsort === 'gap' ? '' : f.rsort,
    msort: msort === 'gap' ? '' : msort,
    members: showAllMembers ? 'all' : '',
  };
  const pagerHref = (page: number) => buildHref('/data/late-filers', { ...tradeParams, page: page > 1 ? String(page) : undefined });

  const memberColumns: DataTableColumn[] = [
    { key: 'member', header: 'Member', mobile: 'title', sortable: false },
    { key: 'reports', header: `Reports with a trade over ${STOCK_ACT_DAYS} days`, numeric: true, sortable: false },
    { key: 'over', header: 'Transactions in them', numeric: true, sortable: false },
    { key: 'gap', header: 'Longest gap', numeric: true, sortable: false },
  ];
  const memberRows: DataTableRow[] = shownMembers.map((m) => ({
    id: m.key,
    values: { member: m.name, reports: m.reports, over: m.over, gap: m.maxDays },
    cells: {
      member: (
        <span className="block min-w-0">
          {m.bioguide ? <Link href={`/people/${m.bioguide}`} className="font-semibold hover:underline">{m.name}</Link> : <b className="font-semibold">{m.name}</b>}
          <span className="block text-[12.5px] font-normal text-muted">{partyLetter(m.party)} · {m.state} · {m.chamber}</span>
        </span>
      ),
      gap: (
        <span className="block">
          <b className="font-mono text-[15px] font-semibold">{m.maxDays.toLocaleString('en-US')} days</b>
          <span className="block font-sans text-[12px] font-normal text-muted">{m.maxTicker}, traded {fmtDateShort(m.maxTraded)}</span>
          <FilingLink href={m.maxUrl} className="font-sans" />
        </span>
      ),
      reports: <b className="font-mono text-[15px] font-semibold">{fmtCount(m.reports)}</b>,
      over: <span className="text-muted">{fmtCount(m.over)} <span className="font-sans text-[12px]">(of {fmtCount(m.computed)} with a computed gap)</span></span>,
    },
  }));

  const notComputed = summary ? summary.totalRows - summary.computed : null;
  const reasons = summary?.notComputed ?? [];

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Data</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Reports filed after the 45-day limit</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          The longest gaps between a stock trade and the first report that disclosed it. Each is stated as days after the trade, with the STOCK Act&rsquo;s {STOCK_ACT_DAYS} days beside it and a link to the filing.
        </p>
        <DataSubNav current="/data/late-filers" />
      </PageBand>

      <Wrap className="pb-12">
        {lateFilersPreview() && (
          <p className="mt-6 rounded-2xl bg-stale-tint px-4 py-2.5 text-[13.5px] text-stale-ink">
            Preview only. This page is hidden on slushfund.net until its figures and wording have been audited.
          </p>
        )}
        <SourceBar datasets={['house_trades', 'senate_trades']} className={lateFilersPreview() ? 'mt-4' : 'mt-6'} />

        <section className="pt-6" aria-labelledby="lf-read">
          <Card>
            <h2 id="lf-read" className="font-display text-[22px] font-extrabold">How to read this</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14.5px] text-muted">
              <li>
                <b className="text-ink">The gap</b> is the number of days from the trade date to the day the first report holding it was filed. An amended report does not reset it.
              </li>
              <li>
                <b className="text-ink">The STOCK Act sets a {STOCK_ACT_DAYS}-day limit.</b> The count can start when the member learns of the trade, which a filing does not always show, so a gap over {STOCK_ACT_DAYS} days
                is a measured fact about two dates, not a finding about the filer. Dates are as the member filed them; see the House Clerk or Senate eFD record linked on each row.
              </li>
              <li>
                <b className="text-ink">Grouped by report.</b> One report can hold hundreds of trades, so the trade list has one row per report, each opening to its trades. Members are ranked by the longest single
                gap or by how many reports hold a trade over {STOCK_ACT_DAYS} days, never by the number of transactions.
              </li>
              <li>
                <b className="text-ink">What is left out.</b>{' '}
                {notComputed != null && summary
                  ? <>
                      Lateness is not computed for {fmtCount(notComputed)} of {fmtCount(summary.totalRows)} trade rows
                      {reasons.length > 0 && <>: {reasons.map((r, i) => <span key={i}>{i ? '; ' : ''}{fmtCount(r.count)} ({basisReason(r.basis)})</span>)}</>}.
                      {' '}They are left off this page and are never counted either way.{' '}
                    </>
                  : null}
                Scanned House reports and paper Senate reports have not been read, so a trade in one of them is missing here and nothing is said about its timing. Senate filings are loaded from 2024 and House filings from 2021.
              </li>
            </ul>
            {summary && (
              <p className="mt-4 rounded-2xl bg-page px-4 py-3 text-[14px]">
                <b>{fmtCount(summary.over)}</b> transactions in <b>{fmtCount(summary.reports.length)}</b> reports were filed more than {STOCK_ACT_DAYS} days after the trade, by <b>{fmtCount(summary.members.length)}</b> members.
                That is {fmtPct(summary.over / summary.computed)} of the {fmtCount(summary.computed)} trades whose lateness we compute.
              </p>
            )}
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="lf-members">
          <SectionHead
            as="h2"
            title={<span id="lf-members">Members, by gap</span>}
            sub="Members with at least one trade reported more than 45 days after the trade date."
          />
          {summary === null ? (
            <EmptyState title="The member ranking is unavailable right now" tone="warning" statuses={statuses}>
              The database did not answer, so nothing is shown rather than a stand-in.
            </EmptyState>
          ) : (
            <Card>
              <p className="mb-3 flex flex-wrap items-center gap-2 text-[13.5px]">
                <span className="text-muted">Rank by:</span>
                {MEMBER_SORTS.map((m) => (
                  <Link
                    key={m.value}
                    href={buildHref('/data/late-filers', { ...tradeParams, msort: m.value === 'gap' ? '' : m.value, page: undefined })}
                    aria-current={msort === m.value ? 'true' : undefined}
                    className={`rounded-full px-3 py-1 font-semibold ${msort === m.value ? 'bg-ink text-white' : 'bg-page text-ink hover:bg-neutral-tint'}`}
                  >
                    {m.label}
                  </Link>
                ))}
              </p>
              <DataTable
                columns={memberColumns}
                rows={memberRows}
                caption="Members ranked by the gap between a trade and its first report, or by reports"
                footer={<span>A report is one first report holding at least one trade filed more than {STOCK_ACT_DAYS} days after the trade; restated filings are not counted again, and each member&rsquo;s count matches the late-report count in our database. &ldquo;Transactions in them&rdquo; is the secondary count; &ldquo;of N with a computed gap&rdquo; counts all of the member&rsquo;s trades whose gap we compute, in any report.</span>}
              />
              {ranked.length > MEMBERS_SHOWN && (
                <p className="mt-3 text-[13.5px]">
                  {showAllMembers
                    ? <Link href={buildHref('/data/late-filers', { ...tradeParams, members: undefined, page: undefined })} className="font-semibold text-trades-ink hover:underline">Show the top {MEMBERS_SHOWN}</Link>
                    : <Link href={buildHref('/data/late-filers', { ...tradeParams, members: 'all', page: undefined })} className="font-semibold text-trades-ink hover:underline">Show all {fmtCount(ranked.length)} members</Link>}
                </p>
              )}
            </Card>
          )}
        </section>

        <section className="pt-8" aria-labelledby="lf-trades">
          <SectionHead
            as="h2"
            title={<span id="lf-trades">Trades, by report</span>}
            sub={`One row per report that holds a trade filed after day ${f.over}. Open a row for its trades.`}
          />
          <Card>
            <ExplorerForm action="/data/late-filers" defaults={{ over: String(STOCK_ACT_DAYS), rsort: 'gap' }} className="mb-4 grid grid-cols-[1fr_1fr_1fr_auto] gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
              {msort !== 'gap' && <input type="hidden" name="msort" value={msort} />}
              {showAllMembers && <input type="hidden" name="members" value="all" />}
              <div>
                <label htmlFor="lf-chamber" className={label}>Chamber</label>
                <select id="lf-chamber" name="chamber" defaultValue={f.chamber} className={field}>
                  <option value="">Both</option>
                  <option value="House">House</option>
                  <option value="Senate">Senate</option>
                </select>
              </div>
              <div>
                <label htmlFor="lf-over" className={label}>Gap longer than</label>
                <select id="lf-over" name="over" defaultValue={String(f.over)} className={field}>
                  {OVER_OPTIONS.map((o) => <option key={o} value={o}>{o} days</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="lf-rsort" className={label}>Order reports by</label>
                <select id="lf-rsort" name="rsort" defaultValue={f.rsort} className={field}>
                  {REPORT_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="h-11 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:bg-deep max-sm:w-full">Apply</button>
              </div>
            </ExplorerForm>
            {rp === null ? (
              <EmptyState title="The reports are unavailable right now" tone="warning" statuses={statuses}>
                The database did not answer, so nothing is shown rather than a stand-in.
              </EmptyState>
            ) : rp.total === 0 ? (
              <p className="rounded-2xl bg-page px-4 py-6 text-center text-[14.5px] text-muted">No report in our records holds a trade with a gap longer than {f.over} days{f.chamber ? ` in the ${f.chamber}` : ''}.</p>
            ) : (
              <>
                <p className="mb-3 text-[13.5px] text-muted" aria-live="polite">
                  {fmtCount(rp.total)} {rp.total === 1 ? 'report' : 'reports'} holding {fmtCount(rp.trades)} {rp.trades === 1 ? 'trade' : 'trades'}{rp.pages > 1 ? ` · page ${fmtCount(rp.page)} of ${fmtCount(rp.pages)}` : ''}
                </p>
                <LateReportList items={reportItems} over={f.over} />
                <Pager page={rp.page} pages={rp.pages} href={pagerHref} />
              </>
            )}
          </Card>
        </section>

        <p className="mt-6 max-w-[860px] text-[13px] text-muted">
          Gaps are computed by our loader from two dates in the filings (the trade date and the first report&rsquo;s filing date) and can be checked by hand from the linked filing.
          Each report links to the first report that listed the trades. Where a later filing restated them, that filing is named beside it (&ldquo;restated in&rdquo;) and linked; it never replaces the first report&rsquo;s date.
          See <Link href="/about/methodology/trades" className="font-semibold text-trades-ink hover:underline">how trades are collected</Link>.
        </p>
      </Wrap>
    </div>
  );
}
