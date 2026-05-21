import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FY_DATE_RANGES } from '@/app/api/backfill/route';
import { ERA_FYS, type Era } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const era = searchParams.get('era') as Era | null;
  const fy = searchParams.get('fy');

  // Fast path: use era_snapshots if available
  if (supabaseAdmin) {
    const { data: snapshots } = await supabaseAdmin
      .from('era_snapshots')
      .select('*')
      .order('era');

    if (snapshots && snapshots.length > 0) {
      const filtered = era ? snapshots.filter(s => s.era === era) : snapshots;
      return NextResponse.json({ source: 'snapshot', data: filtered });
    }
  }

  // Fallback: compute from awards table
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    let fys: number[];

    if (fy) {
      fys = [parseInt(fy)];
    } else if (era && ERA_FYS[era]) {
      fys = ERA_FYS[era];
    } else {
      fys = [...ERA_FYS.trump_1, ...ERA_FYS.covid, ...ERA_FYS.biden, ...ERA_FYS.trump_2];
    }

    // Build combined date range across selected FYs
    const startDates: string[] = [];
    const endDates: string[] = [];
    for (const y of fys) {
      if (FY_DATE_RANGES[y]) {
        startDates.push(FY_DATE_RANGES[y].start);
        endDates.push(FY_DATE_RANGES[y].end);
      }
    }

    if (!startDates.length) {
      return NextResponse.json({ error: 'No valid FYs selected' }, { status: 400 });
    }

    const startDate = startDates[0];
    const endDate = endDates[endDates.length - 1];

    const { data, error } = await supabaseAdmin
      .from('awards')
      .select('dollar_amount, connection_type, flags, competition_status, award_category, posted_date')
      .gte('posted_date', startDate)
      .lte('posted_date', endDate);

    if (error) throw error;
    if (!data) return NextResponse.json({ total_awards: 0, total_dollars: 0 });

    const num = (v: unknown) => Number(v) || 0;
    const totalDollars = data.reduce((s, a) => s + num(a.dollar_amount), 0);
    const connectedDollars = data
      .filter(a => a.connection_type && a.connection_type !== 'none')
      .reduce((s, a) => s + num(a.dollar_amount), 0);
    const noBidDollars = data
      .filter(a => a.competition_status === 'no_bid' || a.competition_status === 'sole_source')
      .reduce((s, a) => s + num(a.dollar_amount), 0);
    const flaggedCount = data.filter(
      a => Array.isArray(a.flags) && a.flags.length > 0
    ).length;

    const result = {
      source: 'computed',
      era: era ?? 'all',
      fy: fy ?? fys,
      start_date: startDate,
      end_date: endDate,
      total_awards: data.length,
      total_dollars: totalDollars,
      connected_dollars: connectedDollars,
      connected_pct: data.length > 0 ? (connectedDollars / totalDollars * 100).toFixed(1) : '0',
      flagged_count: flaggedCount,
      no_bid_dollars: noBidDollars,
      breakdown: {
        contracts: data.filter(a => a.award_category === 'contract').length,
        grants: data.filter(a => a.award_category === 'grant').length,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[era-stats] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}