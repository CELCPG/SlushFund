import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/covid-stats
//
// Returns COVID-19 spending aggregates for the dashboard.
//
// Performance: as of sprint 3, this route calls the get_covid_stats() RPC
// which returns total stats + by_agency + top_vendors + by_quarter in a
// single round-trip. Replaces the prior implementation that pulled every
// award with covid_obligations > 0 and reduced in JS.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_covid_stats');
    if (error) throw error;

    return NextResponse.json(data ?? {
      total_covid_awards: 0,
      total_covid_obligations: 0,
      total_covid_outlays: 0,
      covid_no_bid_count: 0,
      covid_no_bid_dollars: 0,
      by_agency: [],
      top_vendors: [],
      by_quarter: {},
    });
  } catch (err) {
    console.error('[covid-stats] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
