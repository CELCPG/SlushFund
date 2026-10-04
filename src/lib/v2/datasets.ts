import 'server-only';
import { cache } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { MoneyType } from '@/lib/v2/money';

/**
 * Dataset registry and freshness, read from the database so the source bar
 * can't lie (ia-audit §5.4).
 *
 * "Last updated" is the last successful load: the newest completed sync_log
 * run where a loader writes one (service role only), otherwise the newest row
 * timestamp in the table. A dataset is stale once that is older than its
 * threshold, unavailable when the query fails, and "not loaded" when the
 * table is empty or has no loader yet. None of these states shows a number.
 */

export type DatasetKey =
  | 'house_trades'
  | 'senate_trades'
  | 'contracts'
  | 'contract_totals'
  | 'members'
  | 'company_tickers'
  | 'campaign'
  | 'lobbying';

export type DatasetState = 'fresh' | 'stale' | 'unavailable' | 'not_loaded';

export interface DatasetDef {
  key: DatasetKey;
  label: string;
  moneyType?: MoneyType;
  source: { name: string; url: string };
  /** What the rows are, in one line. */
  scope: string;
  /** Expected refresh, as a reader-facing phrase. */
  cadence: string;
  /** Amber after this many days without a successful load. */
  staleAfterDays: number;
  methodologyHref: string;
  /** Label for latestRecord ("Latest filing", "Latest award"). */
  latestRecordLabel: string;
  caveat?: string;
}

export interface DatasetStatus extends DatasetDef {
  state: DatasetState;
  /** ISO timestamp of the last successful load, or null. */
  lastUpdated: string | null;
  updatedBasis: 'sync_log' | 'row_timestamps' | null;
  /** Newest record date in the data (filing date, award date). */
  latestRecord: string | null;
  /** Coverage derived from the rows, e.g. "2021–2026" or "FY2026". */
  coverage: string | null;
  rowCount: number | null;
  /** Whole days since lastUpdated (at render time). */
  ageDays: number | null;
}

const METHODS = '/about/methodology';

export const DATASETS: Record<DatasetKey, DatasetDef> = {
  house_trades: {
    key: 'house_trades',
    label: 'House stock trades',
    moneyType: 'trades',
    source: { name: 'House Clerk PTRs', url: 'https://disclosures-clerk.house.gov/FinancialDisclosure' },
    scope: 'Periodic transaction reports filed by House members under the STOCK Act',
    cadence: 'Daily once automations run',
    staleAfterDays: 4,
    methodologyHref: `${METHODS}/trades`,
    latestRecordLabel: 'Latest filing',
    caveat: 'Amounts are the ranges members disclose, never exact values.',
  },
  senate_trades: {
    key: 'senate_trades',
    label: 'Senate stock trades',
    moneyType: 'trades',
    source: { name: 'Senate eFD', url: 'https://efdsearch.senate.gov/search/' },
    scope: 'Periodic transaction reports filed by senators under the STOCK Act',
    cadence: 'Daily once automations run',
    staleAfterDays: 4,
    methodologyHref: `${METHODS}/trades`,
    latestRecordLabel: 'Latest filing',
    caveat: 'Amounts are the ranges senators disclose, never exact values.',
  },
  contracts: {
    key: 'contracts',
    label: 'Contract awards',
    moneyType: 'contracts',
    source: { name: 'USAspending.gov', url: 'https://www.usaspending.gov/search' },
    scope: 'Prime contract awards: every non-competed award of $1M+ and every award of $10M+ (rule r5-v1)',
    cadence: 'Daily once automations run',
    staleAfterDays: 4,
    methodologyHref: `${METHODS}/contracts`,
    latestRecordLabel: 'Latest award',
    caveat: 'A selection, not all spending: shares like "% no-bid" use the agency totals, not these rows. DoD publishes 90 days late.',
  },
  contract_totals: {
    key: 'contract_totals',
    label: 'Agency contract totals',
    moneyType: 'contracts',
    source: { name: 'USAspending.gov', url: 'https://www.usaspending.gov/agency' },
    scope: 'All prime contract obligations per agency and fiscal year, with the non-competed share',
    cadence: 'Weekly once automations run',
    staleAfterDays: 10,
    methodologyHref: `${METHODS}/contracts`,
    latestRecordLabel: 'Period ends',
    caveat: 'DoD reports contract actions 90 days late, so the latest quarter is incomplete.',
  },
  members: {
    key: 'members',
    label: 'Members of Congress',
    source: { name: 'congress-legislators', url: 'https://github.com/unitedstates/congress-legislators' },
    scope: 'Every member who served 2016–today, with current committee seats',
    cadence: 'Weekly once automations run',
    staleAfterDays: 14,
    methodologyHref: `${METHODS}#members`,
    latestRecordLabel: 'Roster',
    caveat: 'Committee seats are current ones, not the seats held at the time of past trades.',
  },
  company_tickers: {
    key: 'company_tickers',
    label: 'Ticker links',
    moneyType: 'contracts',
    source: { name: 'SEC EDGAR company tickers', url: 'https://www.sec.gov/files/company_tickers.json' },
    scope: 'Federal contract recipients matched to SEC-registered companies and their ticker symbols (rule r7-v1). Only auto- or manually confirmed links are shown',
    cadence: 'After each awards load, once automations run',
    staleAfterDays: 14,
    methodologyHref: `${METHODS}#contracts`,
    latestRecordLabel: 'Latest match run',
    caveat: 'A link says the records tie a recipient to a registrant, not that a trade or award means anything. Subsidiaries whose parent is not clear stay unlinked.',
  },
  campaign: {
    key: 'campaign',
    label: 'Campaign money',
    moneyType: 'campaign',
    source: { name: 'FEC', url: 'https://www.fec.gov/data/' },
    scope: 'PAC and donor money to members (not loaded yet)',
    cadence: 'Planned',
    staleAfterDays: 7,
    methodologyHref: `${METHODS}#campaign`,
    latestRecordLabel: 'Latest filing',
  },
  lobbying: {
    key: 'lobbying',
    label: 'Lobbying',
    moneyType: 'lobbying',
    source: { name: 'Senate LDA', url: 'https://lda.senate.gov/' },
    scope: 'Lobbying disclosures: who paid, how much, on what (not loaded yet)',
    cadence: 'Planned',
    staleAfterDays: 7,
    methodologyHref: `${METHODS}#lobbying`,
    latestRecordLabel: 'Latest filing',
  },
};

export const DATASET_ORDER: DatasetKey[] = [
  'contracts', 'contract_totals', 'house_trades', 'senate_trades', 'members', 'campaign', 'lobbying',
];

type Raw = {
  rowCount: number | null;
  lastUpdated: string | null;
  updatedBasis: DatasetStatus['updatedBasis'];
  latestRecord: string | null;
  coverage: string | null;
  failed: boolean;
};

const EMPTY: Raw = { rowCount: null, lastUpdated: null, updatedBasis: null, latestRecord: null, coverage: null, failed: false };

type Result<T> = { data: T | null; error: unknown; count?: number | null };

/** First row's column, or null. */
function first<T extends Record<string, unknown>>(r: Result<T[]>, col: keyof T): string | null {
  const v = r.data?.[0]?.[col];
  return v == null ? null : String(v);
}

function yearSpan(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  const x = a.slice(0, 4);
  const y = b.slice(0, 4);
  return x === y ? x : `${x}–${y}`;
}

async function readTrades(system: 'House_Clerk' | 'Senate_EFD'): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const t = () => supabase!.from('congress_trades');
  const [count, newestFiled, oldestFiled, newestRow] = await Promise.all([
    t().select('id', { count: 'exact', head: true }).eq('source_system', system),
    t().select('filed_date').eq('source_system', system).not('filed_date', 'is', null).order('filed_date', { ascending: false }).limit(1),
    t().select('filed_date').eq('source_system', system).not('filed_date', 'is', null).order('filed_date', { ascending: true }).limit(1),
    t().select('updated_at').eq('source_system', system).order('updated_at', { ascending: false }).limit(1),
  ]);
  if (count.error || newestFiled.error || oldestFiled.error || newestRow.error) return { ...EMPTY, failed: true };
  const latest = first(newestFiled, 'filed_date');
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(newestRow, 'updated_at'),
    updatedBasis: 'row_timestamps',
    latestRecord: latest,
    coverage: yearSpan(first(oldestFiled, 'filed_date'), latest),
    failed: false,
  };
}

async function readContracts(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const a = () => supabase!.from('awards');
  const [count, newest, fyMin, fyMax, newestRow] = await Promise.all([
    a().select('id', { count: 'exact', head: true }),
    a().select('posted_date').not('posted_date', 'is', null).order('posted_date', { ascending: false }).limit(1),
    a().select('fiscal_year').not('fiscal_year', 'is', null).order('fiscal_year', { ascending: true }).limit(1),
    a().select('fiscal_year').not('fiscal_year', 'is', null).order('fiscal_year', { ascending: false }).limit(1),
    a().select('updated_at').order('updated_at', { ascending: false }).limit(1),
  ]);
  if (count.error || newest.error || fyMin.error || fyMax.error || newestRow.error) return { ...EMPTY, failed: true };

  // sync_log is service-role only (it holds raw error payloads). When the
  // server has that key, the last *completed* loader run is the truth.
  let lastUpdated = first(newestRow, 'updated_at');
  let basis: DatasetStatus['updatedBasis'] = 'row_timestamps';
  if (supabaseAdmin) {
    const log = await supabaseAdmin
      .from('sync_log')
      .select('completed_at')
      .like('sync_type', 'awards:%')
      .eq('status', 'complete')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1);
    const done = log.error ? null : first(log, 'completed_at');
    if (done) {
      lastUpdated = done;
      basis = 'sync_log';
    }
  }
  const lo = first(fyMin, 'fiscal_year');
  const hi = first(fyMax, 'fiscal_year');
  return {
    rowCount: count.count ?? null,
    lastUpdated,
    updatedBasis: basis,
    latestRecord: first(newest, 'posted_date'),
    coverage: lo && hi ? (lo === hi ? `FY${lo}` : `FY${lo}–FY${hi}`) : null,
    failed: false,
  };
}

async function readContractTotals(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const s = () => supabase!.from('contract_spending_summary');
  const [count, fetched, fyMin, fyMax] = await Promise.all([
    s().select('fiscal_year', { count: 'exact', head: true }),
    s().select('fetched_at, period_end').order('fetched_at', { ascending: false }).limit(1),
    s().select('fiscal_year').order('fiscal_year', { ascending: true }).limit(1),
    s().select('fiscal_year').order('fiscal_year', { ascending: false }).limit(1),
  ]);
  if (count.error || fetched.error || fyMin.error || fyMax.error) return { ...EMPTY, failed: true };
  const lo = first(fyMin, 'fiscal_year');
  const hi = first(fyMax, 'fiscal_year');
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(fetched, 'fetched_at'),
    updatedBasis: 'row_timestamps',
    latestRecord: first(fetched, 'period_end'),
    coverage: lo && hi ? (lo === hi ? `FY${lo}` : `FY${lo}–FY${hi}`) : null,
    failed: false,
  };
}

async function readMembers(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const m = () => supabase!.from('congress_members');
  const [count, newestRow] = await Promise.all([
    m().select('id', { count: 'exact', head: true }),
    m().select('updated_at').order('updated_at', { ascending: false }).limit(1),
  ]);
  if (count.error || newestRow.error) return { ...EMPTY, failed: true };
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(newestRow, 'updated_at'),
    updatedBasis: 'row_timestamps',
    latestRecord: null,
    coverage: '2016–today',
    failed: false,
  };
}

async function readCompanyTickers(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const t = () => supabase!.from('company_tickers');
  const [count, newest] = await Promise.all([
    t().select('id', { count: 'exact', head: true }),
    t().select('matched_at').order('matched_at', { ascending: false }).limit(1),
  ]);
  if (count.error || newest.error) return { ...EMPTY, failed: true };
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(newest, 'matched_at'),
    updatedBasis: 'row_timestamps',
    latestRecord: first(newest, 'matched_at'),
    coverage: 'FY2024–26 recipients',
    failed: false,
  };
}

const READERS: Record<DatasetKey, () => Promise<Raw>> = {
  house_trades: () => readTrades('House_Clerk'),
  senate_trades: () => readTrades('Senate_EFD'),
  contracts: readContracts,
  contract_totals: readContractTotals,
  members: readMembers,
  company_tickers: readCompanyTickers,
  // No loader yet: say so instead of showing anything.
  campaign: async () => ({ ...EMPTY, rowCount: 0 }),
  lobbying: async () => ({ ...EMPTY, rowCount: 0 }),
};

export function classify(def: DatasetDef, raw: Raw, now: number = Date.now()): Pick<DatasetStatus, 'state' | 'ageDays'> {
  if (raw.failed) return { state: 'unavailable', ageDays: null };
  if (!raw.rowCount) return { state: 'not_loaded', ageDays: null };
  if (!raw.lastUpdated) return { state: 'stale', ageDays: null };
  const ageDays = Math.floor((now - new Date(raw.lastUpdated).getTime()) / 86_400_000);
  return { state: ageDays > def.staleAfterDays ? 'stale' : 'fresh', ageDays };
}

/** Freshness for one dataset. Deduplicated per request. Never throws. */
export const getDatasetStatus = cache(async (key: DatasetKey): Promise<DatasetStatus> => {
  const def = DATASETS[key];
  let raw: Raw;
  try {
    raw = await READERS[key]();
  } catch {
    raw = { ...EMPTY, failed: true };
  }
  return { ...def, ...raw, ...classify(def, raw) };
});

export async function getDatasetStatuses(keys: DatasetKey[] = DATASET_ORDER): Promise<DatasetStatus[]> {
  return Promise.all(keys.map((k) => getDatasetStatus(k)));
}
