import { supabase } from '@/lib/supabase';
import { ERA_FYS, type Era } from '@/lib/types';

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
  // Era context
  era: Era | 'all';
}

/**
 * Build date range from era FYs.
 * FY runs Oct 1 – Sep 30, so FY2019 = 2018-10-01 to 2019-09-30.
 */
function eraDateRange(era: Era): { start: string; end: string } {
  const fys = ERA_FYS[era];
  const today = new Date().toISOString().split('T')[0];
  const ranges = fys.map((fy) => {
    if (fy === 2026) return { start: `${fy - 1}-10-01`, end: today };
    if (fy === 2019) return { start: '2018-10-01', end: '2019-09-30' };
    return { start: `${fy - 1}-10-01`, end: `${fy}-09-30` };
  });
  return { start: ranges[0].start, end: ranges[ranges.length - 1].end };
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
  era: 'all',
};

/**
 * Fetch landing-page headline stats. Queries Supabase for federal-spending
 * aggregates; on missing config or any error, returns CURATED_STATS so the
 * page never blocks. Mirrors the aggregate logic in /api/alerts.
 *
 * @param era - Optional era to filter stats. Defaults to 'all'.
 */
export async function getHomeStats(era: Era | 'all' = 'all'): Promise<HomeStats> {
  if (!supabase) return { ...CURATED_STATS, era };

  try {
    let query = supabase
      .from('awards')
      .select('dollar_amount, connection_type, flags, competition_status, posted_date');

    if (era && era !== 'all') {
      const { start, end } = eraDateRange(era);
      query = query.gte('posted_date', start).lte('posted_date', end);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) return { ...CURATED_STATS, era };

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
      era,
    };
  } catch {
    return { ...CURATED_STATS, era };
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
