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

interface Award {
  recipient_name: string;
  dollar_amount: number;
  date_signed: string;
  awarding_agency: string;
  awarding_office: string;
  connection_type: string;
  description: string | null;
}

const CSV_HEADERS = [
  'recipient_name',
  'dollar_amount',
  'date_signed',
  'awarding_agency',
  'awarding_office',
  'connection_type',
  'description',
];

function awardToRow(a: Award): string {
  const fields = [
    `"${a.recipient_name}"`,
    a.dollar_amount,
    a.date_signed ?? '',
    `"${a.awarding_agency}"`,
    `"${a.awarding_office}"`,
    a.connection_type,
    `"${a.description ?? ''}"`,
  ];
  return fields.join(',');
}

function awardsToCSV(awards: Award[]): string {
  const rows = awards.map(awardToRow);
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

// ── GET /api/v1/contracts ──────────────────────────────────────────────────────
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
  const agency = searchParams.get('agency');
  const connection = searchParams.get('connection');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const minAmount = searchParams.get('min_amount');
  const maxAmount = searchParams.get('max_amount');

  // Sorting
  const sortKey = searchParams.get('sort') ?? 'date';
  const sortDir = searchParams.get('dir') ?? 'desc';
  const sortCol = sortKey === 'dollars' ? 'dollar_amount' : 'date_signed';

  // Pagination
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100'), 1), 1000);

  // Format
  const format = searchParams.get('format') ?? 'json';

  let query = supabaseAdmin
    .from('awards')
    .select(
      `recipient_name, dollar_amount, date_signed, awarding_agency,
       awarding_office, connection_type, description`,
      { count: 'exact' }
    )
    .range(0, limit - 1)
    .order(sortCol === 'dollar_amount' ? 'dollar_amount' : 'date_signed', {
      ascending: sortDir === 'asc',
    });

  if (agency) query = query.ilike('awarding_agency', `%${agency}%`);
  if (connection && connection !== 'all') query = query.eq('connection_type', connection);
  if (from) query = query.gte('date_signed', from);
  if (to) query = query.lte('date_signed', to);
  if (minAmount) query = query.gte('dollar_amount', parseInt(minAmount));
  if (maxAmount) query = query.lte('dollar_amount', parseInt(maxAmount));

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const awards: Award[] = (data ?? []).map((row: any) => ({
    recipient_name: row.recipient_name,
    dollar_amount: row.dollar_amount,
    date_signed: row.date_signed,
    awarding_agency: row.awarding_agency ?? row.awarding_office ?? '',
    awarding_office: row.awarding_office ?? '',
    connection_type: row.connection_type ?? '',
    description: row.description ?? null,
  }));

  if (format === 'csv') {
    const csv = awardsToCSV(awards);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contracts.csv"`,
        'X-Total-Count': String(count ?? 0),
      },
    });
  }

  return NextResponse.json({
    awards,
    total: count ?? 0,
    limit,
  });
}