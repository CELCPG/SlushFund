import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';
import { companySlug, FISCAL_YEARS } from '@/lib/v2/companies';
import { memo, readAll } from '@/lib/v2/reads';
import { instrumentKind } from '@/lib/v2/instruments';
import unreadData from '@/data/unread-filings.json';

/**
 * People (D2). Read-only against the database, anon key.
 *
 * A PERSON is a row of congress_members (the unitedstates/congress-legislators roster, 2016–today),
 * keyed by bioguide id: /people/<bioguide>. The index lists everyone in office plus anyone with a
 * disclosed trade in our filings. Counts are numbers of disclosed transactions; amounts stay the
 * disclosed bands and are never added up.
 */

export const BIOGUIDE_RE = /^[A-Z]\d{6}$/;

// ---------------------------------------------------------------- roster

export interface Member {
  bioguide_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  party: string;
  chamber: 'House' | 'Senate' | string;
  state: string;
  district: string | null;
  state_name: string | null;
  in_office: boolean | null;
  title: string | null;
  committees: string[] | null;
  updated_at: string | null;
}

const MEMBER_COLS = 'bioguide_id, name, first_name, last_name, party, chamber, state, district, state_name, in_office, title, committees, updated_at';

/** Every roster member with a bioguide id. Memoized 30 min. */
export const getRoster = memo(async (): Promise<Member[] | null> => {
  if (!supabase) return null;
  const rows = await readAll<Member>((from, to) =>
    supabase!
      .from('congress_members')
      .select(MEMBER_COLS, { count: 'exact' })
      .not('bioguide_id', 'is', null)
      .order('bioguide_id', { ascending: true })
      .range(from, to),
  );
  return rows;
});

export async function getMember(bioguide: string): Promise<Member | null | undefined> {
  const roster = await getRoster();
  if (!roster) return null; // unavailable
  return roster.find((m) => m.bioguide_id === bioguide); // undefined = not a member we know
}

// ---------------------------------------------------------------- trade counts (all members)

export interface TradeStats {
  /** Every disclosed transaction row. */
  total: number;
  /** Stock purchases / sales (options and other assets never count as one). */
  buys: number;
  sells: number;
  /** Stock exchanges (every stock row that is neither a purchase nor a sale), so buys + sells + exchanges + other = total (A8 N5). */
  exchanges: number;
  /** Options, bonds, funds and other non-stock rows. */
  other: number;
  /** Newest filing date among rows whose dates are not flagged. */
  latestFiled: string | null;
}

type SlimTrade = Pick<TradeRow, 'bio_guide_id' | 'transaction_type' | 'asset_type' | 'company_name' | 'option_type' | 'filed_date' | 'date_flag'>;

/** Per-member counts over every trade row. Memoized 30 min (~25 requests cold). */
export const getTradeStats = memo(async (): Promise<Map<string, TradeStats> | null> => {
  if (!supabase) return null;
  const rows = await readAll<SlimTrade>((from, to) =>
    supabase!
      .from('congress_trades')
      .select('bio_guide_id, transaction_type, asset_type, company_name, option_type, filed_date, date_flag', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (!rows) return null;
  const by = new Map<string, TradeStats>();
  for (const r of rows) {
    if (!r.bio_guide_id) continue;
    const s = by.get(r.bio_guide_id) ?? { total: 0, buys: 0, sells: 0, exchanges: 0, other: 0, latestFiled: null };
    s.total += 1;
    if (instrumentKind(r) !== 'stock') s.other += 1;
    else if (r.transaction_type === 'BUY') s.buys += 1;
    else if (r.transaction_type.startsWith('SELL')) s.sells += 1;
    else s.exchanges += 1;
    if (!r.date_flag && r.filed_date && (!s.latestFiled || r.filed_date > s.latestFiled)) s.latestFiled = r.filed_date;
    by.set(r.bio_guide_id, s);
  }
  return by;
});

// ---------------------------------------------------------------- one member's trades

export const getMemberTrades = cache(async (bioguide: string): Promise<TradeRow[] | null> => {
  if (!supabase || !BIOGUIDE_RE.test(bioguide)) return null;
  const rows = await readAll<TradeRow>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(TRADE_COLS, { count: 'exact' })
      .eq('bio_guide_id', bioguide)
      .order('filed_date', { ascending: false, nullsFirst: false })
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    10_000,
  );
  return rows as TradeRow[] | null;
});

// ---------------------------------------------------------------- trades by quarter

export interface QuarterBucket {
  key: string; // 2025-Q3
  year: number;
  q: number;
  buys: number;
  sells: number;
  /** Exchanges, options and other assets. */
  other: number;
}

/**
 * Number of disclosed transactions per calendar quarter of the transaction date, stock purchases
 * vs sales vs everything else. Rows with a date flag are left out (they are counted separately)
 * because their dates look wrong in the filing.
 */
export function tradesByQuarter(trades: TradeRow[]): { buckets: QuarterBucket[]; flagged: number } {
  const by = new Map<string, QuarterBucket>();
  let flagged = 0;
  for (const t of trades) {
    if (t.date_flag) {
      flagged += 1;
      continue;
    }
    const y = Number(t.transaction_date.slice(0, 4));
    const q = Math.floor((Number(t.transaction_date.slice(5, 7)) - 1) / 3) + 1;
    if (!y || !q) continue;
    const key = `${y}-Q${q}`;
    const b = by.get(key) ?? { key, year: y, q, buys: 0, sells: 0, other: 0 };
    if (instrumentKind(t) !== 'stock') b.other += 1;
    else if (t.transaction_type === 'BUY') b.buys += 1;
    else if (t.transaction_type.startsWith('SELL')) b.sells += 1;
    else b.other += 1;
    by.set(key, b);
  }
  if (!by.size) return { buckets: [], flagged };
  // Fill empty quarters between the first and last so gaps read as zero, not as missing bars.
  const keys = [...by.values()].sort((a, b) => a.year - b.year || a.q - b.q);
  const out: QuarterBucket[] = [];
  let y = keys[0].year;
  let q = keys[0].q;
  const last = keys[keys.length - 1];
  while (y < last.year || (y === last.year && q <= last.q)) {
    const key = `${y}-Q${q}`;
    out.push(by.get(key) ?? { key, year: y, q, buys: 0, sells: 0, other: 0 });
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return { buckets: out, flagged };
}

// ---------------------------------------------------------------- unread filings (R3 / R4 evidence)

export interface UnreadFilings {
  house_scanned: number;
  senate_paper: number;
}

export function getUnreadFilings(bioguide: string): UnreadFilings | null {
  const d = (unreadData as Record<string, UnreadFilings>)[bioguide];
  return d && (d.house_scanned || d.senate_paper) ? d : null;
}

// ---------------------------------------------------------------- contracts of traded companies (R6b)

/**
 * The member page's "trades paired with contractors' awards" section stays OFF until R6b fills
 * company_tickers.instrument_class / valid_from / valid_to / window_status and the join is audited.
 * Preview locally with SHOW_MEMBER_CONTRACTS=1 (read at request time).
 */
export function memberContractsEnabled(): boolean {
  return process.env.SHOW_MEMBER_CONTRACTS === '1';
}

export interface TradedContractor {
  key: string;
  name: string;
  slug: string;
  tickers: { ticker: string; preferred: boolean }[];
  /** This member's stock trades in those tickers inside the link's dates. */
  trades: number;
  /** Awards meeting the listing rule, per fiscal year signed (deduplicated by award). */
  fy: { fy: number; count: number; obligated: number }[];
}

type LinkRow = {
  ticker: string;
  recipient_parent_uei: string | null;
  recipient_uei: string | null;
  recipient_parent_name: string | null;
  instrument_class: string | null;
  valid_from: string | null;
  valid_to: string | null;
  window_status: string | null;
  status: string;
};

type AwardTickerRow = {
  award_id: string;
  fiscal_year: number | null;
  obligated_amount: number | string | null;
  recipient_parent_uei: string | null;
  recipient_uei: string | null;
  recipient_parent_name: string | null;
  recipient_name: string | null;
  ticker: string;
  link_status: string;
  window_status: string | null;
};

const CONFIRMED = ['auto_confirmed', 'manual_confirmed'];
const OWNED = ['common', 'adr', 'preferred'];
const WINDOW_OK = ['same_entity', 'checked'];

/**
 * Join a member's stock trades to contractors through company_tickers, counting a trade only when
 * the ticker is common, ADR or preferred and the trade date is inside [valid_from, valid_to]
 * (NULL = open); 'unchecked' windows are not used. Award sums come from the award_tickers view,
 * which applies the same window to the award's date signed. null = unavailable.
 */
export async function getMemberContractors(trades: TradeRow[]): Promise<TradedContractor[] | null> {
  if (!supabase) return null;
  const stock = trades.filter((t) => instrumentKind(t) === 'stock' && t.ticker);
  const tickers = [...new Set(stock.map((t) => t.ticker))];
  if (!tickers.length) return [];
  const links = await readAll<LinkRow>((from, to) =>
    supabase!
      .from('company_tickers')
      .select('ticker, recipient_parent_uei, recipient_uei, recipient_parent_name, instrument_class, valid_from, valid_to, window_status, status', { count: 'exact' })
      .in('ticker', tickers)
      .in('status', CONFIRMED)
      .in('instrument_class', OWNED)
      .in('window_status', WINDOW_OK)
      .range(from, to),
  );
  if (!links) return null;
  const inWindow = (d: string, l: LinkRow) => (!l.valid_from || d >= l.valid_from) && (!l.valid_to || d <= l.valid_to);
  const groups = new Map<string, { name: string; tickers: Map<string, boolean>; trades: Set<string> }>();
  for (const t of stock) {
    for (const l of links) {
      if (l.ticker !== t.ticker || !inWindow(t.transaction_date, l)) continue;
      const key = l.recipient_parent_uei ?? l.recipient_uei;
      if (!key) continue;
      const g = groups.get(key) ?? { name: l.recipient_parent_name ?? key, tickers: new Map(), trades: new Set() };
      g.tickers.set(l.ticker, l.instrument_class === 'preferred');
      g.trades.add(t.id);
      groups.set(key, g);
    }
  }
  if (!groups.size) return [];
  const matched = [...new Set([...groups.values()].flatMap((g) => [...g.tickers.keys()]))];
  const awards = await readAll<AwardTickerRow>((from, to) =>
    supabase!
      .from('award_tickers')
      .select('award_id, fiscal_year, obligated_amount, recipient_parent_uei, recipient_uei, recipient_parent_name, recipient_name, ticker, link_status, window_status', { count: 'exact' })
      .in('ticker', matched)
      .in('link_status', CONFIRMED)
      .in('window_status', WINDOW_OK)
      .range(from, to),
  );
  if (!awards) return null;
  const out: TradedContractor[] = [];
  for (const [key, g] of groups) {
    const seen = new Set<string>();
    const fy = new Map<number, { count: number; obligated: number }>();
    let name = g.name;
    for (const a of awards) {
      if ((a.recipient_parent_uei ?? a.recipient_uei) !== key || seen.has(a.award_id) || a.fiscal_year == null || a.obligated_amount == null) continue;
      seen.add(a.award_id);
      name = (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name || name;
      const s = fy.get(a.fiscal_year) ?? { count: 0, obligated: 0 };
      s.count += 1;
      s.obligated += Number(a.obligated_amount);
      fy.set(a.fiscal_year, s);
    }
    if (!seen.size) continue;
    out.push({
      key,
      name,
      slug: companySlug(key, name),
      tickers: [...g.tickers.entries()].map(([ticker, preferred]) => ({ ticker, preferred })),
      trades: g.trades.size,
      fy: FISCAL_YEARS.filter((y) => fy.has(y)).map((y) => ({ fy: y, ...fy.get(y)! })),
    });
  }
  return out.sort((a, b) => b.trades - a.trades || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- display helpers

/** "NJ-5", "AK at-large", "Senate, NJ". */
export function seatLabel(m: Pick<Member, 'chamber' | 'state' | 'district'>): string {
  if (m.chamber === 'Senate') return `Senator, ${m.state}`;
  const d = m.district == null ? null : String(Number(m.district));
  if (d === '0') return `${m.state} at-large`;
  return d ? `${m.state}-${d}` : m.state;
}

export function partyName(p: string | null | undefined): string {
  return p || 'Party not listed';
}
