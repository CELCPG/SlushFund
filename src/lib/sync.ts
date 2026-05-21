// Sync service — pulls from USAspending API, maps to full Award schema, writes to Supabase
import { supabaseAdmin } from './supabase';
import {
  fetchAllAwards,
  fetchAwards,
  mapCompetitionStatus,
  mapContractType,
  detectFlags,
  type SpendingByAwardResponse,
} from './usaspending';
import { getConnectionInfo, connectionMultiplier, POLITICAL_ENTITIES } from './political-entities';
import type { Award, AwardCategory, ContractFlag, Era } from './types';
import { ERA_FYS } from './types';

// ─── FY Date Ranges ──────────────────────────────────────────────────────────
export const FY_DATE_RANGES: Record<number, { start: string; end: string }> = {
  2019: { start: '2018-10-01', end: '2019-09-30' },
  2020: { start: '2019-10-01', end: '2020-09-30' },
  2021: { start: '2020-10-01', end: '2021-09-30' },
  2022: { start: '2021-10-01', end: '2022-09-30' },
  2023: { start: '2022-10-01', end: '2023-09-30' },
  2024: { start: '2023-10-01', end: '2024-09-30' },
  2025: { start: '2024-10-01', end: '2025-09-30' },
  2026: { start: '2025-10-01', end: new Date().toISOString().split('T')[0] },
};

// ─── Era Detection ────────────────────────────────────────────────────────────
export function detectEra(dateStr: string): Era | null {
  if (!dateStr) return null;
  const year = new Date(dateStr).getFullYear();
  for (const [era, years] of Object.entries(ERA_FYS)) {
    if (years.includes(year)) return era as Era;
  }
  return null;
}

// ─── PPP Detection ─────────────────────────────────────────────────────────────
const PPP_CFDA_CODES = ['59.012', '59.013'];
export function isPPPRelated(cfda: string | null): boolean {
  if (!cfda) return false;
  return PPP_CFDA_CODES.includes(cfda);
}

// ─── USAspending → Award Mapper ────────────────────────────────────────────────
function mapToAward(raw: SpendingByAwardResponse): Award {
  const flags = detectFlags(raw);
  const amount = raw['Award Amount'] ?? 0;
  const { connection_type, political_connection, confidence } = getConnectionInfo(raw['Recipient Name'] ?? '');

  // Risk scoring
  const risk = computeRiskScore({
    connection_type,
    competition_status: mapCompetitionStatus(raw),
    dollar_amount: amount,
    flags,
  });

  // Flatten all flag categories into one array
  const allFlags: ContractFlag[] = [
    ...(flags.competition_flags as ContractFlag[]),
    ...(flags.price_flags as ContractFlag[]),
    ...(flags.connection_flags as ContractFlag[]),
    ...(flags.structural_flags as ContractFlag[]),
  ];

  // Add related_party flag if politically connected
  if (connection_type !== 'none' && connection_type !== undefined) {
    if (!allFlags.includes('related_party')) {
      allFlags.push('related_party');
    }
  }

  return {
    id: raw.internal_id ?? raw['generated_internal_id'] ?? '',
    award_id: raw['Award ID'] ?? '',
    recipient_name: raw['Recipient Name'] ?? '',
    recipient_uei: raw['Recipient UEI'] ?? null,
    recipient_duns: raw['Recipient DUNS Number'] ?? null,
    recipient_parent_name: null,
    recipient_location: raw['Primary Place of Performance'] ?? null,
    dollar_amount: amount,
    total_outlays: raw['Total Outlays'] ?? null,
    subsidy_cost: raw['Subsidy Cost'] ?? null,
    loan_value: raw['Loan Value'] ?? null,
    description: raw['Description'] ?? '',
    assistance_listing: raw['Assistance Listing'] ?? null,
    cfda_program: raw['CFDA Number'] ?? null,
    awarding_agency: raw['Awarding Agency'] ?? '',
    awarding_agency_code: raw['Awarding Agency Code'] ?? '',
    awarding_sub_agency: raw['Awarding Sub Agency'] ?? '',
    funding_agency: raw['Funding Agency'] ?? '',
    funding_agency_code: raw['Funding Agency Code'] ?? '',
    funding_sub_agency: raw['Funding Sub Agency'] ?? '',
    award_category: mapContractType(raw['Contract Award Type'] ?? '') as AwardCategory,
    contract_type: raw['Contract Award Type'] ?? '',
    competition_status: mapCompetitionStatus(raw),
    extent_competed: raw['Extent Competed'] ?? null,
    extent_competed_code: raw['Extent Competed Type Code'] ?? null,
    naics_code: raw['NAICS'] ?? null,
    psc_code: raw['PSC'] ?? null,
    posted_date: raw['Base Obligation Date'] ?? '',
    performance_start: raw['Start Date'] ?? null,
    performance_end: raw['End Date'] ?? null,
    base_obligation_date: raw['Base Obligation Date'] ?? '',
    last_modified_date: raw['Last Modified Date'] ?? '',
    pop_state: raw['Place of Performance State Code'] ?? null,
    pop_country: raw['Place of Performance Country Code'] ?? 'USA',
    pop_city: raw['Place of Performance City Code'] ?? null,
    primary_place_of_performance: raw['Primary Place of Performance'] ?? null,
    flags: allFlags,
    competition_flags: flags.competition_flags as any[],
    price_flags: flags.price_flags as any[],
    connection_flags: flags.connection_flags as any[],
    structural_flags: flags.structural_flags as any[],
    connection_type: connection_type !== 'none' ? connection_type : null,
    political_connection: political_connection || null,
    confidence,
    connection_sources: [],
    risk_score: risk.score,
    risk_factors: risk.factors,
    estimated_market_rate: null,
    price_premium_pct: null,
    covid_obligations: raw['COVID-19 Obligations'] ?? null,
    covid_outlays: raw['COVID-19 Outlays'] ?? null,
    infrastructure_obligations: raw['Infrastructure Obligations'] ?? null,
    infrastructure_outlays: raw['Infrastructure Outlays'] ?? null,
    era: detectEra(raw['Base Obligation Date']),
    fpds_url: buildFPDSUrl(raw),
    usaspending_url: buildUSASpendingUrl(raw),
    notes: null,
    source: 'usaspending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildFPDSUrl(award: SpendingByAwardResponse): string | null {
  const piid = award['Award ID'];
  if (!piid) return null;
  const agency = award['Awarding Agency Code'] ?? '';
  return `https://www.fpds.gov/fpds-screen/${agency}/${piid}`;
}

function buildUSASpendingUrl(award: SpendingByAwardResponse): string | null {
  const id = award['generated_internal_id'] ?? award['Award ID'];
  if (!id) return null;
  return `https://www.usaspending.gov/award/${encodeURIComponent(id)}`;
}

// ─── Risk Scoring Engine ──────────────────────────────────────────────────────
interface RiskInput {
  connection_type: string | undefined;
  competition_status: string;
  dollar_amount: number;
  flags: { competition_flags: string[]; price_flags: string[]; connection_flags: string[]; structural_flags: string[] };
}

function computeRiskScore(input: RiskInput): { score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];

  const cat = input.connection_type ?? 'none';

  // Connection score (0-40)
  const connScore = connectionMultiplier(cat as any) * 40;
  score += connScore;
  if (connScore > 0) factors.push(`${cat} connection (+${connScore.toFixed(0)})`);

  // Competition score (0-25)
  if (input.competition_status === 'no_bid') { score += 25; factors.push('No-bid award'); }
  else if (input.competition_status === 'sole_source') { score += 20; factors.push('Sole-source'); }
  else if (input.competition_status === 'limited_competition') { score += 10; factors.push('Limited competition'); }

  // Price/size score (0-20)
  const amt = input.dollar_amount;
  if (amt > 500_000_000) { score += 20; factors.push(`$${(amt / 1e9).toFixed(1)}B — very large award`); }
  else if (amt > 100_000_000) { score += 15; factors.push(`$${(amt / 1e6).toFixed(0)}M award`); }
  else if (amt > 10_000_000) { score += 5; factors.push(`$${(amt / 1e6).toFixed(0)}M award`); }

  // Price flags
  if (input.flags.price_flags.includes('inflated')) { score += 10; factors.push('Price flagged as inflated'); }
  if (input.flags.price_flags.includes('no_compete_high_value')) { score += 15; factors.push('No competition on high-value award'); }

  // Structural flags
  if (input.flags.structural_flags.includes('covid_related')) { score += 5; factors.push('COVID-related spending'); }
  if (input.flags.structural_flags.includes('emergency')) { score += 10; factors.push('Emergency designation'); }

  return { score: Math.min(100, score), factors };
}

// ─── Sync Log ──────────────────────────────────────────────────────────────────
interface SyncLogEntry {
  id: string;
  sync_type: string;
  table_name: string;
  start_date: string | null;
  end_date: string | null;
  records_synced: number;
  records_flagged: number;
  errors: string[];
  status: string;
  started_at: string;
  completed_at: string | null;
}

async function logSyncStart(syncType: string, startDate?: string, endDate?: string): Promise<string> {
  if (!supabaseAdmin) return '';
  const { data, error } = await supabaseAdmin
    .from('sync_log')
    .insert({ sync_type: syncType, start_date: startDate, end_date: endDate, status: 'running' })
    .select('id')
    .single();
  if (error) { console.error('[sync] Failed to log start:', error.message); return ''; }
  return data.id as string;
}

async function logSyncComplete(logId: string, recordsSynced: number, recordsFlagged: number, errors: string[], durationMs: number) {
  if (!supabaseAdmin || !logId) return;
  await supabaseAdmin
    .from('sync_log')
    .update({ status: 'complete', records_synced: recordsSynced, records_flagged: recordsFlagged, errors, duration_ms: durationMs, completed_at: new Date().toISOString() })
    .eq('id', logId);
}

async function getLastSyncTime(tableName: string = 'awards'): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('sync_log')
    .select('end_date')
    .eq('status', 'complete')
    .eq('sync_type', 'incremental')
    .order('completed_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? (data[0].end_date ?? null) : null;
}
async function upsertAward(award: Award): Promise<boolean> {
  if (!supabaseAdmin) return true;
  const { error } = await supabaseAdmin
    .from('awards')
    .upsert(award, { onConflict: 'award_id', ignoreDuplicates: false });
  if (error) {
    console.error(`Upsert error [${award.award_id}]:`, error.message);
    return false;
  }
  return true;
}

// ─── Sync Contract ─────────────────────────────────────────────────────────────
export interface SyncResult {
  synced: number;
  flagged: number;
  errors: string[];
  duration_ms: number;
  page_count: number;
}

// Sync contracts only
export async function syncContracts(
  startDate: string,
  endDate: string,
  awardingAgency?: string
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, flagged: 0, errors: [], duration_ms: 0, page_count: 0 };
  const start = Date.now();

  try {
    let pageCount = 0;
    for await (const awards of fetchAllAwards({
      startDate,
      endDate,
      awardingAgency,
      awardTypes: ['A', 'B', 'C', 'D'],
    })) {
      pageCount++;
      result.page_count++;

      if (pageCount % 5 === 0) {
        console.log(`[sync] Page ${pageCount} — ${result.synced} contracts synced...`);
      }

      for (const raw of awards) {
        try {
          const award = mapToAward(raw);
          const ok = await upsertAward(award);
          if (ok) {
            result.synced++;
            if (award.flags.length > 0) result.flagged++;
          }
        } catch (err) {
          result.errors.push(`Award ${raw['Award ID']}: ${err}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Sync failed: ${err}`);
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// Sync grants only
export async function syncGrants(
  startDate: string,
  endDate: string,
  awardingAgency?: string
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, flagged: 0, errors: [], duration_ms: 0, page_count: 0 };
  const start = Date.now();

  try {
    let pageCount = 0;
    for await (const awards of fetchAllAwards({
      startDate,
      endDate,
      awardingAgency,
      awardTypes: ['02', '03', '04', '05'],
    })) {
      pageCount++;
      result.page_count++;

      for (const raw of awards) {
        try {
          const award = mapToAward(raw);
          const ok = await upsertAward(award);
          if (ok) {
            result.synced++;
            if (award.flags.length > 0) result.flagged++;
          }
        } catch (err) {
          result.errors.push(`Award ${raw['Award ID']}: ${err}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Sync failed: ${err}`);
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// Full sync — contracts + grants
export async function syncAll(
  startDate: string,
  endDate: string
): Promise<{ contracts: SyncResult; grants: SyncResult }> {
  console.log('[sync] Starting full sync — contracts + grants...');
  const [contracts, grants] = await Promise.all([
    syncContracts(startDate, endDate),
    syncGrants(startDate, endDate),
  ]);
  console.log(`[sync] Done. Contracts: ${contracts.synced} (${contracts.flagged} flagged). Grants: ${grants.synced} (${grants.flagged} flagged).`);
  return { contracts, grants };
}

// Full backfill — accepts optional FY list (defaults to 2024-2026)
export async function fullBackfill(fys: number[] = [2024, 2025, 2026]): Promise<{ contracts: SyncResult; grants: SyncResult }> {
  const ranges = fys.map(fy => ({
    fy,
    start: FY_DATE_RANGES[fy]?.start ?? `${fy - 1}-10-01`,
    end: fy === 2026 ? new Date().toISOString().split('T')[0] : (FY_DATE_RANGES[fy]?.end ?? `${fy}-09-30`),
  }));

  console.log(`[sync] Full backfill for FYs: ${ranges.map(r => `FY${r.fy}(${r.start}→${r.end})`).join(', ')}`);
  const fyResults = await Promise.all(
    ranges.map(({ start, end, fy }) =>
      syncAll(start, end).then(result => ({ fy, result }))
    )
  );

  const combine = (parts: SyncResult[]) => ({
    synced: parts.reduce((s, p) => s + p.synced, 0),
    flagged: parts.reduce((s, p) => s + p.flagged, 0),
    errors: parts.flatMap(p => p.errors),
    duration_ms: parts.reduce((s, p) => s + p.duration_ms, 0),
    page_count: parts.reduce((s, p) => s + p.page_count, 0),
  });

  const contracts = fyResults.map(r => r.result.contracts);
  const grants = fyResults.map(r => r.result.grants);
  const labelStr = fyResults.map(r => `FY${r.fy}: ${r.result.contracts.synced} contracts, ${r.result.grants.synced} grants`).join(' | ');
  console.log(`[sync] Backfill complete. ${labelStr}`);

  return {
    contracts: { ...combine(contracts), label: 'contracts' } as any,
    grants: { ...combine(grants), label: 'grants' } as any,
  };
}

// Incremental sync — reads last sync time from sync_log, fetches awards modified since
const INCREMENTAL_DAYS = 30;

export async function incrementalSync(): Promise<SyncResult> {
  const logId = await logSyncStart('incremental');
  const lastSync = await getLastSyncTime('awards');
  const endDate = new Date().toISOString().split('T')[0];

  let startDate: string;
  if (lastSync) {
    startDate = lastSync;
    console.log(`[sync] Incremental from last sync: ${startDate} → ${endDate}`);
  } else {
    startDate = new Date(Date.now() - INCREMENTAL_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`[sync] No prior sync found, defaulting to ${INCREMENTAL_DAYS}-day window: ${startDate} → ${endDate}`);
  }

  const startMs = Date.now();
  const result = await syncAll(startDate, endDate);
  const contracts = result.contracts;
  const totalSynced = contracts.synced + result.grants.synced;
  const totalFlagged = contracts.flagged + result.grants.flagged;
  const allErrors = [...contracts.errors, ...result.grants.errors];

  await logSyncComplete(logId, totalSynced, totalFlagged, allErrors, Date.now() - startMs);
  return { ...contracts, synced: totalSynced, flagged: totalFlagged, errors: allErrors };
}

// Agency-specific sync — for targeted pulls
export async function syncAgency(
  agencyCode: string,
  fiscalYear: number
): Promise<SyncResult> {
  const startDate = `${fiscalYear}-10-01`;
  const endDate = `${fiscalYear + 1}-09-30`;
  console.log(`[sync] Agency ${agencyCode} FY${fiscalYear}: ${startDate} → ${endDate}`);
  const { contracts } = await syncAll(startDate, endDate);
  return contracts;
}