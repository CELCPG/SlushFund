// USAspending.gov API client
// Docs: https://api.usaspending.gov/docs/endpoints
// No API key required — public government data

const BASE_URL = 'https://api.usaspending.gov/api/v2';

// ─── Award Type Codes ─────────────────────────────────────────────────────────
// Procurement (contracts): A=BLSS, B=Delivery Order, C=Purchase Order, D=IDV
// Grants: 02=Formula, 03=Project, 04=Continuation, 05=Pass-through
// Loans: 07=Direct loan, 08=Guaranteed
// Direct payments: 06, 10
// Other: 09, 11, -1

export const CONTRACT_TYPES = ['A', 'B', 'C', 'D'] as const;
export const GRANT_TYPES = ['02', '03', '04', '05'] as const;
export const LOAN_TYPES = ['07', '08'] as const;

// ─── Response Types ────────────────────────────────────────────────────────────
export interface SpendingByAwardResponse {
  internal_id: string;
  'Award ID': string;
  'Recipient Name': string;
  'Award Amount': number;
  'Awarding Agency': string;
  'Awarding Sub Agency': string;
  'Awarding Agency Code': string;
  'Funding Agency': string;
  'Funding Sub Agency': string;
  'Funding Agency Code': string;
  'Contract Award Type': string; // A/B/C/D
  'Start Date': string;
  'End Date': string | null;
  Description: string;
  'Place of Performance State Code': string | null;
  'Place of Performance Country Code': string;
  'Place of Performance City Code': string | null;
  NAICS: string | null;
  PSC: string | null;
  'Base Obligation Date': string;
  'Last Modified Date': string;
  'generated_internal_id': string;
  'recipient_id': string | null;
  'Recipient UEI': string | null;
  'Recipient DUNS Number': string | null;
  // ── Competition data (EXTEND_COMPETED_TYPE_CODES from FPDS) ────────────────
  'Competition Constraint': string | null;
  'Competition Fixed-price': string | null;
  'Extent Competed': string | null;
  'Extent Competed Type Code': string | null;
  // ── Additional fields we want ──────────────────────────────────────────────
  'Primary Place of Performance': string | null;
  'Assistance Listing': string | null;
  'CFDA Number': string | null;
  'Loan Value': number | null;
  'Subsidy Cost': number | null;
  'Total Outlays': number | null;
  'COVID-19 Obligations': number | null;
  'COVID-19 Outlays': number | null;
  'Infrastructure Obligations': number | null;
  'Infrastructure Outlays': number | null;
}

interface SearchResponse {
  results: SpendingByAwardResponse[];
  page_metadata: {
    page: number;
    hasNext: boolean;
    last_record_unique_id: number | null;
    last_record_sort_value: string | null;
  };
  messages: string[];
}

// ─── Competition Status Mapping ────────────────────────────────────────────────
// Maps USAspending extent_competed values to our competition_status
// Data dictionary: https://www.usaspending.gov/country-guide
export function mapCompetitionStatus(award: Partial<SpendingByAwardResponse>): CompetitionStatus {
  const extent = award['Extent Competed'] ?? award['Extent Competed Type Code'] ?? '';

  // Competitive procedures
  if (extent.includes('Full') || extent.includes('Competing')) return 'open_competition';
  if (extent.includes('Another')) return 'limited_competition';

  // Non-competitive
  if (extent.includes('Not')) return 'no_bid';
  if (extent.includes('Single') || extent.includes(' sole ')) return 'sole_source';
  if (extent.includes('Limited')) return 'limited_competition';

  // Check competition constraint as fallback
  const constraint = award['Competition Constraint'] ?? '';
  if (constraint.includes('Not')) return 'no_bid';
  if (constraint.includes('Single')) return 'sole_source';

  return 'unknown';
}

export type CompetitionStatus =
  | 'open_competition'
  | 'limited_competition'
  | 'no_bid'
  | 'sole_source'
  | 'unknown';

// ─── Award Type Mapping ───────────────────────────────────────────────────────
export function mapContractType(awardType: string): AwardType {
  if (['A', 'B', 'C', 'D'].includes(awardType)) return 'contract';
  if (['02', '03', '04', '05'].includes(awardType)) return 'grant';
  if (['07', '08'].includes(awardType)) return 'loan';
  if (['06', '10'].includes(awardType)) return 'direct_payment';
  return 'other';
}

export type AwardType = 'contract' | 'grant' | 'loan' | 'direct_payment' | 'other';

// ─── Flag Detection ────────────────────────────────────────────────────────────
export interface DetectedFlags {
  competition_flags: string[];
  price_flags: string[];
  connection_flags: string[];
  structural_flags: string[];
}

export function detectFlags(award: Partial<SpendingByAwardResponse>): DetectedFlags {
  const flags: DetectedFlags = {
    competition_flags: [],
    price_flags: [],
    connection_flags: [],
    structural_flags: [],
  };
  const amount = award['Award Amount'] ?? 0;

  // Competition flags
  const competition = mapCompetitionStatus(award);
  if (competition === 'no_bid') flags.competition_flags.push('no_bid');
  if (competition === 'sole_source') flags.competition_flags.push('sole_source');
  if (competition === 'limited_competition') flags.competition_flags.push('limited_competition');

  // Price flags — this is where we'd compare against GAO benchmarks
  // For now flag anything >$50M with limited competition as suspicious
  if (amount > 50_000_000 && (competition === 'no_bid' || competition === 'sole_source')) {
    flags.price_flags.push('no_compete_high_value');
  }
  if (amount > 100_000_000) flags.price_flags.push('large_award');

  // Structural flags
  const extent = award['Extent Competed'] ?? '';
  if (extent.includes('Non-competitive') || extent.includes('Not Competed')) {
    flags.structural_flags.push('non_competitive');
  }

  // COVID/Infrastructure flags
  if (award['COVID-19 Obligations'] && award['COVID-19 Obligations'] > 0) {
    flags.structural_flags.push('covid_related');
  }
  if (award['Infrastructure Obligations'] && award['Infrastructure Obligations'] > 0) {
    flags.structural_flags.push('infrastructure');
  }

  return flags;
}

// ─── Core Fetch Function ──────────────────────────────────────────────────────
export async function fetchAwards(params: {
  startDate: string;
  endDate: string;
  page?: number;
  limit?: number;
  awardingAgency?: string;
  fundingAgency?: string;
  keyword?: string;
  awardTypes?: string[];
  naics?: string;
  recipientSearch?: string;
}): Promise<{ results: SpendingByAwardResponse[]; hasMore: boolean; total: number }> {
  const {
    startDate,
    endDate,
    page = 1,
    limit = 100,
    awardingAgency,
    fundingAgency,
    keyword,
    awardTypes = [...CONTRACT_TYPES],
    naics,
    recipientSearch,
  } = params;

  const filters: {
    award_type_codes?: string[];
    time_period?: { start_date: string; end_date: string; date_type?: string }[];
    keywords?: string[];
    agencies?: { type: string; tier: string; name: string }[];
    naics_codes?: string[];
    recipient_search_text?: string[];
  } = {
    award_type_codes: awardTypes,
    time_period: [{ start_date: startDate, end_date: endDate, date_type: 'last_modified_date' }],
  };

  if (keyword) filters.keywords = [keyword];
  if (awardingAgency) {
    filters.agencies = filters.agencies ?? [];
    filters.agencies.push({ type: 'awarding', tier: 'toptier', name: awardingAgency });
  }
  if (fundingAgency) {
    filters.agencies = filters.agencies ?? [];
    filters.agencies.push({ type: 'funding', tier: 'toptier', name: fundingAgency });
  }
  if (naics) filters.naics_codes = [naics];
  if (recipientSearch) filters.recipient_search_text = [recipientSearch];

  const body: Record<string, unknown> = {
    subawards: false,
    limit,
    page,
    filters,
    fields: [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Awarding Agency',
      'Awarding Sub Agency',
      'Awarding Agency Code',
      'Funding Agency',
      'Funding Sub Agency',
      'Funding Agency Code',
      'Contract Award Type',
      'Start Date',
      'End Date',
      'Description',
      'Place of Performance State Code',
      'Place of Performance Country Code',
      'Place of Performance City Code',
      'NAICS',
      'PSC',
      'Base Obligation Date',
      'Last Modified Date',
      'generated_internal_id',
      'recipient_id',
      'Recipient UEI',
      'Recipient DUNS Number',
      // Competition fields — CRITICAL for flagging
      'Extent Competed',
      'Extent Competed Type Code',
      'Competition Constraint',
      'Competition Fixed-price',
      // Additional
      'CFDA Number',
      'Assistance Listing',
      'Loan Value',
      'Subsidy Cost',
      'Total Outlays',
      'COVID-19 Obligations',
      'COVID-19 Outlays',
      'Infrastructure Obligations',
      'Infrastructure Outlays',
    ],
  };

  const response = await fetch(`${BASE_URL}/search/spending_by_award/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`USAspending API error: ${response.status} ${response.statusText}`);
  }

  const data: SearchResponse = await response.json();
  return {
    results: data.results,
    hasMore: data.page_metadata.hasNext,
    total: 0, // USAspending doesn't return total count in this endpoint
  };
}

// ─── Paginated Generator ──────────────────────────────────────────────────────
export async function* fetchAllAwards(
  params: {
    startDate: string;
    endDate: string;
    awardingAgency?: string;
    keyword?: string;
    awardTypes?: string[];
  },
  limitPerPage = 100
): AsyncGenerator<SpendingByAwardResponse[]> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { results, hasMore: more } = await fetchAwards({
      ...params,
      page,
      limit: limitPerPage,
    });
    yield results;
    hasMore = more;
    page++;
  }
}

// ─── Specialized Fetchers ─────────────────────────────────────────────────────

// Contracts only (procurement)
export async function fetchContracts(params: {
  startDate: string;
  endDate: string;
  awardingAgency?: string;
  keyword?: string;
}): Promise<{ results: SpendingByAwardResponse[]; hasMore: boolean }> {
  return fetchAwards({ ...params, awardTypes: [...CONTRACT_TYPES] });
}

// Grants only (assistance)
export async function fetchGrants(params: {
  startDate: string;
  endDate: string;
  awardingAgency?: string;
  keyword?: string;
  cfdaProgram?: string;
}): Promise<{ results: SpendingByAwardResponse[]; hasMore: boolean }> {
  return fetchAwards({ ...params, awardTypes: [...GRANT_TYPES] });
}

// All award types
export async function fetchAllAwardTypes(params: {
  startDate: string;
  endDate: string;
  awardingAgency?: string;
  keyword?: string;
}): Promise<{ results: SpendingByAwardResponse[]; hasMore: boolean }> {
  return fetchAwards({
    ...params,
    awardTypes: [...CONTRACT_TYPES, ...GRANT_TYPES, ...LOAN_TYPES],
  });
}

// By specific agency
export async function fetchAgencySpending(agencyCode: string, fiscalYear: number) {
  return fetchAwards({
    startDate: `${fiscalYear}-10-01`,
    endDate: `${fiscalYear + 1}-09-30`,
    awardingAgency: agencyCode,
    limit: 100,
  });
}

// ─── Quick Test ───────────────────────────────────────────────────────────────
export async function testAPI() {
  const now = new Date();
  const startDate = `${now.getFullYear()}-01-01`;
  const endDate = now.toISOString().split('T')[0];

  const { results } = await fetchAwards({
    startDate,
    endDate,
    limit: 5,
  });

  return results;
}