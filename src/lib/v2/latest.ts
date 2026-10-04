import 'server-only';
import { supabase } from '@/lib/supabase';
import type { AwardRow } from '@/lib/v2/companies';
import { one, pick, type SP } from '@/lib/v2/explorer';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * The /latest feed and its RSS (D6b): new trade reports by first-report date, and new awards by
 * date signed, newest first, merged. Only data rows: nothing here is ranked, scored or written up.
 *
 *  - A trade's date is its FIRST report (original_filed_date). filed_date is the amendment's date
 *    when an amendment replaced the row (D2 issue 3), so ordering by it would put old trades at the
 *    top. The 229 House rows whose first report is not in our records have no date to place them
 *    by and are left out.
 *  - An award's date is the date it was signed (posted date when that is missing).
 *  - A chamber filter narrows trades only; awards have no chamber, so it hides them.
 */

export const LATEST_PAGE_SIZE = 40;
/** Deeper than this, the explorers are the right tool (the feed stays cheap and its pages stable). */
export const LATEST_MAX_PAGES = 10;
export const LATEST_PARAMS = ['chamber', 'type', 'page'] as const;

export interface LatestFilters {
  chamber: '' | 'House' | 'Senate';
  type: '' | 'trades' | 'awards';
}

export function parseLatestFilters(sp: SP): LatestFilters {
  const chamber = pick(sp.chamber, ['House', 'Senate'] as const);
  // A chamber means trades: awards have none.
  const type = chamber ? 'trades' : pick(sp.type, ['trades', 'awards'] as const);
  return { chamber, type };
}

export type LatestItem =
  | { kind: 'trade'; id: string; date: string; trade: TradeRow }
  | { kind: 'award'; id: string; date: string; award: AwardRow };

const AWARD_FEED_COLS =
  'id, award_id, parent_award_piid, description, recipient_name, recipient_uei, recipient_parent_uei, recipient_parent_name, awarding_agency, awarding_agency_code, awarding_sub_agency, fiscal_year, date_signed, posted_date, obligated_amount, competition_status, extent_competed, other_than_full_open, usaspending_url';

async function newestTrades(f: LatestFilters, n: number): Promise<LatestItem[] | null> {
  let q = supabase!
    .from('congress_trades')
    .select(TRADE_COLS)
    .not('original_filed_date', 'is', null);
  if (f.chamber) q = q.eq('member_chamber', f.chamber);
  const { data, error } = await q
    .order('original_filed_date', { ascending: false })
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: true })
    .limit(n);
  if (error || !data) return null;
  return (data as unknown as TradeRow[]).map((t) => ({ kind: 'trade' as const, id: t.id, date: t.original_filed_date as string, trade: t }));
}

async function newestAwards(n: number): Promise<LatestItem[] | null> {
  const { data, error } = await supabase!
    .from('awards')
    .select(AWARD_FEED_COLS)
    .not('date_signed', 'is', null)
    .order('date_signed', { ascending: false })
    .order('id', { ascending: true })
    .limit(n);
  if (error || !data) return null;
  return (data as unknown as AwardRow[]).map((a) => ({
    kind: 'award' as const,
    id: a.id,
    date: a.date_signed as string,
    award: { ...a, obligated_amount: a.obligated_amount == null ? null : Number(a.obligated_amount) },
  }));
}

export interface LatestPage {
  items: LatestItem[];
  page: number;
  /** Pages known to exist (capped at LATEST_MAX_PAGES); one more than `page` while there is more. */
  pages: number;
}

/**
 * Newest first. Within a day: awards before trades, then (for trades) the later trade date first, then id,
 * which is the same order the database gives each source, so a page boundary never splits a day differently.
 */
function byNewest(a: LatestItem, b: LatestItem): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  if (a.kind === 'trade' && b.kind === 'trade' && a.trade.transaction_date !== b.trade.transaction_date) {
    return a.trade.transaction_date < b.trade.transaction_date ? 1 : -1;
  }
  return a.id < b.id ? -1 : 1;
}

/** The newest items for a page. Each source is read to the depth the page needs, then merged. null on failure. */
export async function getLatestPage(f: LatestFilters, pageParam: string | string[] | undefined): Promise<LatestPage | null> {
  if (!supabase) return null;
  const n = Math.floor(Number(one(pageParam)));
  const page = Number.isFinite(n) ? Math.min(LATEST_MAX_PAGES, Math.max(1, n)) : 1;
  const need = page * LATEST_PAGE_SIZE + 1; // one extra row tells us whether another page exists
  const [t, a] = await Promise.all([
    f.type === 'awards' ? Promise.resolve([] as LatestItem[]) : newestTrades(f, need),
    f.type === 'trades' ? Promise.resolve([] as LatestItem[]) : newestAwards(need),
  ]);
  if (t === null || a === null) return null;
  const merged = [...t, ...a].sort(byNewest);
  const from = (page - 1) * LATEST_PAGE_SIZE;
  const items = merged.slice(from, from + LATEST_PAGE_SIZE);
  const more = merged.length > from + LATEST_PAGE_SIZE;
  return { items, page, pages: more && page < LATEST_MAX_PAGES ? page + 1 : page };
}

/** The newest `limit` items of both kinds, for the RSS. null on failure. */
export async function getLatestForFeed(limit = 50): Promise<LatestItem[] | null> {
  if (!supabase) return null;
  const [t, a] = await Promise.all([newestTrades({ chamber: '', type: '' }, limit), newestAwards(limit)]);
  if (t === null || a === null) return null;
  return [...t, ...a].sort(byNewest).slice(0, limit);
}
