import { supabase } from '@/lib/supabase';

/** Headline figures shown on the landing page. */
export interface HomeStats {
  /** True when numbers come from a live Supabase query, false when curated fallback. */
  live: boolean;
  // Federal spending (live-capable)
  totalDollars: number;
  connectedDollars: number;
  noBidDollars: number;
  flaggedCount: number;
  // Congress trading (curated — no aggregate endpoint yet)
  congressTrades: number;
  membersTracked: number;
  contractorOverlap: number;
  // Crypto & influence (curated — no aggregate endpoint yet)
  cryptoPacDollars: number;
  politiciansHoldingBtc: number;
}

/**
 * Curated fallback. Single source of truth for figures that have no aggregate
 * API (congress / crypto) and for the federal numbers when the DB is unreachable.
 */
export const CURATED_STATS: HomeStats = {
  live: false,
  totalDollars: 17_000_000_000,
  connectedDollars: 14_800_000_000,
  noBidDollars: 9_700_000_000,
  flaggedCount: 192,
  congressTrades: 926,
  membersTracked: 52,
  contractorOverlap: 129,
  cryptoPacDollars: 178_000_000,
  politiciansHoldingBtc: 21,
};

/**
 * Fetch landing-page headline stats. Queries Supabase for federal-spending
 * aggregates; on missing config or any error, returns CURATED_STATS so the
 * page never blocks. Mirrors the aggregate logic in /api/alerts.
 */
export async function getHomeStats(): Promise<HomeStats> {
  if (!supabase) return CURATED_STATS;

  try {
    const { data, error } = await supabase
      .from('awards')
      .select('dollar_amount, connection_type, flags, competition_status');

    if (error || !data || data.length === 0) return CURATED_STATS;

    const num = (v: unknown) => Number(v) || 0;

    const totalDollars = data.reduce((s, a) => s + num(a.dollar_amount), 0);
    const connectedDollars = data
      .filter((a) => a.connection_type && a.connection_type !== 'none')
      .reduce((s, a) => s + num(a.dollar_amount), 0);
    const noBidDollars = data
      .filter((a) => a.competition_status === 'no_bid' || a.competition_status === 'sole_source')
      .reduce((s, a) => s + num(a.dollar_amount), 0);
    const flaggedCount = data.filter(
      (a) => Array.isArray(a.flags) && (a.flags as string[]).length > 0,
    ).length;

    return {
      ...CURATED_STATS,
      live: true,
      totalDollars,
      connectedDollars,
      noBidDollars,
      flaggedCount,
    };
  } catch {
    return CURATED_STATS;
  }
}

/** Format a dollar amount as a compact label, e.g. 14_800_000_000 -> "$14.8B". */
export function formatCompactUSD(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value}`;
}
