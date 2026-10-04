import 'server-only';
import { supabase } from '@/lib/supabase';
import { EXPORT_ROW_CAP, PAGE_SIZE, isoDate, one, pageOf, pick, STATE_CODES, type SP } from '@/lib/v2/explorer';
import { BIOGUIDE_RE } from '@/lib/v2/people';
import { cleanQuery, TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * Trades explorer (D4): filters, sort and paging done by the database, so a permalink is the URL.
 *
 * Reads congress_trades with the anon key. Every row is one disclosed transaction; amounts stay
 * the disclosed ranges and are never added up. days_to_file is not read here (it lives on the
 * late-filers board, behind its flag).
 */

export const CHAMBERS = ['House', 'Senate'] as const;
export const PARTIES = ['Democrat', 'Republican', 'Independent'] as const;
export const DIRECTIONS = [
  { value: 'BUY', label: 'Purchases' },
  { value: 'SELL', label: 'Sales' },
  { value: 'EXCHANGE', label: 'Exchanges' },
] as const;
export const OWNERS = [
  { value: 'Self', label: 'Self (House: incl. trusts/accounts)' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Child', label: 'Dependent child' },
] as const;
export const INSTRUMENTS = [
  { value: 'stock', label: 'Stocks' },
  { value: 'option', label: 'Options' },
  { value: 'other', label: 'Other assets (bonds, funds, crypto…)' },
] as const;

/**
 * The disclosure forms' own amount bands. A row matches a band when its disclosed range text
 * contains it, so a row of two same-day lots ("$1,001 - $15,000 + $15,001 - $50,000") matches
 * both of its bands.
 */
export const AMOUNT_BANDS = [
  { key: 'b1', label: '$1,001 – $15,000', needles: ['$1,001 - $15,000'] },
  { key: 'b2', label: '$15,001 – $50,000', needles: ['$15,001 - $50,000'] },
  { key: 'b3', label: '$50,001 – $100,000', needles: ['$50,001 - $100,000'] },
  { key: 'b4', label: '$100,001 – $250,000', needles: ['$100,001 - $250,000'] },
  { key: 'b5', label: '$250,001 – $500,000', needles: ['$250,001 - $500,000'] },
  { key: 'b6', label: '$500,001 – $1,000,000', needles: ['$500,001 - $1,000,000'] },
  { key: 'b7', label: '$1,000,001 – $5,000,000', needles: ['$1,000,001 - $5,000,000'] },
  { key: 'b8', label: '$5,000,001 and up', needles: ['$5,000,001', '$25,000,001', '$50,000,001'] },
  { key: 'b9', label: 'Over $1,000,000 (spouse or child form)', needles: ['Over $1,000,000'] },
] as const;

export const TRADE_SORTS = [
  { value: 'filed', label: 'Newest first report' },
  { value: 'filed_asc', label: 'Oldest first report' },
  { value: 'traded', label: 'Newest trade date' },
  { value: 'traded_asc', label: 'Oldest trade date' },
  { value: 'member', label: 'Member name A–Z' },
  { value: 'ticker', label: 'Ticker A–Z' },
] as const;
type TradeSort = (typeof TRADE_SORTS)[number]['value'];

export interface TradeFilters {
  chamber: '' | (typeof CHAMBERS)[number];
  /** A bioguide id (exact member) or part of a name. */
  member: string;
  party: '' | (typeof PARTIES)[number];
  state: string;
  /** A ticker (up to 6 letters, no spaces) or part of a company name. */
  ticker: string;
  direction: '' | 'BUY' | 'SELL' | 'EXCHANGE';
  owner: '' | 'Self' | 'Spouse' | 'Joint' | 'Child';
  instrument: '' | 'stock' | 'option' | 'other';
  /** Which date the range applies to. */
  by: 'traded' | 'filed';
  from: string;
  to: string;
  band: string;
  sort: TradeSort;
}

/** Parameter names the explorer reads (also what a permalink may carry). */
export const TRADE_PARAMS = ['chamber', 'member', 'party', 'state', 'ticker', 'direction', 'owner', 'instrument', 'by', 'from', 'to', 'band', 'sort', 'page'] as const;

const TICKER_RE = /^[A-Za-z][A-Za-z.-]{0,5}$/;

export function parseTradeFilters(sp: SP): TradeFilters {
  const memberRaw = one(sp.member).trim();
  const state = one(sp.state).toUpperCase();
  const from = isoDate(sp.from);
  const to = isoDate(sp.to);
  return {
    chamber: pick(sp.chamber, CHAMBERS),
    member: BIOGUIDE_RE.test(memberRaw.toUpperCase()) ? memberRaw.toUpperCase() : cleanQuery(memberRaw),
    party: pick(sp.party, PARTIES),
    state: (STATE_CODES as readonly string[]).includes(state) ? state : '',
    ticker: cleanQuery(one(sp.ticker)),
    direction: pick(sp.direction, ['BUY', 'SELL', 'EXCHANGE'] as const),
    owner: pick(sp.owner, ['Self', 'Spouse', 'Joint', 'Child'] as const),
    instrument: pick(sp.instrument, ['stock', 'option', 'other'] as const),
    by: one(sp.by) === 'filed' ? 'filed' : 'traded',
    // An inverted range is swapped rather than silently empty.
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to,
    band: AMOUNT_BANDS.some((b) => b.key === one(sp.band)) ? one(sp.band) : '',
    sort: pick(sp.sort, TRADE_SORTS.map((s) => s.value)) || 'filed',
  };
}

/** The filters as URL parameters (defaults dropped), for permalinks, pager links and the export. */
export function tradeParams(f: TradeFilters): Record<string, string> {
  return {
    chamber: f.chamber,
    member: f.member,
    party: f.party,
    state: f.state,
    ticker: f.ticker,
    direction: f.direction,
    owner: f.owner,
    instrument: f.instrument,
    by: f.by === 'filed' ? 'filed' : '',
    from: f.from,
    to: f.to,
    band: f.band,
    sort: f.sort === 'filed' ? '' : f.sort,
  };
}

const sample = () => supabase!.from('congress_trades').select(TRADE_COLS, { count: 'exact' });
type TradeQuery = ReturnType<typeof sample>;

function applyFilters(q: TradeQuery, f: TradeFilters): TradeQuery {
  if (f.chamber) q = q.eq('member_chamber', f.chamber);
  if (f.party) q = q.eq('member_party', f.party);
  if (f.state) q = q.eq('member_state', f.state);
  if (f.direction === 'SELL') q = q.in('transaction_type', ['SELL', 'SELL_PARTIAL']);
  else if (f.direction) q = q.eq('transaction_type', f.direction);
  if (f.owner) q = q.eq('owner', f.owner);
  if (f.member) q = BIOGUIDE_RE.test(f.member) ? q.eq('bio_guide_id', f.member) : q.ilike('member_name', `%${f.member}%`);
  if (f.ticker) q = TICKER_RE.test(f.ticker) ? q.ilike('ticker', f.ticker) : q.ilike('company_name', `%${f.ticker}%`);
  // Same classes as instrumentKind(): an option is any row with option_type, or an asset type that says option.
  if (f.instrument === 'option') q = q.or('option_type.not.is.null,asset_type.ilike.%option%');
  else if (f.instrument === 'stock') q = q.is('option_type', null).ilike('asset_type', 'stock');
  else if (f.instrument === 'other') q = q.is('option_type', null).not('asset_type', 'ilike', '%option%').not('asset_type', 'ilike', 'stock');
  const band = AMOUNT_BANDS.find((b) => b.key === f.band);
  if (band) q = q.or(band.needles.map((n) => `amount_range.ilike."%${n}%"`).join(','));
  // "Filed" is the first report; rows whose first report is unknown have no filed date to match.
  const dateCol = f.by === 'filed' ? 'original_filed_date' : 'transaction_date';
  if (f.from) q = q.gte(dateCol, f.from);
  if (f.to) q = q.lte(dateCol, f.to);
  return q;
}

function applyOrder(q: TradeQuery, sort: TradeSort): TradeQuery {
  const dated = sort === 'filed' || sort === 'filed_asc' || sort === 'traded' || sort === 'traded_asc';
  // A row whose dates look wrong in the filing never leads a date-ordered list: it sorts last.
  if (dated) q = q.order('date_flag', { ascending: true, nullsFirst: true });
  switch (sort) {
    case 'filed': q = q.order('original_filed_date', { ascending: false, nullsFirst: false }).order('filed_date', { ascending: false, nullsFirst: false }); break;
    case 'filed_asc': q = q.order('original_filed_date', { ascending: true, nullsFirst: false }).order('filed_date', { ascending: true, nullsFirst: false }); break;
    case 'traded': q = q.order('transaction_date', { ascending: false }); break;
    case 'traded_asc': q = q.order('transaction_date', { ascending: true }); break;
    case 'member': q = q.order('member_name', { ascending: true }).order('transaction_date', { ascending: false }); break;
    case 'ticker': q = q.order('ticker', { ascending: true }).order('transaction_date', { ascending: false }); break;
  }
  return q.order('id', { ascending: true });
}

export interface TradePage {
  rows: TradeRow[];
  total: number;
  page: number;
  pages: number;
}

/** One page of matching trades. null when the database does not answer. */
export async function getTradePage(f: TradeFilters, pageParam: string | string[] | undefined): Promise<TradePage | null> {
  if (!supabase) return null;
  const head = await applyFilters(supabase.from('congress_trades').select('id', { count: 'exact', head: true }) as unknown as TradeQuery, f);
  if (head.error || head.count == null) return null;
  const total = head.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = pageOf(pageParam, pages);
  if (total === 0) return { rows: [], total, page, pages };
  const from = (page - 1) * PAGE_SIZE;
  const { data, error } = await applyOrder(applyFilters(sample(), f), f.sort).range(from, from + PAGE_SIZE - 1);
  if (error || !data) return null;
  return { rows: data as unknown as TradeRow[], total, page, pages };
}

/** Matching trades for the CSV, in the chosen order, up to the row cap. null on failure. */
export async function getTradesForExport(f: TradeFilters): Promise<{ rows: TradeRow[]; total: number } | null> {
  if (!supabase) return null;
  const SIZE = 1000;
  const page = (from: number) => applyOrder(applyFilters(sample(), f), f.sort).range(from, from + SIZE - 1);
  const first = await page(0);
  if (first.error || !first.data) return null;
  const total = first.count ?? first.data.length;
  const rows = [...(first.data as unknown as TradeRow[])];
  const starts: number[] = [];
  for (let s = SIZE; s < Math.min(total, EXPORT_ROW_CAP); s += SIZE) starts.push(s);
  // The rest in parallel batches (Promise.all keeps their order): a 10,000-row file in about a second.
  for (let i = 0; i < starts.length; i += 5) {
    const batch = await Promise.all(starts.slice(i, i + 5).map(page));
    for (const b of batch) {
      if (b.error || !b.data) return null;
      rows.push(...(b.data as unknown as TradeRow[]));
    }
  }
  return { rows: rows.slice(0, EXPORT_ROW_CAP), total };
}
