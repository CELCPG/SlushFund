import 'server-only';
import { cache } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { MoneyType } from '@/lib/v2/money';
import unreadData from '@/data/unread-filings.json';

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
  | 'committee_history'
  | 'conflicts'
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
  /** Known gaps, one reader-facing sentence each (live counts are added by the reader). */
  gaps?: string[];
}

export interface DatasetStatus extends DatasetDef {
  state: DatasetState;
  /** ISO timestamp of the last successful load, or null. */
  lastUpdated: string | null;
  updatedBasis: 'sync_log' | 'row_timestamps' | null;
  /** Which column the last-loaded time was read from ("updated_at", "created_at", "completed_at"). */
  updatedColumn: string | null;
  /** Static gaps plus the counts the reader measured. */
  knownGaps: string[];
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
    gaps: ['Filings before 2021 are not loaded yet.'],
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
    gaps: ['Filings before 2024 are not loaded yet.'],
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
    caveat: 'A selection, not all spending: shares like "% not competed" use the agency totals, not these rows. DoD publishes 90 days late.',
    gaps: [
      'Fiscal years before FY2024 are not loaded yet.',
      'A selection (rule r5-v1: non-competed awards of $1M+ and any award of $10M+), not all federal spending.',
      'DoD publishes about 90 days late, so its newest awards are missing.',
    ],
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
    gaps: ['Only recipients of FY2024–26 awards are matched.', 'Recipients with no clear SEC registrant, and subsidiaries whose parent is unclear, stay unlinked.'],
  },
  committee_history: {
    key: 'committee_history',
    label: 'Committee history',
    source: { name: 'congress-legislators (git history)', url: 'https://github.com/unitedstates/congress-legislators' },
    scope: 'Which top-level committee each member sat on and when, rebuilt from every snapshot of the public committee-membership file since June 2016',
    cadence: 'After each congress-legislators update, once automations run',
    staleAfterDays: 14,
    methodologyHref: `${METHODS}/trades`,
    latestRecordLabel: 'Latest snapshot',
    caveat: 'The file lags real appointments by days to weeks, so seats are approximate at their start and end dates.',
    gaps: ['No second source: congress.gov has no committee-roster endpoint to check against.'],
  },
  conflicts: {
    key: 'conflicts',
    label: 'Signal scores',
    moneyType: 'trades',
    source: { name: 'Computed from the trade, committee and ticker-link datasets', url: '/about/methodology#signals' },
    scope: 'For every trade: a signal score from our method (committee seat on the trade date, listed federal contract award, reported late, large position), shown as a score band',
    cadence: 'After any trade, committee or ticker-link load, once automations run',
    staleAfterDays: 4,
    methodologyHref: `${METHODS}/trades`,
    latestRecordLabel: 'Latest filing scored',
    caveat: 'Signal score out of 100 from our method: committee seat +45, listed federal contractor +30, reported late +15, large position +10. A score is a prompt to look closer, not a finding. No page shows per-trade scores yet.',
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

/** /data/status: one row each, in reader order. The rest follow under "Supporting and not loaded". */
export const STATUS_ORDER: DatasetKey[] = ['house_trades', 'senate_trades', 'contracts', 'company_tickers', 'committee_history', 'conflicts'];
export const STATUS_OTHER_ORDER: DatasetKey[] = ['contract_totals', 'members', 'campaign', 'lobbying'];

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
  updatedColumn?: string | null;
  extraGaps?: string[];
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

const nf = (n: number) => n.toLocaleString('en-US');

/** Sum of a field over D2's snapshot of the filings R3 and R4 could not read (scanned House PDFs, paper Senate reports). */
function unreadTotal(field: 'house_scanned' | 'senate_paper'): number {
  return Object.values(unreadData as Record<string, { house_scanned: number; senate_paper: number }>).reduce((n, m) => n + (m[field] ?? 0), 0);
}

async function readTrades(system: 'House_Clerk' | 'Senate_EFD'): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const t = () => supabase!.from('congress_trades');
  const [count, newestFiled, oldestFiled, newestRow, flagged, noFirst, belowThreshold] = await Promise.all([
    t().select('id', { count: 'exact', head: true }).eq('source_system', system),
    t().select('filed_date').eq('source_system', system).not('filed_date', 'is', null).order('filed_date', { ascending: false }).limit(1),
    t().select('filed_date').eq('source_system', system).not('filed_date', 'is', null).order('filed_date', { ascending: true }).limit(1),
    t().select('updated_at').eq('source_system', system).order('updated_at', { ascending: false }).limit(1),
    t().select('id', { count: 'exact', head: true }).eq('source_system', system).not('date_flag', 'is', null),
    t().select('id', { count: 'exact', head: true }).eq('source_system', system).is('original_filed_date', null),
    t().select('id', { count: 'exact', head: true }).eq('source_system', system).eq('lateness_basis', 'below_reporting_threshold'),
  ]);
  if (count.error || newestFiled.error || oldestFiled.error || newestRow.error) return { ...EMPTY, failed: true };
  const latest = first(newestFiled, 'filed_date');
  const gaps: string[] = [];
  const unread = unreadTotal(system === 'House_Clerk' ? 'house_scanned' : 'senate_paper');
  if (unread > 0) {
    gaps.push(system === 'House_Clerk'
      ? `${nf(unread)} scanned House filings were not read (images, not text); their trades are missing, and nothing is said about their timing.`
      : `${nf(unread)} paper Senate filings were not read; their trades are missing, and nothing is said about their timing.`);
  }
  if (!flagged.error && flagged.count) gaps.push(`${nf(flagged.count)} trades carry a date note (the trade is dated more than two years before the report, or the dates as filed look inconsistent).`);
  if (!noFirst.error && noFirst.count) gaps.push(`${nf(noFirst.count)} trades have no first-report date in our records, so lateness is not computed for them.`);
  if (!belowThreshold.error && belowThreshold.count) gaps.push(`${nf(belowThreshold.count)} trades are below the $1,000 reporting threshold, so lateness is not computed for them.`);
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(newestRow, 'updated_at'),
    updatedBasis: 'row_timestamps',
    updatedColumn: 'updated_at',
    latestRecord: latest,
    coverage: yearSpan(first(oldestFiled, 'filed_date'), latest),
    extraGaps: gaps,
    failed: false,
  };
}

async function readCommitteeHistory(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const seats = () => supabase!.from('committee_seats');
  const snaps = () => supabase!.from('committee_snapshots');
  const [count, snapCount, newestSeat, newestSnap, firstSnap, lastSnap, noCommittee, noRoster] = await Promise.all([
    seats().select('id', { count: 'exact', head: true }),
    snaps().select('commit_sha', { count: 'exact', head: true }),
    seats().select('created_at').order('created_at', { ascending: false }).limit(1),
    snaps().select('created_at').order('created_at', { ascending: false }).limit(1),
    snaps().select('snapshot_date').order('snapshot_date', { ascending: true }).limit(1),
    snaps().select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1),
    supabase.from('congress_trades').select('id', { count: 'exact', head: true }).is('committee_conflict', null),
    supabase.from('congress_trades').select('id', { count: 'exact', head: true }).like('committee_basis', 'no_committee_data_since_%'),
  ]);
  if (count.error || newestSeat.error || newestSnap.error || firstSnap.error || lastSnap.error) return { ...EMPTY, failed: true };
  const a = first(newestSeat, 'created_at');
  const b = first(newestSnap, 'created_at');
  const latest = first(lastSnap, 'snapshot_date');
  const gaps: string[] = [];
  if (!snapCount.error && snapCount.count) gaps.push(`Built from ${nf(snapCount.count)} snapshots of the file; the gap between two snapshots is days to weeks.`);
  if (!noCommittee.error && noCommittee.count) {
    const roster = !noRoster.error && noRoster.count != null ? noRoster.count : null;
    gaps.push(roster != null
      ? `${nf(noCommittee.count)} trades have no committee signal: for ${nf(roster)}, a new Congress had not yet published committee rosters on the trade date; for ${nf(noCommittee.count - roster)}, the dates as filed look inconsistent or are more than two years before the report. Blank means not computed, never a "no".`
      : `${nf(noCommittee.count)} trades have no committee signal: a new Congress had not yet published committee rosters, or the dates as filed look inconsistent. Blank means not computed, never a "no".`);
  }
  return {
    rowCount: count.count ?? null,
    lastUpdated: a && b ? (a > b ? a : b) : (a ?? b),
    updatedBasis: 'row_timestamps',
    updatedColumn: 'created_at',
    latestRecord: latest,
    coverage: yearSpan(first(firstSnap, 'snapshot_date'), latest),
    extraGaps: gaps,
    failed: false,
  };
}

/** congress_trades.conflict_tier values (R6e score bands), shown as bands, never as verdict words. */
export const SCORE_BANDS = [
  { tier: 'score_70_plus', label: '70 and up' },
  { tier: 'score_45_69', label: '45–69' },
  { tier: 'score_20_44', label: '20–44' },
  { tier: 'score_under_20', label: 'under 20' },
] as const;

async function readConflicts(): Promise<Raw> {
  if (!supabase) return { ...EMPTY, failed: true };
  const t = () => supabase!.from('congress_trades');
  const [count, newestRow, oldestFiled, newestFiled, noContract, beforeAwards, ...bands] = await Promise.all([
    t().select('id', { count: 'exact', head: true }).not('conflict_tier', 'is', null),
    t().select('updated_at').not('conflict_tier', 'is', null).order('updated_at', { ascending: false }).limit(1),
    t().select('filed_date').not('conflict_tier', 'is', null).not('filed_date', 'is', null).order('filed_date', { ascending: true }).limit(1),
    t().select('filed_date').not('conflict_tier', 'is', null).not('filed_date', 'is', null).order('filed_date', { ascending: false }).limit(1),
    t().select('id', { count: 'exact', head: true }).is('has_federal_contract', null),
    t().select('id', { count: 'exact', head: true }).eq('contract_basis', 'not_computed_trade_before_2023-10-01'),
    ...SCORE_BANDS.map((b) => t().select('id', { count: 'exact', head: true }).eq('conflict_tier', b.tier)),
  ]);
  if (count.error || newestRow.error || oldestFiled.error || newestFiled.error) return { ...EMPTY, failed: true };
  const latest = first(newestFiled, 'filed_date');
  const gaps = ['There is no separate scored-at time: this is the newest updated_at among the scored trade rows, which a trade load moves too.'];
  if (!bands.some((b) => b.error)) gaps.push(`Score bands: ${SCORE_BANDS.map((b, i) => `${b.label} ${nf(bands[i].count ?? 0)}`).join(' · ')}.`);
  if (!noContract.error && noContract.count) {
    const before = !beforeAwards.error && beforeAwards.count != null ? beforeAwards.count : null;
    gaps.push(before != null
      ? `${nf(noContract.count)} trades have no contractor signal: ${nf(before)} are before 2023-10-01, where our listed awards start, and for ${nf(noContract.count - before)} the dates as filed look inconsistent. Blank means not computed, never a "no".`
      : `${nf(noContract.count)} trades have no contractor signal: it was not computed for them. Blank means not computed, never a "no".`);
  }
  gaps.push('A "no" on the contractor signal means no award in our listed set (not competed and at least $1 million, or any contract of at least $10 million, signed from 2023-10-01) was signed on or before the trade; the company may hold other contracts.');
  return {
    rowCount: count.count ?? null,
    lastUpdated: first(newestRow, 'updated_at'),
    updatedBasis: 'row_timestamps',
    updatedColumn: 'updated_at',
    latestRecord: latest,
    coverage: yearSpan(first(oldestFiled, 'filed_date'), latest),
    extraGaps: gaps,
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
    updatedColumn: basis === 'sync_log' ? 'completed_at' : 'updated_at',
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
    updatedColumn: 'fetched_at',
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
    updatedColumn: 'updated_at',
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
    updatedColumn: 'matched_at',
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
  committee_history: readCommitteeHistory,
  conflicts: readConflicts,
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
  return { ...def, ...raw, ...classify(def, raw), updatedColumn: raw.updatedColumn ?? null, knownGaps: [...(def.gaps ?? []), ...(raw.extraGaps ?? [])] };
});

export async function getDatasetStatuses(keys: DatasetKey[] = DATASET_ORDER): Promise<DatasetStatus[]> {
  return Promise.all(keys.map((k) => getDatasetStatus(k)));
}
