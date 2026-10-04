import 'server-only';
import { supabase } from '@/lib/supabase';
import { PAGE_SIZE, memo, one, pageOf, pick, readAll, type SP } from '@/lib/v2/explorer';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * Late-filers board (D4), behind the lateFilersEnabled() flag until an Auditor GO.
 *
 * days_to_file is R6a's value: the first report's filing date (original_filed_date) minus the trade
 * date. It is NULL, and the row never appears here, when the trade date looks wrong in the filing
 * (date_flag) or the first report is unknown. date_flag is read as a plain value: a row that has both
 * a date_flag and a days_to_file (R6c may add such rows) is shown with its flag noted, nothing more.
 * The STOCK Act asks for 45 days; nothing here says a filing broke any rule.
 */

export const STOCK_ACT_DAYS = 45;
export const OVER_OPTIONS = [45, 90, 180, 365] as const;

export interface LateTrade extends TradeRow {
  days_to_file: number;
}

export interface LateFilters {
  chamber: '' | 'House' | 'Senate';
  /** Gap above this many days. */
  over: number;
}

export const LATE_PARAMS = ['chamber', 'over', 'page', 'msort', 'members'] as const;

export function parseLateFilters(sp: SP): LateFilters {
  const over = Number(one(sp.over));
  return {
    chamber: pick(sp.chamber, ['House', 'Senate'] as const),
    over: (OVER_OPTIONS as readonly number[]).includes(over) ? over : STOCK_ACT_DAYS,
  };
}

const COLS = `${TRADE_COLS}, days_to_file`;
const sample = () => supabase!.from('congress_trades').select(COLS, { count: 'exact' });
type Q = ReturnType<typeof sample>;

function base(q: Q, f: LateFilters): Q {
  q = q.not('days_to_file', 'is', null).gt('days_to_file', f.over);
  if (f.chamber) q = q.eq('member_chamber', f.chamber);
  return q;
}

export interface LatePage {
  rows: LateTrade[];
  total: number;
  page: number;
  pages: number;
}

/** The trades with the longest gap between trade and first report, longest first. */
export async function getLateTrades(f: LateFilters, pageParam: string | string[] | undefined): Promise<LatePage | null> {
  if (!supabase) return null;
  const head = await base(supabase.from('congress_trades').select('id', { count: 'exact', head: true }) as unknown as Q, f);
  if (head.error || head.count == null) return null;
  const total = head.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = pageOf(pageParam, pages);
  if (total === 0) return { rows: [], total, page, pages };
  const from = (page - 1) * PAGE_SIZE;
  const { data, error } = await base(sample(), f)
    .order('days_to_file', { ascending: false })
    .order('transaction_date', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (error || !data) return null;
  return { rows: data as unknown as LateTrade[], total, page, pages };
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
  /** Distinct reports (filings) holding at least one of them. */
  reports: number;
  maxDays: number;
  maxUrl: string | null;
  maxTicker: string;
  maxTraded: string;
}

export interface LateSummary {
  members: LateMember[];
  /** Trades whose gap is computed, and of those how many were reported over 45 days after. */
  computed: number;
  over: number;
  /** Every trade row, whether or not a gap could be computed. */
  totalRows: number;
}

type Slim = Pick<TradeRow, 'id' | 'bio_guide_id' | 'member_name' | 'member_chamber' | 'member_party' | 'member_state' | 'disclosure_url' | 'ticker' | 'transaction_date'> & { days_to_file: number };

/** Per-member gaps over every trade with a computed gap. Memoized 30 min (~25 requests cold). */
export const getLateSummary = memo(async (): Promise<LateSummary | null> => {
  if (!supabase) return null;
  const [rows, all] = await Promise.all([
    readAll<Slim>((from, to) =>
      supabase!
        .from('congress_trades')
        .select('id, bio_guide_id, member_name, member_chamber, member_party, member_state, disclosure_url, ticker, transaction_date, days_to_file', { count: 'exact' })
        .not('days_to_file', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase.from('congress_trades').select('id', { count: 'exact', head: true }),
  ]);
  if (!rows || all.error || all.count == null) return null;
  const by = new Map<string, LateMember & { urls: Set<string> }>();
  let over = 0;
  for (const r of rows) {
    const days = Number(r.days_to_file);
    const key = r.bio_guide_id || r.member_name;
    let m = by.get(key);
    if (!m) {
      m = {
        key, bioguide: r.bio_guide_id, name: r.member_name, chamber: r.member_chamber, party: r.member_party, state: r.member_state,
        computed: 0, over: 0, reports: 0, maxDays: -1, maxUrl: null, maxTicker: '', maxTraded: '', urls: new Set(),
      };
      by.set(key, m);
    }
    m.computed += 1;
    if (days > STOCK_ACT_DAYS) {
      over += 1;
      m.over += 1;
      m.urls.add(r.disclosure_url ?? `row:${r.id}`);
    }
    if (days > m.maxDays || (days === m.maxDays && r.transaction_date < m.maxTraded)) {
      m.maxDays = days;
      m.maxUrl = r.disclosure_url;
      m.maxTicker = r.ticker;
      m.maxTraded = r.transaction_date;
    }
  }
  const members = [...by.values()]
    .filter((m) => m.over > 0)
    .map(({ urls, ...m }) => ({ ...m, reports: urls.size }));
  return { members, computed: rows.length, over, totalRows: all.count };
});

export type MemberSort = 'gap' | 'reports' | 'trades';
export const MEMBER_SORTS: { value: MemberSort; label: string }[] = [
  { value: 'gap', label: 'Longest single gap' },
  { value: 'reports', label: 'Most reports holding a trade over 45 days' },
  { value: 'trades', label: 'Most trades over 45 days' },
];

export function sortMembers(list: LateMember[], sort: MemberSort): LateMember[] {
  const by = (a: LateMember, b: LateMember) =>
    sort === 'reports' ? b.reports - a.reports || b.maxDays - a.maxDays
    : sort === 'trades' ? b.over - a.over || b.maxDays - a.maxDays
    : b.maxDays - a.maxDays || b.over - a.over;
  return [...list].sort((a, b) => by(a, b) || a.name.localeCompare(b.name));
}
