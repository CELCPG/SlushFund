import type { ExecFiling, ExecTrade } from './president';

/** "Aug 12, 2025" for a calendar date (same output as format.ts fmtDate; kept here so this file has no runtime imports). */
function fmtDate(d: string | null | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * D15: the figures behind the President section (/president and its sub-pages), as pure functions (no database, no
 * server-only) so scripts/verify-gates.mjs can run them on its own DB dump. Everything is computed from the same
 * office = 'President', report_type = '278-T' rows as the D9 page (the 10 Vance rows are in no figure) plus the cover data in
 * executive_filings. Nothing is typed: the loaders in president-hub.ts return null on a failed read and the page says
 * "figures unavailable". Wording rules: audit-2026-10-19-slushfund-a11.md "Wording rules for the D9 President page", A11b N5.
 */

/** The cover of one report, as read by eye in R10f (executive_filings). Only the columns the pages print. */
export interface ExecCover {
  source_doc_id: string;
  file_name: string;
  disclosure_url: string;
  filer_signed_date: string | null;
  daeo_signed_date: string | null;
  daeo_signed_text: string | null;
  reviewer_comment: string | null;
  reviewer_comment_kind: 'late_fee_note' | 'line_identification' | null;
  reviewer_comment_date: string | null;
  reviewer_comment_ref_page: number | null;
  reviewer_comment_ref_line: number | null;
  amended_file: boolean;
  amendment_signed_date: string | null;
}

export const COVER_COLS = 'source_doc_id, file_name, disclosure_url, filer_signed_date, daeo_signed_date, daeo_signed_text, reviewer_comment, reviewer_comment_kind, reviewer_comment_date, reviewer_comment_ref_page, reviewer_comment_ref_line, amended_file, amendment_signed_date';

/** Days from trade to report, in bins that carry no verdict. The first two bins are at 45 days or fewer. */
export const DAY_BINS = [
  { key: 'd30', label: '30 or fewer', min: 0, max: 30 },
  { key: 'd45', label: '31 to 45', min: 31, max: 45 },
  { key: 'd60', label: '46 to 60', min: 46, max: 60 },
  { key: 'd90', label: '61 to 90', min: 61, max: 90 },
  { key: 'd120', label: '91 to 120', min: 91, max: 120 },
  { key: 'd180', label: '121 to 180', min: 121, max: 180 },
  { key: 'd181', label: '181 or more', min: 181, max: Infinity },
] as const;
export type DayBinKey = (typeof DAY_BINS)[number]['key'];

/** The per-report table uses fewer, wider columns made of the same bins. */
export const REPORT_BINS = [
  { key: 'upTo45', label: '45 or fewer', bins: ['d30', 'd45'] as DayBinKey[] },
  { key: 'to90', label: '46 to 90', bins: ['d60', 'd90'] as DayBinKey[] },
  { key: 'to180', label: '91 to 180', bins: ['d120', 'd180'] as DayBinKey[] },
  { key: 'over180', label: '181 or more', bins: ['d181'] as DayBinKey[] },
] as const;

export function binOf(days: number): DayBinKey {
  return (DAY_BINS.find((b) => days >= b.min && days <= b.max) ?? DAY_BINS[DAY_BINS.length - 1]).key;
}

/** A perpetual fixed-income security: PERP / ALT TIER in the printed description, or the broker's 12/31/49 placeholder (A11b N5). */
export const PERPETUAL_RE = /\bPERP\b|ALT\s*TIER|12\/31\/(?:49|2049)/i;
export function isPerpetual(t: Pick<ExecTrade, 'asset' | 'instrument_class'>): boolean {
  return t.instrument_class === 'bond' && PERPETUAL_RE.test(t.asset);
}

/**
 * The asset text for display. A perpetual's broker maturity placeholder "12/31/49" is never printed as a maturity (A11b N5):
 * it is replaced by the word "perpetual" (once, at the end), and a description that already says PERP keeps it.
 */
export function displayAsset(t: Pick<ExecTrade, 'asset' | 'instrument_class'>): string {
  const a = t.asset.replace(/\s+/g, ' ').trim();
  if (!isPerpetual(t)) return a;
  const stripped = a.replace(/\s*(?:\bdue\s+)?12\/31\/(?:49|2049)\b/i, '').trim();
  return /\bPERP\b/i.test(stripped) ? stripped : `${stripped} (perpetual)`;
}

export interface ReportRow {
  docId: string;
  url: string;
  fileName: string;
  /** "278-T signed Aug 12, 2025 (2)" */
  label: string;
  signed: string | null;
  transactions: number;
  firstTrade: string | null;
  lastTrade: string | null;
  /** Rows with a computed gap (true or false). */
  computed: number;
  over45: number;
  notComputed: number;
  longestGap: number | null;
  bins: Record<DayBinKey, number>;
  cover: ExecCover | null;
}

export interface BandCount { band: string; min: number; count: number }

export interface HubFigures {
  total: number;
  reports: number;
  purchases: number;
  sales: number;
  classes: { stock: number; bond: number; fund: number; other: number };
  /** Owner as printed on the line, by value ('Self', 'Spouse', 'Joint', 'Child'). */
  owners: { value: string; count: number }[];
  firstTrade: string | null;
  lastTrade: string | null;
  firstSigned: string | null;
  lastSigned: string | null;
  computed: number;
  over45: number;
  over45Reports: number;
  notComputed: number;
  notComputedAllNotRequired: boolean;
  atOrUnder45: number;
  hist: { key: DayBinKey; label: string; count: number; over45: boolean }[];
  perReport: ReportRow[];
  bands: BandCount[];
  perpetuals: number;
  restatedLines: number;
  readCheck: { value: string; count: number }[];
  reread: { value: string; count: number }[];
  /** null while the cover table could not be read ("figures unavailable"); [] never (19 rows are loaded). */
  covers: ExecCover[] | null;
}

export function reportLabel(f: { signed: string | null; fileName: string }): string {
  const n = /\((\d)\)/.exec(f.fileName)?.[1];
  return `278-T signed ${fmtDate(f.signed) ?? 'date not read'}${n ? ` (${n})` : ''}`;
}

function tally<K extends string>(keys: K[]): { value: K; count: number }[] {
  const m = new Map<K, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function computeHub(trades: ExecTrade[], filings: ExecFiling[], covers: ExecCover[] | null): HubFigures {
  const coverBy = new Map((covers ?? []).map((c) => [c.source_doc_id, c]));
  const binsZero = () => Object.fromEntries(DAY_BINS.map((b) => [b.key, 0])) as Record<DayBinKey, number>;
  const per = new Map<string, ReportRow>(
    filings.map((f) => [f.docId, {
      docId: f.docId, url: f.url, fileName: f.fileName, label: reportLabel(f), signed: f.signed, transactions: f.transactions,
      firstTrade: f.firstTrade, lastTrade: f.lastTrade, computed: 0, over45: f.over45, notComputed: f.notComputed, longestGap: f.longestGap,
      bins: binsZero(), cover: coverBy.get(f.docId) ?? null,
    }]),
  );
  const hist = binsZero();
  for (const t of trades) {
    if (t.days_to_file == null || t.stock_act_late == null) continue;
    const r = per.get(t.source_doc_id);
    const k = binOf(t.days_to_file);
    hist[k] += 1;
    if (r) { r.bins[k] += 1; r.computed += 1; }
  }
  const signed = filings.map((f) => f.signed).filter(Boolean).sort() as string[];
  const dates = trades.map((t) => t.transaction_date).filter(Boolean).sort();
  const notComp = trades.filter((t) => t.stock_act_late == null);
  const over = trades.filter((t) => t.stock_act_late === true);
  const bandMap = new Map<string, BandCount>();
  for (const t of trades) {
    const b = t.amount_range ?? 'Not stated';
    const e = bandMap.get(b) ?? { band: b, min: Number(t.amount_min ?? 0), count: 0 };
    e.count += 1;
    bandMap.set(b, e);
  }
  const cls = (c: string) => trades.filter((t) => t.instrument_class === c).length;
  return {
    total: trades.length,
    reports: filings.length,
    purchases: trades.filter((t) => t.transaction_type === 'purchase').length,
    sales: trades.filter((t) => t.transaction_type === 'sale').length,
    classes: { stock: cls('stock'), bond: cls('bond'), fund: cls('fund'), other: trades.length - cls('stock') - cls('bond') - cls('fund') },
    owners: tally(trades.map((t) => t.owner ?? 'Not stated')),
    firstTrade: dates[0] ?? null,
    lastTrade: dates[dates.length - 1] ?? null,
    firstSigned: signed[0] ?? null,
    lastSigned: signed[signed.length - 1] ?? null,
    computed: trades.length - notComp.length,
    over45: over.length,
    over45Reports: filings.filter((f) => f.over45 > 0).length,
    notComputed: notComp.length,
    notComputedAllNotRequired: notComp.every((t) => t.late_basis === 'not_required_on_278T'),
    atOrUnder45: trades.filter((t) => t.stock_act_late === false).length,
    hist: DAY_BINS.map((b) => ({ key: b.key, label: b.label, count: hist[b.key], over45: b.min > 45 })),
    perReport: [...per.values()].sort((a, b) => (a.signed ?? '').localeCompare(b.signed ?? '') || a.fileName.localeCompare(b.fileName)),
    bands: [...bandMap.values()].sort((a, b) => a.min - b.min),
    perpetuals: trades.filter(isPerpetual).length,
    restatedLines: trades.filter((t) => t.restated === true).length,
    readCheck: tally(trades.map((t) => t.read_check ?? 'not checked')),
    reread: tally(trades.map((t) => t.reread ?? 'first read kept')),
    covers,
  };
}


/** The OGE scan page of a transaction line. */
export function scanHref(t: Pick<ExecTrade, 'disclosure_url' | 'page_number'>): string {
  return t.page_number ? `${t.disclosure_url}#page=${t.page_number}` : t.disclosure_url;
}

export const FEE_NOTE_SENTENCE = (n: number, of: number) => `On ${n} of the ${of} reports, the reviewing official wrote in the comments box: ‘Filer paid late fee(s).’`;
export const COMPLIANCE_SENTENCE = 'Every report also carries the agency ethics official’s signed opinion that the filer is in compliance with applicable laws and regulations.';
export const FEE_RULE_SENTENCE = 'OGE rules set a $200 fee for a report filed more than 30 days after it was due (5 CFR 2634.704).';
