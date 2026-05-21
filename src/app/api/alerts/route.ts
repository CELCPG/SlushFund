import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { FY_DATE_RANGES } from '@/app/api/backfill/route';
import { ERA_FYS, type Era } from '@/lib/types';

// GET /api/alerts — aggregate stats for the dashboard
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

  // Demo mode
  if (!supabase) {
    return NextResponse.json({
      demo: true,
      summary: { total_awards: 0, total_dollars: 0, flagged_count: 0 },
    });
  }

  // Main stats — apply date filter if set
  let query = supabase
    .from('awards')
    .select('dollar_amount, connection_type, flags, risk_score, award_category, competition_status');
  if (startDate) query = query.gte('posted_date', startDate);
  if (endDate) query = query.lte('posted_date', endDate);
  const { data: allAwards } = await query;

  if (!allAwards) {
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
  }

  const totalAwards = allAwards.length;
  const totalDollars = allAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);
  const connectedAwards = allAwards.filter(a => a.connection_type && a.connection_type !== 'none');
  const connectedDollars = connectedAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);
  const flaggedAwards = allAwards.filter(a => a.flags && (a.flags as string[]).length > 0);
  const flaggedDollars = flaggedAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);
  const noBidAwards = allAwards.filter(a => a.competition_status === 'no_bid' || a.competition_status === 'sole_source');
  const noBidDollars = noBidAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);

  // Connection breakdown
  const breakdown: Record<string, { count: number; total: number; risk_avg: number }> = {};
  for (const award of allAwards) {
    const cat = (award.connection_type as string) ?? 'none';
    if (!breakdown[cat]) breakdown[cat] = { count: 0, total: 0, risk_avg: 0 };
    breakdown[cat].count++;
    breakdown[cat].total += Number(award.dollar_amount);
  }

  // Top high-risk awards
  let hrQuery = supabase
    .from('awards')
    .select('award_id, recipient_name, dollar_amount, connection_type, risk_score, flags, awarding_agency, competition_status')
    .gte('risk_score', parseInt(minRisk))
    .order('risk_score', { ascending: false })
    .limit(limit);
  if (startDate) hrQuery = hrQuery.gte('posted_date', startDate);
  if (endDate) hrQuery = hrQuery.lte('posted_date', endDate);
  const { data: highRisk } = await hrQuery;

  // Agency breakdown
  let agQuery = supabase
    .from('awards')
    .select('awarding_agency, awarding_agency_code, award_category, dollar_amount, connection_type')
    .gte('risk_score', parseInt(minRisk));
  if (startDate) agQuery = agQuery.gte('posted_date', startDate);
  if (endDate) agQuery = agQuery.lte('posted_date', endDate);
  const { data: agencyData } = await agQuery;

  const agencyMap: Record<string, { agency: string; code: string; total: number; connected: number; flagged: number }> = {};
  for (const row of agencyData ?? []) {
    const key = row.awarding_agency;
    if (!agencyMap[key]) {
      agencyMap[key] = { agency: row.awarding_agency, code: row.awarding_agency_code ?? '', total: 0, connected: 0, flagged: 0 };
    }
    agencyMap[key].total += Number(row.dollar_amount);
    if (row.connection_type && row.connection_type !== 'none') agencyMap[key].connected += Number(row.dollar_amount);
  }

  const topAgencies = Object.values(agencyMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    summary: {
      total_awards: totalAwards,
      total_dollars: totalDollars,
      contract_count: allAwards.filter(a => a.award_category === 'contract').length,
      grant_count: allAwards.filter(a => a.award_category === 'grant').length,
      connected_count: connectedAwards.length,
      connected_dollars: connectedDollars,
      flagged_count: flaggedAwards.length,
      flagged_dollars: flaggedDollars,
      no_bid_count: noBidAwards.length,
      no_bid_dollars: noBidDollars,
    },
    breakdown: Object.entries(breakdown).map(([type, v]) => ({
      connection_type: type,
      count: v.count,
      total: v.total,
    })),
    high_risk_awards: highRisk ?? [],
    top_agencies: topAgencies,
    generated_at: new Date().toISOString(),
  });
}