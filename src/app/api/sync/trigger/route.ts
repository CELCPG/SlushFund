import { NextResponse } from 'next/server';
import { fullBackfill } from '@/lib/sync';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  }

  // Log start
  let logId = '';
  const { data } = await supabaseAdmin
    .from('sync_log')
    .insert({ sync_type: 'full', status: 'running' })
    .select('id').single();
  logId = data?.id ?? '';

  const startMs = Date.now();
  try {
    const result = await fullBackfill();
    const duration_ms = Date.now() - startMs;
    const totalSynced = result.contracts.synced + result.grants.synced;
    const totalFlagged = result.contracts.flagged + result.grants.flagged;

    if (logId) {
      await supabaseAdmin.from('sync_log').update({
        status: 'complete',
        records_synced: totalSynced,
        flagged_count: totalFlagged,
        started_at: new Date(startMs).toISOString(),
        completed_at: new Date().toISOString(),
        end_date: new Date().toISOString().split('T')[0],
        duration_ms,
      }).eq('id', logId);
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      flagged: totalFlagged,
      duration_ms,
      errors: [...(result.contracts.errors ?? []), ...(result.grants.errors ?? [])].slice(0, 20),
    });
  } catch (err: any) {
    if (logId) {
      await supabaseAdmin.from('sync_log').update({ status: 'failed' }).eq('id', logId);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}