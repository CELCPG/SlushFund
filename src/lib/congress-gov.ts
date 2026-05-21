// SlushFund — Congress.gov API client
// Live bill status, sponsors, and latest actions (https://api.congress.gov).
// Layered on top of the curated BILLS dataset in src/lib/policy-data.ts.
//
// Set CONGRESS_GOV_API_KEY in the environment to enable live data. Without it,
// callers fall back to the curated dataset — the site never blocks on this API.

const CONGRESS_BASE = 'https://api.congress.gov/v3';

const CONGRESS_API_KEY = process.env.CONGRESS_GOV_API_KEY || '';

export const congressGovConfigured = Boolean(CONGRESS_API_KEY);

export interface LiveBillStatus {
  bill_id: string;
  congress: number;
  type: string;
  number: string;
  title: string | null;
  latest_action: string | null;
  latest_action_date: string | null;
  origin_chamber: string | null;
  update_date: string | null;
}

// Parses a SlushFund bill_id ("HR-4763-118") into Congress.gov path parts.
function parseBillId(billId: string): { congress: number; type: string; number: string } | null {
  const m = /^([A-Za-z]+)-(\d+)-(\d+)$/.exec(billId.trim());
  if (!m) return null;
  return { type: m[1].toLowerCase(), number: m[2], congress: Number(m[3]) };
}

/** Live status for a single bill. Returns null when the key is unset. */
export async function getLiveBillStatus(billId: string): Promise<LiveBillStatus | null> {
  if (!congressGovConfigured) return null;

  const parts = parseBillId(billId);
  if (!parts) return null;

  const url =
    `${CONGRESS_BASE}/bill/${parts.congress}/${parts.type}/${parts.number}` +
    `?format=json&api_key=${CONGRESS_API_KEY}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 21_600 }, // cache 6h
  });

  if (!res.ok) {
    throw new Error(`Congress.gov API ${res.status} for ${billId}`);
  }

  const json = (await res.json()) as { bill?: Record<string, unknown> };
  const b = json.bill;
  if (!b) return null;

  const latest = b.latestAction as { text?: string; actionDate?: string } | undefined;
  return {
    bill_id: billId,
    congress: parts.congress,
    type: parts.type,
    number: parts.number,
    title: (b.title as string) ?? null,
    latest_action: latest?.text ?? null,
    latest_action_date: latest?.actionDate ?? null,
    origin_chamber: (b.originChamber as string) ?? null,
    update_date: (b.updateDate as string) ?? null,
  };
}
