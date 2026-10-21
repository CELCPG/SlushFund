import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { TRADE_COLS, type TradeRow } from '@/lib/v2/queries';
import { getRoster, type Member } from '@/lib/v2/people';
import { getLeaderboard, getTradingWindow, todayNY, unreadReportsInWindow, type LeaderRow, type TradingWindow } from '@/lib/v2/report-card';
import { activityOf, gradeOf } from '@/lib/v2/grade-method';
import { getPresidentTrades } from '@/lib/v2/president';
import { daysBefore, WHATS_NEW_DAYS } from '@/lib/v2/voter';
import { ELECTION_DAY, daysUntil, moneyTotals, type LetterOrNG, type MoneyRow, type MoneyTotals } from '@/lib/v2/election-calc';

/**
 * D17 Election Center (/election-2026): one loader per section, each returning null when the database did not answer (the page
 * prints "unavailable", never a zero). Grades come from the same functions as the member pages, voter pages and leaderboard
 * (grade-method.ts, report-card.ts), so a figure here is the figure on those pages.
 */

export interface GradedMember {
  bioguide: string;
  party: string;
  state: string;
  letter: LetterOrNG;
}

export interface Countdown {
  today: string;
  electionDay: string;
  days: number;
}

export function getCountdown(): Countdown {
  const today = todayNY();
  return { today, electionDay: ELECTION_DAY, days: daysUntil(ELECTION_DAY, today) };
}

/** Every sitting member's letter (the report card), by party and state. null = the trade or member database did not answer. */
export const getGradedMembers = memo(async (): Promise<{ members: GradedMember[]; win: TradingWindow } | null> => {
  const [roster, win] = await Promise.all([getRoster(), getTradingWindow()]);
  if (!roster || !win) return null;
  const members: GradedMember[] = roster
    .filter((m) => m.in_office === true)
    .map((m: Member) => {
      const list = win.byMember.get(m.bioguide_id) ?? [];
      const g = gradeOf(list, activityOf(m.bioguide_id, list), unreadReportsInWindow(m.bioguide_id, win));
      return { bioguide: m.bioguide_id, party: m.party, state: m.state, letter: g.letter };
    });
  return { members, win };
});

export type MoneyState = { state: 'missing' } | { state: 'error' } | { state: 'ok'; totals: MoneyTotals };

const MONEY_COLS = 'bioguide_id, raised, shares_ok, pct_small_individual, pct_large_individual, pct_corporate_trade_pac, pct_labor_pac, pct_leadership_party_other, pct_self_funded, outside_support, outside_oppose, coverage_end';

/** Totals over member_campaign_money (FEC 2025-26 cycle). 'missing' while the view does not exist. */
export const getMoneyTotals = memo(async (): Promise<(MoneyState & { coverageEnd?: string | null }) | null> => {
  if (!supabase) return null;
  let missing = false;
  const rows = await readAll<MoneyRow & { coverage_end: string | null }>(async (from, to) => {
    const r = await supabase!.from('member_campaign_money').select(MONEY_COLS, { count: 'exact' }).order('bioguide_id', { ascending: true }).range(from, to);
    // PGRST205: "Could not find the table ... in the schema cache"; 42P01: undefined table.
    if (r.error && (r.error.code === 'PGRST205' || r.error.code === '42P01')) missing = true;
    return r as never;
  });
  if (missing) return { state: 'missing' };
  if (!rows) return null;
  const ends = rows.map((r) => r.coverage_end).filter((d): d is string => !!d).sort();
  return { state: 'ok', totals: moneyTotals(rows), coverageEnd: ends.length ? ends[ends.length - 1] : null };
});

/** Top 10 of the most-active-traders board on its default sort (transactions), same tie-breaks as the page. */
export async function getTopTraders(): Promise<{ rows: LeaderRow[]; start: string; end: string } | null> {
  const board = await getLeaderboard();
  if (!board) return null;
  const rows = [...board.rows]
    .sort((a, b) => b.transactions - a.transactions || a.member.name.localeCompare(b.member.name))
    .slice(0, 10);
  return { rows, start: board.win.start, end: board.win.end };
}

/** Disclosed transactions of every kind dated in the trailing 24 months (the leaderboard page's trend total). */
export async function getTrades24(): Promise<{ count: number; start: string; end: string } | null> {
  const win = await getTradingWindow();
  if (!win) return null;
  return { count: win.months.reduce((n, m) => n + m.count, 0), start: win.start, end: win.end };
}

/** The President's 278-T transaction count (the figure on his page). null = unavailable. */
export async function getPresidentCount(): Promise<number | null> {
  const d = await getPresidentTrades();
  return d ? d.trades.length : null;
}

export interface NewTrades {
  since: string;
  until: string;
  rows: TradeRow[];
  members: number;
}

/**
 * Trades by sitting members whose first report is dated in the last 30 days (the voter pages' "What's new", across every state),
 * newest report first. null = the trade or member database did not answer.
 */
export const getWhatsNewAll = memo(async (): Promise<NewTrades | null> => {
  const roster = await getRoster();
  if (!supabase || !roster) return null;
  const sitting = new Set(roster.filter((m) => m.in_office === true).map((m) => m.bioguide_id));
  const until = todayNY();
  const since = daysBefore(until, WHATS_NEW_DAYS);
  const rows = await readAll<TradeRow>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(TRADE_COLS, { count: 'exact' })
      .gte('original_filed_date', since)
      .lte('original_filed_date', until)
      .order('original_filed_date', { ascending: false })
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    10_000,
  );
  if (!rows) return null;
  const mine = (rows as TradeRow[]).filter((t) => t.bio_guide_id && sitting.has(t.bio_guide_id));
  return { since, until, rows: mine, members: new Set(mine.map((t) => t.bio_guide_id)).size };
});
