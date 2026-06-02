import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Award, AwardsResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<AwardsResponse>> {
  // Demo mode — Supabase not configured
  if (!supabase) {
    return NextResponse.json({
      awards: [],
      total: 0,
      page: 1,
      limit: 50,
      pages: 0,
      demo: true,
    });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = (page - 1) * limit;

  // Filters
  const connection = searchParams.get('connection');
  const category = searchParams.get('category'); // contract | grant | loan | direct_payment
  const flag = searchParams.get('flag');
  const search = searchParams.get('search');
  const minAmount = searchParams.get('min_amount');
  const maxAmount = searchParams.get('max_amount');
  const agency = searchParams.get('agency');
  const sortKey = searchParams.get('sort') ?? 'dollar_amount';
  const sortDir = searchParams.get('dir') ?? 'desc';
  const riskMin = searchParams.get('risk_min');
  const riskMax = searchParams.get('risk_max');

  // count: 'estimated' uses Postgres statistics instead of a full count.
  // For a 17k-row table, the difference is 10-50x faster on paginated
  // queries. The count is only used for "X of Y" display in the UI, so
  // being off by a few hundred rows is fine.
  // Trim SELECT to just the columns the UI actually displays. The award
  // row has 59 columns; the dashboard list view only uses ~11. Less data
  // over the wire = faster response, smaller memory in Vercel edge.
  const LIST_COLS = 'id, recipient_name, description, awarding_agency, awarding_agency_code, award_category, contract_type, naics_code, dollar_amount, risk_score, competition_status, connection_type, flags, posted_date, performance_start, performance_end, base_obligation_date, pop_state, pop_city, recipient_parent_name, price_premium_pct';

  let query = supabase
    .from('awards')
    .select(LIST_COLS, { count: 'estimated' })
    .range(offset, offset + limit - 1)
    .order(sortKey, { ascending: sortDir === 'asc' });

  if (connection && connection !== 'all') {
    query = query.eq('connection_type', connection);
  }

  if (category && category !== 'all') {
    query = query.eq('award_category', category);
  }

  if (flag && flag !== 'all') {
    query = query.contains('flags', [flag]);
  }

  if (search) {
    query = query.or(`recipient_name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (minAmount) {
    query = query.gte('dollar_amount', parseInt(minAmount));
  }

  if (maxAmount) {
    query = query.lte('dollar_amount', parseInt(maxAmount));
  }

  if (agency) {
    query = query.eq('awarding_agency', agency);
  }

  if (riskMin) {
    query = query.gte('risk_score', parseInt(riskMin));
  }

  if (riskMax) {
    query = query.lte('risk_score', parseInt(riskMax));
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message } as any, { status: 500 });
  }

  return NextResponse.json({
    awards: (data ?? []) as unknown as Award[],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  }, {
    headers: {
      // Awards table changes infrequently. Cache for 5min on the CDN,
      // 1min in browser, with 10min SWR for cold-cache recovery.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Demo mode — Supabase not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from('awards')
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ award: data }, { status: 201 });
}