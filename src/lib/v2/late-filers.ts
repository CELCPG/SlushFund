import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, one, pick, readAll, type SP } from '@/lib/v2/explorer';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * Late-filers board (D4, grouped by report in D6b), behind the lateFiltersEnabled() flag until an Auditor GO.
 *
 * days_to_file is R6a's value: the first report's filing date (original_filed_date) minus the trade
 * date. Since R6e a row is on the board only when stock_act_late is not NULL (lateness_basis
 * 'computed'): rows below the $1,000 reporting threshold keep days_to_file for information but are
 * never late, and rows with an unknown first report or dates that look inconsistent are not computed.
 * Every NULL is counted by its lateness_basis and stated on the page (latenessNote in date-flags.ts).
 * R6c's `stale_2y_corroborated` rows are computed; they carry their date-flag sentence.
 * The STOCK Act asks for 45 days; nothing here says a filing broke any rule. Members and reports are
 * ranked by reports or by days, never by transaction counts (A7b).
 *
 * A "report" is one first report: a filing URL plus the date of the first report. One report can hold
 * hundreds of trades, so the trade list is grouped by report (one row each, expandable).
 */

export const STOCK_ACT_DAYS = 45;
export const OVER_OPTIONS = [45, 90, 180, 365] as const;
export const REPORTS_PER_PAGE = 20;
/** Trades listed inside one expanded report (the longest gaps first); the rest are one link away. */
export const REPORT_TRADES_SHOWN = 25;

export interface LateTrade extends TradeRow {
  days_to_file: number;
}

export type ReportSort = 'gap' | 'recent';
export const REPORT_SORTS: { value: ReportSort; label: string }[] = [
  { value: 'gap', label: 'Largest gap' },
  { value: 'recent', label: 'Newest report' },
];

export interface LateFilters {
  chamber: '' | 'House' | 'Senate';
  /** Gap above this many days. */
  over: number;
  rsort: ReportSort;
}

export const LATE_PARAMS = ['chamber', 'over', 'page', 'msort', 'members', 'rsort'] as const;

export function parseLateFilters(sp: SP): LateFilters {
  const over = Number(one(sp.over));
  return {
    chamber: pick(sp.chamber, ['House', 'Senate'] as const),
    over: (OVER_OPTIONS as readonly number[]).includes(over) ? over : STOCK_ACT_DAYS,
    rsort: pick(sp.rsort, REPORT_SORTS.map((s) => s.value)) || 'gap',
  };
}

const COLS = `${TRADE_COLS}, days_to_file`;

// ---------------------------------------------------------------- reports

export interface LateReport {
  key: string;
  /** The filing the rows link to (for an amended row, the amended report). */
  url: string | null;
  /** Used to find the rows when there is no URL. */
  firstId: string;
  bioguide: string | null;
  memberKey: string;
  name: string;
  chamber: string;
  party: string;
  state: string;
  /** Date of the first report holding these trades. */
  reportDate: string | null;
  /** Trades in this report with a computed gap. */
  computed: number;
  /** Gaps over 45 days, longest first. */
  gaps: number[];
  /** Trades in this report that carry a date flag. */
  flagged: number;
  maxDays: number;
  maxTicker: string;
  maxTraded: string;
}

export interface LateReportView extends LateReport {
  /** Trades in the report over the chosen limit. */
  overCount: number;
}

// ---------------------------------------------------------------- members

export interface LateMember {
  key: string;
  bioguide: string | null;
  name: string;
  chamber: string;
  party: string;
  state: string;
  /** Trades with a computed gap. */
  computed: number;
  /** Of those, trades reported more than 45 days after. */
  over: number;
  /** Distinct first reports holding at least one of them. */
  reports: number;
  maxDays: number;
  maxUrl: string | null;
  maxTicker: string;
  maxTraded: string;
}

export interface LateSummary {
  members: LateMember[];
  reports: LateReport[];
  /** Trades whose gap is computed, and of those how many were reported over 45 days after. */
  computed: number;
  over: number;
  /** Every trade row, whether or not a gap could be computed. */
  totalRows: number;
  /** Rows whose lateness is not computed, by lateness_basis (R6e), largest first. */
  notComputed: { basis: string; count: number }[];
}

/** R6e lateness_basis values other than 'computed'; each one has a sentence in date-flags.ts. */
export const NOT_COMPUTED_BASES = [
  'below_reporting_threshold', 'original_filing_unknown', 'not_computed_date_stale_2y', 'not_computed_date_after_filing', 'not_computed_date_future',
] as const;

type Slim = Pick<TradeRow, 'id' | 'bio_guide_id' | 'member_name' | 'member_chamber' | 'member_party' | 'member_state' | 'disclosure_url' | 'ticker' | 'transaction_date' | 'original_filed_date' | 'date_flag'> & { days_to_file: number };

/** Per-member and per-report gaps over every trade with a computed gap. Memoized 30 min (~25 requests cold). */
export const getLateSummary = memo(async (): Promise<LateSummary | null> => {
  if (!supabase) return null;
  const [rows, all, ...bases] = await Promise.all([
    readAll<Slim>((from, to) =>
      supabase!
        .from('congress_trades')
        .select('id, bio_guide_id, member_name, member_chamber, member_party, member_state, disclosure_url, ticker, transaction_date, original_filed_date, date_flag, days_to_file', { count: 'exact' })
        .not('stock_act_late', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase.from('congress_trades').select('id', { count: 'exact', head: true }),
    ...NOT_COMPUTED_BASES.map((b) => supabase!.from('congress_trades').select('id', { count: 'exact', head: true }).eq('lateness_basis', b)),
  ]);
  if (!rows || all.error || all.count == null || bases.some((b) => b.error)) return null;
  const notComputed = NOT_COMPUTED_BASES.map((basis, i) => ({ basis, count: bases[i].count ?? 0 })).filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
  const by = new Map<string, LateMember & { keys: Set<string> }>();
  const reports = new Map<string, LateReport>();
  let over = 0;
  for (const r of rows) {
    const days = Number(r.days_to_file);
    const memberKey = r.bio_guide_id || r.member_name;
    const reportKey = `${r.disclosure_url ?? `row:${r.id}`}|${r.original_filed_date ?? ''}`;
    let m = by.get(memberKey);
    if (!m) {
      m = {
        key: memberKey, bioguide: r.bio_guide_id, name: r.member_name, chamber: r.member_chamber, party: r.member_party, state: r.member_state,
        computed: 0, over: 0, reports: 0, maxDays: -1, maxUrl: null, maxTicker: '', maxTraded: '', keys: new Set(),
      };
      by.set(memberKey, m);
    }
    let rep = reports.get(reportKey);
    if (!rep) {
      rep = {
        key: reportKey, url: r.disclosure_url, firstId: r.id, bioguide: r.bio_guide_id, memberKey, name: r.member_name, chamber: r.member_chamber,
        party: r.member_party, state: r.member_state, reportDate: r.original_filed_date ?? null, computed: 0, gaps: [], flagged: 0, maxDays: -1, maxTicker: '', maxTraded: '',
      };
      reports.set(reportKey, rep);
    }
    m.computed += 1;
    rep.computed += 1;
    if (r.date_flag) rep.flagged += 1;
    if (days > STOCK_ACT_DAYS) {
      over += 1;
      m.over += 1;
      m.keys.add(reportKey);
      rep.gaps.push(days);
    }
    if (days > m.maxDays || (days === m.maxDays && r.transaction_date < m.maxTraded)) {
      m.maxDays = days;
      m.maxUrl = r.disclosure_url;
      m.maxTicker = r.ticker;
      m.maxTraded = r.transaction_date;
    }
    if (days > rep.maxDays || (days === rep.maxDays && r.transaction_date < rep.maxTraded)) {
      rep.maxDays = days;
      rep.maxTicker = r.ticker;
      rep.maxTraded = r.transaction_date;
    }
  }
  const members = [...by.values()]
    .filter((m) => m.over > 0)
    .map(({ keys, ...m }) => ({ ...m, reports: keys.size }));
  const late = [...reports.values()].filter((r) => r.gaps.length > 0).map((r) => ({ ...r, gaps: r.gaps.sort((a, b) => b - a) }));
  return { members, reports: late, computed: rows.length, over, totalRows: all.count, notComputed };
});

export interface ReportPage {
  reports: LateReportView[];
  /** Reports with at least one trade over the limit, in this chamber. */
  total: number;
  /** Trades over the limit across those reports. */
  trades: number;
  page: number;
  pages: number;
}

/** The reports holding a trade over the limit, in the chosen order, one page of them. */
export function pageReports(summary: LateSummary, f: LateFilters, pageParam: string | string[] | undefined): ReportPage {
  const views: LateReportView[] = summary.reports
    .filter((r) => !f.chamber || r.chamber === f.chamber)
    .map((r) => ({ ...r, overCount: r.gaps.filter((g) => g > f.over).length }))
    .filter((r) => r.overCount > 0);
  const byDate = (a: LateReportView, b: LateReportView) => (b.reportDate ?? '').localeCompare(a.reportDate ?? '');
  views.sort((a, b) =>
    (f.rsort === 'recent' ? byDate(a, b) || b.maxDays - a.maxDays
      : b.maxDays - a.maxDays || b.overCount - a.overCount) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  const total = views.length;
  const pages = Math.max(1, Math.ceil(total / REPORTS_PER_PAGE));
  const n = Math.floor(Number(one(pageParam)));
  const page = Number.isFinite(n) ? Math.min(pages, Math.max(1, n)) : 1;
  return {
    reports: views.slice((page - 1) * REPORTS_PER_PAGE, page * REPORTS_PER_PAGE),
    total,
    trades: views.reduce((s, r) => s + r.overCount, 0),
    page,
    pages,
  };
}

/** The longest-gap trades of one report that are over the limit. null on failure. */
export async function getReportTrades(r: LateReport, over: number, limit = REPORT_TRADES_SHOWN): Promise<LateTrade[] | null> {
  if (!supabase) return null;
  let q = supabase.from('congress_trades').select(COLS).eq('stock_act_late', true).gt('days_to_file', over);
  q = r.url ? q.eq('disclosure_url', r.url) : q.eq('id', r.firstId);
  q = r.reportDate ? q.eq('original_filed_date', r.reportDate) : q.is('original_filed_date', null);
  const { data, error } = await q
    .order('days_to_file', { ascending: false })
    .order('transaction_date', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (error || !data) return null;
  return data as unknown as LateTrade[];
}

export type MemberSort = 'gap' | 'reports';
export const MEMBER_SORTS: { value: MemberSort; label: string }[] = [
  { value: 'gap', label: 'Longest single gap' },
  { value: 'reports', label: 'Most reports holding a trade over 45 days' },
];

export function sortMembers(list: LateMember[], sort: MemberSort): LateMember[] {
  const by = (a: LateMember, b: LateMember) =>
    sort === 'reports' ? b.reports - a.reports || b.maxDays - a.maxDays
    : b.maxDays - a.maxDays || b.reports - a.reports;
  return [...list].sort((a, b) => by(a, b) || a.name.localeCompare(b.name));
}
