import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { FY_DATE_RANGES } from '@/lib/era';
import { ERA_FYS, type Era } from '@/lib/types';

// Edge runtime: SQL RPC only, no Node deps.
export const runtime = 'edge';

// Cache headers: summary stats only change when the awards table or
// era_snapshots is refreshed. CDN cache 5min, browser 1min, plus SWR.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
};

// GET /api/alerts — aggregate stats for the dashboard
//
// Performance: as of sprint 5, this route no longer pulls raw rows from
// the awards table for the summary block. It calls two SQL RPCs:
//   1. get_alert_summary(start_date, end_date) — returns the 10 scalar
//      summary fields (total_awards, total_dollars, connected_dollars,
//      flagged_count, no_bid_count, etc.) in a single round-trip.
//   2. get_top_agencies(start_date, end_date, min_risk, limit) — returns
//      the top-N agency rows aggregated in Postgres.
// The connection breakdown is read from the existing connection_group_summary
// view (no date filter — already global). The only row scan that remains is
// the "top high-risk awards" query which already has a hard limit.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minRisk = searchParams.get('min_risk') ?? '50';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);
  const era = searchParams.get('era') as Era | null;
  const fyParam = searchParams.get('fy');

  // Resolve date range from era/fy
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (fyParam) {
    const fy = parseInt(fyParam);
    if (FY_DATE_RANGES[fy]) {
      startDate = FY_DATE_RANGES[fy].start;
      endDate = FY_DATE_RANGES[fy].end;
    }
  } else if (era && ERA_FYS[era]) {
    const fys = ERA_FYS[era];
    const starts = fys.map(f => FY_DATE_RANGES[f]?.start).filter(Boolean);
    const ends = fys.map(f => FY_DATE_RANGES[f]?.end).filter(Boolean);
    if (starts.length && ends.length) {
      startDate = starts[0];
      endDate = ends[ends.length - 1];
    }
  }

  // Database not configured — return empty summary (frontend renders "Data updating" state).
  if (!supabase) {
    return NextResponse.json({
      summary: { total_awards: 0, total_dollars: 0, flagged_count: 0 },
    });
  }

  // Fire the summary RPC + connection breakdown view + top-agencies RPC
  // + high-risk list + competition-coverage RPC in parallel.
  const [summaryResult, breakdownResult, agenciesResult, highRiskResult, competitionResult] = await Promise.all([
    supabase.rpc('get_alert_summary', {
      start_date: startDate ?? undefined,
      end_date: endDate ?? undefined,
    }),
    supabase
      .from('connection_group_summary')
      .select('connection_type, award_count, total_dollars, non_competitive_count'),
    supabase.rpc('get_top_agencies', {
      start_date: startDate ?? undefined,
      end_date: endDate ?? undefined,
      min_risk: parseInt(minRisk),
      result_limit: 10,
    }),
    (() => {
      let hrQuery = supabase
        .from('awards')
        .select('award_id, recipient_name, dollar_amount, connection_type, risk_score, flags, awarding_agency, competition_status')
        .gte('risk_score', parseInt(minRisk))
        .order('risk_score', { ascending: false })
        .limit(limit);
      if (startDate) hrQuery = hrQuery.gte('posted_date', startDate);
      if (endDate) hrQuery = hrQuery.lte('posted_date', endDate);
      return hrQuery;
    })(),
    supabase.rpc('get_competition_coverage'),
  ]);

  if (summaryResult.error) {
    console.error('[alerts] get_alert_summary RPC error:', summaryResult.error);
    return NextResponse.json({ error: 'Summary query failed' }, { status: 500 });
  }
  if (agenciesResult.error) {
    console.error('[alerts] get_top_agencies RPC error:', agenciesResult.error);
    return NextResponse.json({ error: 'Agency query failed' }, { status: 500 });
  }
  if (competitionResult.error) {
    console.error('[alerts] get_competition_coverage RPC error:', competitionResult.error);
  }

  const summary = (summaryResult.data as Record<string, number>) ?? {};
  const breakdown = (breakdownResult.data ?? []).map((r) => ({
    connection_type: r.connection_type,
    count: r.award_count,
    total: r.total_dollars,
  }));
  const topAgencies = ((agenciesResult.data ?? []) as Array<{
    agency: string;
    agency_code: string | null;
    total: number;
    connected: number;
    flagged: number;
  }>).map((r) => ({
    agency: r.agency,
    code: r.agency_code ?? '',
    total: r.total,
    connected: r.connected,
    flagged: r.flagged,
  }));

  return NextResponse.json({
    summary: {
      total_awards: Number(summary.total_awards ?? 0),
      total_dollars: Number(summary.total_dollars ?? 0),
      contract_count: Number(summary.contract_count ?? 0),
      grant_count: Number(summary.grant_count ?? 0),
      connected_count: Number(summary.connected_count ?? 0),
      connected_dollars: Number(summary.connected_dollars ?? 0),
      flagged_count: Number(summary.flagged_count ?? 0),
      flagged_dollars: Number(summary.flagged_dollars ?? 0),
      no_bid_count: Number(summary.no_bid_count ?? 0),
      no_bid_dollars: Number(summary.no_bid_dollars ?? 0),
    },
    breakdown,
    high_risk_awards: highRiskResult.data ?? [],
    top_agencies: topAgencies,
    competition_coverage: (competitionResult.data as Record<string, unknown>) ?? null,
    generated_at: new Date().toISOString(),
  }, { headers: CACHE_HEADERS });
}
