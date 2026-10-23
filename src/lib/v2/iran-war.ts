import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { displayAsset, scanHref } from '@/lib/v2/president-hub-core';
import {
  AXIS_END,
  AXIS_START,
  CHRON_COLS,
  CONGRESS_COLS,
  EIA_COLS,
  EXEC_COLS,
  FILING_COLS,
  ISSUER_COLS,
  buildIssuerMap,
  computeIranWar,
  dateRange,
  enrichExec,
  fmtLongDate,
  reportLabel,
  type ChronRow,
  type CongressRow,
  type EiaRow,
  type ExecRow,
  type FilingRow,
  type GroupClass,
  type IranWarFigures,
  type IranWarInputs,
  type IssuerRow,
  type TxType,
} from '@/lib/v2/iran-war-core';

/**
 * W2: live reads for the Iran war story (anon key, paged, failures never memoized). A table that does not answer makes the whole
 * read null, and the page then prints "Figures unavailable", never a zero.
 */
export const getIranWarInputs = memo(async (): Promise<IranWarInputs | null> => {
  if (!supabase) return null;
  const db = supabase;
  const exec = await readAll<ExecRow>((from, to) =>
    db.from('executive_trades').select(EXEC_COLS, { count: 'exact' }).eq('office', 'President').eq('report_type', '278-T').order('id').range(from, to),
  );
  if (!exec || exec.length === 0) return null;
  const congress = await readAll<CongressRow>((from, to) =>
    db.from('congress_trades').select(CONGRESS_COLS, { count: 'exact' }).gte('transaction_date', '2026-01-02').lte('transaction_date', '2026-07-31').order('id').range(from, to),
  );
  if (!congress || congress.length === 0) return null;
  const [filings, chron, eia, issuers] = await Promise.all([
    readAll<FilingRow>((from, to) => db.from('executive_filings').select(FILING_COLS, { count: 'exact' }).order('source_doc_id').range(from, to)),
    readAll<ChronRow>((from, to) => db.from('story_chronology').select(CHRON_COLS, { count: 'exact' }).order('id').range(from, to)),
    readAll<EiaRow>((from, to) => db.from('eia_spot_prices').select(EIA_COLS, { count: 'exact' }).order('series').order('price_date').range(from, to)),
    readAll<IssuerRow>((from, to) => db.from('issuer_classification').select(ISSUER_COLS, { count: 'exact' }).order('source_table').order('instrument').order('issuer_key').range(from, to)),
  ]);
  if (!filings || !chron || !eia || !issuers || filings.length === 0 || chron.length === 0 || eia.length === 0 || issuers.length === 0) return null;
  return { exec, filings, congress, chron, eia, issuers };
});

/** Every figure on the page, computed from the rows above by iran-war-core.ts. null = the database did not answer. */
export const getIranWar = memo(async (): Promise<IranWarFigures | null> => {
  const inp = await getIranWarInputs();
  return inp ? computeIranWar(inp) : null;
});

// ---------------------------------------------------------------- the day panel

export interface DayTxItem {
  id: string;
  asset: string;
  type: TxType;
  band: string;
  cls: GroupClass;
  report: string;
  page: number | null;
  line: number | null;
  href: string;
}
export interface DayChronItem {
  id: string;
  time: string | null;
  lane: string;
  labelled: boolean;
  text: string;
  quote: string | null;
  sourceUrl: string;
  archiveUrl: string | null;
}
export interface DayPayload {
  date: string;
  longDate: string;
  chron: DayChronItem[];
  tx: DayTxItem[];
  brent: number | null;
  wti: number | null;
}

/** The days the timeline covers. */
export const timelineDates = (): string[] => dateRange(AXIS_START, AXIS_END);

export const getDayPayloads = memo(async (): Promise<Map<string, DayPayload> | null> => {
  const inp = await getIranWarInputs();
  if (!inp) return null;
  const map = buildIssuerMap(inp.issuers);
  const tx = enrichExec(inp.exec, inp.filings, map);
  const rowById = new Map(inp.exec.map((r) => [r.id, r]));
  const labels = new Map(inp.filings.map((f) => [f.source_doc_id, reportLabel(f)]));
  const out = new Map<string, DayPayload>();
  for (const date of timelineDates()) out.set(date, { date, longDate: fmtLongDate(date), chron: [], tx: [], brent: null, wti: null });
  for (const c of inp.chron) {
    const d = out.get(c.event_date);
    if (!d) continue;
    d.chron.push({ id: c.id, time: c.event_time_et ? c.event_time_et.slice(0, 5) : null, lane: c.lane, labelled: c.labelled_marker, text: c.event_text, quote: c.quote, sourceUrl: c.source_url, archiveUrl: c.archive_url });
  }
  for (const d of out.values()) d.chron.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.id.localeCompare(b.id));
  for (const t of tx) {
    const d = out.get(t.date);
    const r = rowById.get(t.id);
    if (!d || !r) continue;
    d.tx.push({
      id: t.id,
      asset: displayAsset({ asset: r.asset, instrument_class: r.instrument_class }),
      type: t.type,
      band: r.amount_range ?? 'Not stated',
      cls: t.cls,
      report: labels.get(r.source_doc_id) ?? 'Report',
      page: r.page_number,
      line: r.line_on_page,
      href: scanHref({ disclosure_url: r.disclosure_url, page_number: r.page_number }),
    });
  }
  for (const d of out.values()) d.tx.sort((a, b) => a.report.localeCompare(b.report) || (a.page ?? 0) - (b.page ?? 0) || (a.line ?? 0) - (b.line ?? 0) || a.id.localeCompare(b.id));
  for (const e of inp.eia) {
    const d = out.get(e.price_date);
    if (!d || e.usd_per_bbl == null) continue;
    if (e.series === 'RBRTE') d.brent = Number(e.usd_per_bbl);
    else if (e.series === 'RWTC') d.wti = Number(e.usd_per_bbl);
  }
  return out;
});

// ---------------------------------------------------------------- downloads

const ISSUER_CSV_SELECT = 'issuer_key,source_table,ticker,cik,sec_name,sic,sic_major,instrument,group_e,group_d_sic,group_d_dod,evidence,decided_by,retrieved_at,note';
const ISSUER_CSV_COLS = ISSUER_CSV_SELECT.split(',');
const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** The issuer map as it stands in the database: every row the story's groups come from (executive_trades and congress_trades; the other-officials rows are not part of this story), with its evidence link and who decided it. */
export const getIssuerCsv = memo(async (): Promise<string | null> => {
  if (!supabase) return null;
  const db = supabase;
  const rows = await readAll<Record<string, unknown>>((from, to) =>
    db.from('issuer_classification').select(ISSUER_CSV_SELECT, { count: 'exact' }).in('source_table', ['executive_trades', 'congress_trades']).order('source_table').order('instrument').order('issuer_key').range(from, to),
  );
  if (!rows || rows.length === 0) return null;
  return `${[ISSUER_CSV_COLS.join(','), ...rows.map((r) => ISSUER_CSV_COLS.map((c) => csvCell(r[c])).join(','))].join('\r\n')}\r\n`;
});
