import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FY_DATE_RANGES } from '@/lib/era';
import { ERA_FYS, type Era } from '@/lib/types';

// Edge runtime: only calls a PL/pgSQL RPC. No Node deps.
export const runtime = 'edge';

// POST /api/snapshots/backfill
//
// Refreshes the era_snapshots table by calling the backfill_era_snapshots RPC
// for every era defined in ERA_FYS. Triggered by Vercel cron daily at 04:30 UTC.
//
// Security: this endpoint is hit by Vercel's cron infrastructure, which
// appends `?cron_secret=...` when the CRON_SECRET env var is set in the project.
// We verify the secret in addition to checking that the request comes from
// the configured Vercel deployment.
//
// Vercel cron sends GET by default, so we expose both GET and POST.
export const GET = POST;
export async function POST(request: Request) {
  // Vercel cron auth (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    // Build the era_ranges array from the application-layer ERA_FYS +
    // FY_DATE_RANGES. Each era's range is the union of its FY date ranges.
    const eraRanges: Array<{ era: string; start_date: string; end_date: string }> = [];
    for (const era of Object.keys(ERA_FYS) as Era[]) {
      const fys = ERA_FYS[era];
      const starts = fys.map((f) => FY_DATE_RANGES[f]?.start).filter((s): s is string => !!s);
      const ends = fys.map((f) => FY_DATE_RANGES[f]?.end).filter((s): s is string => !!s);
      if (starts.length && ends.length) {
        eraRanges.push({
          era,
          start_date: starts[0],
          end_date: ends[ends.length - 1],
        });
      }
    }

    if (eraRanges.length === 0) {
      return NextResponse.json(
        { error: 'No era ranges configured' },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc('backfill_era_snapshots', {
      era_ranges: eraRanges,
    });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      eras_written: data,
      computed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[snapshots/backfill] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
