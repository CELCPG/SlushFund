import { aggregate, UNCLASSIFIED_LABEL, type TradeRow } from '@/lib/v2/sector-agg';

/**
 * D21: the right panel of "Follow the money". Pure aggregation (no server imports, so the report's hand checks run the same
 * rules). It calls D18's aggregate() on ONE member's rows, so the counting rules and the sector map are D18's, unchanged:
 * 24-month window as filed (rows with a date note left out), individual-stock purchases and sales only, sector from
 * TICKER_SECTORS only, everything else Unclassified. Counts of transactions; amounts are bands and are never summed here.
 */

export const TRAIL_MAX_SECTORS = 7;

export interface SectorFlow {
  key: string;
  label: string;
  count: number;
  buys: number;
  sells: number;
  tickers: number;
}

export interface TrailTrades {
  start: string;
  end: string;
  /** Counted purchases + sales. */
  counted: number;
  /** Shown sectors, largest first. */
  sectors: SectorFlow[];
  /** Sectors beyond TRAIL_MAX_SECTORS, folded into one ribbon (null when none). */
  other: (SectorFlow & { sectorCount: number }) | null;
  /** Tickers the map does not hold (and rows with no ticker): never guessed. null when none. */
  unclassified: (SectorFlow & { noTicker: number }) | null;
  /** Rows in the window that are not counted (options, bonds, funds and other, exchanges, rows with a date note). */
  notCounted: number;
}

const flow = (c: { key: string; label: string; total: number; buys: number; sells: number; tickers: number }): SectorFlow => ({
  key: c.key, label: c.label, count: c.total, buys: c.buys, sells: c.sells, tickers: c.tickers,
});

type MemberTradeRow = Omit<TradeRow, 'option_type' | 'date_flag'> & { option_type?: string | null; date_flag?: string | null };

export function trailTrades(rows: MemberTradeRow[], end: string): TrailTrades {
  const a = aggregate(rows.map((r) => ({ ...r, option_type: r.option_type ?? null, date_flag: r.date_flag ?? null })), end, 24);
  const named = a.sectors.filter((s) => s.total > 0).map(flow);
  const shown = named.length > TRAIL_MAX_SECTORS + 1 ? named.slice(0, TRAIL_MAX_SECTORS) : named;
  const rest = named.slice(shown.length);
  const other = rest.length
    ? {
        key: 'other-sectors',
        label: 'Other sectors',
        count: rest.reduce((n, s) => n + s.count, 0),
        buys: rest.reduce((n, s) => n + s.buys, 0),
        sells: rest.reduce((n, s) => n + s.sells, 0),
        tickers: rest.reduce((n, s) => n + s.tickers, 0),
        sectorCount: rest.length,
      }
    : null;
  const u = a.unclassified;
  const unclassified = u.total > 0 ? { ...flow({ ...u, label: UNCLASSIFIED_LABEL }), noTicker: a.noTicker } : null;
  const nc = a.notCounted;
  return {
    start: a.start,
    end: a.end,
    counted: a.counted,
    sectors: shown,
    other,
    unclassified,
    notCounted: nc.options + nc.bonds + nc.fundsAndOther + nc.exchanges + nc.dateNote,
  };
}
