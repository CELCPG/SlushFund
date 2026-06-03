import { NextRequest, NextResponse } from 'next/server';
import { fetchAwards } from '@/lib/usaspending';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { CONNECTION_MAP } from '@/lib/connection-map';

const BATCH_SIZE = 200;
const DELAY_MS = 600;
const MAX_PAGES = 50;

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

function matchConnection(name: string) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, entry] of Object.entries(CONNECTION_MAP)) {
    const aliases = entry.aliases.map(a => a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim());
    const keyNorm = key.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (n.includes(keyNorm) || aliases.some(a => n === a || n.includes(a))) {
      return { connection_type: entry.connection_type, political_connection: entry.description, confidence: entry.confidence, sources: entry.sources };
    }
    const firstKey = keyNorm.split(' ').find(w => w.length >= 4);
    if (firstKey && n.split(' ').includes(firstKey)) {
      return { connection_type: entry.connection_type, political_connection: entry.description, confidence: entry.confidence, sources: entry.sources };
    }
  }
  return null;
}

function calcRisk(flags: string[], amount: number, hasConn: boolean): number {
  let s = 30;
  const w: Record<string, number> = { sole_source: 18, no_bid: 20, limited_competition: 8, no_compete_high_value: 12, large_award: 5, inflated: 10, emergency_waiver: 8, bundling: 5, mid_project_contractor_change: 5, matched_connection: 25 };
  for (const f of flags) s += w[f] ?? 2;
  if (amount >= 1e9) s += 18; else if (amount >= 5e8) s += 14; else if (amount >= 1e8) s += 8; else if (amount >= 25e6) s += 4; else if (amount >= 5e6) s += 2;
  if (hasConn) s += 25;
  return Math.min(s, 99);
}

function transform(raw: any): Award {
  const amount = Math.round(raw['Award Amount'] ?? 0);
  const extent = raw['Extent Competed'] ?? '';
  const compFlags: string[] = [];
  if (extent.includes('Not Competed') || extent.includes('Not')) compFlags.push('no_bid');
  if (extent.includes('Single')) compFlags.push('sole_source');
  if (extent.includes('Limited')) compFlags.push('limited_competition');
  const priceFlags: string[] = [];
  if (amount > 5e7 && (compFlags.includes('no_bid') || compFlags.includes('sole_source'))) priceFlags.push('no_compete_high_value');
  if (amount > 1e8) priceFlags.push('large_award');
  const structFlags: string[] = [];
  if ((raw['COVID-19 Obligations'] ?? 0) > 0) structFlags.push('covid_related');
  if ((raw['Infrastructure Obligations'] ?? 0) > 0) structFlags.push('infrastructure');
  const match = matchConnection(raw['Recipient Name'] ?? '');
  const allFlags = [...compFlags, ...priceFlags, ...structFlags, ...(match ? ['matched_connection'] : [])];
  const hasConn = !!match;
  const risk = calcRisk(allFlags, amount, hasConn);
  const awardTypeRaw = raw['Contract Award Type'] ?? '';
  let cat = 'contract';
  if (['02', '03', '04', '05'].includes(awardTypeRaw)) cat = 'grant';
  else if (['07', '08'].includes(awardTypeRaw)) cat = 'loan';
  const baseDate = raw['Base Obligation Date'] ?? raw['Last Modified Date'] ?? '';
  const posted = baseDate.slice(0, 10);
  const awardId = raw['Award ID'] ?? '';
  return {
    id: `sync_${awardId}_${posted}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50),
    award_id: awardId,
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
    awarding_agency: raw['Awarding Agency'] ?? 'Unknown Agency',
    awarding_agency_code: raw['Awarding Agency Code'] ?? '',
    awarding_sub_agency: raw['Awarding Sub Agency'] ?? '',
    funding_agency: raw['Funding Agency'] ?? '',
    funding_agency_code: raw['Funding Agency Code'] ?? '',
    funding_sub_agency: raw['Funding Sub Agency'] ?? '',
    award_category: cat || 'other',
    contract_type: awardTypeRaw,
    competition_status: compFlags.includes('no_bid') ? 'no_bid' : compFlags.includes('sole_source') ? 'sole_source' : compFlags.includes('limited_competition') ? 'limited_competition' : 'open_competition',
    extent_competed: extent,
    extent_competed_code: raw['Extent Competed Type Code'] ?? '',
    naics_code: raw['NAICS'] ?? null,
    psc_code: raw['PSC'] ?? null,
    posted_date: posted,
    performance_start: raw['Start Date']?.slice(0, 10) ?? null,
    performance_end: raw['End Date']?.slice(0, 10) ?? null,
    base_obligation_date: baseDate.slice(0, 10),
    last_modified_date: (raw['Last Modified Date'] ?? '').slice(0, 10),
    pop_state: raw['Place of Performance State Code'] ?? null,
    pop_country: raw['Place of Performance Country Code'] ?? 'USA',
    pop_city: raw['Place of Performance City Code'] ?? null,
    primary_place_of_performance: raw['Primary Place of Performance'] ?? null,
    flags: allFlags,
    competition_flags: compFlags,
    price_flags: priceFlags,
    connection_flags: match ? ['matched_connection'] : [],
    structural_flags: structFlags,
    connection_type: match?.connection_type ?? 'none',
    political_connection: match?.political_connection ?? 'No known political connection',
    confidence: match?.confidence ?? 'none',
    connection_sources: match?.sources ?? [],
    risk_score: risk,
    risk_factors: [],
    estimated_market_rate: null,
    price_premium_pct: null,
    covid_obligations: raw['COVID-19 Obligations'] != null ? Math.round(raw['COVID-19 Obligations']) : null,
    covid_outlays: raw['COVID-19 Outlays'] != null ? Math.round(raw['COVID-19 Outlays']) : null,
    infrastructure_obligations: raw['Infrastructure Obligations'] != null ? Math.round(raw['Infrastructure Obligations']) : null,
    infrastructure_outlays: raw['Infrastructure Outlays'] != null ? Math.round(raw['Infrastructure Outlays']) : null,
    fpds_url: awardId ? `https://www.fpds.gov/fpds-screen/${raw['Awarding Agency Code']}/${awardId}` : null,
    usaspending_url: awardId ? `https://www.usaspending.gov/award/${awardId}` : '',
    notes: '',
    source: 'usaspending_api',
  };
}

async function upsertOne(supabase: any, record: Award): Promise<boolean> {
  if (!record.awarding_agency) record.awarding_agency = 'Unknown Agency';
  if (!record.recipient_name) record.recipient_name = 'Unknown';
  if (!record.award_category) record.award_category = 'other';
  const { error } = await supabase.from('awards').upsert([record], { onConflict: 'award_id' });
  return !error;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// GET /api/sync?days=7&type=contracts|grants|all
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured', synced: 0, errors: 0 }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') ?? '7');
  const full = searchParams.get('full') === 'true';
  const syncType = searchParams.get('type') ?? 'all';

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - (full ? 365 : days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const typeGroups = syncType === 'contracts'
    ? [{ label: 'contracts', types: ['A', 'B', 'C', 'D'] }]
    : syncType === 'grants'
    ? [{ label: 'grants', types: ['02', '03', '04', '05'] }]
    : [
        { label: 'contracts', types: ['A', 'B', 'C', 'D'] },
        { label: 'grants', types: ['02', '03', '04', '05'] },
      ];

  let totalSynced = 0, totalErrors = 0;

  for (const group of typeGroups) {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= MAX_PAGES) {
      try {
        const result = await fetchAwards({ startDate, endDate, page, limit: 100, awardTypes: group.types });
        if (!result.results.length) { hasMore = false; break; }

        const transformed = result.results
          .filter((r: any) => (r['Award Amount'] ?? 0) >= 100_000)
          .map(transform);

        const notable = transformed.filter((a: Award) =>
          a.connection_type !== 'none' ||
          a.risk_score >= 55 ||
          ((a.competition_status === 'no_bid' || a.competition_status === 'sole_source') && a.dollar_amount >= 5_000_000)
        );

        for (const record of notable) {
          const ok = await upsertOne(supabaseAdmin, record);
          if (ok) totalSynced++; else totalErrors++;
          if (totalSynced % 20 === 0) await delay(100);
        }

        hasMore = result.hasMore;
        page++;
        await delay(DELAY_MS);
      } catch (err: any) {
        totalErrors++;
        hasMore = false;
      }
    }
  }

  // Get current total
  const { count } = await supabaseAdmin.from('awards').select('*', { count: 'exact', head: true });
  const { data: latest } = await supabaseAdmin.from('awards').select('posted_date').order('posted_date', { ascending: false }).limit(1);

  return NextResponse.json({
    synced: totalSynced,
    errors: totalErrors,
    total_awards: count ?? 0,
    latest_date: latest?.[0]?.posted_date ?? null,
    period: { startDate, endDate, days },
  });
}
