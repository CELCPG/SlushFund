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

  let query = supabase
    .from('awards')
    .select('*', { count: 'exact' })
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
    awards: (data ?? []) as Award[],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
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