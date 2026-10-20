import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * D10 "Who funds them": one row of F1's view member_campaign_money (FEC 2026 cycle; f1-fec.md). Until the F1 migration
 * is applied (pending Apex) the view does not exist and the panel says only "Campaign finance data: coming soon".
 */

export interface CampaignMoney {
  bioguide_id: string;
  raised: number | null;
  individual_itemized: number | null;
  individual_unitemized: number | null;
  pct_small_individual: number | null;
  pct_large_individual: number | null;
  pct_corporate_trade_pac: number | null;
  pct_labor_pac: number | null;
  pct_leadership_party_other: number | null;
  pct_self_funded: number | null;
  outside_support: number | null;
  outside_oppose: number | null;
  outside_lines: number | null;
  coverage_end: string | null;
  fec_election_year: number | null;
  fec_candidate_url: string | null;
}

export type CampaignMoneyResult =
  | { state: 'missing' } // the view does not exist yet (migration pending)
  | { state: 'error' }
  | { state: 'none' } // no confirmed FEC id for this member
  | { state: 'ok'; row: CampaignMoney };

export const getCampaignMoney = cache(async (bioguide: string): Promise<CampaignMoneyResult> => {
  if (!supabase) return { state: 'error' };
  const { data, error } = await supabase.from('member_campaign_money').select('*').eq('bioguide_id', bioguide).limit(1);
  if (error) {
    // PGRST205: "Could not find the table ... in the schema cache"; 42P01: undefined table.
    if (error.code === 'PGRST205' || error.code === '42P01') return { state: 'missing' };
    return { state: 'error' };
  }
  const row = (data ?? [])[0] as CampaignMoney | undefined;
  return row ? { state: 'ok', row } : { state: 'none' };
});
