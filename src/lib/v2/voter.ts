import 'server-only';
import { supabase } from '@/lib/supabase';
import { readAll } from '@/lib/v2/reads';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';
import { getRoster, type Member } from '@/lib/v2/people';
import { getTradingWindow, todayNY, unreadReportsInWindow, type TradingWindow } from '@/lib/v2/report-card';
import { activityOf, gradeOf, type Grade, type MemberActivity } from '@/lib/v2/grade-method';

/**
 * D11 "Your members of Congress: the records" (g1 §4 fallback: incumbents only, no ballot claims). One page per state with
 * the same panels for every current member, in alphabetical order by last name. Figures come from the same server
 * functions as the member pages and the leaderboard (report-card.ts, grade-method.ts), so a member's numbers match
 * their own page exactly.
 */

/** "What's new": trades whose first report was filed in the last 30 days. */
export const WHATS_NEW_DAYS = 30;
/** Rows listed in "What's new" before the link to the explorer. */
export const WHATS_NEW_SHOWN = 25;

export interface StateEntry {
  code: string;
  name: string;
  senators: number;
  house: number;
}

export interface MemberRecord {
  member: Member;
  /** null = the trade database did not answer. */
  activity: MemberActivity | null;
  grade: Grade | null;
}

export interface StateRecords {
  state: StateEntry;
  senators: MemberRecord[];
  house: MemberRecord[];
  /** null = the trade database did not answer. */
  win: TradingWindow | null;
}

export const stateSlug = (code: string) => code.toLowerCase();

/** Alphabetical by last name as the roster lists it, then first name: the only order on these pages. */
export function byLastName(a: Member, b: Member): number {
  const k = (m: Member) => (m.last_name ?? m.name).trim();
  return k(a).localeCompare(k(b), 'en', { sensitivity: 'base' })
    || (a.first_name ?? a.name).localeCompare(b.first_name ?? b.name, 'en', { sensitivity: 'base' })
    || a.bioguide_id.localeCompare(b.bioguide_id);
}

function statesOf(current: Member[]): StateEntry[] {
  const by = new Map<string, StateEntry>();
  for (const m of current) {
    const s = by.get(m.state) ?? { code: m.state, name: m.state_name || m.state, senators: 0, house: 0 };
    if (m.chamber === 'Senate') s.senators += 1;
    else s.house += 1;
    if (m.state_name && s.name === s.code) s.name = m.state_name;
    by.set(m.state, s);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every state, DC and territory with a current member, by name. null = the members database did not answer. */
export async function getVoterStates(): Promise<StateEntry[] | null> {
  const roster = await getRoster();
  if (!roster) return null;
  return statesOf(roster.filter((m) => m.in_office === true));
}

/** One state's current members with their trading activity and grade. null = unavailable; undefined = no such state. */
export async function getStateRecords(code: string): Promise<StateRecords | null | undefined> {
  const [roster, win] = await Promise.all([getRoster(), getTradingWindow()]);
  if (!roster) return null;
  const current = roster.filter((m) => m.in_office === true && m.state === code.toUpperCase());
  if (!current.length) return undefined;
  const record = (m: Member): MemberRecord => {
    if (!win) return { member: m, activity: null, grade: null };
    const list = win.byMember.get(m.bioguide_id) ?? [];
    const activity = activityOf(m.bioguide_id, list);
    return { member: m, activity, grade: gradeOf(list, activity, unreadReportsInWindow(m.bioguide_id, win)) };
  };
  const sorted = [...current].sort(byLastName);
  return {
    state: statesOf(current)[0],
    senators: sorted.filter((m) => m.chamber === 'Senate').map(record),
    house: sorted.filter((m) => m.chamber !== 'Senate').map(record),
    win,
  };
}

/** The calendar day `days` before `today` (YYYY-MM-DD). */
export function daysBefore(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

export interface WhatsNew {
  since: string;
  until: string;
  rows: TradeRow[];
}

/**
 * Trades by these members whose first report (original_filed_date, as the explorer's "filed" filter reads it) is dated in
 * the last 30 days, newest report first. null = the trade database did not answer.
 */
export async function getWhatsNew(bioguides: string[]): Promise<WhatsNew | null> {
  if (!supabase) return null;
  const until = todayNY();
  const since = daysBefore(until, WHATS_NEW_DAYS);
  if (!bioguides.length) return { since, until, rows: [] };
  const rows = await readAll<TradeRow>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(TRADE_COLS, { count: 'exact' })
      .in('bio_guide_id', bioguides)
      .gte('original_filed_date', since)
      .lte('original_filed_date', until)
      .order('original_filed_date', { ascending: false })
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    5_000,
  );
  return rows ? { since, until, rows: rows as TradeRow[] } : null;
}
