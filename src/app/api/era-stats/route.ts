import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FY_DATE_RANGES } from '@/app/api/backfill/route';
import { ERA_FYS, type Era } from '@/lib/types';

// Cache headers: snapshot data is refreshed once daily by the Vercel cron at
// 04:30 UTC. The CDNs can cache for 24h, browsers for 1h, and we allow
// stale-while-revalidate for 12h to mask cron timing jitter.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const era = searchParams.get('era') as Era | null;
  const fy = searchParams.get('fy');

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  // Fast path 1: era_snapshots (populated by /api/snapshots/backfill cron)
  if (!fy) {
    const { data: snapshots } = await supabaseAdmin
      .from('era_snapshots')
      .select('*')
      .order('era');

    if (snapshots && snapshots.length > 0) {
      const filtered = era ? snapshots.filter((s) => s.era === era) : snapshots;
      return NextResponse.json({ source: 'snapshot', data: filtered }, { headers: CACHE_HEADERS });
    }
  }

  // Fallback: compute via get_era_stats RPC (no row scan in Node, all in Postgres)
  try {
    let fys: number[];

    if (fy) {
      fys = [parseInt(fy)];
    } else if (era && ERA_FYS[era]) {
      fys = ERA_FYS[era];
    } else {
      fys = [...ERA_FYS.trump_1, ...ERA_FYS.covid, ...ERA_FYS.biden, ...ERA_FYS.trump_2];
    }

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

    const { data: stats, error } = await supabaseAdmin.rpc('get_era_stats', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) throw error;

    return NextResponse.json({
      source: 'computed',
      era: era ?? 'all',
      fy: fy ?? fys,
      start_date: startDate,
      end_date: endDate,
      ...((stats as Record<string, unknown>) ?? {}),
    }, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('[era-stats] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
