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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 50000);
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

  // Guard: never return future-dated trades — credibility fix
  const today = new Date().toISOString().split('T')[0];

  let query = supabaseAdmin
    .from('congress_trades')
    .select('*', { count: 'exact' })
    .lte('transaction_date', today)
    .range(offset, offset + limit - 1);

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

  // BATCHED enrichment: 1 round-trip for the whole page, regardless of how
  // many BUY+has_contract trades are in it. Replaces the prior N+1.
  const processedTrades = await enrichTradesBatched(trades);

  return NextResponse.json({
    trades: processedTrades,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

/**
 * Batch version of the per-trade enrichment.
 *
 * For each trade with has_federal_contract=true AND transaction_type='BUY',
 * we want to find any awards >$10M with recipient_name or recipient_parent_name
 * matching the trade's company name, where posted_date is within 30 days
 * before / 60 days after the trade's transaction_date.
 *
 * Strategy:
 *   1. Build the union of all (company_name, start_date, end_date) windows
 *      for the candidate trades.
 *   2. Fire ONE Supabase OR query covering the full date range, with the
 *      first 2 words of each company name as the OR filter.
 *   3. Group the awards in JS, filter per-trade against the actual date
 *      window. Cap at 3 per trade.
 *
 * Replaces up to 1,222 sequential round-trips (worst case) with a
 * single round-trip. 5-50x faster on cold pages.
 *
 * NOTE: The awards table doesn't have a ticker column. The OR filter uses
 * the first 2 words of the company_name (e.g. "Palantir Technologies")
 * against recipient_name / recipient_parent_name.
 */
async function enrichTradesBatched(trades: CongressTrade[]): Promise<CongressTrade[]> {
  if (!supabaseAdmin) {
    return trades;
  }

  // Collect candidate trades that need award enrichment.
  type Candidate = { trade: CongressTrade; idx: number };
  const candidates: Candidate[] = trades
    .map((t, i) => ({ trade: t, idx: i }))
    .filter((c) => c.trade.has_federal_contract && c.trade.transaction_type === 'BUY' && !!c.trade.transaction_date);

  if (candidates.length === 0) {
    return trades;
  }

  // Build the global date range covering all candidates' windows.
  const allDates = candidates.map((c) => c.trade.transaction_date as string).sort();
  const minDate = addDays(allDates[0], -30);
  const maxDate = addDays(allDates[allDates.length - 1], 60);

  // OR filter: each candidate contributes two predicates
  // (recipient_name contains company_key, recipient_parent_name contains it).
  // Use the first 2 words of company_name to match the clean recipient_name
  // format in awards (trade company names often have "Inc. - Class A Common
  // Stock" suffixes that don't appear in awards).
  // Dedupe so popular tickers don't blow up the filter.
  const companyWords = (name: string) =>
    name
      .replace(/[,.\-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .join(' ');
  const companies = Array.from(
    new Set(candidates.map((c) => companyWords(c.trade.company_name)).filter(Boolean))
  );
  const nameFilters = companies
    .flatMap((c) => [`recipient_name.ilike.%${c}%`, `recipient_parent_name.ilike.%${c}%`])
    .join(',');
  // PostgREST expects the comma-separated list WITHOUT outer parens.
  // The or= parameter provides the parens.
  const orFilter = nameFilters;

  const { data: awards, error } = await supabaseAdmin
    .from('awards')
    .select('recipient_name, recipient_parent_name, dollar_amount, posted_date, awarding_agency, description')
    .or(orFilter)
    .gte('dollar_amount', 10_000_000)
    .gte('posted_date', minDate)
    .lte('posted_date', maxDate)
    .limit(Math.min(candidates.length * 10, 200));

  if (error || !awards) {
    // Fail soft: don't 500 the whole page if the enrichment query errors.
    // The trades still render with no related_contracts.
    console.error('[enrichTradesBatched] awards query error:', error?.message);
    return trades;
  }

  // For each candidate trade, filter awards whose recipient matches
  // the trade's company_name (case-insensitive), and whose posted_date
  // is within the trade's window. Cap at 3 per trade.
  const tradesWithContracts: CongressTrade[] = trades.map((t) => ({ ...t, related_contracts: [] }));
  for (const c of candidates) {
    const t = c.trade;
    const txStart = addDays(t.transaction_date as string, -30);
    const txEnd = addDays(t.transaction_date as string, 60);
    // Re-use the same key the SQL filter used, so any returned award
    // is a candidate. Just check the date window.
    const companyKey = companyWords(t.company_name).toLowerCase();

    const matches: RelatedContract[] = (awards as any[])
      .filter((a) => {
        if (!a.posted_date) return false;
        const pd = String(a.posted_date).slice(0, 10);
        return pd >= txStart && pd <= txEnd;
      })
      .filter((a) => {
        const rn = String(a.recipient_name ?? '').toLowerCase();
        const pn = String(a.recipient_parent_name ?? '').toLowerCase();
        return rn.includes(companyKey) || pn.includes(companyKey);
      })
      .slice(0, 3)
      .map((a) => ({
        recipient_name: a.recipient_name,
        total: a.dollar_amount,
        date_signed: a.posted_date,
        agency: a.awarding_agency || 'Unknown',
        description: a.description ?? null,
      }));

    if (matches.length > 0) {
      const updated: CongressTrade = {
        ...tradesWithContracts[c.idx],
        related_contracts: matches,
        flags: tradesWithContracts[c.idx].flags.includes('pre_award_buy')
          ? tradesWithContracts[c.idx].flags
          : [...tradesWithContracts[c.idx].flags, 'pre_award_buy'],
      };
      tradesWithContracts[c.idx] = updated;
    }
  }

  return tradesWithContracts.map(computeSignalType);
}

/** Compute the signal_type field from existing flags. Pure function. */
function computeSignalType(t: CongressTrade): CongressTrade {
  if (t.flags.includes('pre_award_buy')) {
    return { ...t, signal_type: 'insider_trading' };
  }
  if (
    t.has_federal_contract &&
    t.amount_max != null &&
    t.amount_max >= 1_000_000
  ) {
    return { ...t, signal_type: 'suspicious' };
  }
  return { ...t, signal_type: 'routine' };
}

/** Add N days to a YYYY-MM-DD string. Negative N goes backward. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDemoTrades(): CongressTrade[] {
  return [
    { id: 'demo-1', member_name: 'Nancy Pelosi', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'CA', ticker: 'NVDA', company_name: 'NVIDIA Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 1_000_000, amount_max: 5_000_000, amount_range: '$1M - $5M', transaction_date: '2025-12-18', filed_date: '2026-01-15', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['federal_contractor_overlap', 'buy', 'large_trade'], signal_type: 'suspicious', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-2', member_name: 'Tommy Tuberville', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'AL', ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 15_001, amount_max: 50_000, amount_range: '$15K - $50K', transaction_date: '2025-11-05', filed_date: '2025-12-20', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['federal_contractor_overlap', 'buy'], signal_type: 'routine', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-3', member_name: 'Josh Gottheimer', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'NJ', ticker: 'MSFT', company_name: 'Microsoft Corporation - Common', transaction_type: 'SELL' as const, asset_type: 'Stock', amount_min: 500_001, amount_max: 1_000_000, amount_range: '$500K - $1M', transaction_date: '2025-10-22', filed_date: '2025-12-06', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['sell'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-4', member_name: 'Marjorie Taylor Greene', member_chamber: 'House' as const, member_party: 'Republican', member_state: 'GA', ticker: 'NVDA', company_name: 'NVIDIA Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 100_001, amount_max: 250_000, amount_range: '$100K - $250K', transaction_date: '2025-09-15', filed_date: '2025-10-30', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-5', member_name: 'Ted Cruz', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'TX', ticker: 'XOM', company_name: 'Exxon Mobil Corporation', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 250_001, amount_max: 500_000, amount_range: '$250K - $500M', transaction_date: '2025-08-30', filed_date: '2025-10-14', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['buy'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-6', member_name: 'John Barrasso', member_chamber: 'Senate' as const, member_party: 'Republican', member_state: 'WY', ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 50_001, amount_max: 100_000, amount_range: '$50K - $100K', transaction_date: '2025-08-12', filed_date: '2025-09-26', disclosure_year: 2025, source_system: 'Senate_EFD', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'routine', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-7', member_name: 'Katherine Clark', member_chamber: 'House' as const, member_party: 'Democrat', member_state: 'MA', ticker: 'TSLA', company_name: 'Tesla Inc', transaction_type: 'SELL' as const, asset_type: 'Stock', amount_min: 500_001, amount_max: 1_000_000, amount_range: '$500K - $1M', transaction_date: '2025-07-19', filed_date: '2025-09-02', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['sell'], signal_type: 'routine', has_federal_contract: false, related_contracts: [], created_at: new Date().toISOString() },
    { id: 'demo-8', member_name: 'Mike Gallagher', member_chamber: 'House' as const, member_party: 'Republican', member_state: 'WI', ticker: 'BA', company_name: 'Boeing Company', transaction_type: 'BUY' as const, asset_type: 'Stock', amount_min: 100_001, amount_max: 250_000, amount_range: '$100K - $250K', transaction_date: '2025-06-25', filed_date: '2025-08-08', disclosure_year: 2025, source_system: 'House_Clerk', flags: ['buy', 'federal_contractor_overlap'], signal_type: 'suspicious', has_federal_contract: true, related_contracts: [], created_at: new Date().toISOString() },
  ];
}
