import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { CovidFraudStats } from '@/components/covid/CovidFraudSection';

// Edge runtime: single RPC call, no Node deps.
export const runtime = 'edge';

// GET /api/covid-fraud
//
// Aggregates fraud-signal fields across all COVID-tagged awards.
// Powers the "PPE loans & COVID fraud" section on /covid.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_covid_fraud_stats');
    if (error) throw error;

    return NextResponse.json(
      data ?? {
        total_awards: 0,
        flagged_count: 0,
        flagged_dollars: 0,
        price_flagged_count: 0,
        price_flagged_dollars: 0,
        connection_flagged_count: 0,
        connection_flagged_dollars: 0,
        no_bid_count: 0,
        no_bid_dollars: 0,
        high_risk_count: 0,
        high_risk_dollars: 0,
        price_premium_count: 0,
        avg_price_premium_pct: 0,
        total_inflated_overpayment: 0,
        top_suspicious_vendors: [],
        flag_breakdown: {},
        highest_risk_awards: [],
      } as CovidFraudStats
    );
  } catch (err) {
    console.error('[covid-fraud] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
