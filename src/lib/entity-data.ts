// Entity data layer — composes spending + trading + influence into a single
// shape suitable for /entity/[slug] pages. One query module per database.

import { supabase, supabaseAdmin } from './supabase';
import { PAC_DATABASE, type PACDonation } from './pac-data';
import type { EntityConfig } from './entities';
import type { Award } from './types';

export interface EntitySpending {
  /** All awards that match this entity (combined connection_type + recipient pattern) */
  awards: Array<Award & { id: string }>;
  /** Sum of award dollar amounts */
  total_dollars: number;
  /** Number of awards */
  count: number;
  /** Number of no-bid + sole-source awards */
  no_bid_count: number;
  /** Number of awards with risk_score >= 80 */
  high_risk_count: number;
  /** Average risk score */
  avg_risk_score: number;
  /** Distinct agencies */
  agencies: { name: string; dollars: number; count: number }[];
}

export interface EntityTrading {
  /** Congressional trades that mention this entity's ticker (or, for people, by member name) */
  trades: Array<{
    id: string;
    member_name: string;
    member_chamber: 'House' | 'Senate' | null;
    member_party: string | null;
    ticker: string;
    company_name: string;
    transaction_type: 'BUY' | 'SELL' | 'EXCHANGE';
    transaction_date: string;
    filed_date: string;
    amount_range: string | null;
    amount_min: number | null;
    amount_max: number | null;
    has_federal_contract: boolean;
    signal_type: string | null;
  }>;
  total_trades: number;
  buys: number;
  sells: number;
  total_min: number;
  total_max: number;
}

export interface EntityInfluence {
  /** PAC donations, super PACs, and dark-money orgs linked to this entity */
  pacs: PACDonation[];
  total_raised: number;
  top_recipients: { name: string; office: string; amount: number }[];
  affiliated_entities: string[];
}

export interface TimelineEvent {
  date: string;
  kind: 'contract' | 'trade' | 'donation';
  title: string;
  detail: string;
  amount: number;
  href: string;
}

export interface EntityPageData {
  config: EntityConfig;
  spending: EntitySpending;
  trading: EntityTrading;
  influence: EntityInfluence;
  timeline: TimelineEvent[];
  /**
   * Which steps of the Loop this entity appears in, derived from
   * what data we found. Drives the Loop Position diagram.
   */
  loop_position: { step: 1 | 2 | 3 | 4 | 5; present: boolean; count: number; dollars: number }[];
  /** Aggregate dollars across all 3 databases (spending only — trades + influence are non-federal) */
  total_tracked: number;
}

// ─── SPENDING DB ─────────────────────────────────────────────────────────────

export async function loadEntitySpending(config: EntityConfig): Promise<EntitySpending> {
  if (!supabase) {
    return { awards: [], total_dollars: 0, count: 0, no_bid_count: 0, high_risk_count: 0, avg_risk_score: 0, agencies: [] };
  }

  // Strategy:
  // 1. If connectionType is set, filter by that first.
  // 2. Then narrow by recipient_name matching the entity's patterns.
  // 3. If no patterns, return all connection-type awards (entity = person/umbrella).
  let query = supabase
    .from('awards')
    .select('*')
    .limit(2000);

  if (config.spending.connectionType) {
    query = query.eq('connection_type', config.spending.connectionType);
  }

  if (config.spending.recipientPatterns.length > 0) {
    // OR filter: recipient_name ILIKE any pattern
    // PostgREST or=...with comma-separated ilike values
    const orFilter = config.spending.recipientPatterns
      .map(p => `recipient_name.ilike.%${p}%`)
      .join(',');
    query = query.or(orFilter);
  } else if (!config.spending.connectionType) {
    // No way to look up — empty
    return { awards: [], total_dollars: 0, count: 0, no_bid_count: 0, high_risk_count: 0, avg_risk_score: 0, agencies: [] };
  }

  const { data, error } = await query.order('dollar_amount', { ascending: false });
  if (error || !data) {
    return { awards: [], total_dollars: 0, count: 0, no_bid_count: 0, high_risk_count: 0, avg_risk_score: 0, agencies: [] };
  }

  const awards = data as Array<Award & { id: string }>;
  const total_dollars = awards.reduce((s, a) => s + Number(a.dollar_amount || 0), 0);
  const no_bid_count = awards.filter(a =>
    a.competition_status === 'no_bid' || a.competition_status === 'sole_source'
  ).length;
  const high_risk_count = awards.filter(a => Number(a.risk_score || 0) >= 80).length;
  const avg_risk_score = awards.length
    ? awards.reduce((s, a) => s + Number(a.risk_score || 0), 0) / awards.length
    : 0;

  // Aggregate by agency
  const byAgency = new Map<string, { name: string; dollars: number; count: number }>();
  for (const a of awards) {
    const agency = a.awarding_agency || 'Unknown';
    const e = byAgency.get(agency) ?? { name: agency, dollars: 0, count: 0 };
    e.dollars += Number(a.dollar_amount || 0);
    e.count += 1;
    byAgency.set(agency, e);
  }
  const agencies = Array.from(byAgency.values())
    .sort((a, b) => b.dollars - a.dollars)
    .slice(0, 8);

  return {
    awards: awards.slice(0, 100), // cap for page payload
    total_dollars,
    count: awards.length,
    no_bid_count,
    high_risk_count,
    avg_risk_score,
    agencies,
  };
}

// ─── TRADING DB ──────────────────────────────────────────────────────────────

export async function loadEntityTrading(config: EntityConfig): Promise<EntityTrading> {
  if (!supabase) {
    return { trades: [], total_trades: 0, buys: 0, sells: 0, total_min: 0, total_max: 0 };
  }

  let query = supabase
    .from('congress_trades')
    .select('*')
    .limit(500);

  if (config.trading.tickers && config.trading.tickers.length > 0) {
    const orFilter = config.trading.tickers.map(t => `ticker.ilike.%${t}%`).join(',');
    query = query.or(orFilter);
  } else if (config.trading.memberName) {
    query = query.ilike('member_name', `%${config.trading.memberName}%`);
  } else {
    return { trades: [], total_trades: 0, buys: 0, sells: 0, total_min: 0, total_max: 0 };
  }

  const { data, error } = await query.order('transaction_date', { ascending: false });
  if (error || !data) {
    return { trades: [], total_trades: 0, buys: 0, sells: 0, total_min: 0, total_max: 0 };
  }

  const trades = data as EntityTrading['trades'];
  const buys = trades.filter(t => t.transaction_type === 'BUY').length;
  const sells = trades.filter(t => t.transaction_type === 'SELL').length;
  const total_min = trades.reduce((s, t) => s + (t.amount_min || 0), 0);
  const total_max = trades.reduce((s, t) => s + (t.amount_max || 0), 0);

  return {
    trades: trades.slice(0, 50),
    total_trades: trades.length,
    buys,
    sells,
    total_min,
    total_max,
  };
}

// ─── INFLUENCE DB (static pac-data.ts) ───────────────────────────────────────

export function loadEntityInfluence(config: EntityConfig): EntityInfluence {
  const namePatterns = config.influence.namePatterns.map(p => p.toLowerCase());
  const matches = (str: string | undefined) => {
    if (!str) return false;
    const s = str.toLowerCase();
    return namePatterns.some(p => s.includes(p.toLowerCase()));
  };

  const pacs: PACDonation[] = PAC_DATABASE.filter(p =>
    matches(p.source_org) ||
    matches(p.pac_name) ||
    p.affiliated_entities?.some(matches) ||
    p.founders?.some(matches) ||
    p.primary_funders?.some(f => matches(f.name))
  );

  const total_raised = pacs.reduce((s, p) => s + (p.total_raised_2016_2024 || 0), 0);
  const top_recipients = pacs
    .flatMap(p => p.top_recipients ?? [])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(r => ({ name: r.name, office: r.office, amount: r.amount }));
  const affiliated_entities = Array.from(new Set(
    pacs.flatMap(p => p.affiliated_entities ?? []).filter(Boolean)
  )).slice(0, 12);

  return { pacs, total_raised, top_recipients, affiliated_entities };
}

// ─── TIMELINE COMPOSER ───────────────────────────────────────────────────────

export function buildTimeline(
  spending: EntitySpending,
  trading: EntityTrading,
  influence: EntityInfluence,
  config: EntityConfig,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const a of spending.awards) {
    if (!a.base_obligation_date && !a.posted_date) continue;
    const date = a.base_obligation_date || a.posted_date || '';
    if (!date) continue;
    events.push({
      date,
      kind: 'contract',
      title: `Contract: ${a.recipient_name}`,
      detail: `${a.awarding_agency} · ${a.competition_status?.replace('_', ' ') ?? 'unknown'}`,
      amount: Number(a.dollar_amount || 0),
      href: `/contract/${a.id}`,
    });
  }

  for (const t of trading.trades) {
    events.push({
      date: t.transaction_date,
      kind: 'trade',
      title: `${t.member_name} ${t.transaction_type} ${t.ticker}`,
      detail: `${t.amount_range ?? ''}${t.has_federal_contract ? ' · contractor overlap' : ''}`,
      amount: t.amount_max || t.amount_min || 0,
      href: `/congress/trades`,
    });
  }

  // For donations we don't have specific dates in pac-data — use founding_year as Jan 1
  for (const p of influence.pacs.slice(0, 5)) {
    events.push({
      date: `${p.founding_year}-01-01`,
      kind: 'donation',
      title: `PAC: ${p.pac_name}`,
      detail: `Founded ${p.founding_year} · $${(p.total_raised_2016_2024 / 1_000_000).toFixed(1)}M raised 2016-2024`,
      amount: p.total_raised_2016_2024,
      href: `/influence`,
    });
  }

  return events
    .filter(e => /^\d{4}-\d{2}-\d{2}/.test(e.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
}

// ─── LOOP POSITION ───────────────────────────────────────────────────────────

export function deriveLoopPosition(
  spending: EntitySpending,
  trading: EntityTrading,
  influence: EntityInfluence,
): { step: 1 | 2 | 3 | 4 | 5; present: boolean; count: number; dollars: number }[] {
  // Step 1 — no-bid award (we can detect)
  const step1 = spending.no_bid_count > 0;
  // Step 2 — insider holds (trades in this entity's ticker)
  const step2 = trading.total_trades > 0;
  // Step 3 — announcement spike (we don't have price data, present if any trade exists)
  const step3 = trading.total_trades > 0;
  // Step 4 — insider sells (sells in this entity)
  const step4 = trading.sells > 0;
  // Step 5 — PAC money back (we can detect)
  const step5 = influence.pacs.length > 0;

  return [
    { step: 1, present: step1, count: spending.no_bid_count, dollars: spending.total_dollars },
    { step: 2, present: step2, count: trading.total_trades, dollars: trading.total_min },
    { step: 3, present: step3, count: trading.total_trades, dollars: 0 },
    { step: 4, present: step4, count: trading.sells, dollars: trading.total_min },
    { step: 5, present: step5, count: influence.pacs.length, dollars: influence.total_raised },
  ];
}

// ─── TOP-LEVEL COMPOSER ──────────────────────────────────────────────────────

export async function loadEntityPageData(slug: string): Promise<EntityPageData | null> {
  const { getEntityBySlug } = await import('./entities');
  const config = getEntityBySlug(slug);
  if (!config) return null;

  const [spending, trading, influence] = await Promise.all([
    loadEntitySpending(config),
    loadEntityTrading(config),
    Promise.resolve(loadEntityInfluence(config)),
  ]);

  const timeline = buildTimeline(spending, trading, influence, config);
  const loop_position = deriveLoopPosition(spending, trading, influence);
  const total_tracked = spending.total_dollars; // spending is the only federal dollar figure

  return { config, spending, trading, influence, timeline, loop_position, total_tracked };
}

/** Suppress unused-import warning for supabaseAdmin (used in other modules). */
export { supabaseAdmin };
