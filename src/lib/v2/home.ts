import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { getDatasetStatuses, type DatasetStatus } from '@/lib/v2/datasets';
import { getTradeStats } from '@/lib/v2/people';
import { getContractTotals, getMembersInOffice, TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * Homepage figures (D6a). Counts only, never invented totals: PostgREST aggregates are disabled on
 * this project, so every count is an exact head count (as D4 does) or a count over rows read in full.
 * Each reader returns null on any failure so the tile says "Unavailable" instead of a number.
 */

export interface HomeFigures {
  statuses: Record<'members' | 'house_trades' | 'senate_trades' | 'contracts' | 'campaign' | 'lobbying', DatasetStatus>;
  members: { total: number; inOffice: number | null; withTrades: number | null } | null;
  trades: { total: number; house: number; senate: number } | null;
  /** Awards the agency coded not competed ($1M+, rule r5-v1), by fiscal year signed. */
  noncompeted: { total: number; byFy: { fy: number; count: number }[]; lagDays: number } | null;
}

type HeadResult = { count: number | null; error: unknown };

async function headCount(build: () => PromiseLike<HeadResult>): Promise<number | null> {
  const { count, error } = await build();
  return error || count == null ? null : count;
}

async function readNoncompeted(): Promise<HomeFigures['noncompeted']> {
  if (!supabase) return null;
  const nb = () => supabase!.from('awards').select('id', { count: 'exact', head: true }).eq('competition_status', 'no_bid');
  // The fiscal years on file come from the rows, so a new year shows up without a code change.
  const [total, lo, hi, totals] = await Promise.all([
    headCount(nb),
    supabase.from('awards').select('fiscal_year').eq('competition_status', 'no_bid').not('fiscal_year', 'is', null).order('fiscal_year', { ascending: true }).limit(1),
    supabase.from('awards').select('fiscal_year').eq('competition_status', 'no_bid').not('fiscal_year', 'is', null).order('fiscal_year', { ascending: false }).limit(1),
    getContractTotals(),
  ]);
  const a = Number(lo.data?.[0]?.fiscal_year);
  const b = Number(hi.data?.[0]?.fiscal_year);
  if (total == null || lo.error || hi.error || !Number.isInteger(a) || !Number.isInteger(b) || b - a > 20) return null;
  const years = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const counts = await Promise.all(years.map((fy) => headCount(() => nb().eq('fiscal_year', fy))));
  if (counts.some((c) => c == null)) return null;
  const latest = totals?.find((r) => r.fiscal_year === b);
  return { total, byFy: years.map((fy, i) => ({ fy, count: counts[i]! })), lagDays: latest?.reporting_lag_days ?? 0 };
}

export const getHomeFigures = cache(async (): Promise<HomeFigures> => {
  const [list, members, inOffice, noncompeted, stats] = await Promise.all([
    getDatasetStatuses(['members', 'house_trades', 'senate_trades', 'contracts', 'campaign', 'lobbying']),
    supabase ? headCount(() => supabase!.from('congress_members').select('id', { count: 'exact', head: true }).not('bioguide_id', 'is', null)) : null,
    getMembersInOffice(),
    readNoncompeted().catch(() => null),
    getTradeStats().catch(() => null),
  ]);
  const statuses = Object.fromEntries(list.map((s) => [s.key, s])) as HomeFigures['statuses'];
  const ok = (s: DatasetStatus) => s.state === 'fresh' || s.state === 'stale';
  const { house_trades: house, senate_trades: senate } = statuses;
  return {
    statuses,
    members: members != null && ok(statuses.members) ? { total: members, inOffice, withTrades: stats ? stats.size : null } : null,
    trades:
      ok(house) && ok(senate) && house.rowCount != null && senate.rowCount != null
        ? { total: house.rowCount + senate.rowCount, house: house.rowCount, senate: senate.rowCount }
        : null,
    noncompeted: ok(statuses.contracts) ? noncompeted : null,
  };
});

// ---------------------------------------------------------------- latest filings

export interface LatestFiling {
  url: string;
  /** The first report's filing date (R6a original_filed_date). */
  firstReport: string;
  bioguide: string | null;
  member: string;
  chamber: string;
  party: string;
  state: string;
  sourceSystem: string;
  /** Every transaction row from this report in our data. */
  rowCount: number;
  /** The newest few, never a row whose dates look wrong in the filing. */
  trades: TradeRow[];
}

/**
 * The newest reports by first-report date, one entry per report, so a single 48-trade filing can't
 * fill the module. Rows with a date flag or an unknown first report never lead it.
 */
export const getLatestFilings = cache(async (reports = 6, perReport = 3): Promise<LatestFiling[] | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('congress_trades')
    .select('disclosure_url, original_filed_date')
    .is('date_flag', null)
    .not('original_filed_date', 'is', null)
    .not('disclosure_url', 'is', null)
    .order('original_filed_date', { ascending: false })
    .order('disclosure_url', { ascending: true })
    .limit(1000);
  if (error || !data) return null;
  const picked: { url: string; firstReport: string }[] = [];
  for (const r of data) {
    if (picked.length >= reports) break;
    if (!picked.some((p) => p.url === r.disclosure_url)) picked.push({ url: String(r.disclosure_url), firstReport: String(r.original_filed_date) });
  }
  const out = await Promise.all(
    picked.map(async (p) => {
      const [rows, n] = await Promise.all([
        supabase!
          .from('congress_trades')
          .select(TRADE_COLS)
          .eq('disclosure_url', p.url)
          .is('date_flag', null)
          .order('transaction_date', { ascending: false })
          .order('id', { ascending: true })
          .limit(perReport),
        headCount(() => supabase!.from('congress_trades').select('id', { count: 'exact', head: true }).eq('disclosure_url', p.url)),
      ]);
      if (rows.error || !rows.data?.length || n == null) return null;
      const t = rows.data[0] as TradeRow;
      return {
        ...p,
        bioguide: t.bio_guide_id,
        member: t.member_name,
        chamber: t.member_chamber,
        party: t.member_party,
        state: t.member_state,
        sourceSystem: t.source_system,
        rowCount: n,
        trades: rows.data as TradeRow[],
      } satisfies LatestFiling;
    }),
  );
  if (out.some((f) => f == null)) return null;
  return out as LatestFiling[];
});
