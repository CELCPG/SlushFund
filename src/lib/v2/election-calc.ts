/**
 * D17 Election Center: the pure arithmetic behind the hub (no imports, so scripts/verify-gates.mjs and the figure checks load it too).
 */

/** Election Day 2026 (first Tuesday after the first Monday in November). */
export const ELECTION_DAY = '2026-11-03';

/** Whole calendar days from `today` to `target` (both YYYY-MM-DD). Negative after the date. */
export function daysUntil(target: string, today: string): number {
  const t = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(target) - t(today)) / 86_400_000);
}

export type LetterOrNG = 'A' | 'B' | 'C' | 'D' | 'F' | 'NG';
export const LETTERS: readonly LetterOrNG[] = ['A', 'B', 'C', 'D', 'F', 'NG'];

const POINTS: Record<'A' | 'B' | 'C' | 'D' | 'F', number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const BY_POINTS = ['F', 'D', 'C', 'B', 'A'] as const;

/**
 * A state's average letter: members' letters as A=4, B=3, C=2, D=1, F=0, averaged over graded members (Not graded left out),
 * rounded to the nearest letter (a .5 rounds up). null when no member in the group is graded. Also returns the average points.
 */
export function averageLetter(letters: readonly LetterOrNG[]): { letter: 'A' | 'B' | 'C' | 'D' | 'F'; avg: number; graded: number } | null {
  const g = letters.filter((l): l is 'A' | 'B' | 'C' | 'D' | 'F' => l !== 'NG');
  if (!g.length) return null;
  const avg = g.reduce((n, l) => n + POINTS[l], 0) / g.length;
  return { letter: BY_POINTS[Math.min(4, Math.max(0, Math.round(avg)))], avg, graded: g.length };
}

export interface MoneyRow {
  raised: number | null;
  shares_ok: boolean | null;
  pct_small_individual: number | null;
  pct_large_individual: number | null;
  pct_corporate_trade_pac: number | null;
  pct_labor_pac: number | null;
  pct_leadership_party_other: number | null;
  pct_self_funded: number | null;
  outside_support: number | null;
  outside_oppose: number | null;
}

export const MONEY_KEYS = ['pct_small_individual', 'pct_large_individual', 'pct_corporate_trade_pac', 'pct_labor_pac', 'pct_leadership_party_other', 'pct_self_funded'] as const;
export type MoneyKey = (typeof MONEY_KEYS)[number];

export interface MoneyTotals {
  /** Every row: members with a confirmed FEC record. */
  members: number;
  /** Sum of total receipts over every row with receipts reported (null raised adds nothing). */
  raised: number;
  /** Rows whose shares are usable (shares_ok) and that reported receipts. */
  sharesMembers: number;
  /** Their total receipts: the denominator of every share below. */
  sharesRaised: number;
  /** Dollars by category: each member's total receipts times their published share, summed. */
  byKey: Record<MoneyKey, number>;
  outsideSupport: number;
  outsideOppose: number;
}

/** Totals across members. Shares are the FEC panel's own percentages of receipts; only rows with shares_ok enter the categories. */
export function moneyTotals(rows: readonly MoneyRow[]): MoneyTotals {
  const byKey = Object.fromEntries(MONEY_KEYS.map((k) => [k, 0])) as Record<MoneyKey, number>;
  let raised = 0;
  let sharesRaised = 0;
  let sharesMembers = 0;
  let outsideSupport = 0;
  let outsideOppose = 0;
  for (const r of rows) {
    const rec = r.raised == null ? 0 : Number(r.raised);
    raised += rec;
    outsideSupport += r.outside_support == null ? 0 : Number(r.outside_support);
    outsideOppose += r.outside_oppose == null ? 0 : Number(r.outside_oppose);
    if (r.shares_ok === true && rec > 0) {
      sharesMembers += 1;
      sharesRaised += rec;
      for (const k of MONEY_KEYS) byKey[k] += (rec * (r[k] == null ? 0 : Number(r[k]))) / 100;
    }
  }
  return { members: rows.length, raised, sharesMembers, sharesRaised, byKey, outsideSupport, outsideOppose };
}
