import 'server-only';
import { FISCAL_YEARS, getAgencies, getCompanyAwards, parseCompanySlug } from '@/lib/v2/companies';
import { getDatasetStatus, getDatasetStatuses, type DatasetKey, type DatasetStatus } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtPct, fmtUsdCompact } from '@/lib/v2/format';
import type { OgCardOptions } from '@/lib/v2/og';
import { BIOGUIDE_RE, getMember, getMemberTrades } from '@/lib/v2/people';
import { getLatestTrades } from '@/lib/v2/queries';
import { supabase } from '@/lib/supabase';

/**
 * Figures for the per-family share cards (D8b). Same rule as the homepage card: a number is drawn
 * only when it loaded, with its source and as-of date; otherwise the card is the name alone. No
 * figure here is computed from anything the matching page does not already show. Anon reads only.
 */

const loaded = (s: DatasetStatus) => (s.state === 'fresh' || s.state === 'stale') && s.rowCount != null;
const fyRange = `FY${FISCAL_YEARS[0]}–${String(FISCAL_YEARS[FISCAL_YEARS.length - 1]).slice(2)}`;
const oldest = (xs: (string | null)[]) => xs.filter((x): x is string => !!x).sort()[0];

/** Both trade feeds: count, source and the older of their two load dates. */
async function tradesFigure() {
  const [house, senate] = await getDatasetStatuses(['house_trades', 'senate_trades']);
  if (![house, senate].every(loaded)) return null;
  return {
    count: house.rowCount! + senate.rowCount!,
    asOf: fmtDate(oldest([house.lastUpdated, senate.lastUpdated])) ?? undefined,
  };
}

// ---------------------------------------------------------------- /people/[bioguide]

export async function personCard(raw: string): Promise<OgCardOptions> {
  const id = raw.toUpperCase();
  const m = BIOGUIDE_RE.test(id) ? await getMember(id) : undefined;
  if (!m) return { title: 'Member of Congress', eyebrow: 'Stock trades, from the filings' };
  const base: OgCardOptions = { title: m.name, eyebrow: `${m.chamber === 'Senate' ? 'U.S. Senate' : 'U.S. House'} · ${m.state}` };
  const trades = await getMemberTrades(id);
  if (!trades?.length) return base;
  const chambers = new Set(trades.map((t) => (t.member_chamber === 'Senate' ? 'Senate' : 'House')));
  const keys: DatasetKey[] = [...chambers].map((c) => (c === 'Senate' ? 'senate_trades' : 'house_trades'));
  const statuses = await getDatasetStatuses(keys);
  if (!statuses.every(loaded)) return base;
  const asOf = fmtDate(oldest(statuses.map((s) => s.lastUpdated)));
  if (!asOf) return base;
  return {
    ...base,
    type: 'trades',
    stat: fmtCount(trades.length) ?? undefined,
    statLabel: 'trades on file',
    source: [...chambers].map((c) => (c === 'Senate' ? 'Senate eFD' : 'House Clerk')).join(' + '),
    asOf,
  };
}

// ---------------------------------------------------------------- /companies/[slug]

export async function companyCard(slug: string): Promise<OgCardOptions> {
  const generic: OgCardOptions = { title: 'Company', eyebrow: 'Federal contracts' };
  const key = parseCompanySlug(slug);
  const awards = key ? await getCompanyAwards(key) : null;
  if (!awards?.length) return generic;
  const a = awards[0];
  const title = (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name || 'Company';
  const base: OgCardOptions = { title, eyebrow: 'Federal contracts' };
  const contracts = await getDatasetStatus('contracts');
  const asOf = fmtDate(contracts.lastUpdated);
  if (!loaded(contracts) || !asOf) return base;
  // Same figure and wording as the page's first tile: obligated to date on the non-competed awards we hold.
  const nc = awards.filter((x) => x.competition_status === 'not_competed');
  const obligated = nc.reduce((n, x) => n + (x.obligated_amount ?? 0), 0);
  return {
    ...base,
    type: 'contracts',
    stat: (nc.length ? fmtUsdCompact(obligated) : fmtCount(awards.length)) ?? undefined,
    statLabel: nc.length
      ? `obligated on ${fmtCount(nc.length)} award${nc.length === 1 ? '' : 's'} coded not competed, ${fyRange}`
      : `awards in our records, ${fyRange}`,
    source: 'USAspending',
    asOf,
  };
}

// ---------------------------------------------------------------- /agencies/[code]

export async function agencyCard(code: string): Promise<OgCardOptions> {
  const data = await getAgencies();
  const agency = data?.agencies.find((x) => x.code === code);
  if (!agency) return { title: 'Agency', eyebrow: 'Federal contracts' };
  const base: OgCardOptions = { title: agency.name, eyebrow: 'Federal contracts' };
  const year = [...FISCAL_YEARS].reverse().find((y) => agency.fy[y]?.share != null);
  if (year == null) return base;
  const f = agency.fy[year];
  const asOf = fmtDate(f.fetchedAt);
  const share = fmtPct(f.share);
  if (!asOf || !share) return base;
  return {
    ...base,
    type: 'contracts',
    stat: share,
    statLabel: `of FY${year} contract dollars not competed${f.lagOpen ? ', to date' : ''}`,
    source: 'USAspending agency totals',
    asOf,
  };
}

// ---------------------------------------------------------------- /data/*

export async function dataCard(): Promise<OgCardOptions> {
  const title = 'Data: stock trades and federal contracts, with sources';
  const t = await tradesFigure();
  if (!t) return { title, eyebrow: 'Open data' };
  return {
    title,
    eyebrow: 'Open data',
    type: 'trades',
    stat: fmtCount(t.count) ?? undefined,
    statLabel: 'stock trades disclosed by members of Congress',
    source: 'House Clerk + Senate eFD',
    asOf: t.asOf,
  };
}

// ---------------------------------------------------------------- /latest

export async function latestCard(): Promise<OgCardOptions> {
  const title = 'Latest: new congressional trade reports and contract awards';
  const base: OgCardOptions = { title, eyebrow: 'Newest filings first' };
  if (!supabase) return base;
  const newest = await getLatestTrades(1);
  const newestFiled = newest?.[0]?.filed_date;
  const asOf = fmtDate(newestFiled);
  if (!newestFiled || !asOf) return base;
  const since = new Date(new Date(`${newestFiled}T00:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('congress_trades')
    .select('id', { count: 'exact', head: true })
    .is('date_flag', null)
    .gte('filed_date', since);
  if (error || count == null) return base;
  return {
    ...base,
    type: 'trades',
    stat: fmtCount(count) ?? undefined,
    statLabel: 'trades filed in the 30 days before the newest report',
    source: 'House Clerk + Senate eFD',
    asOf,
  };
}

// ---------------------------------------------------------------- /about/*

export function aboutCard(): OgCardOptions {
  return { title: 'About SlushFund: methods, sources and corrections', eyebrow: 'Methods and sources' };
}
