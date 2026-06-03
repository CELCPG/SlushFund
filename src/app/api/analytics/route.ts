import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Edge runtime: single RPC call, no Node deps.
export const runtime = 'edge';

// GET /api/analytics
//
// Returns the full analytics data: cost_overruns + stock_holdings +
// insider_signals + summary + agency_overruns + sector_breakdown +
// top_signals. All aggregated by the get_analytics_summary() RPC
// (single round-trip).
//
// Fallback: if the RPC is missing (e.g. before schema_analytics_rpc.sql
// was applied), return computed results from the static data files.
// In practice this branch should never hit because the schema files
// are applied on every deploy.
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ demo: true, error: 'DB not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.rpc('get_analytics_summary');
    if (error) throw error;
    if (!data) throw new Error('Empty RPC response');

    return NextResponse.json(data, {
      headers: {
        // Analytics data changes infrequently. CDN cache 5min, browser 1min.
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[analytics] RPC error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
