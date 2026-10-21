/**
 * The Stock Trading Grade and the leaderboard counts (G1 report-card method v0.1, g1-report-card-method.md §1-2).
 * Plain TypeScript with no imports, so scripts/grade-distribution.mjs computes exactly what the pages show.
 *
 * Window: trades dated in the 24 months up to the computation date (dates as filed). Rows with a date note
 * (date_flag) are not scored: their dates look wrong in the filing.
 * Scored ("individual-stock") rows: stocks, stock options and other single-company securities. Excluded: funds and
 * ETFs (by name or a broad-fund ticker), Treasuries, municipal securities, crypto and "other" assets. Corporate bonds
 * are counted and shown, never scored (v1).
 * Thresholds were fixed in the method before any member's result was looked at; they are not tuned.
 */

export const GRADE_WINDOW_MONTHS = 24;

/** The fixed line on every card and on the leaderboard (G1 §1). */
export const GRADE_FIXED_LINE =
  'The grade measures reported trading and disclosure timing under one published method. It is not a finding of wrongdoing.';

export type GradeClass = 'stock' | 'option' | 'bond' | 'excluded';

export interface GradeRow {
  id: string;
  bio_guide_id: string | null;
  ticker: string | null;
  company_name: string | null;
  asset_type: string | null;
  transaction_type: string;
  transaction_date: string;
  amount_min: number | null;
  date_flag: string | null;
  stock_act_late: boolean | null;
  committee_conflict: boolean | null;
  has_federal_contract: boolean | null;
  disclosure_url: string | null;
  original_disclosure_url: string | null;
  original_source_doc_id: string | null;
  source_doc_id: string | null;
}

/** First day of the window: the same calendar day 24 months before `today` (YYYY-MM-DD). */
export function windowStart(today: string, months = GRADE_WINDOW_MONTHS): string {
  const [y, m, d] = today.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 - months, d));
  return t.toISOString().slice(0, 10);
}

export function inWindow(r: Pick<GradeRow, 'transaction_date' | 'date_flag'>, start: string, today: string): boolean {
  return !r.date_flag && r.transaction_date >= start && r.transaction_date <= today;
}

/** Fund, ETF and similar pooled names as filed (a ban would allow these). "Trust" alone is not enough: REITs are one company. */
const FUND_NAME = /\b(etfs?|etns?|funds?|spdr|ishares|proshares|direxion|index|portfolio|select sector|qqq|vaneck|wisdomtree|invesco db|ultrapro|2x|3x|bull|bear)\b/i;
const NOT_SINGLE = /\b(treasury|t-bills?|treasuries|municipal|munis?|government money|money market)\b/i;
/** Broad-fund tickers filed under "Stock" without a fund word in the name. */
const FUND_TICKERS = new Set(['SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'DIA', 'IWM', 'VEA', 'VWO', 'EFA', 'AGG', 'BND', 'GLD', 'SLV', 'TLT', 'VNQ', 'VIG', 'SCHD', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'SMH', 'SOXX', 'ARKK', 'VUG', 'VTV', 'IJH', 'IJR', 'RSP', 'MDY', 'TQQQ', 'SQQQ', 'SOXL', 'UPRO', 'SPXL',
  // A12 M1: funds whose filed names are cut off at 50 characters (so no "fund" word survives), and an interval fund / institutional share class.
  'GIGB', 'FTGC', 'GEM', 'EMLP', 'PDBC', 'KRSOX', 'TPYP', 'GICIX']);
/** A12 M1: a fund name cut off at 50 characters ends mid-word or mid-phrase ("…Strategy Fun", "…Corporate Bo", "…Commodity Strate", "…Infrastructure F", "…Fd Inst"). */
const FUND_NAME_CUT = /(\bfun$|\bfd\b|\bstrate$|\bbo$|\b(?:infrastructure|strategy|equity|income|commodity|corporate|index|bond|etf)\s+[a-z]$)/i;
/**
 * A12 M1: single companies filed with asset type "Other" are scored as stock, not dropped: a share class, common or
 * preferred stock, or a named operating company (SpaceX, Annaly, Yum! Brands, Advanced Machine Intelligence Labs).
 */
const SINGLE_COMPANY_OTHER = /(\bcommon stock\b|\bcl(?:ass)?\.? a\b|\bpreferred\b|^yum! brands\b|^annaly capital\b|\bspace exploration technologies\b|^spacex\b|\badvanced machine intelligence\b)/i;

/**
 * kind is instrumentKind() from instruments.ts ('stock' | 'option' | 'other'), passed in so this file has no imports.
 */
export function gradeClass(r: Pick<GradeRow, 'asset_type' | 'company_name' | 'ticker'>, kind: 'stock' | 'option' | 'other'): GradeClass {
  const name = r.company_name ?? '';
  const asset = (r.asset_type ?? '').trim().toLowerCase();
  if (kind === 'option') return 'option';
  if (asset === 'bond' || asset === 'corporate bond') return NOT_SINGLE.test(name) ? 'excluded' : 'bond';
  if (kind !== 'stock') {
    if (asset === 'other' && SINGLE_COMPANY_OTHER.test(name) && !FUND_NAME.test(name) && !NOT_SINGLE.test(name)) return 'stock';
    return 'excluded';
  }
  if (FUND_NAME.test(name) || FUND_NAME_CUT.test(name.trim()) || NOT_SINGLE.test(name)) return 'excluded';
  if (r.ticker && FUND_TICKERS.has(r.ticker.toUpperCase())) return 'excluded';
  return 'stock';
}

/** A first report (A8 N9/N10): an amendment that restates rows does not make a second report. */
export function reportKey(r: Pick<GradeRow, 'original_source_doc_id' | 'source_doc_id' | 'original_disclosure_url' | 'disclosure_url' | 'id'>): string {
  return r.original_source_doc_id ?? r.original_disclosure_url ?? r.source_doc_id ?? r.disclosure_url ?? `row:${r.id}`;
}
export function reportUrl(r: Pick<GradeRow, 'original_disclosure_url' | 'disclosure_url'>): string | null {
  return r.original_disclosure_url ?? r.disclosure_url ?? null;
}

export interface FactorLink {
  url: string;
  label: string;
}

export interface Factor {
  key: 'transactions' | 'value' | 'options' | 'committee' | 'late' | 'contractor';
  label: string;
  points: number;
  max: number;
  /** null = not computed (scores 0, labelled "not computed", never "clean"). */
  computed: boolean;
  /** The measured value in words. */
  value: string;
  reason: string;
  links: FactorLink[];
  moreLinks: number;
}

export interface MemberActivity {
  bioguide: string;
  /** Scored rows: stocks, options, single-company securities in the window. */
  transactions: number;
  stockTransactions: number;
  optionTransactions: number;
  /** Sum of band minimums of the scored rows ("at least $X"). */
  valueMin: number;
  /** Rows whose band minimum is missing (not added). */
  valueMissing: number;
  /** Distinct first reports holding a scored row reported more than 45 days after the trade (non-NULL rows only). */
  lateReports: number;
  /** Scored rows whose lateness is not computed. */
  lateNull: number;
  committeeMatched: number;
  committeeComputed: number;
  contractorMatched: number;
  contractorComputed: number;
  bonds: number;
  excluded: number;
  /** Distinct first reports holding a scored row. */
  reports: number;
}

export type Letter = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Grade {
  score: number;
  /** 'NG' = not graded (A12 M2): the score is 0 only because the filings that could hold trades are unread. Never shown as a letter. */
  letter: Letter | 'NG';
  /** Reports filed inside the window that are scanned images or paper filings we have not read. */
  unread: number;
  factors: Factor[];
}

/** Filing dates (YYYY-MM-DD) on or after the window start: the unread reports that could hold a trade inside the window. */
export function unreadInWindow(filingDates: readonly string[] | undefined, start: string): number {
  return (filingDates ?? []).filter((d) => d >= start).length;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A12 M2: the sentence on a "Not graded" card. */
export function notGradedLine(name: string, n: number): string {
  return `Not graded: ${cnt(n)} of ${name}’s reports filed in the last 24 months ${plural(n, 'is a scanned image or paper filing', 'are scanned images or paper filings')} we have not read yet, so we cannot say whether ${plural(n, 'it includes', 'they include')} individual-stock trades.`;
}

/** D17: the same sentence for a group of members (the Election Center's grade spread); same words as notGradedLine, plural. */
export const NOT_GRADED_GROUP_LINE =
  'Not graded: some of these members’ reports filed in the last 24 months are scanned images or paper filings we have not read yet, so we cannot say whether they include individual-stock trades.';

/** A12 M2: the caveat on a graded (B to F) card whose member has unread reports in the window. */
export function unreadCaveat(n: number): string {
  return `Grade based on the electronic filings we have read. ${cnt(n)} scanned or paper ${plural(n, 'report', 'reports')} from the last 24 months ${plural(n, 'is', 'are')} not read yet, so this count may be incomplete.`;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const cnt = (n: number) => n.toLocaleString('en-US');
const pl = (n: number, one: string, many = `${one}s`) => `${cnt(n)} ${n === 1 ? one : many}`;

export function txPoints(n: number): number {
  return n === 0 ? 0 : n <= 10 ? 15 : n <= 50 ? 30 : n <= 200 ? 45 : 55;
}
export function valuePoints(v: number): number {
  return v < 250_000 ? 0 : v < 1_000_000 ? 5 : v < 5_000_000 ? 10 : 15;
}
export function committeePoints(share: number): number {
  return share <= 0 ? 0 : share <= 0.25 ? 5 : 10;
}
export function latePoints(n: number): number {
  return n === 0 ? 0 : n === 1 ? 3 : n <= 4 ? 6 : 10;
}
export function letterFor(score: number, transactions: number): Letter {
  if (transactions === 0 && score === 0) return 'A';
  return score <= 20 ? 'B' : score <= 40 ? 'C' : score <= 60 ? 'D' : 'F';
}

export interface ClassifiedRow extends GradeRow {
  cls: GradeClass;
}

/** One member's activity over their classified rows (already filtered to the window). */
export function activityOf(bioguide: string, rows: ClassifiedRow[]): MemberActivity {
  const scored = rows.filter((r) => r.cls === 'stock' || r.cls === 'option');
  const late = new Set<string>();
  const reports = new Set<string>();
  let valueMin = 0;
  let valueMissing = 0;
  for (const r of scored) {
    reports.add(reportKey(r));
    if (r.stock_act_late === true) late.add(reportKey(r));
    if (r.amount_min == null) valueMissing += 1;
    else valueMin += Number(r.amount_min);
  }
  return {
    bioguide,
    transactions: scored.length,
    stockTransactions: scored.filter((r) => r.cls === 'stock').length,
    optionTransactions: scored.filter((r) => r.cls === 'option').length,
    valueMin,
    valueMissing,
    lateReports: late.size,
    lateNull: scored.filter((r) => r.stock_act_late == null).length,
    committeeMatched: scored.filter((r) => r.committee_conflict === true).length,
    committeeComputed: scored.filter((r) => r.committee_conflict != null).length,
    contractorMatched: scored.filter((r) => r.has_federal_contract === true).length,
    contractorComputed: scored.filter((r) => r.has_federal_contract != null).length,
    bonds: rows.filter((r) => r.cls === 'bond').length,
    excluded: rows.filter((r) => r.cls === 'excluded').length,
    reports: reports.size,
  };
}

function linksFor(rows: ClassifiedRow[], cap = 5, withAmount = false): { links: FactorLink[]; more: number } {
  const seen = new Map<string, FactorLink>();
  for (const r of rows) {
    const url = reportUrl(r);
    if (!url || seen.has(url)) continue;
    seen.set(url, { url, label: `${r.ticker || r.company_name || 'filing'}, traded ${r.transaction_date}${withAmount && r.amount_min != null ? `, at least ${usd(Number(r.amount_min))}` : ''}` });
  }
  const all = [...seen.values()];
  return { links: all.slice(0, cap), more: Math.max(0, all.length - cap) };
}

/** The grade with every point and its reason (G1 §1). rows = this member's classified rows in the window. */
export function gradeOf(rows: ClassifiedRow[], a: MemberActivity, unread = 0): Grade {
  const scored = rows.filter((r) => r.cls === 'stock' || r.cls === 'option');
  const factors: Factor[] = [];
  const tx = txPoints(a.transactions);
  factors.push({
    key: 'transactions', label: 'Individual-stock transactions in the last 24 months', points: tx, max: 55, computed: true,
    value: pl(a.transactions, 'transaction'),
    reason: `${pl(a.stockTransactions, 'stock transaction')} and ${pl(a.optionTransactions, 'stock option transaction')}. Bands: 0 → 0 points, 1–10 → 15, 11–50 → 30, 51–200 → 45, over 200 → 55.`,
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor(scored)),
  });
  const vp = valuePoints(a.valueMin);
  factors.push({
    key: 'value', label: 'Reported value (sum of the lowest amount in each band)', points: vp, max: 15, computed: a.transactions === 0 || a.valueMissing < a.transactions,
    value: a.transactions ? `at least ${usd(a.valueMin)}` : '$0',
    reason: `Each trade is disclosed as a range; adding the low end of every range gives at least ${usd(a.valueMin)}${a.valueMissing ? ` (${pl(a.valueMissing, 'row')} with no amount not added)` : ''}. Under $250,000 → 0 points, $250,000–$1 million → 5, $1–5 million → 10, $5 million or more → 15.`,
    // A12 M3: the filings behind the value, largest bands first (every point is linked, G1 §1).
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor([...scored].sort((p, q) => Number(q.amount_min ?? -1) - Number(p.amount_min ?? -1)), 5, true)),
  });
  const opt = scored.filter((r) => r.cls === 'option');
  factors.push({
    key: 'options', label: 'Any stock option trades', points: opt.length ? 5 : 0, max: 5, computed: true,
    value: opt.length ? `yes, ${pl(opt.length, 'transaction')}` : 'none in the window',
    reason: 'Any option trade in the window → 5 points.',
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor(opt)),
  });
  const share = a.committeeComputed ? a.committeeMatched / a.committeeComputed : 0;
  const cp = a.committeeComputed ? committeePoints(share) : 0;
  factors.push({
    key: 'committee', label: 'Trades matching our committee signal', points: cp, max: 10, computed: a.transactions === 0 || a.committeeComputed > 0,
    value: a.transactions === 0 ? 'no trades to check' : a.committeeComputed ? `${cnt(a.committeeMatched)} of ${cnt(a.committeeComputed)} (${(share * 100).toFixed(1)}%)` : 'not computed',
    reason: a.transactions && !a.committeeComputed
      ? 'Not computed: committee data is not available for these trade dates (a new Congress had not yet published committee rosters). Scores 0.'
      : `A match means the member held a seat, on the trade date, on a committee that our hand-built map links to the company's sector (congress-legislators record). 0% → 0 points, over 0–25% → 5, over 25% → 10.${a.committeeComputed < a.transactions ? ` ${pl(a.transactions - a.committeeComputed, 'trade')} not computed.` : ''}`,
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor(scored.filter((r) => r.committee_conflict === true))),
  });
  const lp = latePoints(a.lateReports);
  factors.push({
    key: 'late', label: 'Reports filed more than 45 days after the trade', points: lp, max: 10, computed: a.transactions === 0 || a.lateNull < a.transactions,
    value: `${pl(a.lateReports, 'report')}`,
    reason: `Distinct reports, never transactions, counted from the trade date to the first report as filed. The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade; a gap over 45 days is a measured fact about two dates, not a finding about the filer. 0 → 0 points, 1 → 3, 2–4 → 6, 5 or more → 10.${a.lateNull ? ` ${pl(a.lateNull, 'trade')} not computed.` : ''}`,
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor(scored.filter((r) => r.stock_act_late === true))),
  });
  const kp = a.contractorMatched ? 5 : 0;
  factors.push({
    key: 'contractor', label: 'Trades in companies with listed federal contracts', points: kp, max: 5, computed: a.transactions === 0 || a.contractorComputed > 0,
    value: a.transactions === 0 ? 'no trades to check' : a.contractorComputed ? `${cnt(a.contractorMatched)} of ${cnt(a.contractorComputed)}` : 'not computed',
    reason: a.transactions && !a.contractorComputed
      ? 'Not computed: the trades are dated before 2023-10-01, where our contract data starts. Scores 0.'
      : `A match means the company had at least one award in our listed set (not competed and at least $1 million, or any contract of at least $10 million, signed from 2023-10-01, USAspending) signed on or before the trade date. Any match → 5 points.${a.contractorComputed < a.transactions ? ` ${pl(a.transactions - a.contractorComputed, 'trade')} not computed.` : ''}`,
    ...((x) => ({ links: x.links, moreLinks: x.more }))(linksFor(scored.filter((r) => r.has_federal_contract === true))),
  });
  const score = factors.reduce((n, f) => n + f.points, 0);
  const letter = letterFor(score, a.transactions);
  // A12 M2: an A says "no individual-stock trades reported"; with unread filings in the window we cannot know that.
  return { score, letter: letter === 'A' && unread > 0 ? 'NG' : letter, unread, factors };
}

export const GRADE_BANDS: { letter: Letter; range: string; meaning: string }[] = [
  { letter: 'A', range: '0 points', meaning: 'No individual-stock trades reported in the window.' },
  { letter: 'B', range: '1–20', meaning: '' },
  { letter: 'C', range: '21–40', meaning: '' },
  { letter: 'D', range: '41–60', meaning: '' },
  { letter: 'F', range: '61 or more', meaning: '' },
];
