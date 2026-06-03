#!/usr/bin/env npx tsx
/**
 * sync-awards.ts
 * Pulls fresh federal contract/grant awards from USAspending.gov API,
 * scores them for political connections and red flags,
 * then upserts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/sync-awards.ts                    # sync last 30 days
 *   npx tsx scripts/sync-awards.ts --days=7           # last 7 days
 *   npx tsx scripts/sync-awards.ts --full             # full backfill (slow)
 *
 * Cron (OpenClaw):
 *   Every 6 hours: npx tsx scripts/sync-awards.ts
 */

import { supabaseAdmin, isSupabaseConfigured } from '../src/lib/supabase';
import { fetchAwards } from '../src/lib/usaspending';
import { CONNECTION_MAP } from './connection-map';

// ─── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const fullBackfill = args.includes('--full');
const daysArg = args.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 30;

// ─── Config ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 200;
const MAX_PAGES = 50; // safety cap: 50 pages × 200 = 10k awards per run
const DELAY_MS = 600;  // stay well within 10 req/min USAspending limit

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Political connection matching ────────────────────────────────────────────
interface Award {
  id: string;
  award_id: string;
  recipient_name: string;
  recipient_uei: string | null;
  recipient_duns: string | null;
  recipient_parent_name: string | null;
  recipient_location: string | null;
  dollar_amount: number;
  total_outlays: number | null;
  description: string;
  assistance_listing: string | null;
  cfda_program: string | null;
  awarding_agency: string;
  awarding_agency_code: string;
  awarding_sub_agency: string;
  funding_agency: string;
  funding_agency_code: string;
  funding_sub_agency: string;
  award_category: string;
  contract_type: string;
  competition_status: string;
  extent_competed: string;
  extent_competed_code: string;
  naics_code: string | null;
  psc_code: string | null;
  posted_date: string;
  performance_start: string | null;
  performance_end: string | null;
  base_obligation_date: string;
  last_modified_date: string;
  pop_state: string | null;
  pop_country: string;
  pop_city: string | null;
  primary_place_of_performance: string | null;
  flags: string[];
  competition_flags: string[];
  price_flags: string[];
  connection_flags: string[];
  structural_flags: string[];
  connection_type: string;
  political_connection: string;
  confidence: string;
  connection_sources: string[];
  risk_score: number;
  risk_factors: string[];
  estimated_market_rate: number | null;
  price_premium_pct: number | null;
  covid_obligations: number | null;
  covid_outlays: number | null;
  infrastructure_obligations: number | null;
  infrastructure_outlays: number | null;
  fpds_url: string | null;
  usaspending_url: string;
  notes: string;
  source: string;
}

function matchConnection(recipientName: string, _parentName: string | null): {
  connection_type: string;
  political_connection: string;
  confidence: string;
  sources: string[];
} | null {
  if (!recipientName) return null;
  // Normalize: remove punctuation, collapse spaces
  const name = recipientName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [key, entry] of Object.entries(CONNECTION_MAP)) {
    const aliases = entry.aliases.map(a => a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim());
    const keyNorm = key.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Match if full key phrase appears in recipient name (word-bounded)
    // or if first significant word (>=4 chars) appears
    const nameWords = name.split(' ');
    const keyWords = keyNorm.split(' ');

    // Exact key phrase in name
    if (name.includes(keyNorm)) return { connection_type: entry.connection_type, political_connection: entry.description, confidence: entry.confidence, sources: entry.sources };

    // Exact alias in name
    if (aliases.some(alias => name === alias || name.includes(alias))) return { connection_type: entry.connection_type, political_connection: entry.description, confidence: entry.confidence, sources: entry.sources };

    // First key word (if >=4 chars) appears as standalone word in name
    const firstKeyWord = keyWords.find(w => w.length >= 4);
    if (firstKeyWord && nameWords.includes(firstKeyWord)) return { connection_type: entry.connection_type, political_connection: entry.description, confidence: entry.confidence, sources: entry.sources };
  }
  return null;
}

// ─── Scoring ───────────────────────────────────────────────────────────────────
function calcRiskScore(flags: string[], amount: number, hasConnection: boolean): number {
  let score = 30; // baseline

  const flagWeights: Record<string, number> = {
    sole_source: 18,
    no_bid: 20,
    limited_competition: 8,
    no_compete_high_value: 12,
    large_award: 5,
    inflated: 10,
    emergency_waiver: 8,
    bundling: 5,
    mid_project_contractor_change: 5,
  };

  for (const flag of flags) {
    score += flagWeights[flag] ?? 2;
  }

  // Amount scaling
  if (amount >= 1_000_000_000) score += 18;
  else if (amount >= 500_000_000) score += 14;
  else if (amount >= 100_000_000) score += 8;
  else if (amount >= 10_000_000) score += 3;

  // Political connection bonus
  if (hasConnection) score += 25;

  return Math.min(score, 99);
}

// ─── Transform raw USAspending award → our Award shape ──────────────────────────
function transformAward(raw: any): Award {
  // Parse all numeric fields as rounded integers — Supabase bigint can't store floats or negatives
  const amount = Math.round(raw['Award Amount'] ?? 0);
  const extent = raw['Extent Competed'] ?? '';
  const competition = raw['Extent Competed'] ?? 'Unknown';

  // Competition flags
  const competition_flags: string[] = [];
  if (extent.includes('Not Competed') || extent.includes('Not')) competition_flags.push('no_bid');
  if (extent.includes('Single')) competition_flags.push('sole_source');
  if (extent.includes('Limited')) competition_flags.push('limited_competition');
  if (extent.includes('Full Open')) competition_flags.push('full_competition');

  // Price flags
  const price_flags: string[] = [];
  if (amount > 50_000_000 && (competition_flags.includes('no_bid') || competition_flags.includes('sole_source'))) {
    price_flags.push('no_compete_high_value');
  }
  if (amount > 100_000_000) price_flags.push('large_award');

  // Structural flags
  const structural_flags: string[] = [];
  if (raw['COVID-19 Obligations'] > 0) structural_flags.push('covid_related');
  if (raw['Infrastructure Obligations'] > 0) structural_flags.push('infrastructure');

  // Connection matching — USAspending doesn't include parent company in this endpoint
  // so we match on recipient name only
  const match = matchConnection(raw['Recipient Name'] ?? '', null);

  const connection_flags: string[] = [];
  if (match) connection_flags.push('matched_connection');

  const allFlags = [...competition_flags, ...price_flags, ...structural_flags, ...connection_flags];
  const hasConnection = !!match;
  const risk_score = calcRiskScore(allFlags, amount, hasConnection);
  const risk_factors: string[] = [];
  if (hasConnection) risk_factors.push(`${match!.connection_type} connection (+25)`);
  competition_flags.forEach(f => risk_factors.push(`${f} (+${f === 'no_bid' ? 20 : f === 'sole_source' ? 18 : 8})`));
  if (amount >= 1_000_000_000) risk_factors.push(`$${(amount / 1e9).toFixed(1)}B — very large award (+18)`);
  else if (amount >= 100_000_000) risk_factors.push(`$${(amount / 1e6).toFixed(0)}M — large award (+8)`);

  // Award type
  const awardTypeRaw = raw['Contract Award Type'] ?? '';
  let award_category = 'contract';
  if (['02', '03', '04', '05'].includes(awardTypeRaw)) award_category = 'grant';
  else if (['07', '08'].includes(awardTypeRaw)) award_category = 'loan';

  // posted_date should reflect when the award was OBLIGATED (Base Obligation Date).
  // Base Obligation Date is the legally binding commitment date — the real "business day" of the award.
  // Last Modified Date changes when the award is ADMINISTRATIVELY updated (not the obligation date).
  // Only fall back to Last Modified Date if Base Obligation Date is missing entirely.
  const baseDateRaw = raw['Base Obligation Date'] ?? '';
  const baseDate = baseDateRaw || (raw['Last Modified Date'] ?? '');
  const postedDate = baseDate.slice(0, 10);

  const award_id = raw['Award ID'] ?? raw['award_id'] ?? '';

  return {
    id: `sync_${award_id}_${postedDate}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50),
    award_id,
    recipient_name: raw['Recipient Name'] ?? 'Unknown',
    recipient_uei: raw['Recipient UEI'] ?? null,
    recipient_duns: raw['Recipient DUNS Number'] ?? null,
    recipient_parent_name: raw['Parent Recipient Name'] ?? null,
    recipient_location: raw['Recipient Location'] ?? null,
    dollar_amount: amount,
    total_outlays: raw['Total Outlays'] != null ? Math.round(raw['Total Outlays']) : null,
    description: raw['Description'] ?? '',
    assistance_listing: raw['Assistance Listing'] ?? null,
    cfda_program: raw['CFDA Number'] ?? null,
    awarding_agency: raw['Awarding Agency'] ?? 'Unknown',
    awarding_agency_code: raw['Awarding Agency Code'] ?? '',
    awarding_sub_agency: raw['Awarding Sub Agency'] ?? '',
    funding_agency: raw['Funding Agency'] ?? '',
    funding_agency_code: raw['Funding Agency Code'] ?? '',
    funding_sub_agency: raw['Funding Sub Agency'] ?? '',
    award_category,
    contract_type: awardTypeRaw,
    competition_status: competition_flags.includes('no_bid') ? 'no_bid'
      : competition_flags.includes('sole_source') ? 'sole_source'
      : competition_flags.includes('limited_competition') ? 'limited_competition'
      : 'open_competition',
    extent_competed: extent,
    extent_competed_code: raw['Extent Competed Type Code'] ?? '',
    naics_code: raw['NAICS'] ?? null,
    psc_code: raw['PSC'] ?? null,
    posted_date: postedDate,
    performance_start: raw['Start Date']?.slice(0, 10) ?? null,
    performance_end: raw['End Date']?.slice(0, 10) ?? null,
    base_obligation_date: baseDate.slice(0, 10),
    last_modified_date: (raw['Last Modified Date'] ?? '').slice(0, 10),
    pop_state: raw['Place of Performance State Code'] ?? null,
    pop_country: raw['Place of Performance Country Code'] ?? 'USA',
    pop_city: raw['Recipient Location']?.split(',')[0] ?? null,
    primary_place_of_performance: raw['Primary Place of Performance'] ?? null,
    flags: allFlags,
    competition_flags,
    price_flags,
    connection_flags,
    structural_flags,
    connection_type: match?.connection_type ?? 'none',
    political_connection: match?.political_connection ?? 'No known political connection',
    confidence: match?.confidence ?? 'none',
    connection_sources: match?.sources ?? [],
    risk_score,
    risk_factors,
    estimated_market_rate: null,
    price_premium_pct: null,
    covid_obligations: raw['COVID-19 Obligations'] != null ? Math.round(raw['COVID-19 Obligations']) : null,
    covid_outlays: raw['COVID-19 Outlays'] != null ? Math.round(raw['COVID-19 Outlays']) : null,
    infrastructure_obligations: raw['Infrastructure Obligations'] != null ? Math.round(raw['Infrastructure Obligations']) : null,
    infrastructure_outlays: raw['Infrastructure Outlays'] != null ? Math.round(raw['Infrastructure Outlays']) : null,
    fpds_url: raw['Award ID'] ? `https://www.fpds.gov/fpds-screen/${raw['Awarding Agency Code']}/${raw['Award ID']}` : null,
    usaspending_url: raw['Award ID'] ? `https://www.usaspending.gov/award/${raw['Award ID']}` : '',
    notes: '',
    source: 'usaspending_api',
  };
}

// ─── Upsert to Supabase ────────────────────────────────────────────────────────
async function upsertAwards(awards: Award[]): Promise<{ inserted: number; updated: number; errors: number }> {
  if (!awards.length) return { inserted: 0, updated: 0, errors: 0 };
  if (!isSupabaseConfigured || !supabaseAdmin) {
    console.log('  ⚠ No Supabase configured — skipping upsert');
    return { inserted: 0, updated: 0, errors: 0 };
  }

  let inserted = 0, updated = 0, errors = 0;

  // Clean records — ensure NOT NULL fields, skip records with no award_id
  const clean = awards
    .map(r => ({
      ...r,
      awarding_agency: r.awarding_agency || 'Unknown Agency',
      recipient_name: r.recipient_name || 'Unknown',
      award_category: r.award_category || 'other',
    }))
    .filter(r => r.award_id); // skip records without award_id (can't upsert)

  // Tiered upsert strategy:
  // 1. Try batch of 100  → fast, single round-trip
  // 2. If batch fails → try smaller batches of 10 (isolates bad records)
  // 3. If batch of 10 fails → individual upsert (almost always works)
  // No artificial delays — let the DB and network run at full speed
  const BATCH_LARGE = 100;
  const BATCH_SMALL = 10;

  for (let i = 0; i < clean.length; i += BATCH_LARGE) {
    const chunk = clean.slice(i, i + BATCH_LARGE);
    const { error } = await supabaseAdmin
      .from('awards')
      .upsert(chunk, { onConflict: 'award_id' });

    if (error) {
      // Large batch failed — try smaller batches
      for (let j = 0; j < chunk.length; j += BATCH_SMALL) {
        const sub = chunk.slice(j, j + BATCH_SMALL);
        const { error: err2 } = await supabaseAdmin
          .from('awards')
          .upsert(sub, { onConflict: 'award_id' });

        if (err2) {
          // Small batch failed — individual upserts
          for (const record of sub) {
            const { error: err3 } = await supabaseAdmin
              .from('awards')
              .upsert([record], { onConflict: 'award_id' });
            if (err3) {
              errors++;
              if (errors <= 3) console.error(`  ❌ ${record.award_id}: ${err3.message}`);
            } else {
              inserted++;
            }
          }
        } else {
          inserted += sub.length;
        }
      }
    } else {
      inserted += chunk.length;
    }
  }

  return { inserted, updated, errors };
}

// ─── Main sync ─────────────────────────────────────────────────────────────────
async function syncPage(
  startDate: string,
  endDate: string,
  awardTypes: string[],
  pageNum: number
): Promise<{ results: any[]; hasMore: boolean; fetched: number; notable: number; errors: number }> {
  let fetched = 0, notable = 0, errors = 0;
  let results: any[] = [];
  let hasMore = false;

  try {
    const result = await fetchAwards({
      startDate,
      endDate,
      page: pageNum,
      limit: 100,
      awardTypes,
    });

    if (!result.results.length) {
      return { results: [], hasMore: false, fetched: 0, notable: 0, errors: 0 };
    }

    fetched = result.results.length;
    hasMore = result.hasMore;

    const transformed = result.results
      .filter(r => (r['Award Amount'] ?? 0) >= 100_000)
      .map(transformAward);

    // Notable: political connection OR risk score 55+ OR no-bid/sole-source over $5M
    const notableAwards = transformed.filter(a =>
      a.connection_type !== 'none' ||
      a.risk_score >= 55 ||
      ((a.competition_status === 'no_bid' || a.competition_status === 'sole_source') && a.dollar_amount >= 5_000_000)
    );

    if (notableAwards.length > 0) {
      const upsert = await upsertAwards(notableAwards);
      notable = notableAwards.length;
    }

    results = result.results;
  } catch (err: any) {
    errors++;
    console.error(`     ❌ ${err.message}`);
  }

  return { results, hasMore, fetched, notable, errors };
}

async function sync() {
  if (!isSupabaseConfigured) {
    console.log('❌ No Supabase configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const endDate = new Date().toISOString().slice(0, 10);
  const actualDays = fullBackfill ? 365 : days;
  const startDate = new Date(Date.now() - actualDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  console.log(`\n🔄 SlushFund Awards Sync`);
  console.log(`   Period: ${startDate} → ${endDate} (${actualDays} days)`);
  console.log(`   Backfill: ${fullBackfill ? 'FULL' : 'incremental'}\n`);

  let totalFetched = 0;
  let totalUpserted = 0;
  let errorCount = 0;

  // USAspending requires contracts (A-D) and grants (02-05) in SEPARATE API calls
  const typeGroups = [
    { label: 'contracts', types: ['A', 'B', 'C', 'D'] },
    { label: 'grants', types: ['02', '03', '04', '05'] },
  ];

  for (const group of typeGroups) {
    console.log(`\n  ── ${group.label} ──`);
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      process.stdout.write(`  📡 ${group.label} p${page}... `);

      const result = await syncPage(startDate, endDate, group.types, page);

      if (result.errors > 0) {
        errorCount += result.errors;
        if (errorCount >= 20) {
          console.error('\n   Too many consecutive errors — stopping.');
          process.exit(1);
        }
        page++;
        await delay(DELAY_MS * 3); // back off on error
        continue;
      }

      if (!result.results.length) {
        hasMore = false;
        console.log('no more results');
        break;
      }

      totalFetched += result.fetched;
      totalUpserted += result.notable;
      hasMore = result.hasMore;
      process.stdout.write(`${result.fetched} fetched → ${result.notable} notable\n`);
      page++;
      await delay(DELAY_MS);
    }
  }

  console.log(`\n✅ Sync complete`);
  console.log(`   Total fetched: ${totalFetched}`);
  console.log(`   Notable (risk≥55 or connected): ${totalUpserted}`);
  console.log(`   Errors: ${errorCount}\n`);

  if (totalUpserted > 0) {
    console.log('💡 Recent awards are now live at https://slushfund.net/latest');
  }
}

sync().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
