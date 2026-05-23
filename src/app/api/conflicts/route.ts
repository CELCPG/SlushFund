import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ── Conflict Engine API ────────────────────────────────────────────────────────
// Serves the ranked "most conflicted members" leaderboard and the highest-scoring
// flagged trades, computed by src/scripts/compute_conflicts.py.

export interface ConflictLeader {
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  total_trades: number;
  conflicted_trades: number;
  stock_act_violations: number;
  committee_conflicts: number;
  contractor_trades: number;
  high_conflict_trades: number;
  estimated_volume: number;
  peak_conflict_score: number;
  avg_conflict_score: number;
}

export interface FlaggedTrade {
  id: string;
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  ticker: string;
  company_name: string;
  transaction_type: string;
  transaction_date: string | null;
  filed_date: string | null;
  amount_min: number | null;
  amount_max: number | null;
  conflict_score: number;
  conflict_tier: string;
  conflict_reasons: string[];
  committee_conflict_detail: string | null;
  stock_act_late: boolean;
  days_to_file: number | null;
  has_federal_contract: boolean;
  source_system: string;
}

interface ConflictsResponse {
  leaderboard: ConflictLeader[];
  flagged_trades: FlaggedTrade[];
  stats: {
    total_scored: number;
    total_flagged: number;
    severe: number;
    high: number;
    stock_act_violations: number;
    committee_conflicts: number;
  };
}

const FLAGGED_COLS =
  'id,member_name,member_party,member_chamber,member_state,ticker,company_name,' +
  'transaction_type,transaction_date,filed_date,amount_min,amount_max,conflict_score,' +
  'conflict_tier,conflict_reasons,committee_conflict_detail,stock_act_late,days_to_file,' +
  'has_federal_contract,source_system';

export async function GET(): Promise<NextResponse<ConflictsResponse>> {
  if (!supabaseAdmin) {
    return NextResponse.json({
      leaderboard: [], flagged_trades: [],
      stats: { total_scored: 0, total_flagged: 0, severe: 0, high: 0, stock_act_violations: 0, committee_conflicts: 0 },
    });
  }

  const sb = supabaseAdmin;
  const countOnly = { count: 'exact' as const, head: true };

  const [leaders, flagged, scored, flaggedCount, severe, high, stockAct, committee] = await Promise.all([
    sb.from('member_conflict_scores').select('*')
      .gt('conflicted_trades', 0)
      .order('high_conflict_trades', { ascending: false })
      .order('conflicted_trades', { ascending: false })
      .limit(30),
    sb.from('congress_trades').select(FLAGGED_COLS)
      .in('conflict_tier', ['high', 'severe'])
      .order('conflict_score', { ascending: false })
      .order('transaction_date', { ascending: false })
      .limit(75),
    sb.from('congress_trades').select('*', countOnly),
    sb.from('congress_trades').select('*', countOnly).gt('conflict_score', 0),
    sb.from('congress_trades').select('*', countOnly).eq('conflict_tier', 'severe'),
    sb.from('congress_trades').select('*', countOnly).eq('conflict_tier', 'high'),
    sb.from('congress_trades').select('*', countOnly).eq('stock_act_late', true),
    sb.from('congress_trades').select('*', countOnly).eq('committee_conflict', true),
  ]);

  return NextResponse.json({
    leaderboard: (leaders.data ?? []) as ConflictLeader[],
    flagged_trades: (flagged.data ?? []) as unknown as FlaggedTrade[],
    stats: {
      total_scored: scored.count ?? 0,
      total_flagged: flaggedCount.count ?? 0,
      severe: severe.count ?? 0,
      high: high.count ?? 0,
      stock_act_violations: stockAct.count ?? 0,
      committee_conflicts: committee.count ?? 0,
    },
  });
}
