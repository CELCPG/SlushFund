import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ── Rate limiting ──────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const WINDOW_MS = 60 * 1000;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ── Types (public-facing, no internal fields) ─────────────────────────────────
export interface PublicTrade {
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
  source_system: string;
  signal_type: string | null;
  has_federal_contract: boolean;
}

const CSV_HEADERS = [
  'member_name',
  'member_chamber',
  'member_party',
  'member_state',
  'ticker',
  'company_name',
  'transaction_type',
  'amount_min',
  'amount_max',
  'transaction_date',
  'source_system',
  'signal_type',
  'has_federal_contract',
];

function tradeToRow(t: PublicTrade): string {
  const fields = [
    `"${t.member_name}"`,
    t.member_chamber,
    t.member_party,
    t.member_state,
    t.ticker,
    `"${t.company_name}"`,
    t.transaction_type,
    t.amount_min ?? '',
    t.amount_max ?? '',
    t.transaction_date ?? '',
    t.source_system,
    t.signal_type ?? '',
    t.has_federal_contract ? 'true' : 'false',
  ];
  return fields.join(',');
}

function tradesToCSV(trades: PublicTrade[]): string {
  const rows = trades.map(tradeToRow);
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

// ── GET /api/v1/trades ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);

  // Filters
  const member = searchParams.get('member');
  const ticker = searchParams.get('ticker');
  const chamber = searchParams.get('chamber');
  const party = searchParams.get('party');
  const txType = searchParams.get('type');
  const flag = searchParams.get('flag');
  const hasContract = searchParams.get('has_contract');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Sorting
  const sortKey = searchParams.get('sort') ?? 'date';
  const sortDir = searchParams.get('dir') ?? 'desc';
  const sortCol = sortKey === 'volume' ? 'amount_max' : 'transaction_date';

  // Pagination
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100'), 1), 1000);
  const offset = 0; // no pagination in v1 public API — just limit

  // Format
  const format = searchParams.get('format') ?? 'json';

  let query = supabaseAdmin
    .from('congress_trades')
    .select(
      `member_name, member_chamber, member_party, member_state, ticker,
       company_name, transaction_type, asset_type, amount_min, amount_max,
       amount_range, transaction_date, filed_date, source_system, flags,
       signal_type, has_federal_contract`,
      { count: 'exact' }
    )
    .range(offset, offset + limit - 1);

  // Ordering
  if (sortCol === 'amount_max') {
    query = query.order('amount_max', { ascending: sortDir === 'asc', nullsFirst: false });
  } else {
    query = query.order('transaction_date', { ascending: sortDir === 'asc', nullsFirst: false });
  }

  // Filters
  if (member) query = query.ilike('member_name', `%${member}%`);
  if (ticker) query = query.eq('ticker', ticker.toUpperCase());
  if (chamber && chamber !== 'all') query = query.eq('member_chamber', chamber);
  if (party && party !== 'all') query = query.eq('member_party', party);
  if (txType && txType !== 'all') query = query.eq('transaction_type', txType);
  if (flag && flag !== 'all') query = query.contains('flags', [flag]);
  if (hasContract === 'true') query = query.eq('has_federal_contract', true);
  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute signal_type from flags if not present
  const trades: PublicTrade[] = (data ?? []).map((row: any) => {
    const flags: string[] = row.flags ?? [];
    let signalType = row.signal_type;
    if (!signalType) {
      if (flags.includes('pre_award_buy')) {
        signalType = 'insider_trading';
      } else if (row.has_federal_contract && row.amount_max != null && row.amount_max >= 1_000_000) {
        signalType = 'suspicious';
      } else {
        signalType = 'routine';
      }
    }
    return {
      member_name: row.member_name,
      member_chamber: row.member_chamber,
      member_party: row.member_party,
      member_state: row.member_state,
      ticker: row.ticker,
      company_name: row.company_name,
      transaction_type: row.transaction_type,
      asset_type: row.asset_type,
      amount_min: row.amount_min,
      amount_max: row.amount_max,
      amount_range: row.amount_range,
      transaction_date: row.transaction_date,
      filed_date: row.filed_date,
      source_system: row.source_system,
      signal_type: signalType,
      has_federal_contract: row.has_federal_contract,
    };
  });

  if (format === 'csv') {
    const csv = tradesToCSV(trades);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trades.csv"`,
        'X-Total-Count': String(count ?? 0),
      },
    });
  }

  return NextResponse.json({
    trades,
    total: count ?? 0,
    limit,
  });
}