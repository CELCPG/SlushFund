import 'server-only';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { getDatasetStatus, type DatasetKey } from '@/lib/v2/datasets';
import { getRoster } from '@/lib/v2/people';
import { getTradingWindow, todayNY, unreadReportsInWindow } from '@/lib/v2/report-card';
import { activityOf, gradeOf, windowStart, type Letter } from '@/lib/v2/grade-method';
import { campaignMoneyEnabled, gradesEnabled, investigationsV2Enabled, presidentPageEnabled } from '@/lib/v2/flags';
import unreadData from '@/data/unread-filings.json';

/**
 * D19: figures for /analytics. Every number is read from the database on request (anon key; sync_log with the server's
 * service key, the same way datasets.ts does) and cached for 30 minutes. A failed read is null and the page prints
 * "Unavailable"; nothing here ever returns a zero for a read that did not happen.
 */

// ---------------------------------------------------------------- 1. coverage band

export interface CoverageRow {
  key: string;
  label: string;
  /** What one row is, in the measure's own words. */
  measure: string;
  /** null = unavailable (or not public yet: see `note`). */
  count: number | null;
  /** The dataset's freshest row, ISO date or timestamp; null = unavailable. */
  asOf: string | null;
  /** Which value `asOf` is read from. */
  asOfBasis: string;
  note?: string;
  href?: string;
}

const head = (table: string) => supabase!.from(table).select('*', { count: 'exact', head: true });
const newest = async (table: string, col: string): Promise<string | null> => {
  const r = await supabase!.from(table).select(col).not(col, 'is', null).order(col, { ascending: false }).limit(1);
  const v = r.error ? null : (r.data as unknown as Record<string, unknown>[] | null)?.[0]?.[col];
  return v == null ? null : String(v);
};

async function fromDataset(key: DatasetKey, label: string, measure: string, href: string): Promise<CoverageRow> {
  const s = await getDatasetStatus(key);
  const failed = s.state === 'unavailable';
  return {
    key, label, measure, href,
    count: failed ? null : s.rowCount,
    asOf: failed ? null : s.lastUpdated,
    asOfBasis: s.updatedColumn ? `${s.updatedColumn} on the freshest row` : 'freshest row',
  };
}

async function execRows(): Promise<{ count: number | null; asOf: string | null; officials: number | null }> {
  if (!supabase) return { count: null, asOf: null, officials: null };
  const [c, a, ids] = await Promise.all([
    head('executive_trades'),
    newest('executive_trades', 'updated_at'),
    readAll<{ official_id: string | null }>((from, to) => supabase!.from('executive_trades').select('official_id', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
  ]);
  return {
    count: c.error ? null : (c.count ?? null),
    asOf: a,
    officials: ids ? new Set(ids.map((r) => r.official_id).filter(Boolean)).size : null,
  };
}

/**
 * Contract awards: the count, and the date of the last completed awards load from the load log (service key) or, without
 * it, the newest posted date. Not datasets.ts's reader: that one orders the 37k-row awards table by updated_at, which
 * has no index and hits the anon 3 s statement timeout (HTTP 500) on a busy instance, and one failed query there
 * turns the whole row into "Unavailable".
 */
async function contractsRow(): Promise<CoverageRow> {
  const base = { key: 'contracts', label: 'Contract awards', measure: 'awards in the listed set (rule r5-v1)', href: '/data/contracts' };
  const c = await head('awards');
  if (c.error) return { ...base, count: null, asOf: null, asOfBasis: '' };
  if (supabaseAdmin) {
    const log = await supabaseAdmin.from('sync_log').select('completed_at').like('sync_type', 'awards:%').eq('status', 'complete').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1);
    const done = log.error ? null : (log.data as { completed_at: string }[] | null)?.[0]?.completed_at ?? null;
    if (done) return { ...base, count: c.count ?? null, asOf: done, asOfBasis: 'last completed awards load in the load log' };
  }
  return { ...base, count: c.count ?? null, asOf: await newest('awards', 'posted_date'), asOfBasis: 'newest posted date' };
}
export const getCoverage = memo(async (): Promise<CoverageRow[]> => {
  const ok = Boolean(supabase);
  const none = (key: string, label: string, measure: string, note?: string): CoverageRow => ({ key, label, measure, count: null, asOf: null, asOfBasis: '', note });
  const [house, senate, contracts, roster, exec, fec, subject] = await Promise.all([
    fromDataset('house_trades', 'House trades', 'transactions in periodic transaction reports', '/data/trades'),
    fromDataset('senate_trades', 'Senate trades', 'transactions in periodic transaction reports', '/data/trades'),
    ok ? contractsRow() : Promise.resolve(none('contracts', 'Contract awards', 'awards in the listed set (rule r5-v1)')),
    ok
      ? (async (): Promise<CoverageRow> => {
          const [c, a] = await Promise.all([
            supabase!.from('congress_members').select('*', { count: 'exact', head: true }).eq('in_office', true),
            newest('congress_members', 'updated_at'),
          ]);
          return { key: 'members', label: 'Members of Congress in office', measure: 'roster entries (House and Senate)', count: c.error ? null : (c.count ?? null), asOf: a, asOfBasis: 'updated_at on the freshest row', href: '/people' };
        })()
      : none('members', 'Members of Congress in office', 'roster entries (House and Senate)'),
    presidentPageEnabled() && ok
      ? execRows()
      : Promise.resolve(null),
    campaignMoneyEnabled() && ok
      ? (async (): Promise<CoverageRow> => {
          const [c, a] = await Promise.all([head('member_campaign_money'), newest('member_campaign_money', 'coverage_end')]);
          return { key: 'fec', label: 'FEC member money rows', measure: 'members with a campaign-committee record, 2025-26 cycle', count: c.error ? null : (c.count ?? null), asOf: a, asOfBasis: 'newest report coverage date' };
        })()
      : Promise.resolve(none('fec', 'FEC member money rows', 'members with a campaign-committee record, 2025-26 cycle', 'Not public yet.')),
    investigationsV2Enabled() && ok
      ? (async (): Promise<CoverageRow> => {
          const [c, a] = await Promise.all([head('subject_award_transactions'), newest('subject_award_transactions', 'fetched_at')]);
          return { key: 'subject', label: 'Subject-money transactions', measure: 'USAspending transaction rows behind the investigation posts', count: c.error ? null : (c.count ?? null), asOf: a, asOfBasis: 'fetched_at on the freshest row' };
        })()
      : Promise.resolve(none('subject', 'Subject-money transactions', 'USAspending transaction rows behind the investigation posts', 'Not public yet.')),
  ]);
  const rows: CoverageRow[] = [house, senate];
  rows.push(
    exec
      ? { key: 'exec', label: 'Executive trades', measure: 'securities transactions on OGE Form 278-T reports', count: exec.count, asOf: exec.asOf, asOfBasis: 'updated_at on the freshest row', href: '/people/executive/donald-trump' }
      : none('exec', 'Executive trades', 'securities transactions on OGE Form 278-T reports', 'Not public yet.'),
  );
  rows.push(fec, subject, contracts);
  // The roster row also names the executive officials who have a filing in our records.
  rows.push(roster);
  if (exec && exec.officials != null) roster.measure = `${roster.measure}; plus ${exec.officials} executive officials with 278-T filings`;
  return rows;
});

// ---------------------------------------------------------------- 2 and 3: volume trend and days-to-disclose

export interface TradeSlim {
  source_system: string;
  original_source_doc_id: string | null;
  original_filed_date: string | null;
  days_to_file: number | null;
  lateness_basis: string | null;
  date_flag: string | null;
}

export interface VolumePoint { month: string; house: number; senate: number }
export interface HistBin { label: string; from: number; to: number | null; count: number }

export interface DisclosureAnalytics {
  rows: number;
  volume: VolumePoint[];
  volumeWindow: { start: string; end: string };
  /** Distinct first reports in the window, by chamber. */
  volumeTotals: { house: number; senate: number };
  bins: HistBin[];
  /** Transactions in the histogram (lateness computed). */
  binned: number;
  /** Transactions left out, by reason. */
  excluded: { belowThreshold: number; dateNote: number; notComputed: number };
  /** In the histogram, reported more than 45 days after the trade. */
  over45: number;
  asOf: string | null;
}

export const BINS: { label: string; from: number; to: number | null }[] = [
  { label: '0-7', from: 0, to: 7 },
  { label: '8-14', from: 8, to: 14 },
  { label: '15-30', from: 15, to: 30 },
  { label: '31-45', from: 31, to: 45 },
  { label: '46-60', from: 46, to: 60 },
  { label: '61-90', from: 61, to: 90 },
  { label: '91-180', from: 91, to: 180 },
  { label: '181 or more', from: 181, to: null },
];

/** The 24 calendar months ending with the month of `today`, oldest first (YYYY-MM). */
export function monthWindow(today: string, months = 24): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Pure part, so the figures can be recomputed by script from the same rows. */
export function disclosureFrom(rows: TradeSlim[], today: string): Omit<DisclosureAnalytics, 'asOf'> {
  const months = monthWindow(today);
  const idx = new Map(months.map((m, i) => [m, i]));
  const volume: VolumePoint[] = months.map((month) => ({ month, house: 0, senate: 0 }));
  const seen = new Set<string>();
  const bins: HistBin[] = BINS.map((b) => ({ ...b, count: 0 }));
  const excluded = { belowThreshold: 0, dateNote: 0, notComputed: 0 };
  let over45 = 0;
  let binned = 0;
  for (const r of rows) {
    // A report counts once, in the month of its first filing: restated rows share original_source_doc_id.
    if (r.original_source_doc_id && r.original_filed_date) {
      const key = `${r.source_system}|${r.original_source_doc_id}`;
      const i = idx.get(r.original_filed_date.slice(0, 7));
      if (i != null && !seen.has(key)) {
        seen.add(key);
        if (r.source_system === 'House_Clerk') volume[i].house += 1;
        else if (r.source_system === 'Senate_EFD') volume[i].senate += 1;
      }
    }
    if (r.lateness_basis === 'computed' && r.days_to_file != null) {
      const d = r.days_to_file;
      const b = bins.find((x) => d >= x.from && (x.to == null || d <= x.to));
      if (b) {
        b.count += 1;
        binned += 1;
        if (d > 45) over45 += 1;
      } else excluded.notComputed += 1;
    } else if (r.lateness_basis === 'below_reporting_threshold') excluded.belowThreshold += 1;
    else if (r.lateness_basis?.startsWith('not_computed_date_') || r.date_flag) excluded.dateNote += 1;
    else excluded.notComputed += 1;
  }
  return {
    rows: rows.length,
    volume,
    volumeWindow: { start: `${months[0]}-01`, end: today },
    volumeTotals: { house: volume.reduce((n, p) => n + p.house, 0), senate: volume.reduce((n, p) => n + p.senate, 0) },
    bins,
    binned,
    excluded,
    over45,
  };
}

export const getDisclosure = memo(async (): Promise<DisclosureAnalytics | null> => {
  if (!supabase) return null;
  const rows = await readAll<TradeSlim>((from, to) =>
    supabase!
      .from('congress_trades')
      .select('source_system, original_source_doc_id, original_filed_date, days_to_file, lateness_basis, date_flag', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (!rows) return null;
  const today = todayNY();
  let asOf: string | null = null;
  for (const r of rows) if (r.original_filed_date && (!asOf || r.original_filed_date > asOf)) asOf = r.original_filed_date;
  return { ...disclosureFrom(rows, today), asOf };
});

// ---------------------------------------------------------------- 4. money trend

export interface MoneyAnalytics {
  members: number;
  /** Members whose receipts figure is missing (not added). */
  missing: number;
  /** Sum of `raised`, 2025-26 cycle, as of each member's latest report. */
  raisedTotal: number;
  byQuarter: { quarter: string; members: number; raised: number }[];
  /** Newest and oldest report coverage date. */
  newest: string | null;
  oldest: string | null;
  noDate: number;
}

type MoneySlim = { bioguide_id: string; raised: number | null; coverage_end: string | null; cycle: number | null };

export const quarterOf = (d: string) => `${d.slice(0, 4)} Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;

export function moneyFrom(rows: MoneySlim[]): MoneyAnalytics {
  const q = new Map<string, { members: number; raised: number }>();
  let missing = 0;
  let total = 0;
  let noDate = 0;
  let newestD: string | null = null;
  let oldestD: string | null = null;
  for (const r of rows) {
    if (r.raised == null) { missing += 1; continue; }
    total += Number(r.raised);
    if (!r.coverage_end) { noDate += 1; continue; }
    const k = quarterOf(r.coverage_end);
    const e = q.get(k) ?? { members: 0, raised: 0 };
    e.members += 1;
    e.raised += Number(r.raised);
    q.set(k, e);
    if (!newestD || r.coverage_end > newestD) newestD = r.coverage_end;
    if (!oldestD || r.coverage_end < oldestD) oldestD = r.coverage_end;
  }
  return {
    members: rows.length, missing, raisedTotal: total, noDate, newest: newestD, oldest: oldestD,
    byQuarter: [...q.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([quarter, v]) => ({ quarter, ...v })),
  };
}

export const getMoney = memo(async (): Promise<MoneyAnalytics | null> => {
  if (!supabase || !campaignMoneyEnabled()) return null;
  const rows = await readAll<MoneySlim>((from, to) =>
    supabase!.from('member_campaign_money').select('bioguide_id, raised, coverage_end, cycle', { count: 'exact' }).order('bioguide_id', { ascending: true }).range(from, to),
  );
  return rows ? moneyFrom(rows) : null;
});

// ---------------------------------------------------------------- 5. grades snapshot

export interface GradeSnapshot {
  members: number;
  window: { start: string; end: string };
  counts: Record<Letter | 'NG', number>;
  notGraded: number;
}

export const getGradeSnapshot = memo(async (): Promise<GradeSnapshot | null> => {
  if (!gradesEnabled()) return null;
  const [win, roster] = await Promise.all([getTradingWindow(), getRoster()]);
  if (!win || !roster) return null;
  const counts: GradeSnapshot['counts'] = { A: 0, NG: 0, B: 0, C: 0, D: 0, F: 0 };
  let n = 0;
  for (const m of roster) {
    if (!m.in_office) continue;
    const list = win.byMember.get(m.bioguide_id) ?? [];
    const g = gradeOf(list, activityOf(m.bioguide_id, list), unreadReportsInWindow(m.bioguide_id, win));
    counts[g.letter] += 1;
    n += 1;
  }
  return { members: n, window: { start: windowStart(win.end), end: win.end }, counts, notGraded: counts.NG };
});

// ---------------------------------------------------------------- 6. data quality

export interface SyncRow { syncType: string; lastComplete: string | null; failures30d: number; lastStatus: string | null }
export interface Quality {
  sync: SyncRow[] | null;
  /** Scanned House and paper Senate reports not read yet (our count, src/data/unread-filings.json). */
  unreadHouse: number;
  unreadSenate: number;
  unreadAsOf: string;
}

/** When D2 counted the filings in src/data/unread-filings.json; the count is not redone on each load (same as datasets.ts). */
export const UNREAD_AS_OF = 'Oct 3, 2026';

export const getQuality = memo(async (): Promise<Quality> => {
  const u = Object.values(unreadData as Record<string, { house_scanned: number; senate_paper: number }>);
  const base = {
    unreadHouse: u.reduce((n, m) => n + (m.house_scanned ?? 0), 0),
    unreadSenate: u.reduce((n, m) => n + (m.senate_paper ?? 0), 0),
    unreadAsOf: UNREAD_AS_OF,
  };
  if (!supabaseAdmin) return { ...base, sync: null };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const r = await supabaseAdmin.from('sync_log').select('sync_type, status, started_at, completed_at').gte('started_at', since).order('started_at', { ascending: false }).limit(2000);
  const last = await supabaseAdmin.from('sync_log').select('sync_type, status, completed_at').in('status', ['complete', 'completed']).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(2000);
  if (r.error || last.error || !r.data || !last.data) return { ...base, sync: null };
  const by = new Map<string, SyncRow>();
  const family = (t: string) => t.split(':')[0];
  for (const x of last.data as { sync_type: string; completed_at: string }[]) {
    const k = family(x.sync_type);
    const e = by.get(k) ?? { syncType: k, lastComplete: null, failures30d: 0, lastStatus: null };
    if (!e.lastComplete || x.completed_at > e.lastComplete) e.lastComplete = x.completed_at;
    by.set(k, e);
  }
  const seenFirst = new Set<string>();
  for (const x of r.data as { sync_type: string; status: string }[]) {
    const k = family(x.sync_type);
    const e = by.get(k) ?? { syncType: k, lastComplete: null, failures30d: 0, lastStatus: null };
    if (!seenFirst.has(k)) { e.lastStatus = x.status; seenFirst.add(k); }
    if (x.status !== 'complete' && x.status !== 'completed' && x.status !== 'running') e.failures30d += 1;
    by.set(k, e);
  }
  return { ...base, sync: [...by.values()].sort((a, b) => a.syncType.localeCompare(b.syncType)) };
});
