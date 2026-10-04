import 'server-only';
import { supabase } from '@/lib/supabase';
import { getAgencies, FISCAL_YEARS, type AwardRow } from '@/lib/v2/companies';
import { EXPORT_ROW_CAP, PAGE_SIZE, one, pageOf, pick, type SP } from '@/lib/v2/explorer';
import { cleanQuery } from '@/lib/v2/queries';

/**
 * Contracts explorer (D4): the non-competed awards under rule r5-v1, filtered, sorted and paged by
 * the database so a permalink is the URL.
 *
 * Rule r5-v1 loads (a) every award the agency coded "not competed" (extent-competed B, C, G or NDO)
 * with $1M or more obligated, and (b) any award of $10M or more. This explorer lists group (a):
 * competition_status = 'no_bid', which the loader derives from those codes alone. Dollar amounts are
 * "obligated to date" on awards signed in the fiscal year (A7 §f), never spending in a year, and no
 * share is computed from these rows.
 */

export const SELECTION_RULE = 'r5-v1';

export const AMOUNT_BANDS = [
  { key: '1m', label: '$1M – $10M', min: 1_000_000, max: 10_000_000 },
  { key: '10m', label: '$10M – $100M', min: 10_000_000, max: 100_000_000 },
  { key: '100m', label: '$100M – $1B', min: 100_000_000, max: 1_000_000_000 },
  { key: '1b', label: '$1B and over', min: 1_000_000_000, max: null },
] as const;

export const CONTRACT_SORTS = [
  { value: 'obl', label: 'Largest obligated to date' },
  { value: 'obl_asc', label: 'Smallest obligated to date' },
  { value: 'signed', label: 'Newest signed' },
  { value: 'signed_asc', label: 'Oldest signed' },
  { value: 'recipient', label: 'Recipient A–Z' },
  { value: 'agency', label: 'Agency A–Z' },
] as const;
type ContractSort = (typeof CONTRACT_SORTS)[number]['value'];

export interface ContractFilters {
  fy: '' | '2024' | '2025' | '2026';
  /** Top-tier awarding agency code ("097"). */
  agency: string;
  /** Part of a recipient or parent-company name. */
  q: string;
  /** A parent group's UEI (the company page's identity), exact. */
  parent: string;
  amt: string;
  sort: ContractSort;
}

export const CONTRACT_PARAMS = ['fy', 'agency', 'q', 'parent', 'amt', 'sort', 'page'] as const;

const UEI_RE = /^[A-Z0-9]{12}$/;

export function parseContractFilters(sp: SP): ContractFilters {
  const agency = one(sp.agency).trim();
  const parent = one(sp.parent).trim().toUpperCase();
  return {
    fy: pick(sp.fy, FISCAL_YEARS.map(String) as ['2024', '2025', '2026']),
    agency: /^[A-Za-z0-9]{1,8}$/.test(agency) ? agency : '',
    q: cleanQuery(one(sp.q)),
    parent: UEI_RE.test(parent) ? parent : '',
    amt: AMOUNT_BANDS.some((b) => b.key === one(sp.amt)) ? one(sp.amt) : '',
    sort: pick(sp.sort, CONTRACT_SORTS.map((s) => s.value)) || 'obl',
  };
}

export function contractParams(f: ContractFilters): Record<string, string> {
  return { fy: f.fy, agency: f.agency, q: f.q, parent: f.parent, amt: f.amt, sort: f.sort === 'obl' ? '' : f.sort };
}

export interface ExplorerAward extends AwardRow {
  parent_award_piid: string | null;
  generated_unique_award_id: string | null;
  extent_competed_code: string | null;
  solicitation_procedures: string | null;
  naics_code: string | null;
  psc_code: string | null;
  last_seen_at: string | null;
}

const COLS =
  'id, award_id, parent_award_piid, generated_unique_award_id, description, recipient_name, recipient_uei, recipient_parent_uei, recipient_parent_name, awarding_agency, awarding_agency_code, awarding_sub_agency, fiscal_year, date_signed, posted_date, obligated_amount, competition_status, extent_competed, extent_competed_code, other_than_full_open, solicitation_procedures, naics_code, psc_code, usaspending_url, last_seen_at';

const sample = () => supabase!.from('awards').select(COLS, { count: 'exact' });
type AwardQuery = ReturnType<typeof sample>;

function applyFilters(q: AwardQuery, f: ContractFilters): AwardQuery {
  // Rule r5-v1, non-competed group: the loader's competition_status comes from codes B, C, G, NDO.
  q = q.eq('selection_rule', SELECTION_RULE).eq('competition_status', 'no_bid');
  if (f.fy) q = q.eq('fiscal_year', Number(f.fy));
  if (f.agency) q = q.eq('awarding_agency_code', f.agency);
  if (f.parent) q = q.or(`recipient_parent_uei.eq.${f.parent},and(recipient_parent_uei.is.null,recipient_uei.eq.${f.parent})`);
  if (f.q) q = q.or(`recipient_name.ilike."%${f.q}%",recipient_parent_name.ilike."%${f.q}%"`);
  const band = AMOUNT_BANDS.find((b) => b.key === f.amt);
  if (band) {
    q = q.gte('obligated_amount', band.min);
    if (band.max != null) q = q.lt('obligated_amount', band.max);
  }
  return q;
}

function applyOrder(q: AwardQuery, sort: ContractSort): AwardQuery {
  switch (sort) {
    case 'obl': q = q.order('obligated_amount', { ascending: false }); break;
    case 'obl_asc': q = q.order('obligated_amount', { ascending: true }); break;
    case 'signed': q = q.order('date_signed', { ascending: false, nullsFirst: false }); break;
    case 'signed_asc': q = q.order('date_signed', { ascending: true, nullsFirst: false }); break;
    case 'recipient': q = q.order('recipient_name', { ascending: true }).order('obligated_amount', { ascending: false }); break;
    case 'agency': q = q.order('awarding_agency', { ascending: true }).order('obligated_amount', { ascending: false }); break;
  }
  return q.order('id', { ascending: true });
}

const toAward = (r: ExplorerAward): ExplorerAward => ({ ...r, obligated_amount: r.obligated_amount == null ? null : Number(r.obligated_amount) });

export interface ContractPage {
  rows: ExplorerAward[];
  total: number;
  page: number;
  pages: number;
}

export async function getContractPage(f: ContractFilters, pageParam: string | string[] | undefined): Promise<ContractPage | null> {
  if (!supabase) return null;
  const head = await applyFilters(supabase.from('awards').select('id', { count: 'exact', head: true }) as unknown as AwardQuery, f);
  if (head.error || head.count == null) return null;
  const total = head.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = pageOf(pageParam, pages);
  if (total === 0) return { rows: [], total, page, pages };
  const from = (page - 1) * PAGE_SIZE;
  const { data, error } = await applyOrder(applyFilters(sample(), f), f.sort).range(from, from + PAGE_SIZE - 1);
  if (error || !data) return null;
  return { rows: (data as unknown as ExplorerAward[]).map(toAward), total, page, pages };
}

export async function getContractsForExport(f: ContractFilters): Promise<{ rows: ExplorerAward[]; total: number } | null> {
  if (!supabase) return null;
  const SIZE = 1000;
  const page = (from: number) => applyOrder(applyFilters(sample(), f), f.sort).range(from, from + SIZE - 1);
  const first = await page(0);
  if (first.error || !first.data) return null;
  const total = first.count ?? first.data.length;
  const rows = (first.data as unknown as ExplorerAward[]).map(toAward);
  const starts: number[] = [];
  for (let s = SIZE; s < Math.min(total, EXPORT_ROW_CAP); s += SIZE) starts.push(s);
  // The rest in parallel batches (Promise.all keeps their order).
  for (let i = 0; i < starts.length; i += 5) {
    const batch = await Promise.all(starts.slice(i, i + 5).map(page));
    for (const b of batch) {
      if (b.error || !b.data) return null;
      rows.push(...(b.data as unknown as ExplorerAward[]).map(toAward));
    }
  }
  return { rows: rows.slice(0, EXPORT_ROW_CAP), total };
}

/** Agencies for the filter, by name. Empty when the totals table does not answer (the filter then hides). */
export async function getAgencyOptions(): Promise<{ code: string; name: string }[]> {
  const a = await getAgencies();
  return a ? a.agencies.map((x) => ({ code: x.code, name: x.name })).sort((x, y) => x.name.localeCompare(y.name)) : [];
}

/** The name of a parent group, for the "Company: …" chip when a permalink carries ?parent=. */
export async function getParentName(uei: string): Promise<string | null> {
  if (!supabase || !UEI_RE.test(uei)) return null;
  const { data } = await supabase
    .from('awards')
    .select('recipient_name, recipient_parent_name, recipient_parent_uei')
    .or(`recipient_parent_uei.eq.${uei},and(recipient_parent_uei.is.null,recipient_uei.eq.${uei})`)
    .limit(1);
  const r = data?.[0];
  return r ? ((r.recipient_parent_uei ? r.recipient_parent_name : null) || r.recipient_name || null) : null;
}
