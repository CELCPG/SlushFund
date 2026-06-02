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

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'No database connection' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const windowDays = Math.min(
    Math.max(parseInt(searchParams.get('days') ?? String(DEFAULT_WINDOW_DAYS)), 1),
    MAX_WINDOW_DAYS
  );

  // Single RPC for summary + topMembers + topStocks + partyBreakdown.
  // The function does all the aggregation in Postgres and returns a
  // JSONB blob. We do the sector aggregation here in JS because
  // getSector() is a JS-side mapping (lib/sector-map).
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    'get_congress_trades_summary',
    { p_window_days: windowDays }
  );

  if (rpcError || !rpcData) {
    console.error('[summary] RPC error:', rpcError);
    return NextResponse.json({ error: 'Failed to compute summary' }, { status: 500 });
  }

  const rpc = rpcData as {
    summary: {
      totalTrades: number;
      windowedCount: number;
      totalVolume: number;
      buyCount: number;
      sellCount: number;
      flaggedCount: number;
      dateRange: { earliest: string | null; latest: string | null };
    };
    topMembers: MemberAgg[];
    topStocks: StockAgg[];
    partyBreakdown: PartyAgg[];
  };

  // Sector aggregation requires JS-side getSector() mapping.
  // Query just the windowed rows we need (ticker + company_name + amount +
  // type) — no pagination, all 1-2k rows fit in one shot.
  const today = new Date();
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - windowDays);
  const todayIso = today.toISOString().split('T')[0];
  const earliestIso = earliest.toISOString().split('T')[0];

  const { data: sectorRows, error: sectorError } = await supabaseAdmin
    .from('congress_trades')
    .select('ticker, company_name, transaction_type, amount_max')
    .lte('transaction_date', todayIso)
    .gte('transaction_date', earliestIso)
    .limit(50000);

  if (sectorError) {
    console.error('[summary] sector rows error:', sectorError);
    // Non-fatal: return the rest of the summary without sector data
    return NextResponse.json(buildResponse(rpc, [], windowDays), {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  }

  const sectorData = computeSectorData((sectorRows ?? []) as TradeRow[]);

  return NextResponse.json(buildResponse(rpc, sectorData, windowDays), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}

function buildResponse(
  rpc: {
    summary: {
      totalTrades: number;
      windowedCount: number;
      totalVolume: number;
      buyCount: number;
      sellCount: number;
      flaggedCount: number;
      dateRange: { earliest: string | null; latest: string | null };
    };
    topMembers: MemberAgg[];
    topStocks: StockAgg[];
    partyBreakdown: PartyAgg[];
  },
  sectorData: SectorAgg[],
  windowDays: number
): TradeSummary {
  return {
    totalTrades: rpc.summary.totalTrades,
    totalVolume: rpc.summary.totalVolume,
    buyCount: rpc.summary.buyCount,
    sellCount: rpc.summary.sellCount,
    flaggedCount: rpc.summary.flaggedCount,
    tradeCount: rpc.summary.windowedCount,
    dateRange: rpc.summary.dateRange,
    partyBreakdown: rpc.partyBreakdown,
    topMembers: rpc.topMembers,
    topStocks: rpc.topStocks,
    sectorData,
    windowDays,
    windowedCount: rpc.summary.windowedCount,
  };
}

/** Compute sector data from raw rows. Pure function. */
function computeSectorData(rows: TradeRow[]): SectorAgg[] {
  const map: Record<string, { vol: number; buys: number; sells: number; count: number; tickers: Set<string> }> = {};
  for (const t of rows) {
    if (!t.ticker) continue;
    const amount = t.amount_max ?? 0;
    const sector = getSector(t.ticker, t.company_name);
    const s = (map[sector] ??= { vol: 0, buys: 0, sells: 0, count: 0, tickers: new Set() });
    s.vol += amount;
    s.count++;
    if (t.transaction_type === 'BUY' || (t.transaction_type ?? '').includes('PURCHASE')) s.buys++;
    else if (t.transaction_type === 'SELL' || (t.transaction_type ?? '').includes('SALE')) s.sells++;
    s.tickers.add(t.ticker);
  }
  return Object.entries(map)
    .map(([sector, d]) => ({
      sector,
      vol: d.vol,
      buys: d.buys,
      sells: d.sells,
      count: d.count,
      tickers: Array.from(d.tickers).sort(),
    }))
    .sort((a, b) => b.vol - a.vol);
}
