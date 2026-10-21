import { TICKER_SECTORS } from '@/lib/sector-map';
import { gradeClass, inWindow, windowStart } from '@/lib/v2/grade-method';
import { instrumentKind } from '@/lib/v2/instruments';

/**
 * D18: "What Congress is trading". Pure aggregation over congress_trades rows (no server imports, so the figure checks in
 * the report can run the same rules). Counts only; PTR amounts are bands, so no dollar figure is ever summed here.
 *
 * Rules (the page prints them):
 *  - Window: trade date in the last N months up to the computation date, dates as filed; rows with a date note are left out.
 *  - Counted: rows the grade method classes as single-company stock (gradeClass === 'stock') with a purchase or a sale
 *    (partial sales count as sales). Options are listed apart (instruments.ts: never a plain buy or sell of the stock).
 *    Funds, ETFs, Treasuries, municipal securities, crypto and other assets are not counted (the leaderboard's rule).
 *  - Sector: ONLY the TICKER_SECTORS map (src/lib/sector-map.ts; labels checked and extended against SEC EDGAR SIC codes,
 *    see the d18 sector-map changes CSV). The name-guessing fallback getSector() in that
 *    file is not used. A ticker the map does not hold, or holds under a non-name value, is "Unclassified".
 */

export const UNCLASSIFIED = 'unclassified';
export const UNCLASSIFIED_LABEL = 'Unclassified';
export const MONTH_CHOICES = [3, 6, 12, 24] as const;
export type MonthChoice = (typeof MONTH_CHOICES)[number];

export interface TradeRow {
  id: string;
  bio_guide_id: string | null;
  member_name: string | null;
  ticker: string | null;
  company_name: string | null;
  asset_type: string | null;
  option_type: string | null;
  transaction_type: string;
  transaction_date: string;
  date_flag: string | null;
}

export interface MemberCount {
  bioguide: string;
  name: string;
  count: number;
}

export interface SectorCell {
  key: string;
  label: string;
  buys: number;
  sells: number;
  total: number;
  /** buys minus sells, in transactions. */
  net: number;
  tickers: number;
}

export interface TickerAgg {
  ticker: string;
  company: string;
  sector: string;
  buys: number;
  sells: number;
  total: number;
  /** Members by number of purchases, then by number of sales (computed once, sliced by the page). */
  buyers: MemberCount[];
  sellers: MemberCount[];
  traders: MemberCount[];
}

export interface Aggregate {
  start: string;
  end: string;
  months: MonthChoice;
  counted: number;
  sectors: SectorCell[];
  unclassified: SectorCell;
  /** Counted rows filed without a ticker (all of them are in the Unclassified cell). */
  noTicker: number;
  tickers: TickerAgg[];
  /** topMember: the most counted transactions any one member has in that month (purchases + sales). */
  trend: { month: string; buys: number; sells: number; topMember: number }[];
  /** Sector key -> members by total counted transactions in that sector. */
  sectorMembers: Map<string, MemberCount[]>;
  notCounted: { options: number; bonds: number; fundsAndOther: number; exchanges: number; dateNote: number };
}

/** Sector label for a ticker from the existing map, or null. 'BRK.B' is looked up as the map's 'BRK_B' key. */
export function sectorOf(ticker: string | null | undefined): string | null {
  const t = (ticker ?? '').trim().toUpperCase();
  if (!t) return null;
  const v = (Object.hasOwn(TICKER_SECTORS, t) ? TICKER_SECTORS[t] : undefined) ?? (Object.hasOwn(TICKER_SECTORS, t.replace(/\./g, '_')) ? TICKER_SECTORS[t.replace(/\./g, '_')] : undefined);
  // Values that are not a sector name (the map holds '***' under one key) and the map's own catch-all are unclassified.
  if (!v || !/^[A-Za-z]/.test(v) || v === 'Catch-All / Misc') return null;
  return v;
}

export const sectorKey = (label: string) => label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function direction(t: string): 'buy' | 'sell' | null {
  if (t === 'BUY') return 'buy';
  if (t === 'SELL' || t === 'SELL_PARTIAL') return 'sell';
  return null;
}

const byCount = (a: MemberCount, b: MemberCount) => b.count - a.count || a.name.localeCompare(b.name) || a.bioguide.localeCompare(b.bioguide);

function bump(m: Map<string, MemberCount>, id: string, name: string) {
  const c = m.get(id);
  if (c) c.count += 1;
  else m.set(id, { bioguide: id, name, count: 1 });
}

/** One pass over the rows for a window of `months` months ending on `end` (YYYY-MM-DD). */
export function aggregate(rows: TradeRow[], end: string, months: MonthChoice): Aggregate {
  const start = windowStart(end, months);
  const notCounted = { options: 0, bonds: 0, fundsAndOther: 0, exchanges: 0, dateNote: 0 };
  const sectorTotals = new Map<string, { label: string; buys: number; sells: number; tickers: Set<string> }>();
  const members = new Map<string, Map<string, MemberCount>>();
  const tick = new Map<string, { sector: string; companies: Map<string, number>; buys: number; sells: number; buyers: Map<string, MemberCount>; sellers: Map<string, MemberCount>; traders: Map<string, MemberCount> }>();
  const trendMap = new Map<string, { buys: number; sells: number; members: Map<string, number> }>();
  let counted = 0;
  let noTicker = 0;

  for (const r of rows) {
    if (r.date_flag && r.transaction_date >= start && r.transaction_date <= end) {
      notCounted.dateNote += 1;
      continue;
    }
    if (!inWindow(r, start, end)) continue;
    const cls = gradeClass(r, instrumentKind(r));
    if (cls === 'option') { notCounted.options += 1; continue; }
    if (cls === 'bond') { notCounted.bonds += 1; continue; }
    if (cls === 'excluded') { notCounted.fundsAndOther += 1; continue; }
    const dir = direction(r.transaction_type);
    if (!dir) { notCounted.exchanges += 1; continue; }

    counted += 1;
    const ticker = (r.ticker ?? '').trim().toUpperCase();
    const label = sectorOf(ticker) ?? UNCLASSIFIED_LABEL;
    const key = label === UNCLASSIFIED_LABEL ? UNCLASSIFIED : sectorKey(label);
    const s = sectorTotals.get(key) ?? { label, buys: 0, sells: 0, tickers: new Set<string>() };
    if (dir === 'buy') s.buys += 1; else s.sells += 1;
    if (ticker) s.tickers.add(ticker); else noTicker += 1;
    sectorTotals.set(key, s);

    const month = r.transaction_date.slice(0, 7);
    const id = r.bio_guide_id ?? `name:${r.member_name ?? 'unknown'}`;
    const tm = trendMap.get(month) ?? { buys: 0, sells: 0, members: new Map<string, number>() };
    if (dir === 'buy') tm.buys += 1; else tm.sells += 1;
    tm.members.set(id, (tm.members.get(id) ?? 0) + 1);
    trendMap.set(month, tm);

    const nm = r.member_name ?? 'Name not given';
    const sm = members.get(key) ?? new Map<string, MemberCount>();
    bump(sm, id, nm);
    members.set(key, sm);

    if (!ticker) continue;
    const t = tick.get(ticker) ?? { sector: key, companies: new Map(), buys: 0, sells: 0, buyers: new Map(), sellers: new Map(), traders: new Map() };
    if (r.company_name) t.companies.set(r.company_name.trim(), (t.companies.get(r.company_name.trim()) ?? 0) + 1);
    if (dir === 'buy') { t.buys += 1; bump(t.buyers, id, nm); } else { t.sells += 1; bump(t.sellers, id, nm); }
    bump(t.traders, id, nm);
    tick.set(ticker, t);
  }

  const cell = (key: string): SectorCell => {
    const s = sectorTotals.get(key);
    return s
      ? { key, label: s.label, buys: s.buys, sells: s.sells, total: s.buys + s.sells, net: s.buys - s.sells, tickers: s.tickers.size }
      : { key, label: UNCLASSIFIED_LABEL, buys: 0, sells: 0, total: 0, net: 0, tickers: 0 };
  };
  const sectors = [...sectorTotals.keys()].filter((k) => k !== UNCLASSIFIED).map(cell).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const tickers: TickerAgg[] = [...tick.entries()].map(([ticker, t]) => {
    const company = [...t.companies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
    return {
      ticker, company, sector: t.sector, buys: t.buys, sells: t.sells, total: t.buys + t.sells,
      buyers: [...t.buyers.values()].sort(byCount), sellers: [...t.sellers.values()].sort(byCount), traders: [...t.traders.values()].sort(byCount),
    };
  });

  // Every month from the window start to the end month, so a quiet month reads as zero, not as missing.
  const trend: Aggregate['trend'] = [];
  for (let d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 7) <= end.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const k = d.toISOString().slice(0, 7);
    const tm = trendMap.get(k);
    trend.push({ month: k, buys: tm?.buys ?? 0, sells: tm?.sells ?? 0, topMember: tm ? Math.max(0, ...tm.members.values()) : 0 });
  }

  const sectorMembers = new Map<string, MemberCount[]>();
  for (const [k, m] of members) sectorMembers.set(k, [...m.values()].sort(byCount));

  return { start, end, months, counted, sectors, unclassified: cell(UNCLASSIFIED), noTicker, tickers, trend, sectorMembers, notCounted };
}

/** Ranked tickers for one direction: count in that direction, then ticker. Tickers with none in that direction are left out. */
export function rankTickers(tickers: TickerAgg[], dir: 'buy' | 'sell', n: number, sector?: string): TickerAgg[] {
  const val = (t: TickerAgg) => (dir === 'buy' ? t.buys : t.sells);
  return tickers.filter((t) => val(t) > 0 && (!sector || t.sector === sector)).sort((a, b) => val(b) - val(a) || a.ticker.localeCompare(b.ticker)).slice(0, n);
}
