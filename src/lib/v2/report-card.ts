import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { instrumentKind } from '@/lib/v2/instruments';
import { getRoster, type Member } from '@/lib/v2/people';
import unreadWindow from '@/data/unread-window.json';
import {
  activityOf, gradeClass, gradeOf, inWindow, unreadInWindow, windowStart, type ClassifiedRow, type Grade, type GradeRow, type MemberActivity,
} from '@/lib/v2/grade-method';

/**
 * D10: the leaderboard (/data/most-active-traders) and the Stock Trading Grade (member pages), computed in this server
 * function from congress_trades (anon reads, no DDL). The method itself is grade-method.ts.
 */

const COLS = 'id, bio_guide_id, ticker, company_name, asset_type, option_type, transaction_type, transaction_date, amount_min, date_flag, stock_act_late, committee_conflict, has_federal_contract, disclosure_url, original_disclosure_url, original_source_doc_id, source_doc_id';

export interface TradingWindow {
  start: string;
  end: string;
  /** Every member's classified rows in the window. */
  byMember: Map<string, ClassifiedRow[]>;
  /** All rows dated in the window (every instrument, both chambers), by month of the trade date: the trend line. */
  months: { month: string; count: number }[];
  /** Rows left out of the window because of a date note. */
  flaggedOut: number;
  rowsRead: number;
}

/** Today in New York (YYYY-MM-DD): the computation date the window ends on. */
export function todayNY(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** Rows dated in the last 24 months, classified. Memoized 30 min. null = unavailable. */
export const getTradingWindow = memo(async (): Promise<TradingWindow | null> => {
  if (!supabase) return null;
  const end = todayNY();
  const start = windowStart(end);
  const rows = await readAll<GradeRow & { option_type: string | null }>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(COLS, { count: 'exact' })
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (!rows) return null;
  const byMember = new Map<string, ClassifiedRow[]>();
  const months = new Map<string, number>();
  let flaggedOut = 0;
  for (const r of rows) {
    if (!inWindow(r, start, end)) {
      flaggedOut += 1;
      continue;
    }
    const m = r.transaction_date.slice(0, 7);
    months.set(m, (months.get(m) ?? 0) + 1);
    if (!r.bio_guide_id) continue;
    const c: ClassifiedRow = { ...r, cls: gradeClass(r, instrumentKind(r)) };
    const list = byMember.get(r.bio_guide_id) ?? [];
    list.push(c);
    byMember.set(r.bio_guide_id, list);
  }
  // Every month from the start to now, so a quiet month reads as zero, not as missing.
  const out: { month: string; count: number }[] = [];
  for (let d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 7) <= end.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const k = d.toISOString().slice(0, 7);
    out.push({ month: k, count: months.get(k) ?? 0 });
  }
  return { start, end, byMember, months: out, flaggedOut, rowsRead: rows.length };
});

/**
 * A12 M2: scanned House and paper Senate reports we have not read that were filed on or after the window start
 * (src/data/unread-window.json, scripts/build-unread-window.mjs), not the 2021-2026 totals the member note uses.
 */
export function unreadReportsInWindow(bioguide: string, win: Pick<TradingWindow, 'start'>): number {
  return unreadInWindow((unreadWindow as Record<string, string[]>)[bioguide], win.start);
}

export interface LeaderRow extends MemberActivity {
  member: Member;
}

/** Every member with at least one scored transaction in the window. null = unavailable. */
export async function getLeaderboard(): Promise<{ win: TradingWindow; rows: LeaderRow[] } | null> {
  const [win, roster] = await Promise.all([getTradingWindow(), getRoster()]);
  if (!win || !roster) return null;
  const byId = new Map(roster.map((m) => [m.bioguide_id, m]));
  const rows: LeaderRow[] = [];
  for (const [id, list] of win.byMember) {
    const member = byId.get(id);
    if (!member) continue;
    const a = activityOf(id, list);
    if (a.transactions === 0) continue;
    rows.push({ ...a, member });
  }
  return { win, rows };
}

export interface MemberCard {
  win: TradingWindow;
  activity: MemberActivity;
  grade: Grade;
}

/** One sitting member's grade. null = unavailable. */
export async function getMemberCard(bioguide: string): Promise<MemberCard | null> {
  const win = await getTradingWindow();
  if (!win) return null;
  const list = win.byMember.get(bioguide) ?? [];
  const activity = activityOf(bioguide, list);
  return { win, activity, grade: gradeOf(list, activity, unreadReportsInWindow(bioguide, win)) };
}
