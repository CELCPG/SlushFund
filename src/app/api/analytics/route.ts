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
// No fallback: if the RPC fails the route returns an error, never figures
// from static files.
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
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
