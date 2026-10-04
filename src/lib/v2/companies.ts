import 'server-only';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';

/**
 * Companies and agencies (D3). Read-only against the database.
 *
 * COMPANY = a USAspending recipient *parent group*: the parent UEI printed on
 * the awards, or the recipient's own UEI when its awards carry no parent
 * (the same unit rule r7-v1 uses to link tickers). One company page can hold
 * many recipient records (Sikorsky, Raytheon Company under RTX).
 *
 * SLUG SCHEME  /companies/<name-slug>-<uei>
 *   <uei>       the group's 12-character UEI, lower case. This is the stable
 *               identity: lookups use only the trailing UEI, so a renamed
 *               company keeps its URL.
 *   <name-slug> the group's name, slugified (cosmetic; the page redirects to
 *               the canonical slug when it differs).
 *   Example     lockheed-martin-corp-zfn2jjxblzt3
 *
 * What the awards table can and cannot say: it holds only rule r5-v1 rows
 * (non-competed awards of $1M+ plus any award of $10M+). Sums of
 * obligated_amount are "obligated to date on awards signed in that FY", never
 * "spending in FY", and no no-bid share is ever computed from these rows.
 */

export const FISCAL_YEARS = [2024, 2025, 2026] as const;
export type FiscalYear = (typeof FISCAL_YEARS)[number];

const TTL_MS = 30 * 60 * 1000;
const UEI_RE = /^[A-Z0-9]{12}$/;

/** Memoize an async loader in module scope for TTL_MS; failures are never cached. */
function memo<T>(fn: () => Promise<T>): () => Promise<T> {
  let hit: { at: number; p: Promise<T> } | null = null;
  return () => {
    if (!hit || Date.now() - hit.at > TTL_MS) {
      const p = fn();
      const mine = { at: Date.now(), p };
      hit = mine;
      p.catch(() => {
        if (hit === mine) hit = null;
      });
    }
    return hit.p;
  };
}

// ---------------------------------------------------------------- slugs

export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/g, '') || 'company'
  );
}

export function companySlug(key: string, name: string): string {
  return `${slugifyName(name)}-${key.toLowerCase()}`;
}

/** The group UEI from a slug (trailing 12 characters), or null when it has none. */
export function parseCompanySlug(slug: string): string | null {
  const m = /(?:^|-)([a-z0-9]{12})$/i.exec(decodeURIComponent(slug));
  const key = m?.[1]?.toUpperCase() ?? null;
  return key && UEI_RE.test(key) ? key : null;
}

// ---------------------------------------------------------------- paging

type Page<T> = { data: T[] | null; error: unknown; count?: number | null };

/** Read every page of a query (PostgREST caps a response at 1,000 rows). null on any failure. */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, maxRows = 60_000): Promise<T[] | null> {
  const SIZE = 1000;
  const first = await build(0, SIZE - 1);
  if (first.error || !first.data) return null;
  const rows = [...first.data];
  const total = first.count ?? null;
  if (first.data.length < SIZE) return rows;
  const want = Math.min(total ?? maxRows, maxRows);
  const starts: number[] = [];
  for (let s = SIZE; s < want; s += SIZE) starts.push(s);
  for (let i = 0; i < starts.length; i += 8) {
    const batch = await Promise.all(starts.slice(i, i + 8).map((s) => build(s, s + SIZE - 1)));
    for (const b of batch) {
      if (b.error || !b.data) return null;
      rows.push(...b.data);
    }
  }
  return rows;
}

// ---------------------------------------------------------------- ticker links (r7)

export interface TickerLink {
  id: number;
  cik: string;
  ticker: string;
  sec_name: string;
  exchange: string | null;
  recipient_parent_uei: string | null;
  recipient_parent_name: string | null;
  recipient_uei: string | null;
  recipient_name: string | null;
  match_method: string;
  notes: string | null;
  evidence_url: string | null;
  status: string;
}

const CONFIRMED = ['auto_confirmed', 'manual_confirmed'];

/** Every confirmed company↔ticker link (never needs_review). */
export const getTickerLinks = memo(async (): Promise<TickerLink[] | null> => {
  if (!supabase) return null;
  const rows = await readAll<TickerLink>((from, to) =>
    supabase!
      .from('company_tickers')
      .select('id, cik, ticker, sec_name, exchange, recipient_parent_uei, recipient_parent_name, recipient_uei, recipient_name, match_method, notes, evidence_url, status', { count: 'exact' })
      .in('status', CONFIRMED)
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows ? rows.filter((r) => CONFIRMED.includes(r.status)) : null;
});

/** The entity key a ticker link belongs to (parent group, else the recipient). */
function linkKey(l: TickerLink): string | null {
  return l.recipient_parent_uei ?? l.recipient_uei ?? null;
}

// ---------------------------------------------------------------- entity index

export interface FyStat {
  /** Awards the agency coded "not competed" (B/C/G/NDO), $1M and up. */
  nc: number;
  /** Their total obligated to date. */
  ncObl: number;
  /** Other awards in the set (competed or limited), each $10M and up. */
  other: number;
  otherObl: number;
}

export interface EntitySummary {
  key: string;
  name: string;
  slug: string;
  tickers: string[];
  recipients: number;
  fy: Record<number, FyStat>;
}

export interface EntityIndex {
  entities: EntitySummary[];
  byKey: Map<string, EntitySummary>;
  awardRows: number;
}

type SlimAward = {
  recipient_name: string | null;
  recipient_uei: string | null;
  recipient_parent_uei: string | null;
  recipient_parent_name: string | null;
  fiscal_year: number | null;
  obligated_amount: number | null;
  competition_status: string | null;
};

const emptyFy = (): FyStat => ({ nc: 0, ncObl: 0, other: 0, otherObl: 0 });

/** All recipient groups with per-FY totals, from the r5-v1 awards. Memoized 30 min. */
export const getEntityIndex = memo(async (): Promise<EntityIndex | null> => {
  if (!supabase) return null;
  const rows = await readAll<SlimAward>((from, to) =>
    supabase!
      .from('awards')
      .select('recipient_name, recipient_uei, recipient_parent_uei, recipient_parent_name, fiscal_year, obligated_amount, competition_status', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (!rows) return null;
  const links = (await getTickerLinks()) ?? [];
  const tickersBy = new Map<string, Set<string>>();
  for (const l of links) {
    const k = linkKey(l);
    if (!k) continue;
    (tickersBy.get(k) ?? tickersBy.set(k, new Set()).get(k)!).add(l.ticker);
  }

  const acc = new Map<string, { name: string; recips: Set<string>; fy: Record<number, FyStat> }>();
  for (const r of rows) {
    const key = r.recipient_parent_uei || r.recipient_uei;
    if (!key || r.fiscal_year == null || r.obligated_amount == null) continue;
    let e = acc.get(key);
    if (!e) {
      e = { name: (r.recipient_parent_uei ? r.recipient_parent_name : null) || r.recipient_name || key, recips: new Set(), fy: {} };
      acc.set(key, e);
    }
    if (r.recipient_uei) e.recips.add(r.recipient_uei);
    const s = (e.fy[r.fiscal_year] ??= emptyFy());
    const amt = Number(r.obligated_amount);
    if (r.competition_status === 'no_bid') {
      s.nc += 1;
      s.ncObl += amt;
    } else {
      s.other += 1;
      s.otherObl += amt;
    }
  }

  const entities: EntitySummary[] = [...acc.entries()].map(([key, e]) => ({
    key,
    name: e.name,
    slug: companySlug(key, e.name),
    tickers: [...(tickersBy.get(key) ?? [])].sort(),
    recipients: e.recips.size,
    fy: e.fy,
  }));
  return { entities, byKey: new Map(entities.map((e) => [e.key, e])), awardRows: rows.length };
});

/** Non-competed totals across the chosen FY (or all three). */
export function ncTotals(e: EntitySummary, fy: number | null): { count: number; obligated: number } {
  let count = 0;
  let obligated = 0;
  for (const y of fy ? [fy] : FISCAL_YEARS) {
    const s = e.fy[y];
    if (s) {
      count += s.nc;
      obligated += s.ncObl;
    }
  }
  return { count, obligated };
}

export function otherCount(e: EntitySummary, fy: number | null): number {
  let n = 0;
  for (const y of fy ? [fy] : FISCAL_YEARS) n += e.fy[y]?.other ?? 0;
  return n;
}

// ---------------------------------------------------------------- one company

export interface AwardRow {
  id: string;
  award_id: string | null;
  description: string | null;
  recipient_name: string | null;
  recipient_uei: string | null;
  recipient_parent_uei: string | null;
  recipient_parent_name: string | null;
  awarding_agency: string | null;
  awarding_agency_code: string | null;
  awarding_sub_agency: string | null;
  fiscal_year: number | null;
  date_signed: string | null;
  posted_date: string | null;
  obligated_amount: number | null;
  competition_status: string | null;
  extent_competed: string | null;
  other_than_full_open: string | null;
  usaspending_url: string | null;
  /** The IDV an order was placed under; a PIID alone is not unique. */
  parent_award_piid?: string | null;
}

const AWARD_COLS =
  'id, award_id, parent_award_piid, description, recipient_name, recipient_uei, recipient_parent_uei, recipient_parent_name, awarding_agency, awarding_agency_code, awarding_sub_agency, fiscal_year, date_signed, posted_date, obligated_amount, competition_status, extent_competed, other_than_full_open, usaspending_url';

/** Every r5-v1 award of one recipient group, largest first. null on failure. */
export const getCompanyAwards = cache(async (key: string): Promise<AwardRow[] | null> => {
  if (!supabase || !UEI_RE.test(key)) return null;
  const rows = await readAll<AwardRow>((from, to) =>
    supabase!
      .from('awards')
      .select(AWARD_COLS, { count: 'exact' })
      .or(`recipient_parent_uei.eq.${key},and(recipient_parent_uei.is.null,recipient_uei.eq.${key})`)
      .order('obligated_amount', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows ? rows.map((r) => ({ ...r, obligated_amount: r.obligated_amount == null ? null : Number(r.obligated_amount) })) : null;
});

/** Confirmed ticker links of one group. */
export async function getLinksForCompany(key: string): Promise<TickerLink[] | null> {
  const all = await getTickerLinks();
  return all ? all.filter((l) => linkKey(l) === key) : null;
}

export interface SiblingGroup {
  key: string;
  name: string;
  slug: string;
  ticker: string;
  ncObl: number;
  awards: number;
}

/** Other recipient groups confirmed to the same SEC registrant(s) (same CIK). */
export async function getSiblingGroups(key: string, myLinks: TickerLink[]): Promise<SiblingGroup[] | null> {
  const [all, idx] = await Promise.all([getTickerLinks(), getEntityIndex()]);
  if (!all || !idx) return null;
  const ciks = new Set(myLinks.map((l) => l.cik));
  const seen = new Map<string, SiblingGroup>();
  for (const l of all) {
    const k = linkKey(l);
    if (!k || k === key || !ciks.has(l.cik) || seen.has(k)) continue;
    const e = idx.byKey.get(k);
    if (!e) continue;
    const t = ncTotals(e, null);
    seen.set(k, { key: k, name: e.name, slug: e.slug, ticker: l.ticker, ncObl: t.obligated, awards: t.count + otherCount(e, null) });
  }
  return [...seen.values()].sort((a, b) => b.ncObl - a.ncObl);
}

/** Trades in the given tickers, newest filing first. null on failure. */
export const getTradesForTickers = cache(async (tickersKey: string): Promise<TradeRow[] | null> => {
  const tickers = tickersKey.split(',').filter(Boolean);
  if (!supabase || tickers.length === 0) return null;
  const rows = await readAll<TradeRow>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(TRADE_COLS, { count: 'exact' })
      .in('ticker', tickers)
      .order('filed_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to),
    5000,
  );
  return rows as TradeRow[] | null;
});

// ---------------------------------------------------------------- agencies

export interface AgencyFy {
  fiscal_year: number;
  total: number;
  nc: number;
  competed: number;
  unreported: number;
  /** non-competed ÷ total contract obligations, from the stored totals only. */
  share: number | null;
  periodEnd: string;
  fetchedAt: string;
  lagDays: number;
  /** The agency's reporting lag still reaches past the day the totals were fetched. */
  lagOpen: boolean;
}

export interface Agency {
  code: string;
  name: string;
  abbr: string | null;
  fy: Record<number, AgencyFy>;
}

type SummaryRow = {
  fiscal_year: number;
  agency_code: string;
  agency_name: string;
  agency_abbreviation: string | null;
  total_obligations: number | string | null;
  noncompeted_obligations: number | string | null;
  competed_obligations: number | string | null;
  unreported_obligations: number | string | null;
  period_end: string;
  fetched_at: string;
  reporting_lag_days: number | null;
};

/** Agency totals per FY from contract_spending_summary (the only source of "% not competed"). null on failure. */
export const getAgencies = cache(async (): Promise<{ all: Agency | null; agencies: Agency[] } | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('contract_spending_summary')
    .select('fiscal_year, agency_code, agency_name, agency_abbreviation, total_obligations, noncompeted_obligations, competed_obligations, unreported_obligations, period_end, fetched_at, reporting_lag_days')
    .order('fiscal_year', { ascending: true })
    .limit(1000);
  if (error || !data) return null;
  const by = new Map<string, Agency>();
  for (const r of data as SummaryRow[]) {
    const total = r.total_obligations == null ? null : Number(r.total_obligations);
    const nc = r.noncompeted_obligations == null ? null : Number(r.noncompeted_obligations);
    if (total == null || nc == null) continue; // missing stays missing: no row for that FY
    let a = by.get(r.agency_code);
    if (!a) {
      a = { code: r.agency_code, name: r.agency_name, abbr: r.agency_abbreviation, fy: {} };
      by.set(r.agency_code, a);
    }
    const lagDays = r.reporting_lag_days ?? 0;
    const lagEnds = new Date(`${r.period_end}T00:00:00Z`).getTime() + lagDays * 86_400_000;
    a.fy[r.fiscal_year] = {
      fiscal_year: r.fiscal_year,
      total,
      nc,
      competed: Number(r.competed_obligations ?? 0),
      unreported: Number(r.unreported_obligations ?? 0),
      share: total > 0 ? nc / total : null,
      periodEnd: r.period_end,
      fetchedAt: r.fetched_at,
      lagDays,
      lagOpen: lagDays > 0 && lagEnds > new Date(r.fetched_at).getTime(),
    };
  }
  const all = by.get('ALL') ?? null;
  const agencies = [...by.values()].filter((a) => a.code !== 'ALL' && a.code !== 'UNATTRIBUTED');
  return { all, agencies };
});

export type AgencyAward = AwardRow;

/** Largest non-competed awards in the r5-v1 set for one agency (obligated to date). */
export const getAgencyTopAwards = cache(async (code: string, fy: number | null, limit = 25): Promise<AgencyAward[] | null> => {
  if (!supabase || !/^[A-Za-z0-9]{1,8}$/.test(code)) return null;
  let q = supabase.from('awards').select(AWARD_COLS).eq('awarding_agency_code', code).eq('competition_status', 'no_bid');
  if (fy) q = q.eq('fiscal_year', fy);
  const { data, error } = await q.order('obligated_amount', { ascending: false }).limit(limit);
  if (error || !data) return null;
  return (data as AgencyAward[]).map((r) => ({ ...r, obligated_amount: r.obligated_amount == null ? null : Number(r.obligated_amount) }));
});

// ---------------------------------------------------------------- search

export interface CompanyHit {
  key: string;
  name: string;
  slug: string;
  tickers: string[];
  awards: number;
  ncAwards: number;
  ncObl: number;
}

/** Contract-recipient groups whose name matches (or whose confirmed ticker equals the query). */
export async function searchCompanyGroups(q: string): Promise<{ hits: CompanyHit[]; matched: number } | null> {
  const idx = await getEntityIndex();
  if (!idx) return null;
  const needle = q.trim().toLowerCase();
  if (!needle) return { hits: [], matched: 0 };
  const all = idx.entities
    .filter((e) => e.name.toLowerCase().includes(needle) || e.tickers.some((t) => t.toLowerCase() === needle))
    .map((e) => {
      const t = ncTotals(e, null);
      return { key: e.key, name: e.name, slug: e.slug, tickers: e.tickers, awards: t.count + otherCount(e, null), ncAwards: t.count, ncObl: t.obligated };
    })
    .sort((a, b) => b.ncObl - a.ncObl || b.awards - a.awards || a.name.localeCompare(b.name));
  return { hits: all.slice(0, 25), matched: all.length };
}

export interface AgencyHit {
  code: string;
  name: string;
  abbr: string | null;
  /** Latest fiscal year with a stored total, and its share (null if none). */
  fy: number | null;
  share: number | null;
  lagOpen: boolean;
}

export async function searchAgencies(q: string): Promise<AgencyHit[] | null> {
  const data = await getAgencies();
  if (!data) return null;
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return data.agencies
    .filter((a) => a.name.toLowerCase().includes(needle) || (a.abbr ?? '').toLowerCase() === needle)
    .sort((a, b) => (b.fy[2026]?.total ?? b.fy[2025]?.total ?? 0) - (a.fy[2026]?.total ?? a.fy[2025]?.total ?? 0))
    .slice(0, 10)
    .map((a) => {
      const y = [...FISCAL_YEARS].reverse().find((yy) => a.fy[yy]);
      const f = y ? a.fy[y] : undefined;
      return { code: a.code, name: a.name, abbr: a.abbr, fy: y ?? null, share: f?.share ?? null, lagOpen: f?.lagOpen ?? false };
    });
}

/** For traded tickers, the company page they belong to (confirmed links only). */
export async function companiesForTickers(tickers: string[]): Promise<Map<string, { name: string; slug: string }>> {
  const out = new Map<string, { name: string; slug: string }>();
  const [links, idx] = await Promise.all([getTickerLinks(), getEntityIndex()]);
  if (!links || !idx) return out;
  const want = new Set(tickers.map((t) => t.toUpperCase()));
  const best = new Map<string, { score: number; name: string; slug: string }>();
  for (const l of links) {
    const t = l.ticker.toUpperCase();
    const k = linkKey(l);
    if (!want.has(t) || !k) continue;
    const e = idx.byKey.get(k);
    if (!e) continue;
    const score = ncTotals(e, null).obligated + otherCount(e, null);
    if (!best.has(t) || score > best.get(t)!.score) best.set(t, { score, name: e.name, slug: e.slug });
  }
  for (const [t, v] of best) out.set(t, { name: v.name, slug: v.slug });
  return out;
}
