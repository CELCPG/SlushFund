import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSector } from '@/lib/sector-map';

interface TradeRow {
  ticker: string;
  company_name: string;
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  transaction_type: string;
  amount_max: number | null;
  transaction_date: string | null;
  flags: string[];
  has_federal_contract: boolean;
}

export interface SectorAgg {
  sector: string;
  vol: number;
  buys: number;
  sells: number;
  count: number;
  tickers: string[];
}

export interface MemberAgg {
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  total_trades: number;
  estimated_volume: number;
  buys: number;
  sells: number;
  unique_tickers: number;
}

export interface StockAgg {
  ticker: string;
  company_name: string;
  total_trades: number;
  buys: number;
  sells: number;
  estimated_volume: number;
  num_members: number;
}

export interface PartyAgg {
  party: string;
  buys: number;
  sells: number;
  volume: number;
  count: number;
}

export interface TradeSummary {
  totalTrades: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
  flaggedCount: number;
  tradeCount: number; // trades in the aggregation window
  dateRange: { earliest: string | null; latest: string | null };
  partyBreakdown: PartyAgg[];
  topMembers: MemberAgg[];
  topStocks: StockAgg[];
  sectorData: SectorAgg[];
  windowDays: number;
  windowedCount: number;
}

const DEFAULT_WINDOW_DAYS = 180;
const MAX_WINDOW_DAYS = 365 * 5;

// Supabase PostgREST default max-rows is 1000 — paginate to bypass
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'No database connection' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const windowDays = Math.min(
    Math.max(parseInt(searchParams.get('days') ?? String(DEFAULT_WINDOW_DAYS)), 1),
    MAX_WINDOW_DAYS
  );

  // Windowed date for sector/leaderboard/stocks
  const today = new Date();
  const earliestWindow = new Date(today);
  earliestWindow.setDate(earliestWindow.getDate() - windowDays);
  const earliestIso = earliestWindow.toISOString().split('T')[0];
  const todayIso = today.toISOString().split('T')[0];

  // Lifetime count, windowed count, and earliest date in parallel
  const [lifetimeCountRes, windowedCountRes, earliestRes] = await Promise.all([
    supabaseAdmin
      .from('congress_trades')
      .select('*', { count: 'exact', head: true })
      .lte('transaction_date', todayIso),
    supabaseAdmin
      .from('congress_trades')
      .select('*', { count: 'exact', head: true })
      .lte('transaction_date', todayIso)
      .gte('transaction_date', earliestIso),
    supabaseAdmin
      .from('congress_trades')
      .select('transaction_date')
      .lte('transaction_date', todayIso)
      .order('transaction_date', { ascending: true })
      .limit(1),
  ]);

  const totalTrades = lifetimeCountRes.count ?? 0;
  const windowedCount = windowedCountRes.count ?? 0;
  const earliestDate = (earliestRes.data?.[0]?.transaction_date as string | undefined) ?? null;

  // Paginate through the windowed trades
  let offset = 0;
  const allTrades: TradeRow[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker, company_name, member_name, member_party, member_chamber, member_state, transaction_type, amount_max, transaction_date, flags, has_federal_contract')
      .lte('transaction_date', todayIso)
      .gte('transaction_date', earliestIso)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Summary paginate error:', error);
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }

    const rows = (data ?? []) as TradeRow[];
    if (rows.length === 0) break;
    allTrades.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (allTrades.length > 200000) break; // safety cap
  }

  // Aggregate
  let totalVolume = 0;
  let buyCount = 0;
  let sellCount = 0;
  let flaggedCount = 0;
  let latestDate: string | null = null;

  const memberMap: Record<string, {
    member_name: string;
    member_party: string;
    member_chamber: string;
    member_state: string;
    total_trades: number;
    estimated_volume: number;
    buys: number;
    sells: number;
    tickers: Set<string>;
  }> = {};

  const stockMap: Record<string, {
    ticker: string;
    company_name: string;
    total_trades: number;
    buys: number;
    sells: number;
    estimated_volume: number;
    _members: Set<string>;
  }> = {};

  const sectorMap: Record<string, {
    vol: number;
    buys: number;
    sells: number;
    count: number;
    tickers: Set<string>;
  }> = {};

  const partyTotals: Record<string, PartyAgg> = {};

  for (const t of allTrades) {
    const amount = t.amount_max ?? 0;
    totalVolume += amount;
    const tx = t.transaction_type ?? '';
    const isBuy = tx === 'BUY' || tx.includes('PURCHASE');
    const isSell = tx === 'SELL' || tx.includes('SALE');
    if (isBuy) buyCount++;
    if (isSell) sellCount++;
    const flags = t.flags ?? [];
    if (flags.includes('federal_contractor_overlap') || flags.includes('large_trade')) {
      flaggedCount++;
    }
    if (t.transaction_date && (!latestDate || t.transaction_date > latestDate)) {
      latestDate = t.transaction_date;
    }

    // Member aggregation
    if (t.member_name) {
      const m = (memberMap[t.member_name] ??= {
        member_name: t.member_name,
        member_party: t.member_party,
        member_chamber: t.member_chamber,
        member_state: t.member_state,
        total_trades: 0,
        estimated_volume: 0,
        buys: 0,
        sells: 0,
        tickers: new Set(),
      });
      m.total_trades++;
      m.estimated_volume += amount;
      m.tickers.add(t.ticker);
      if (isBuy) m.buys++;
      else if (isSell) m.sells++;
    }

    // Stock aggregation
    if (t.ticker) {
      const s = (stockMap[t.ticker] ??= {
        ticker: t.ticker,
        company_name: t.company_name,
        total_trades: 0,
        buys: 0,
        sells: 0,
        estimated_volume: 0,
        _members: new Set(),
      });
      s.total_trades++;
      if (isBuy) s.buys++;
      else if (isSell) s.sells++;
      s.estimated_volume += amount;
      s._members.add(t.member_name);
    }

    // Sector aggregation (server-side, single source of truth)
    if (t.ticker) {
      const sector = getSector(t.ticker, t.company_name);
      const s = (sectorMap[sector] ??= {
        vol: 0,
        buys: 0,
        sells: 0,
        count: 0,
        tickers: new Set(),
      });
      s.vol += amount;
      s.count++;
      if (isBuy) s.buys++;
      else if (isSell) s.sells++;
      s.tickers.add(t.ticker);
    }

    // Party aggregation
    const party = t.member_party || 'Unknown';
    const p = (partyTotals[party] ??= { party, buys: 0, sells: 0, volume: 0, count: 0 });
    p.count++;
    p.volume += amount;
    if (isBuy) p.buys++;
    else if (isSell) p.sells++;
  }

  const partyBreakdown = Object.values(partyTotals).sort((a, b) => b.volume - a.volume);

  const topMembers: MemberAgg[] = Object.values(memberMap)
    .map(m => ({ ...m, unique_tickers: m.tickers.size }))
    .sort((a, b) => b.estimated_volume - a.estimated_volume)
    .slice(0, 10);

  const topStocks: StockAgg[] = Object.values(stockMap)
    .map(s => ({
      ticker: s.ticker,
      company_name: s.company_name,
      total_trades: s.total_trades,
      buys: s.buys,
      sells: s.sells,
      estimated_volume: s.estimated_volume,
      num_members: s._members.size,
    }))
    .sort((a, b) => b.estimated_volume - a.estimated_volume)
    .slice(0, 20);

  const sectorData: SectorAgg[] = Object.entries(sectorMap)
    .map(([sector, d]) => ({
      sector,
      vol: d.vol,
      buys: d.buys,
      sells: d.sells,
      count: d.count,
      tickers: Array.from(d.tickers).sort(),
    }))
    .sort((a, b) => b.vol - a.vol);

  const summary: TradeSummary = {
    totalTrades,
    totalVolume,
    buyCount,
    sellCount,
    flaggedCount,
    tradeCount: allTrades.length,
    dateRange: { earliest: earliestDate, latest: latestDate },
    partyBreakdown,
    topMembers,
    topStocks,
    sectorData,
    windowDays,
    windowedCount,
  };

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
