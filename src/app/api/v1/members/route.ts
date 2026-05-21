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

interface MemberStats {
  member_name: string;
  party: string;
  chamber: string;
  state: string;
  total_trades: number;
  total_volume: number;
  buys: number;
  sells: number;
  unique_tickers: number;
  first_trade_date: string | null;
  last_trade_date: string | null;
  has_federal_contract_trades: number;
}

const CSV_HEADERS = [
  'member_name',
  'party',
  'chamber',
  'state',
  'total_trades',
  'total_volume',
  'buys',
  'sells',
  'unique_tickers',
  'first_trade_date',
  'last_trade_date',
  'has_federal_contract_trades',
];

function memberToRow(m: MemberStats): string {
  const fields = [
    `"${m.member_name}"`,
    m.party,
    m.chamber,
    m.state,
    m.total_trades,
    m.total_volume,
    m.buys,
    m.sells,
    m.unique_tickers,
    m.first_trade_date ?? '',
    m.last_trade_date ?? '',
    m.has_federal_contract_trades,
  ];
  return fields.join(',');
}

function membersToCSV(members: MemberStats[]): string {
  const rows = members.map(memberToRow);
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

// ── GET /api/v1/members ────────────────────────────────────────────────────────
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
  const format = searchParams.get('format') ?? 'json';

  // Aggregate query: group by member_name, party, chamber, state
  const { data, error } = await supabaseAdmin
    .from('congress_trades')
    .select(
      `member_name, member_party, member_chamber, member_state,
       ticker, transaction_type, amount_max, transaction_date, has_federal_contract`
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build aggregates in-memory (Supabase doesn't support complex GROUP BY across all dimensions)
  const memberMap = new Map<
    string,
    {
      party: string;
      chamber: string;
      state: string;
      total_trades: number;
      total_volume: number;
      buys: number;
      sells: number;
      tickers: Set<string>;
      first_trade_date: string | null;
      last_trade_date: string | null;
      has_federal_contract_trades: number;
    }
  >();

  for (const row of data ?? []) {
    const key = row.member_name;
    if (!memberMap.has(key)) {
      memberMap.set(key, {
        party: row.member_party,
        chamber: row.member_chamber,
        state: row.member_state,
        total_trades: 0,
        total_volume: 0,
        buys: 0,
        sells: 0,
        tickers: new Set(),
        first_trade_date: null,
        last_trade_date: null,
        has_federal_contract_trades: 0,
      });
    }
    const m = memberMap.get(key)!;
    m.total_trades++;
    if (row.amount_max != null) m.total_volume += row.amount_max;
    if (row.transaction_type === 'BUY') m.buys++;
    else if (row.transaction_type === 'SELL') m.sells++;
    if (row.ticker) m.tickers.add(row.ticker);
    if (row.transaction_date) {
      if (!m.first_trade_date || row.transaction_date < m.first_trade_date) {
        m.first_trade_date = row.transaction_date;
      }
      if (!m.last_trade_date || row.transaction_date > m.last_trade_date) {
        m.last_trade_date = row.transaction_date;
      }
    }
    if (row.has_federal_contract) m.has_federal_contract_trades++;
  }

  const members: MemberStats[] = Array.from(memberMap.entries())
    .map(([member_name, m]) => ({
      member_name,
      party: m.party,
      chamber: m.chamber,
      state: m.state,
      total_trades: m.total_trades,
      total_volume: m.total_volume,
      buys: m.buys,
      sells: m.sells,
      unique_tickers: m.tickers.size,
      first_trade_date: m.first_trade_date,
      last_trade_date: m.last_trade_date,
      has_federal_contract_trades: m.has_federal_contract_trades,
    }))
    .sort((a, b) => b.total_trades - a.total_trades);

  if (format === 'csv') {
    const csv = membersToCSV(members);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="members.csv"`,
      },
    });
  }

  return NextResponse.json({ members, total: members.length });
}