import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataSubNav from '@/components/v2/DataSubNav';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { MonthLine, RankBars } from '@/components/v2/RankChart';
import SourceBar from '@/components/v2/SourceBar';
import { partyLetter } from '@/components/v2/TradesTable';
import { STATE_CODES, buildHref, one, type SP } from '@/lib/v2/explorer';
import { GRADE_METHOD_PATH, MOST_ACTIVE_PATH, SECTOR_HEATMAP_PATH, gradesEnabled, mostActiveEnabled, sectorHeatmapEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate, fmtUsd } from '@/lib/v2/format';
import { GRADE_FIXED_LINE, gradeOf } from '@/lib/v2/grade-method';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { getLeaderboard, unreadReportsInWindow, type LeaderRow } from '@/lib/v2/report-card';
import { seatLabel } from '@/lib/v2/people';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D10 leaderboard (G1 §2). Behind mostActiveEnabled() (off on production unless SHOW_MOST_ACTIVE=1); the grade column
// behind gradesEnabled(). Ranked by counts and band minimums only. Party is a text label; every bar has one colour.
export function generateMetadata(): Metadata {
  if (!mostActiveEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: MOST_ACTIVE_PATH,
    title: 'Most active stock traders in Congress',
    description: 'Members of Congress ranked by the individual-stock transactions they reported in the last 24 months, the reported value (sum of band minimums) and reports filed more than 45 days after the trade.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const SORTS = [
  { value: 'tx', label: 'Transactions', unit: 'Transactions' },
  { value: 'value', label: 'Reported value (at least)', unit: 'Reported value, at least' },
  { value: 'late', label: 'Reports filed more than 45 days after the trade', unit: 'Reports' },
] as const;
type Sort = (typeof SORTS)[number]['value'];
const SHOWN = 50;
const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

const metric = (r: LeaderRow, s: Sort) => (s === 'tx' ? r.transactions : s === 'value' ? r.valueMin : r.lateReports);
const display = (r: LeaderRow, s: Sort) => (s === 'tx' ? fmtCount(r.transactions)! : s === 'value' ? `at least ${fmtUsd(r.valueMin)}` : fmtCount(r.lateReports)!);

export default async function MostActivePage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!mostActiveEnabled()) notFound();
  const sp = await searchParams;
  const sort: Sort = (SORTS.find((s) => s.value === one(sp.sort))?.value) ?? 'tx';
  const chamber = ['House', 'Senate'].includes(one(sp.chamber)) ? one(sp.chamber) : '';
  const state = (STATE_CODES as readonly string[]).includes(one(sp.state).toUpperCase()) ? one(sp.state).toUpperCase() : '';
  const showAll = one(sp.all) === '1';
  const grades = gradesEnabled();
  const board = await getLeaderboard();

  const head = (
    <PageBand>
      <h1 className="mt-8 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:mt-5 max-md:text-[30px]">Most active stock traders in Congress</h1>
      <p className="mt-2 max-w-[860px] text-[16px] text-on-deep">
        Individual-stock transactions members reported in the last 24 months, from House Clerk and Senate eFD periodic transaction reports.
      </p>
      <DataSubNav current={MOST_ACTIVE_PATH} />
    </PageBand>
  );
  if (!board) {
    return (
      <div data-v2>
        {head}
        <Wrap className="pb-12 pt-6"><EmptyState title="The leaderboard is unavailable right now" tone="warning">The trade database did not answer, so nothing is shown.</EmptyState></Wrap>
      </div>
    );
  }

  const parties = [...new Set(board.rows.map((r) => r.member.party).filter(Boolean))].sort();
  const party = parties.includes(one(sp.party)) ? one(sp.party) : '';
  const filtered = board.rows
    .filter((r) => (!chamber || r.member.chamber === chamber) && (!party || r.member.party === party) && (!state || r.member.state === state))
    .sort((a, b) => metric(b, sort) - metric(a, sort) || b.transactions - a.transactions || a.member.name.localeCompare(b.member.name));
  const top = filtered.slice(0, 25);
  const shown = showAll ? filtered : filtered.slice(0, SHOWN);
  const unit = SORTS.find((s) => s.value === sort)!.unit;
  const params = { sort: sort === 'tx' ? undefined : sort, chamber: chamber || undefined, party: party || undefined, state: state || undefined };
  const total = board.win.months.reduce((n, m) => n + m.count, 0);
  // Trades are reported up to 45 days (or more) after the trade, so the last two months are still filling in.
  const lagFrom = board.win.months.length >= 2 ? board.win.months[board.win.months.length - 2].month : undefined;

  const columns: DataTableColumn[] = [
    { key: 'rank', header: '#', numeric: true, sortable: false, mobile: 'hidden' },
    { key: 'member', header: 'Member', mobile: 'title', sortable: false },
    { key: 'tx', header: 'Transactions', numeric: true, sortable: false },
    { key: 'value', header: 'Reported value (sum of band minimums)', numeric: true, sortable: false },
    { key: 'late', header: 'Reports filed more than 45 days after the trade', numeric: true, sortable: false },
    ...(grades ? [{ key: 'grade', header: 'Stock Trading Grade', sortable: false } as DataTableColumn] : []),
  ];
  const rows: DataTableRow[] = shown.map((r, i) => {
    const g = grades && r.member.in_office ? gradeOf(board.win.byMember.get(r.bioguide) ?? [], r, unreadReportsInWindow(r.bioguide, board.win)) : null;
    return {
      id: r.bioguide,
      values: { rank: i + 1, member: r.member.name, tx: r.transactions, value: r.valueMin, late: r.lateReports, grade: g ? (g.letter === 'NG' ? 'Not graded' : g.letter) : null },
      cells: {
        member: (
          <span className="block min-w-0">
            <Link href={`/people/${r.bioguide}`} className="font-semibold hover:underline">{r.member.name}</Link>
            <span className="block text-[12.5px] font-normal text-muted">{partyLetter(r.member.party)} · {seatLabel(r.member)} · {r.member.chamber}{r.member.in_office ? '' : ' · former member'}</span>
          </span>
        ),
        value: <span className="whitespace-nowrap font-mono">at least {fmtUsd(r.valueMin)}</span>,
        ...(grades ? { grade: g ? (g.letter === 'NG' ? <span className="sf-ng-cell text-[13.5px] font-semibold">Not graded <span className="font-normal text-muted">({g.unread} unread {g.unread === 1 ? 'report' : 'reports'})</span></span> : <span data-letter={g.letter} className="sf-grade-cell font-display text-[18px] font-extrabold">{g.letter} <span className="font-mono text-[12px] font-normal text-muted">{g.score} pts</span></span>) : <span className="text-[12.5px] text-muted">sitting members only</span> } : {}),
      },
    };
  });

  return (
    <div data-v2>
      {head}
      <Wrap className="pb-12">
        <SourceBar datasets={['house_trades', 'senate_trades']} className="mt-6" />
        <Card className="mt-6">
          <form method="get" action={MOST_ACTIVE_PATH} className="grid grid-cols-5 items-end gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
            <label className="block min-w-0">
              <span className={lbl}>Rank by</span>
              <select name="sort" defaultValue={sort} className={field}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </label>
            <label className="block min-w-0">
              <span className={lbl}>Chamber</span>
              <select name="chamber" defaultValue={chamber} className={field}><option value="">Both</option><option value="House">House</option><option value="Senate">Senate</option></select>
            </label>
            <label className="block min-w-0">
              <span className={lbl}>Party</span>
              <select name="party" defaultValue={party} className={field}><option value="">All</option>{parties.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </label>
            <label className="block min-w-0">
              <span className={lbl}>State</span>
              <select name="state" defaultValue={state} className={field}><option value="">All</option>{STATE_CODES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </label>
            <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-[15px] font-bold text-white hover:bg-deep">Show</button>
          </form>
        </Card>

        <section className="pt-8" aria-labelledby="top25">
          <Card>
            <SectionHead as="h2" title={<span id="top25" className="text-[24px] max-md:text-[22px]">Top {fmtCount(top.length)} by {SORTS.find((s) => s.value === sort)!.label.toLowerCase()}</span>} sub={`Trades dated ${fmtDate(board.win.start)} to ${fmtDate(board.win.end)}. Party is shown as a label.`} />
            {top.length ? (
              <RankBars rows={top.map((r) => ({ key: r.bioguide, name: r.member.name, tag: `${partyLetter(r.member.party)}-${r.member.state}`, value: metric(r, sort), display: display(r, sort) }))} label={`Top ${top.length} members by ${unit.toLowerCase()}`} unit={unit} />
            ) : (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No member with individual-stock transactions in the window matches these filters.</p>
            )}
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="trend">
          <Card>
            <SectionHead as="h2" title={<span id="trend" className="text-[24px] max-md:text-[22px]">All congressional trades per month</span>} sub={`${fmtCount(total)} disclosed transactions of every kind (stocks, options, bonds, funds and other) by the month of the trade date, both chambers, all members.`} />
            <MonthLine points={board.win.months} label="Disclosed congressional transactions per month of the trade date" lagFrom={lagFrom} />
            <p className="mt-2 text-[12.5px] text-muted">The shaded months are still filling in: trades are reported up to 45 days after the trade date, and some later. Counts of transactions, not money.</p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="table">
          <Card>
            <SectionHead as="h2" title={<span id="table" className="text-[24px] max-md:text-[22px]">Every member with an individual-stock trade in the window</span>} sub={`${fmtCount(filtered.length)} members. Reported value adds the lowest amount of each disclosed range, so it reads “at least”; the real figure can be much higher.`} />
            <DataTable columns={columns} rows={rows} caption="Members of Congress by individual-stock transactions reported in the last 24 months" csv={{ filename: 'most-active-traders' }} />
            {!showAll && filtered.length > SHOWN && (
              <p className="mt-3 text-[13px] text-muted">Showing {SHOWN} of {fmtCount(filtered.length)}. <Link href={buildHref(MOST_ACTIVE_PATH, { ...params, all: '1' }) + '#table'} className="font-semibold text-trades-ink hover:underline">Show all</Link>.</p>
            )}
            <div className="mt-4 space-y-2 text-[13px] text-muted">
              <p>
                Counted: stocks, stock options and other single-company securities, self, spouse and dependent child, with trade dates in the window as filed. Not counted: funds, ETFs, Treasuries, municipal securities and other assets a stock-trading ban would allow; bonds; rows whose dates carry a date note. Reports are counted once per first report, never per transaction.
                The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade; a gap over 45 days is a measured fact about two dates as the member filed them, not a finding about the filer.
              </p>
              {grades && <p className="font-semibold text-ink">{GRADE_FIXED_LINE} <Link href={GRADE_METHOD_PATH} className="font-normal underline">Method</Link></p>}
              <p>These are counts from public filings. Ranking by them says how much a member reported, not why.</p>
              {sectorHeatmapEnabled() && <p>Which sectors and tickers they traded: <Link href={SECTOR_HEATMAP_PATH} className="font-semibold text-trades-ink hover:underline">What Congress is trading</Link>.</p>}
            </div>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
