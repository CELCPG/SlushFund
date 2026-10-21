import { fmtCount, fmtDate, fmtUsdCompact } from '@/lib/v2/format';
import type { DelayGraphic, FundingGraphic, FundKey, GradeGraphic, GradeLetter, PresidentGraphic } from '@/lib/v2/graphics-data';

/**
 * D20 infographics as a scene: a flat list of rectangles and text on a fixed 1200x1200 canvas, built from the live figures. One scene
 * feeds three renderers (the on-page SVG, the "Download PNG" button which serializes that SVG, and the opengraph-image route which
 * draws the same list as positioned boxes), so the page, the share card and the PNG always carry the same numbers and the same
 * provenance line. Plain TypeScript with no server-only import, so the client download button and scripts can load the types.
 */

export const SIZE = 1200;
export const C = { bg: '#0B0B0B', ink: '#F3F0E8', muted: '#BAB5AA', acc: '#E4FF1A', line: '#3B3B3B', grey: '#8A867C' } as const;

export type Prim =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; dash?: string; title?: string }
  | { k: 'vline'; x: number; y1: number; y2: number; stroke: string; sw: number; dash: string }
  | { k: 'text'; x: number; y: number; size: number; fill: string; text: string; font: 'd' | 'b'; anchor: 'start' | 'middle' | 'end'; ls: number };

export interface Scene {
  slug: string;
  /** Accessible name and description of the whole graphic (the data table under it is the text alternative). */
  label: string;
  prims: Prim[];
}

/** Rough text width in canvas units (display face is wider than the body face). Used only to shrink a line that would overflow. */
export function textWidth(text: string, size: number, font: 'd' | 'b'): number {
  return text.length * size * (font === 'd' ? 0.64 : 0.58);
}

function fit(text: string, size: number, maxW: number, font: 'd' | 'b'): number {
  const w = textWidth(text, size, font);
  return w > maxW ? Math.floor((size * maxW) / w) : size;
}

function T(x: number, y: number, size: number, fill: string, text: string, o: { font?: 'd' | 'b'; anchor?: 'start' | 'middle' | 'end'; ls?: number; maxW?: number } = {}): Prim {
  const font = o.font ?? 'b';
  return { k: 'text', x, y, size: o.maxW ? fit(text, size, o.maxW, font) : size, fill, text, font, anchor: o.anchor ?? 'start', ls: o.ls ?? 0 };
}

const R = (x: number, y: number, w: number, h: number, fill?: string, o: { stroke?: string; sw?: number; dash?: string; title?: string } = {}): Prim => ({ k: 'rect', x, y, w, h, fill, ...o });

const pct1 = (share: number) => `${(share * 100).toFixed(1)}%`;

function frame(o: { kicker: string; title: string[]; source: string; retrieved: string; slug: string }): Prim[] {
  const p: Prim[] = [R(0, 0, SIZE, SIZE, C.bg), R(0, 0, SIZE, 12, C.acc)];
  p.push(T(60, 66, 28, C.acc, 'SLUSHFUND.NET', { font: 'd', ls: 3 }));
  p.push(T(1140, 66, 22, C.muted, o.kicker.toUpperCase(), { anchor: 'end', ls: 1 }));
  o.title.forEach((l, i) => p.push(T(60, 166 + i * 84, 80, C.ink, l.toUpperCase(), { font: 'd', maxW: 1080 })));
  p.push(R(60, 1090, 1080, 2, C.line));
  p.push(T(60, 1128, 24, C.muted, o.source, { maxW: 1080 }));
  p.push(T(60, 1166, 24, C.muted, `Data retrieved ${fmtDate(o.retrieved) ?? o.retrieved}`));
  p.push(T(1140, 1166, 26, C.acc, `slushfund.net/graphics/${o.slug}`, { font: 'd', anchor: 'end' }));
  return p;
}

// ---------------------------------------------------------------- 1. the report card of Congress

export const GRADE_STYLE: Record<GradeLetter, { fill?: string; ink: string; stroke?: string; dash?: string }> = {
  A: { fill: '#2B2B2B', ink: '#D8D4C8', stroke: '#4A4A4A' },
  B: { fill: '#8C8C30', ink: '#0B0B0B' },
  C: { fill: '#BCCB22', ink: '#0B0B0B' },
  D: { fill: '#E4FF1A', ink: '#0B0B0B' },
  F: { fill: '#FFFFFF', ink: '#0B0B0B' },
  NG: { ink: '#BAB5AA', stroke: '#8A867C', dash: '4 3' },
};
export const GRADE_GLYPH: Record<GradeLetter, string> = { A: 'A', B: 'B', C: 'C', D: 'D', F: 'F', NG: '–' };

export function gradeScene(d: GradeGraphic): Scene {
  const p = frame({
    kicker: 'Stock Trading Grade', title: ['The report card', 'of Congress'], retrieved: d.retrieved, slug: 'grading-congress',
    source: 'Source: House/Senate PTRs via SlushFund.net. Method: slushfund.net/about/methodology/report-card',
  });
  p.push(T(60, 304, 34, C.ink, `${fmtCount(d.total)} sitting members of Congress`, { maxW: 1080 }));
  p.push(T(60, 342, 26, C.muted, `Stock Trading Grade for trades dated ${fmtDate(d.start)} to ${fmtDate(d.end)}`, { maxW: 1080 }));
  const cols = 30;
  const rows = Math.ceil(d.members.length / cols);
  const pitch = Math.min(36, Math.floor(648 / rows));
  const tile = pitch - 4;
  const x0 = 60 + Math.floor((1080 - cols * pitch) / 2);
  const y0 = 372;
  d.members.forEach((m, i) => {
    const s = GRADE_STYLE[m.letter];
    const x = x0 + (i % cols) * pitch;
    const y = y0 + Math.floor(i / cols) * pitch;
    p.push(R(x, y, tile, tile, s.fill, { stroke: s.stroke, sw: s.stroke ? 2 : undefined, dash: s.dash, title: `${m.name} (${m.state}): ${m.letter === 'NG' ? 'not graded' : `grade ${m.letter}`}` }));
    p.push(T(x + tile / 2, y + tile * 0.72, Math.round(tile * 0.58), s.ink, GRADE_GLYPH[m.letter], { font: 'd', anchor: 'middle' }));
  });
  const xs = [60, 215, 370, 525, 680, 835];
  (['A', 'B', 'C', 'D', 'F', 'NG'] as GradeLetter[]).forEach((l, i) => {
    const s = GRADE_STYLE[l];
    p.push(R(xs[i], 1034, 30, 30, s.fill, { stroke: s.stroke, sw: s.stroke ? 2 : undefined, dash: s.dash }));
    p.push(T(xs[i] + 15, 1057, 19, s.ink, GRADE_GLYPH[l], { font: 'd', anchor: 'middle' }));
    p.push(T(xs[i] + 42, 1060, 34, C.ink, l === 'NG' ? `${fmtCount(d.counts[l])} not graded` : fmtCount(d.counts[l]) ?? '', { font: 'd' }));
  });
  const c = d.counts;
  return {
    slug: 'grading-congress',
    label: `The report card of Congress: ${d.total} sitting members, one tile each, colored by Stock Trading Grade. A ${c.A}, B ${c.B}, C ${c.C}, D ${c.D}, F ${c.F}, not graded ${c.NG}. Trades dated ${d.start} to ${d.end}. Data retrieved ${d.retrieved}.`,
    prims: p,
  };
}

// ---------------------------------------------------------------- 2. who funds Congress

export const FUND_COLOR: Record<FundKey, string> = {
  small: '#E4FF1A', large: '#F3F0E8', corporate: '#6FD6DE', labor: '#FFAD80', leadership: '#BBA6FF', self: '#FF9CC0', other: '#8A867C',
};

export function fundingScene(d: FundingGraphic): Scene {
  const p = frame({
    kicker: 'Campaign receipts, 2025–26 cycle', title: ['Who funds Congress'], retrieved: d.retrieved, slug: 'where-the-money-comes-from',
    source: 'Source: Federal Election Commission bulk data via SlushFund.net',
  });
  p.push(T(60, 342, 112, C.acc, `${fmtUsdCompact(d.total)}`, { font: 'd', maxW: 360 }));
  p.push(T(440, 306, 32, C.ink, 'in total receipts reported to the FEC', { maxW: 700 }));
  p.push(T(440, 346, 32, C.ink, `by ${fmtCount(d.members)} members of Congress`, { maxW: 700 }));
  p.push(T(60, 392, 22, C.muted, `2025–26 cycle. Latest reports on file run through ${fmtDate(d.coverageLast) ?? 'the latest filing'}.`, { maxW: 1080 }));
  let x = 60;
  d.segments.forEach((s, i) => {
    const w = i === d.segments.length - 1 ? 1140 - x : s.share * 1080;
    p.push(R(x, 424, Math.max(w, 0), 120, FUND_COLOR[s.key], { stroke: C.bg, sw: 3, title: `${s.label}: ${fmtUsdCompact(s.dollars)}, ${pct1(s.share)} of total receipts` }));
    if (w >= 96) p.push(T(x + w / 2, 499, 40, '#0B0B0B', pct1(s.share), { font: 'd', anchor: 'middle' }));
    x += w;
  });
  d.segments.forEach((s, i) => {
    const y = 616 + i * 60;
    p.push(R(60, y - 26, 30, 30, FUND_COLOR[s.key]));
    p.push(T(108, y, 31, C.ink, s.label, { maxW: 640 }));
    p.push(T(930, y, 33, C.ink, fmtUsdCompact(s.dollars) ?? '', { font: 'd', anchor: 'end' }));
    p.push(T(1140, y, 33, C.acc, pct1(s.share), { font: 'd', anchor: 'end' }));
  });
  const left = d.excluded > 0 ? ` ${fmtCount(d.excluded)} of ${fmtCount(d.rows)} members left out where FEC totals do not line up.` : '';
  p.push(T(60, 1042, 21, C.muted, `Percent of total receipts, rounded.${left}`, { maxW: 1080 }));
  p.push(T(60, 1068, 21, C.muted, 'Last group is total receipts minus the six above; it is not an FEC category.', { maxW: 1080 }));
  return {
    slug: 'where-the-money-comes-from',
    label: `Who funds Congress: ${fmtUsdCompact(d.total)} in total receipts reported to the FEC by ${d.members} members, 2025-26 cycle. ${d.segments.map((s) => `${s.label} ${fmtUsdCompact(s.dollars)}, ${pct1(s.share)}`).join('; ')}. Data retrieved ${d.retrieved}.`,
    prims: p,
  };
}

// ---------------------------------------------------------------- 3. how fast do they report

export function delayScene(d: DelayGraphic): Scene {
  const p = frame({
    kicker: 'Days from trade to report', title: ['How fast do they', 'report?'], retrieved: d.retrieved, slug: 'trading-while-disclosing',
    source: 'Source: House/Senate PTRs via SlushFund.net',
  });
  p.push(T(60, 408, 160, C.acc, pct1(d.share), { font: 'd', maxW: 520 }));
  p.push(T(620, 336, 31, C.ink, `of ${fmtCount(d.total)} transactions`));
  p.push(T(620, 378, 31, C.ink, 'were reported more than 45 days'));
  p.push(T(620, 420, 31, C.ink, `after the trade (${fmtCount(d.over45)}).`));
  const base = 960;
  const max = Math.max(...d.bins.map((b) => b.count), 1);
  const bw = 108;
  const gap = 24;
  const x0 = 84;
  const H = 400;
  d.bins.forEach((b, i) => {
    const h = Math.max(2, Math.round((b.count / max) * H));
    const x = x0 + i * (bw + gap);
    p.push(R(x, base - h, bw, h, b.over45 ? C.acc : C.grey, { title: `${b.label} days: ${fmtCount(b.count)} transactions` }));
    p.push(T(x + bw / 2, base - h - 12, 27, C.ink, fmtCount(b.count) ?? '', { font: 'd', anchor: 'middle' }));
    p.push(T(x + bw / 2, base + 38, 26, C.muted, b.label, { anchor: 'middle' }));
  });
  p.push(R(60, base, 1080, 2, C.line));
  p.push(T(600, base + 74, 22, C.muted, 'Days from the trade to the report', { anchor: 'middle' }));
  for (const [i, label] of [[3, '30 DAYS'], [4, '45 DAYS']] as const) {
    const lx = x0 + i * (bw + gap) - gap / 2;
    p.push({ k: 'vline', x: lx, y1: 478, y2: base, stroke: C.ink, sw: 3, dash: '10 7' });
    p.push(T(lx, 468, 24, C.ink, label, { font: 'd', anchor: 'middle' }));
  }
  p.push(R(760, 520, 24, 24, C.grey));
  p.push(T(796, 541, 24, C.ink, 'reported within 45 days'));
  p.push(R(760, 560, 24, 24, C.acc));
  p.push(T(796, 581, 24, C.ink, 'reported more than 45 days'));
  p.push(T(796, 609, 24, C.ink, 'after the trade'));
  p.push(T(60, 1066, 21, C.muted, 'The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after it.', { maxW: 1080 }));
  return {
    slug: 'trading-while-disclosing',
    label: `How fast do they report: ${fmtCount(d.over45)} of ${fmtCount(d.total)} transactions (${pct1(d.share)}) were reported more than 45 days after the trade. Counts by days from trade to report: ${d.bins.map((b) => `${b.label} days ${fmtCount(b.count)}`).join('; ')}. Data retrieved ${d.retrieved}.`,
    prims: p,
  };
}

// ---------------------------------------------------------------- 4. the President's reports

const dayNum = (d: string) => Date.parse(`${d}T12:00:00Z`) / 86_400_000;
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const CLASS_COLOR: Record<string, string> = { stock: '#F3F0E8', bond: '#6FD6DE', fund: '#BBA6FF' };

export function presidentScene(d: PresidentGraphic): Scene {
  const n = d.reports.length;
  const p = frame({
    kicker: 'OGE Form 278-T', title: [`${n} reports.`, `${fmtCount(d.transactions)} transactions.`], retrieved: d.retrieved, slug: 'the-presidents-trades',
    source: 'Source: OGE Form 278-T reports, U.S. Office of Government Ethics, via SlushFund.net',
  });
  p.push(T(60, 304, 30, C.ink, 'President Trump: securities transactions', { maxW: 1080 }));
  p.push(T(60, 340, 24, C.muted, `Reports signed ${fmtDate(d.firstSigned)} to ${fmtDate(d.lastSigned)}. Block height = transactions in the report.`, { maxW: 1080 }));
  const showNotes = d.notesLoaded && d.feeNoteReports > 0;
  if (showNotes) {
    p.push(R(60, 372, 24, 24, C.acc));
    p.push(T(98, 392, 25, C.ink, `On ${d.feeNoteReports} of the ${n} reports, the reviewing official wrote in the comments box:`, { maxW: 1040 }));
    p.push(T(98, 428, 32, C.acc, '“Filer paid late fee(s).”', { font: 'd' }));
    p.push(T(60, 466, 22, C.muted, 'Every report also carries the agency ethics official’s signed opinion that the filer is in', { maxW: 1080 }));
    p.push(T(60, 494, 22, C.muted, 'compliance with applicable laws and regulations.', { maxW: 1080 }));
  }
  // Reports signed within a week of each other share one column (stacked), so blocks never overlap.
  const sorted = [...d.reports].sort((a, b) => a.signed.localeCompare(b.signed) || b.transactions - a.transactions);
  const groups: typeof sorted[] = [];
  for (const r of sorted) {
    const g = groups[groups.length - 1];
    if (g && dayNum(r.signed) - dayNum(g[g.length - 1].signed) <= 7) g.push(r);
    else groups.push([r]);
  }
  const first = dayNum(d.firstSigned);
  const last = dayNum(d.lastSigned);
  const X0 = 110;
  const X1 = 1090;
  const xOf = (day: number) => (last > first ? X0 + ((day - first) / (last - first)) * (X1 - X0) : (X0 + X1) / 2);
  const base = 894;
  const maxStack = Math.max(...groups.map((g) => g.reduce((s, r) => s + r.transactions, 0)), 1);
  const scale = 340 / maxStack;
  const bw = 50;
  for (const g of groups) {
    const cx = xOf(g.reduce((s, r) => s + dayNum(r.signed), 0) / g.length);
    let y = base;
    for (const r of [...g].sort((a, b) => b.transactions - a.transactions)) {
      const h = Math.max(2, r.transactions * scale);
      y -= h;
      const marked = showNotes && !!r.feeNote;
      p.push(R(cx - bw / 2, y, bw, h, marked ? C.acc : C.grey, { stroke: C.bg, sw: 1, title: `Report signed ${fmtDate(r.signed)}: ${fmtCount(r.transactions)} transactions${marked ? ', reviewing official’s note on the cover page' : ''}` }));
      if (h >= 26) p.push(T(cx, y + h / 2 + 5, 15, '#0B0B0B', fmtCount(r.transactions) ?? '', { font: 'd', anchor: 'middle' }));
      y -= 2;
    }
  }
  p.push(R(60, base, 1080, 2, C.line));
  const fd = new Date(first * 86_400_000);
  let m = new Date(Date.UTC(fd.getUTCFullYear(), fd.getUTCMonth() + 1, 1, 12));
  for (let i = 0; m.getTime() / 86_400_000 <= last; i++, m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1, 12))) {
    const tx = xOf(m.getTime() / 86_400_000);
    p.push(R(tx - 1, base, 2, 10, C.muted));
    if (i % 2 === 0) p.push(T(tx, base + 34, 20, C.muted, `${MON[m.getUTCMonth()]} ${String(m.getUTCFullYear()).slice(2)}`, { anchor: 'middle' }));
  }
  p.push(T(60, 962, 20, C.muted, 'ASSET CLASS, AS THE REPORTS LIST IT', { ls: 1 }));
  const total = d.classes.reduce((s, c) => s + c.count, 0) || 1;
  let cx = 60;
  d.classes.forEach((c, i) => {
    const w = i === d.classes.length - 1 ? 1140 - cx : (c.count / total) * 1080;
    p.push(R(cx, 974, Math.max(w, 0), 34, CLASS_COLOR[c.key], { stroke: C.bg, sw: 2 }));
    cx += w;
  });
  d.classes.forEach((c, i) => {
    const lx = [60, 440, 800][i];
    p.push(R(lx, 1030, 22, 22, CLASS_COLOR[c.key]));
    p.push(T(lx + 34, 1049, 24, C.ink, `${c.label} ${fmtCount(c.count)} · ${pct1(c.count / total)}`, { maxW: 320 }));
  });
  return {
    slug: 'the-presidents-trades',
    label: `${n} reports, ${fmtCount(d.transactions)} transactions: President Trump's securities transactions on OGE Form 278-T, reports signed ${d.firstSigned} to ${d.lastSigned}, shown as blocks sized by transaction count along a date axis.${showNotes ? ` On ${d.feeNoteReports} of the ${n} reports the reviewing official wrote in the comments box: “Filer paid late fee(s).” Every report also carries the agency ethics official's signed opinion that the filer is in compliance with applicable laws and regulations.` : ''} ${d.classes.map((c) => `${c.label} ${fmtCount(c.count)}`).join(', ')}. Data retrieved ${d.retrieved}.`,
    prims: p,
  };
}
