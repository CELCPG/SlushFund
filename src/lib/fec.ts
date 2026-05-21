// SlushFund — OpenFEC API client
// Live federal campaign-finance data from the FEC (https://api.open.fec.gov).
// Used to verify the curated PAC_DATABASE against official filings.
//
// Set FEC_API_KEY in the environment to enable live data. Without it, callers
// fall back to the curated static dataset — the site never blocks on FEC.

const FEC_BASE = 'https://api.open.fec.gov/v1';

// FEC publishes a shared DEMO_KEY with a low rate limit — fine as a fallback so
// the feature degrades gracefully rather than failing outright.
const FEC_API_KEY = process.env.FEC_API_KEY || 'DEMO_KEY';

export const fecConfigured = Boolean(process.env.FEC_API_KEY);

export interface FECCommitteeTotals {
  committee_id: string;
  cycle: number;
  receipts: number;
  disbursements: number;
  cash_on_hand_end_period: number;
  independent_expenditures: number | null;
  last_report_year: number | null;
}

export interface FECCommittee {
  committee_id: string;
  name: string;
  committee_type_full: string | null;
  designation_full: string | null;
  party_full: string | null;
  treasurer_name: string | null;
}

interface FetchOpts {
  // Next.js revalidate window in seconds (ISR cache for route handlers).
  revalidate?: number;
}

async function fecFetch<T>(path: string, params: Record<string, string | number>, opts: FetchOpts = {}): Promise<T> {
  const qs = new URLSearchParams({ api_key: FEC_API_KEY });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));

  const res = await fetch(`${FEC_BASE}${path}?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: opts.revalidate ?? 86_400 }, // default: cache 24h
  });

  if (!res.ok) {
    throw new Error(`FEC API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Committee financial totals for a given two-year cycle. */
export async function getCommitteeTotals(
  committeeId: string,
  cycle = 2024,
): Promise<FECCommitteeTotals | null> {
  const json = await fecFetch<{ results: Record<string, unknown>[] }>(
    `/committee/${encodeURIComponent(committeeId)}/totals/`,
    { cycle, per_page: 1, sort: '-cycle' },
  );
  const r = json.results?.[0];
  if (!r) return null;
  return {
    committee_id: committeeId,
    cycle: Number(r.cycle ?? cycle),
    receipts: Number(r.receipts ?? 0),
    disbursements: Number(r.disbursements ?? 0),
    cash_on_hand_end_period: Number(r.last_cash_on_hand_end_period ?? r.cash_on_hand_end_period ?? 0),
    independent_expenditures: r.independent_expenditures != null ? Number(r.independent_expenditures) : null,
    last_report_year: r.last_report_year != null ? Number(r.last_report_year) : null,
  };
}

export interface FECDonor {
  contributor: string;
  employer: string | null;
  amount: number;
  date: string | null;
}

/**
 * Top individual/organization receipts for a committee in a cycle (Schedule A).
 * For a super PAC this is the "who funds this" story — its largest backers.
 */
export async function getTopDonors(
  committeeId: string,
  cycle = 2024,
  limit = 8,
): Promise<FECDonor[]> {
  const json = await fecFetch<{ results: Record<string, unknown>[] }>(
    `/schedules/schedule_a/`,
    {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      sort: '-contribution_receipt_amount',
      per_page: limit,
      sort_hide_null: 'true',
    },
  );
  return (json.results ?? []).map((r) => ({
    contributor: String(r.contributor_name ?? 'Unknown'),
    employer: (r.contributor_employer as string) ?? null,
    amount: Number(r.contribution_receipt_amount ?? 0),
    date: (r.contribution_receipt_date as string)?.slice(0, 10) ?? null,
  }));
}

/** Committee identity / registration metadata. */
export async function getCommittee(committeeId: string): Promise<FECCommittee | null> {
  const json = await fecFetch<{ results: Record<string, unknown>[] }>(
    `/committee/${encodeURIComponent(committeeId)}/`,
    { per_page: 1 },
  );
  const r = json.results?.[0];
  if (!r) return null;
  return {
    committee_id: committeeId,
    name: String(r.name ?? ''),
    committee_type_full: (r.committee_type_full as string) ?? null,
    designation_full: (r.designation_full as string) ?? null,
    party_full: (r.party_full as string) ?? null,
    treasurer_name: (r.treasurer_name as string) ?? null,
  };
}
