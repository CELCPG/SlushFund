import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Read-only queries shared by v2 pages. Every function returns null on any
 * failure so the caller shows "unavailable", never a stand-in number.
 */

export interface ContractTotalRow {
  fiscal_year: number;
  total_obligations: number;
  noncompeted_share: number | null;
  period_end: string;
  fetched_at: string;
  reporting_lag_days: number;
  source_url: string;
}

/** All-agency prime contract obligations per fiscal year (USAspending aggregates). */
export const getContractTotals = cache(async (): Promise<ContractTotalRow[] | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('contract_spending_summary')
    .select('fiscal_year, total_obligations, noncompeted_share, period_end, fetched_at, reporting_lag_days, source_url')
    .eq('agency_code', 'ALL')
    .order('fiscal_year', { ascending: true });
  if (error || !data) return null;
  return data.map((r) => ({
    ...r,
    total_obligations: Number(r.total_obligations),
    noncompeted_share: r.noncompeted_share == null ? null : Number(r.noncompeted_share),
  })) as ContractTotalRow[];
});

export interface TradeRow {
  id: string;
  member_name: string;
  member_chamber: string;
  member_party: string;
  member_state: string;
  bio_guide_id: string | null;
  ticker: string;
  company_name: string;
  transaction_type: string;
  asset_type: string;
  amount_min: number | null;
  amount_max: number | null;
  amount_range: string | null;
  transaction_date: string;
  filed_date: string | null;
  disclosure_url: string | null;
  source_system: string;
  owner: string | null;
  /** R6a: 'call' | 'put' | 'unknown' for options, NULL otherwise (or not parsed yet). */
  option_type?: string | null;
  strike?: number | null;
  expiry?: string | null;
  lot_count?: number | null;
  /** R6a: set when the transaction date looks wrong in the filing; the dates stay as filed. */
  date_flag?: string | null;
  original_filed_date?: string | null;
}

// days_to_file and stock_act_late are not read: hidden site-wide until R6a's values are audited
// (A7 S2). D4 wires lateness.
export const TRADE_COLS =
  'id, member_name, member_chamber, member_party, member_state, bio_guide_id, ticker, company_name, transaction_type, asset_type, amount_min, amount_max, amount_range, transaction_date, filed_date, disclosure_url, source_system, owner, option_type, strike, expiry, lot_count, date_flag, original_filed_date';

/** Most recently filed trades (newest filing first). */
export const getLatestTrades = cache(async (limit = 10): Promise<TradeRow[] | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('congress_trades')
    .select(TRADE_COLS)
    .not('filed_date', 'is', null)
    // A row whose dates look wrong in the filing (R6a date_flag) never leads a "latest" list.
    .is('date_flag', null)
    .order('filed_date', { ascending: false })
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data as TradeRow[];
});

export const getMembersInOffice = cache(async (): Promise<number | null> => {
  if (!supabase) return null;
  const { count, error } = await supabase
    .from('congress_members')
    .select('id', { count: 'exact', head: true })
    .eq('in_office', true);
  return error ? null : (count ?? null);
});

export interface MemberHit {
  bioguide_id: string | null;
  name: string;
  party: string;
  chamber: string;
  state: string;
  district: string | null;
  in_office: boolean | null;
}

export interface CompanyHit {
  name: string;
  awards: number;
  dollars: number;
}

export interface TradedHit {
  ticker: string;
  company_name: string;
  trades: number;
}

/** Aggregated hits plus how many matching rows exist vs. how many were read. */
export interface Aggregated<T> {
  hits: T[];
  matched: number;
  scanned: number;
}

/**
 * Search input is reduced to letters, digits, spaces and & ' . - before it
 * reaches a filter, so it cannot inject PostgREST syntax or LIKE wildcards.
 * Runs of hyphens collapse to one: a quote followed by "--" is an SQL-injection signature that the
 * database gateway rejects outright (the page then said "unavailable"), and no real name contains it.
 */
export function cleanQuery(q: string | null | undefined): string {
  return (q ?? '').replace(/[^\p{L}\p{N}\s&'.-]/gu, ' ').replace(/-{2,}/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function likeTerm(q: string): string {
  return `%${cleanQuery(q)}%`;
}

export async function searchMembers(q: string): Promise<MemberHit[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('congress_members')
    .select('bioguide_id, name, party, chamber, state, district, in_office')
    .ilike('name', likeTerm(q))
    .order('in_office', { ascending: false })
    .order('last_name', { ascending: true })
    .limit(25);
  if (error || !data) return null;
  return data as MemberHit[];
}

/** Contract recipients whose name matches, aggregated over loaded awards. */
export async function searchCompanies(q: string): Promise<Aggregated<CompanyHit> | null> {
  if (!supabase) return null;
  const { data, error, count } = await supabase
    .from('awards')
    .select('recipient_name, dollar_amount', { count: 'exact' })
    .ilike('recipient_name', likeTerm(q))
    .order('dollar_amount', { ascending: false })
    .limit(1000);
  if (error || !data) return null;
  const by = new Map<string, CompanyHit>();
  for (const r of data) {
    const name = String(r.recipient_name).trim();
    const hit = by.get(name) ?? { name, awards: 0, dollars: 0 };
    hit.awards += 1;
    hit.dollars += Number(r.dollar_amount) || 0;
    by.set(name, hit);
  }
  return { hits: [...by.values()].sort((a, b) => b.dollars - a.dollars).slice(0, 25), matched: count ?? data.length, scanned: data.length };
}

/** Companies members traded, by ticker or company name. */
export async function searchTraded(q: string): Promise<Aggregated<TradedHit> | null> {
  if (!supabase) return null;
  const term = likeTerm(q);
  const { data, error, count } = await supabase
    .from('congress_trades')
    .select('ticker, company_name', { count: 'exact' })
    .or(`ticker.ilike."${term}",company_name.ilike."${term}"`)
    .limit(2000);
  if (error || !data) return null;
  const by = new Map<string, TradedHit>();
  for (const r of data) {
    const key = String(r.ticker || r.company_name).toUpperCase();
    const hit = by.get(key) ?? { ticker: String(r.ticker), company_name: String(r.company_name), trades: 0 };
    hit.trades += 1;
    by.set(key, hit);
  }
  return { hits: [...by.values()].sort((a, b) => b.trades - a.trades).slice(0, 25), matched: count ?? data.length, scanned: data.length };
}
