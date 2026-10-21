import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { getRoster } from '@/lib/v2/people';
import { getTradingWindow, todayNY, unreadReportsInWindow } from '@/lib/v2/report-card';
import { activityOf, gradeOf } from '@/lib/v2/grade-method';
import { getExecutiveFilings, getPresidentTrades } from '@/lib/v2/president';

/**
 * D20 infographics: every figure on the four graphics is computed here from the database (anon reads, no DDL) at request time,
 * memoized 30 minutes like the pages the figures come from. A failed read returns null and the graphic says "figures unavailable";
 * nothing falls back to a typed number. `retrieved` is the New York date the figures were computed.
 */

// ---------------------------------------------------------------- 1. the report card of Congress

export const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F', 'NG'] as const;
export type GradeLetter = (typeof GRADE_ORDER)[number];

export interface GradeMember {
  id: string;
  name: string;
  state: string;
  chamber: string;
  letter: GradeLetter;
}

export interface GradeGraphic {
  retrieved: string;
  /** Trade-date window of the Stock Trading Grade (24 months ending on the retrieval date). */
  start: string;
  end: string;
  total: number;
  counts: Record<GradeLetter, number>;
  /** Sorted A, B, C, D, F, Not graded; within a grade by last name. */
  members: GradeMember[];
}

export const getGradeGraphic = memo(async (): Promise<GradeGraphic | null> => {
  const [win, roster] = await Promise.all([getTradingWindow(), getRoster()]);
  if (!win || !roster) return null;
  const members: GradeMember[] = [];
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0, NG: 0 } as Record<GradeLetter, number>;
  for (const m of roster) {
    if (!m.in_office) continue;
    const list = win.byMember.get(m.bioguide_id) ?? [];
    const a = activityOf(m.bioguide_id, list);
    const g = gradeOf(list, a, unreadReportsInWindow(m.bioguide_id, win));
    const letter = (GRADE_ORDER as readonly string[]).includes(g.letter) ? (g.letter as GradeLetter) : 'NG';
    counts[letter] += 1;
    members.push({ id: m.bioguide_id, name: m.name, state: m.state, chamber: m.chamber, letter });
  }
  const last = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? n;
  members.sort((x, y) => GRADE_ORDER.indexOf(x.letter) - GRADE_ORDER.indexOf(y.letter) || last(x.name).localeCompare(last(y.name)) || x.name.localeCompare(y.name));
  return { retrieved: todayNY(), start: win.start, end: win.end, total: members.length, counts, members };
});

// ---------------------------------------------------------------- 2. who funds Congress

/**
 * The six groups the member-page panel prints (FundingPanel.tsx; F1b), in dollars instead of shares. "Leadership, party and other
 * committees" is every PAC column except corporate/trade and labor; "Self-funding" is the candidate's own contributions (loans are
 * not in it). What is left of total receipts (loans, transfers and other receipts) is its own segment, computed as the difference.
 */
export type FundKey = 'small' | 'large' | 'corporate' | 'labor' | 'leadership' | 'self' | 'other';
export const FUND_LABEL: Record<FundKey, string> = {
  small: 'Small donors (unitemized)',
  large: 'Larger individual gifts (itemized)',
  corporate: 'Corporate and trade-association PACs',
  labor: 'Labor PACs',
  leadership: 'Leadership, party and other committees',
  self: 'Self-funding',
  other: 'Loans, transfers and other receipts',
};

export interface FundSegment {
  key: FundKey;
  label: string;
  dollars: number;
  share: number;
}

export interface FundingGraphic {
  retrieved: string;
  total: number;
  /** Members counted / members with an FEC row. */
  members: number;
  rows: number;
  /** Members left out because the site prints no shares for them (shares_ok = false). */
  excluded: number;
  coverageFirst: string | null;
  coverageLast: string | null;
  /** Largest first, "other" last. */
  segments: FundSegment[];
}

interface MoneyRow {
  raised: number | null;
  individual_itemized: number | null;
  individual_unitemized: number | null;
  pac_corporate_trade: number | null;
  pac_labor: number | null;
  pac_leadership: number | null;
  pac_party_committee: number | null;
  pac_candidate_committee: number | null;
  pac_cooperative: number | null;
  pac_membership_org: number | null;
  pac_nonconnected: number | null;
  pac_other: number | null;
  candidate_contrib: number | null;
  coverage_end: string | null;
  shares_ok: boolean | null;
}

const MONEY_COLS = 'raised, individual_itemized, individual_unitemized, pac_corporate_trade, pac_labor, pac_leadership, pac_party_committee, pac_candidate_committee, pac_cooperative, pac_membership_org, pac_nonconnected, pac_other, candidate_contrib, coverage_end, shares_ok';

export const getFundingGraphic = memo(async (): Promise<FundingGraphic | null> => {
  if (!supabase) return null;
  const rows = await readAll<MoneyRow & { bioguide_id: string }>((from, to) =>
    supabase!.from('member_campaign_money').select(`bioguide_id, ${MONEY_COLS}`, { count: 'exact' }).order('bioguide_id', { ascending: true }).range(from, to),
  );
  if (!rows || rows.length === 0) return null;
  const n = (v: number | null | undefined) => Number(v ?? 0);
  const used = rows.filter((r) => r.shares_ok === true && n(r.raised) > 0);
  const sum = (f: (r: MoneyRow) => number) => used.reduce((s, r) => s + f(r), 0);
  const total = sum((r) => n(r.raised));
  if (!(total > 0)) return null;
  const parts: Record<Exclude<FundKey, 'other'>, number> = {
    small: sum((r) => n(r.individual_unitemized)),
    large: sum((r) => n(r.individual_itemized)),
    corporate: sum((r) => n(r.pac_corporate_trade)),
    labor: sum((r) => n(r.pac_labor)),
    leadership: sum((r) => n(r.pac_leadership) + n(r.pac_party_committee) + n(r.pac_candidate_committee) + n(r.pac_cooperative) + n(r.pac_membership_org) + n(r.pac_nonconnected) + n(r.pac_other)),
    self: sum((r) => n(r.candidate_contrib)),
  };
  const other = total - Object.values(parts).reduce((s, v) => s + v, 0);
  if (other < 0) return null; // the groups cannot exceed total receipts; if they do, show nothing rather than a wrong bar
  const segs: FundSegment[] = (Object.keys(parts) as (keyof typeof parts)[])
    .map((key) => ({ key: key as FundKey, label: FUND_LABEL[key], dollars: parts[key], share: parts[key] / total }))
    .sort((a, b) => b.dollars - a.dollars);
  segs.push({ key: 'other', label: FUND_LABEL.other, dollars: other, share: other / total });
  const dates = rows.map((r) => r.coverage_end).filter((d): d is string => !!d).sort();
  return {
    retrieved: todayNY(),
    total,
    members: used.length,
    rows: rows.length,
    excluded: rows.length - used.length,
    coverageFirst: dates[0] ?? null,
    coverageLast: dates[dates.length - 1] ?? null,
    segments: segs,
  };
});

// ---------------------------------------------------------------- 3. how fast do they report

export const DELAY_BINS: { label: string; lo: number; hi: number }[] = [
  { label: '0–7', lo: 0, hi: 7 },
  { label: '8–14', lo: 8, hi: 14 },
  { label: '15–30', lo: 15, hi: 30 },
  { label: '31–45', lo: 31, hi: 45 },
  { label: '46–60', lo: 46, hi: 60 },
  { label: '61–90', lo: 61, hi: 90 },
  { label: '91–180', lo: 91, hi: 180 },
  { label: '181+', lo: 181, hi: Infinity },
];

export interface DelayGraphic {
  retrieved: string;
  /** Transactions with a computed gap (lateness_basis = 'computed'). */
  total: number;
  /** Rows in congress_trades, and how many have no computed gap. */
  allRows: number;
  notComputed: number;
  bins: { label: string; count: number; over45: boolean }[];
  over45: number;
  share: number;
}

export const getDelayGraphic = memo(async (): Promise<DelayGraphic | null> => {
  if (!supabase) return null;
  const rows = await readAll<{ days_to_file: number | null }>((from, to) =>
    supabase!
      .from('congress_trades')
      .select('days_to_file', { count: 'exact' })
      .eq('lateness_basis', 'computed')
      .not('days_to_file', 'is', null)
      .order('id', { ascending: true })
      .range(from, to),
  );
  const all = await supabase.from('congress_trades').select('id', { count: 'exact', head: true });
  if (!rows || all.error || all.count == null || rows.length === 0) return null;
  const counts = DELAY_BINS.map(() => 0);
  let over45 = 0;
  for (const r of rows) {
    const d = Number(r.days_to_file);
    if (!Number.isFinite(d) || d < 0) continue;
    const i = DELAY_BINS.findIndex((b) => d >= b.lo && d <= b.hi);
    if (i >= 0) counts[i] += 1;
    if (d > 45) over45 += 1;
  }
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return null;
  return {
    retrieved: todayNY(),
    total,
    allRows: all.count,
    notComputed: all.count - total,
    bins: DELAY_BINS.map((b, i) => ({ label: b.label, count: counts[i], over45: b.lo > 45 })),
    over45,
    share: over45 / total,
  };
});

// ---------------------------------------------------------------- 4. the President's reports

export interface PresidentReport {
  docId: string;
  signed: string;
  transactions: number;
  /** The reviewing official's cover-page comment, verbatim, when it is a late-fee note (executive_filings). */
  feeNote: string | null;
  feeNoteDate: string | null;
  url: string;
}

export interface PresidentGraphic {
  retrieved: string;
  reports: PresidentReport[];
  transactions: number;
  firstSigned: string;
  lastSigned: string;
  classes: { key: string; label: string; count: number }[];
  /** false when executive_filings does not exist yet: no reviewer note is drawn or mentioned. */
  notesLoaded: boolean;
  feeNoteReports: number;
}

export const getPresidentGraphic = memo(async (): Promise<PresidentGraphic | null> => {
  const [data, notes] = await Promise.all([getPresidentTrades(), getExecutiveFilings()]);
  if (!data || notes.state === 'error' || data.filings.length === 0) return null;
  const noteBy = new Map<string, { comment: string; date: string | null }>();
  if (notes.state === 'ok') {
    for (const n of notes.rows) {
      if (n.reviewer_comment_kind === 'late_fee_note' && n.reviewer_comment) {
        noteBy.set(n.source_doc_id, { comment: String(n.reviewer_comment), date: n.reviewer_comment_date ? String(n.reviewer_comment_date) : null });
      }
    }
  }
  const reports: PresidentReport[] = data.filings
    .filter((f) => f.signed)
    .map((f) => ({
      docId: f.docId, signed: f.signed as string, transactions: f.transactions, url: f.url,
      feeNote: noteBy.get(f.docId)?.comment ?? null, feeNoteDate: noteBy.get(f.docId)?.date ?? null,
    }));
  if (reports.length !== data.filings.length) return null; // a report with no signed date cannot be placed on the axis
  const signed = reports.map((r) => r.signed).sort();
  const LABEL: Record<string, string> = { stock: 'Stocks', bond: 'Bonds', fund: 'Funds' };
  const classes = ['stock', 'bond', 'fund'].map((k) => ({ key: k, label: LABEL[k], count: data.trades.filter((t) => t.instrument_class === k).length }));
  return {
    retrieved: todayNY(),
    reports,
    transactions: data.trades.length,
    firstSigned: signed[0],
    lastSigned: signed[signed.length - 1],
    classes,
    notesLoaded: notes.state === 'ok',
    feeNoteReports: reports.filter((r) => r.feeNote).length,
  };
});
