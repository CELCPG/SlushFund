import { NextRequest, NextResponse } from 'next/server';
import { fullBackfill, syncContracts, syncGrants, incrementalSync } from '@/lib/sync';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/sync — check sync status and last sync time
export async function GET() {
  let lastSync = null;
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('sync_log')
      .select('sync_type, status, records_synced, started_at, completed_at, end_date')
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      lastSync = {
        type: data[0].sync_type,
        status: data[0].status,
        records_synced: data[0].records_synced,
        started_at: data[0].started_at,
        completed_at: data[0].completed_at,
        end_date: data[0].end_date,
      };
    }
  }

  return NextResponse.json({
    sync_types: ['contracts', 'grants', 'full', 'incremental'],
    usage: 'POST /api/sync?type=full&start=2024-10-01&end=2025-05-17',
    last_sync: lastSync,
    note: 'This endpoint calls the USAspending.gov API and writes to Supabase. Use with caution — can trigger large syncs.',
    live_endpoints: {
      fec: 'GET /api/fec?committee_id=C00000000 — live FEC committee totals (read-through cache, no DB write). Weekly cron keeps the cache warm.',
      policy: 'GET /api/policy/bills — curated bills + votes, enriched with live Congress.gov status. Weekly cron keeps the cache warm.',
    },
  });
}

// POST /api/sync — trigger a sync job
// Query params: ?type=contracts|grants|full|incremental&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const syncType = searchParams.get('type') ?? 'full';
  const start = searchParams.get('start') ?? '2024-10-01';
  const end = searchParams.get('end') ?? new Date().toISOString().split('T')[0];

  try {
    if (syncType === 'full') {
      // Log start
      let logId = '';
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('sync_log')
          .insert({ sync_type: 'full', start_date: start, end_date: end, status: 'running' })
          .select('id').single();
        logId = data?.id ?? '';
      }
      const startMs = Date.now();
      const result = await fullBackfill();
      const totalSynced = result.contracts.synced + result.grants.synced;
      const totalFlagged = result.contracts.flagged + result.grants.flagged;
      const allErrors = [...(result.contracts.errors ?? []), ...(result.grants.errors ?? [])];
      if (supabaseAdmin && logId) {
        await supabaseAdmin.from('sync_log').update({
          status: 'complete',
          records_synced: totalSynced,
          records_flagged: totalFlagged,
          errors: allErrors,
          duration_ms: Date.now() - startMs,
          completed_at: new Date().toISOString(),
        }).eq('id', logId);
      }
      return NextResponse.json({
        status: 'complete',
        total_synced: totalSynced,
        total_flagged: totalFlagged,
        contracts: result.contracts,
        grants: result.grants,
        message: `Full backfill complete. Synced ${totalSynced} awards (${totalFlagged} flagged).`,
      });
    }

    if (syncType === 'contracts') {
      const result = await syncContracts(start, end);
      return NextResponse.json({
        status: 'complete',
        ...result,
        message: `Synced ${result.synced} contracts from ${start} to ${end}.`,
      });
    }

    if (syncType === 'grants') {
      const result = await syncGrants(start, end);
      return NextResponse.json({
        status: 'complete',
        ...result,
        message: `Synced ${result.synced} grants from ${start} to ${end}.`,
      });
    }

    if (syncType === 'incremental') {
      // incrementalSync() handles its own logging internally via sync.ts helpers
      const result = await incrementalSync();
      return NextResponse.json({
        status: 'complete',
        ...result,
        message: `Incremental sync complete. Synced ${result.synced} awards.`,
      });
    }

    return NextResponse.json({ error: `Unknown sync type: ${syncType}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}