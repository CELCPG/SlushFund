import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * D10 "Who funds them": one row of F1's view member_campaign_money (FEC 2025-26 cycle; f1-fec.md, f1b-funding-fix.md). Until the F1 migration
 * is applied (pending Apex) the view does not exist and the panel says only "Campaign finance data: coming soon".
 */

export interface CampaignMoney {
  bioguide_id: string;
  fec_cand_id: string;
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
  /** F1b (A12 M5-M8): the office of the FEC candidate record these figures belong to. */
  office_label: string | null;
  /** F1b M6: false when a share is negative or the shares add to more than 100, or there are no receipts. */
  shares_ok: boolean;
  /** F1b M5: a second FEC record (the member's seat), carried with its own label when the member has a 2026 record for another office. */
  alt_fec_cand_id: string | null;
  alt_office_label: string | null;
  alt_raised: number | null;
  alt_coverage_end: string | null;
  alt_fec_candidate_url: string | null;
  alt_same_committee: boolean | null;
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
