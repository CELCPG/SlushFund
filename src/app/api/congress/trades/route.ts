import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface CongressTrade {
  id: string;
  member_name: string;
  member_chamber: 'House' | 'Senate';
  member_party: string;
  member_state: string;
  ticker: string;
  company_name: string;
  transaction_type: 'BUY' | 'SELL' | 'EXCHANGE' | 'EXERCISE';
  asset_type: string;
  amount_min: number | null;
  amount_max: number | null;
  amount_range: string | null;
  transaction_date: string | null;
  filed_date: string | null;
  disclosure_year: number | null;
  source_system: string;
  flags: string[];
  signal_type: string | null;
  has_federal_contract: boolean;
  related_contracts: RelatedContract[];
  created_at: string;
}

export interface RelatedContract {
  recipient_name: string;
  total: number;
  date_signed: string;
  agency: string;
  description: string | null;
}

interface TradesResponse {
  trades: CongressTrade[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function GET(request: NextRequest): Promise<NextResponse<TradesResponse>> {
  if (!supabaseAdmin) {
    return NextResponse.json({ trades: getDemoTrades(), total: 8, page: 1, limit: 50, pages: 1 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 1000);
  const offset = (page - 1) * limit;

  const chamber = searchParams.get('chamber');
  const party = searchParams.get('party');
  const state = searchParams.get('state');
  const ticker = searchParams.get('ticker');
  const member = searchParams.get('member');
  const txType = searchParams.get('type');
  const minAmount = searchParams.get('min_amount');
  const maxAmount = searchParams.get('max_amount');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const flag = searchParams.get('flag');
  const hasContract = searchParams.get('has_contract');
  const sortKey = searchParams.get('sort') ?? 'transaction_date';
  const sortDir = searchParams.get('dir') ?? 'desc';
  const sortCol = sortKey === 'amount' || sortKey === 'volume' ? 'amount_max' : sortKey;

  let query = supabaseAdmin
    .from('congress_trades')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1);

  // Apply ordering explicitly so it doesn't get lost in chained filters
  if (sortCol === 'amount_max') {
    query = query.order('amount_max', { ascending: sortDir === 'asc', nullsFirst: false });
  } else {
    query = query.order(sortCol, { ascending: sortDir === 'asc', nullsFirst: false });
  }

  if (chamber && chamber !== 'all') query = query.eq('member_chamber', chamber);
  if (party && party !== 'all') query = query.eq('member_party', party);
  if (state && state !== 'all') query = query.eq('member_state', state);
  if (ticker) query = query.eq('ticker', ticker.toUpperCase());
  if (member) query = query.ilike('member_name', `%${member}%`);
  if (txType && txType !== 'all') query = query.eq('transaction_type', txType);
  if (minAmount) query = query.gte('amount_max', parseInt(minAmount));
  if (maxAmount) query = query.lte('amount_max', parseInt(maxAmount));
  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);
  if (flag && flag !== 'all') query = query.contains('flags', [flag]);
  if (hasContract === 'true') query = query.eq('has_federal_contract', true);

  const { data, error, count } = await query;

  if (error) {
    console.error('Congress trades query error:', error);
    return NextResponse.json({ trades: [], total: 0, page: 1, limit: 50, pages: 0 }, { status: 500 });
  }

  const total = count ?? 0;
  const trades = (data ?? []) as CongressTrade[];

  // Post-process: add pre_award_buy flags and signal_type
  const processedTrades = await Promise.all(
    trades.map((trade) => enrichTrade(trade))
  );

  return NextResponse.json({
    trades: processedTrades,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

async function enrichTrade(trade: CongressTrade): Promise<CongressTrade> {
  const isBuy = trade.transaction_type === 'BUY';

  let flags = [...trade.flags];
  let relatedContracts: RelatedContract[] = [];
  let signalType: string;

  // Only check awards for buys that have federal contracts
  if (trade.has_federal_contract && isBuy) {
    const awards = await findMatchingAwards(trade);
    if (awards.length > 0) {
      if (!flags.includes('pre_award_buy')) {
        flags.push('pre_award_buy');
      }
      relatedContracts = awards;
    }
  }

  // Compute signal_type
  if (flags.includes('pre_award_buy')) {
    signalType = 'insider_trading';
  } else if (
    trade.has_federal_contract &&
    trade.amount_max != null &&
    trade.amount_max >= 1_000_000
  ) {
    signalType = 'suspicious';
  } else {
    signalType = 'routine';
  }

  return {
    ...trade,
    flags,
    signal_type: signalType,
    related_contracts: relatedContracts,
  };
}

async function findMatchingAwards(
  trade: CongressTrade
): Promise<RelatedContract[]> {
  if (!supabaseAdmin || !trade.transaction_date) return [];

  const companyPattern = `%${trade.company_name}%`;
  const tickerPattern = `%${trade.ticker}%`;
  const txDate = trade.transaction_date;

  const { data, error } = await supabaseAdmin
    .from('awards')
    .select(
      'recipient_name, total_cost, date_signed, awarding_agency_name, awarding_office, description'
    )
    .or(`recipient_name.ilike.${companyPattern},recipient_parent_ticker.ilike.${tickerPattern}`)
    .gte('total_cost', 10_000_000)
    .gte('date_signed', `${txDate}::date - interval '30 days'`)
    .lte('date_signed', `${txDate}::date + interval '60 days'`)
    .limit(3);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    recipient_name: row.recipient_name,
    total: row.total_cost,
    date_signed: row.date_signed,
    agency: row.awarding_agency_name || row.awarding_office || 'Unknown',
    description: row.description ?? null,
  }));
}

function getDemoTrades(): CongressTrade[] {
  return [
    { id: 'demo-1', member_name: 'Nancy Pelosi', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'CA', ticker: 'NVDA', company_name: 'NVIDIA Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 1_000_000, amount_max: 5_000_000, amount_range: '$1M - $5M', transaction_date: '2025-12-18', filed_date: '2026-01-15', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['federal_contractor_overlap', 'buy', 'large_trade'], signal_type: 'suspicious', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-2', member_name: 'Tommy Tuberville', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'AL', ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 15_001, amount_max: 50_000, amount_range: '$15K - $50K', transaction_date: '2025-11-05', filed_date: '2025-12-20', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['federal_contractor_overlap', 'buy'], signal_type: 'routine', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-3', member_name: 'Josh Gottheimer', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'NJ', ticker: 'MSFT', company_name: 'Microsoft Corporation', transaction_type: 'SELL' as const, asset_type: 'Stock', amount_min: 500_001, amount_max: 1_000_000, amount_range: '$500K - $1M', transaction_date: '2025-10-22', filed_date: '2025-12-06', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['sell'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-4', member_name: 'Marjorie Taylor Greene', member_chamber: 'House' as const, member_party: 'Republican', member_state: 'GA', ticker: 'NVDA', company_name: 'NVIDIA Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 100_001, amount_max: 250_000, amount_range: '$100K - $250K', transaction_date: '2025-09-15', filed_date: '2025-10-30', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-5', member_name: 'Ted Cruz', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'TX', ticker: 'XOM', company_name: 'Exxon Mobil Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 250_001, amount_max: 500_000, amount_range: '$250K - $500K', transaction_date: '2025-08-30', filed_date: '2025-10-14', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['buy'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-6', member_name: 'John Barrasso', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'WY', ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 50_001, amount_max: 100_000, amount_range: '$50K - $100K', transaction_date: '2025-08-12', filed_date: '2025-09-26', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'routine', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-7', member_name: 'Katherine Clark', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'MA', ticker: 'TSLA', company_name: 'Tesla Inc', transaction_type: 'SELL' as const, asset_type: 'Stock', amount_min: 500_001, amount_max: 1_000_000, amount_range: '$500K - $1M', transaction_date: '2025-07-19', filed_date: '2025-09-02', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['sell'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-8', member_name: 'Mike Gallagher', member_chamber: 'House' as const, member_party: 'Republican', member_state: 'WI', ticker: 'BA', company_name: 'Boeing Company', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 100_001, amount_max: 250_000, amount_range: '$100K - $250K', transaction_date: '2025-06-25', filed_date: '2025-08-08', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'suspicious', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
  ];
}