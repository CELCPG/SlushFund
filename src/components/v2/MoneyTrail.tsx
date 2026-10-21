import Link from 'next/link';
import { Card, SectionHead } from '@/components/v2/PageBand';
import {
  CYCLE, FUNDING_COMING_SOON, FUNDING_NO_RECEIPTS, FUNDING_UNAVAILABLE, PARTS, SHARES_NOT_SHOWN, fundingNoRecord,
} from '@/components/v2/FundingPanel';
import type { CampaignMoneyResult } from '@/lib/v2/campaign-money';
import { fmtCount, fmtDate, fmtUsd, fmtUsdCompact } from '@/lib/v2/format';
import { notGradedLine } from '@/lib/v2/grade-method';
import { TRAIL_CAPTION, TRAIL_COUNTS_LINE, TRAIL_NO_TRADES, TRAIL_TITLE } from '@/lib/v2/money-trail-copy';
import type { SectorFlow, TrailTrades } from '@/lib/v2/money-trail';
import { SECTOR_HEATMAP_PATH } from '@/lib/v2/flags';

/**
 * D21 "Follow the money": money in (FEC receipts by the "Who funds them" categories) -> the member -> what the member's
 * disclosed trades touch (sectors, D18's map). The two sides meet at the member, never at each other. Ribbons on the left are
 * dollars (share of total receipts x the committee's reported total); ribbons on the right are transaction counts, never dollars.
 * Every instance prints TRAIL_CAPTION verbatim. The SVGs are drawn from the same numbers as the tables and lists beside them.
 */

export interface TrailMember {
  id: string;
  name: string;
  /** "Democrat \u00b7 Rep. for CA-12", neutral text. */
  detail: string;
  /** "Grade B" / "Not graded", or null while the grade is off or unavailable. */
  grade: string | null;
}

// ---------------------------------------------------------------- left side: money in

interface MoneyItem { key: string; label: string; color: string; pct: number | null; value: number | null }
export type MoneyIn =
  | { kind: 'flows'; raised: number; through: string; items: MoneyItem[] }
  | { kind: 'text'; text: string; warn: boolean };

/** The funding panel's own rules and wording, state by state. */
export function moneyIn(money: CampaignMoneyResult | null, name: string): MoneyIn {
  if (!money || money.state === 'missing') return { kind: 'text', text: FUNDING_COMING_SOON, warn: false };
  if (money.state === 'error') return { kind: 'text', text: FUNDING_UNAVAILABLE, warn: true };
  if (money.state === 'none') return { kind: 'text', text: fundingNoRecord(name), warn: false };
  const row = money.row;
  const raised = row.raised == null ? 0 : Number(row.raised);
  if (!(raised > 0)) return { kind: 'text', text: FUNDING_NO_RECEIPTS, warn: false };
  if (row.shares_ok !== true) return { kind: 'text', text: SHARES_NOT_SHOWN, warn: false };
  const items = PARTS.map((p) => {
    const pct = row[p.key] == null ? null : Number(row[p.key]);
    return { key: p.key, label: p.label, color: p.color, pct, value: pct == null ? null : (raised * pct) / 100 };
  });
  return { kind: 'flows', raised, through: fmtDate(row.coverage_end) ?? 'the latest report', items };
}

const pctText = (p: number) => `${p.toFixed(1)}%`;
const drawnLeft = (m: Extract<MoneyIn, { kind: 'flows' }>) => m.items.filter((i) => i.value != null && i.value > 0);

function moneyLine(i: MoneyItem): string {
  return i.pct == null || i.value == null ? 'unavailable' : `${fmtUsdCompact(i.value)} \u00b7 ${pctText(i.pct)}`;
}

// ---------------------------------------------------------------- right side: what the trades touch

export type TradesIn =
  | { kind: 'flows'; t: TrailTrades; unread: number }
  | { kind: 'text'; text: string; warn: boolean };

export function tradesIn(name: string, t: TrailTrades | null, unread: number): TradesIn {
  if (!t) return { kind: 'text', text: 'Unavailable right now: the trade database did not answer.', warn: true };
  if (t.counted === 0) {
    const parts = [`${TRAIL_NO_TRADES}.`];
    if (t.notCounted > 0) parts.push(`${fmtCount(t.notCounted)} other ${t.notCounted === 1 ? 'row' : 'rows'} (options, funds, bonds, exchanges or dates with a note) ${t.notCounted === 1 ? 'is' : 'are'} not counted here.`);
    if (unread > 0) parts.push(notGradedLine(name, unread).replace(/^Not graded: /, ''));
    return { kind: 'text', text: parts.join(' '), warn: false };
  }
  return { kind: 'flows', t, unread };
}

interface TradeNode { key: string; label: string; count: number; detail: string }

function tradeNodes(t: TrailTrades): TradeNode[] {
  const one = (s: SectorFlow, label = s.label): TradeNode => ({ key: s.key, label, count: s.count, detail: `${fmtCount(s.count)} ${s.count === 1 ? 'transaction' : 'transactions'}` });
  const out = t.sectors.map((s) => one(s));
  if (t.other) out.push(one(t.other, `Other sectors (${t.other.sectorCount})`));
  if (t.unclassified) out.push(one(t.unclassified));
  return out;
}

// ---------------------------------------------------------------- geometry

const W = 1000;
const LB0 = 250, LB1 = 262, C0 = 380, C1 = 620, RB0 = 738, RB1 = 750;
const GAP = 10;
const FLOW_H = 300;
const LINE = 16;

function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && `${cur} ${w}`.length > max) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

/** Start positions of consecutive blocks of the given sizes, `gap` apart. */
function stack(start: number, sizes: number[], gap: number): number[] {
  const out: number[] = [];
  let at = start;
  for (const s of sizes) { out.push(at); at += s + gap; }
  return out;
}

function heights(values: number[]): number[] {
  const total = values.reduce((n, v) => n + v, 0);
  const scale = total > 0 ? Math.max(0, FLOW_H - GAP * (values.length - 1)) / total : 0;
  return values.map((v) => Math.max(3, v * scale));
}

/** Label centers pushed apart so blocks of height h never overlap, kept inside [top, bottom]. */
function spread(items: { c: number; h: number }[], top: number, bottom: number): number[] {
  const ys = items.map((i) => i.c);
  let prev = top;
  for (let i = 0; i < items.length; i++) {
    ys[i] = Math.max(ys[i], prev + items[i].h / 2);
    prev = ys[i] + items[i].h / 2 + 6;
  }
  let next = bottom;
  for (let i = items.length - 1; i >= 0; i--) {
    ys[i] = Math.min(ys[i], next - items[i].h / 2);
    next = ys[i] - items[i].h / 2 - 6;
  }
  return ys;
}

const ribbon = (xa: number, ya: number, xb: number, yb: number, ha: number, hb: number) => {
  const xm = (xa + xb) / 2;
  return `M${xa},${ya} C${xm},${ya} ${xm},${yb} ${xb},${yb} L${xb},${yb + hb} C${xm},${yb + hb} ${xm},${ya + ha} ${xa},${ya + ha} Z`;
};
const vribbon = (xa: number, ya: number, xb: number, yb: number, wa: number, wb: number) => {
  const ym = (ya + yb) / 2;
  return `M${xa},${ya} C${xa},${ym} ${xb},${ym} ${xb},${yb} L${xb + wb},${yb} C${xb + wb},${ym} ${xa + wa},${ym} ${xa + wa},${ya} Z`;
};

const INK = 'var(--color-ink)';
const MUTED = 'var(--color-muted)';
const DEEP = 'var(--color-deep)';
const TRADES = 'var(--color-trades)';
/** A thin muted edge so dark ribbons (the PAC indigo) stay visible on the near-black T1 page. */
const OUTLINE = { stroke: MUTED, strokeOpacity: 0.5, strokeWidth: 0.75 } as const;

// ---------------------------------------------------------------- the wide graphic (lg and up)

function labelBlock(x: number, y: number, anchor: 'start' | 'end', lines: string[], value: string) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={INK}>
      {lines.map((l, i) => <tspan key={l + i} x={x} dy={i === 0 ? 0 : LINE} fontSize="13" fontWeight="700">{l}</tspan>)}
      <tspan x={x} dy={LINE} fontSize="12.5" fill={MUTED} className="font-mono">{value}</tspan>
    </text>
  );
}

function TextBlock({ x, anchor, lines, y, w, warn }: { x: number; anchor: 'start' | 'end'; lines: string[]; y: number; w: number; warn: boolean }) {
  const h = lines.length * LINE + 20;
  const rx = anchor === 'start' ? x - 8 : x - w + 8;
  return (
    <g>
      <rect x={rx} y={y - h / 2} width={w} height={h} rx="10" style={{ fill: warn ? 'var(--color-stale-tint)' : 'var(--color-neutral-tint)' }} />
      <text fill={warn ? 'var(--color-stale-ink)' : MUTED} fontSize="13">
        {lines.map((l, i) => <tspan key={l + i} x={rx + 12} y={y - h / 2 + 22 + i * LINE}>{l}</tspan>)}
      </text>
    </g>
  );
}

function Wide({ member, left, right, ariaLabel }: { member: TrailMember; left: MoneyIn; right: TradesIn; ariaLabel: string }) {
  const L = left.kind === 'flows' ? drawnLeft(left) : [];
  const R = right.kind === 'flows' ? tradeNodes(right.t) : [];
  const lh = heights(L.map((i) => i.value ?? 0));
  const rh = heights(R.map((n) => n.count));
  const colH = (hs: number[]) => hs.reduce((n, h) => n + h, 0) + GAP * Math.max(0, hs.length - 1);
  const lblL = L.map((i) => ({ lines: wrap(i.label, 30), value: moneyLine(i) }));
  const lblR = R.map((n) => ({ lines: wrap(n.label, 30), value: n.detail }));
  const needL = lblL.reduce((n, b) => n + (b.lines.length + 1) * LINE + 6, 0);
  const needR = lblR.reduce((n, b) => n + (b.lines.length + 1) * LINE + 6, 0);
  const H = Math.max(360, colH(lh) + 60, colH(rh) + 60, needL + 50, needR + 50);
  const cy = H / 2;
  const topOf = (hs: number[]) => cy - colH(hs) / 2;
  const sumL = lh.reduce((n, h) => n + h, 0);
  const sumR = rh.reduce((n, h) => n + h, 0);
  const cH = Math.max(150, sumL + 24, sumR + 24);
  const name = wrap(member.name, 20);
  const blockH = name.length * 24 + (member.grade ? 30 : 0);

  const lNodes = stack(topOf(lh), lh, GAP).map((y, k) => ({ y, h: lh[k] }));
  const rNodes = stack(topOf(rh), rh, GAP).map((y, k) => ({ y, h: rh[k] }));
  const lSlots = stack(cy - sumL / 2, lh, 0);
  const rSlots = stack(cy - sumR / 2, rh, 0);
  const lY = spread(lblL.map((b, i) => ({ c: lNodes[i].y + lNodes[i].h / 2, h: (b.lines.length + 1) * LINE })), 20, H - 20);
  const rY = spread(lblR.map((b, i) => ({ c: rNodes[i].y + rNodes[i].h / 2, h: (b.lines.length + 1) * LINE })), 20, H - 20);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block h-auto w-full max-lg:hidden" data-trail="wide" focusable="false">
      {/* left ribbons and bars */}
      {L.map((i, k) => (
        <g key={i.key}>
          <path d={ribbon(LB1, lNodes[k].y, C0, lSlots[k], lh[k], lh[k])} style={{ fill: i.color }} fillOpacity="0.5" {...OUTLINE} />
          <rect x={LB0} y={lNodes[k].y} width={LB1 - LB0} height={lh[k]} style={{ fill: i.color }} {...OUTLINE} />
          <path d={`M${LB0},${lNodes[k].y + lh[k] / 2} L${LB0 - 8},${lY[k]}`} stroke={MUTED} strokeWidth="1" fill="none" strokeOpacity="0.6" />
          {labelBlock(LB0 - 14, lY[k] - ((lblL[k].lines.length + 1) * LINE) / 2 + 11, 'end', lblL[k].lines, lblL[k].value)}
        </g>
      ))}
      {left.kind === 'text' && <TextBlock x={236} anchor="end" lines={wrap(left.text, 34)} y={cy} w={236} warn={left.warn} />}
      {/* right ribbons and bars */}
      {R.map((n, k) => (
        <g key={n.key}>
          <path d={ribbon(C1, rSlots[k], RB0, rNodes[k].y, rh[k], rh[k])} style={{ fill: TRADES }} fillOpacity="0.4" {...OUTLINE} />
          <rect x={RB0} y={rNodes[k].y} width={RB1 - RB0} height={rh[k]} style={{ fill: TRADES }} {...OUTLINE} />
          <path d={`M${RB1},${rNodes[k].y + rh[k] / 2} L${RB1 + 8},${rY[k]}`} stroke={MUTED} strokeWidth="1" fill="none" strokeOpacity="0.6" />
          {labelBlock(RB1 + 14, rY[k] - ((lblR[k].lines.length + 1) * LINE) / 2 + 11, 'start', lblR[k].lines, lblR[k].value)}
        </g>
      ))}
      {right.kind === 'text' && <TextBlock x={764} anchor="start" lines={wrap(right.text, 34)} y={cy} w={236} warn={right.warn} />}
      {/* the member */}
      <rect x={C0} y={cy - cH / 2} width={C1 - C0} height={cH} rx="12" style={{ fill: DEEP }} />
      <text x={(C0 + C1) / 2} textAnchor="middle" fill="#FFFFFF" fontWeight="800" fontSize="19">
        {name.map((l, i) => <tspan key={l + i} x={(C0 + C1) / 2} y={cy - blockH / 2 + 18 + i * 24}>{l}</tspan>)}
      </text>
      {member.grade && (
        <text x={(C0 + C1) / 2} y={cy - blockH / 2 + 18 + (name.length - 1) * 24 + 28} textAnchor="middle" fontSize="14" fontWeight="800" style={{ fill: 'var(--color-highlight)' }}>{member.grade}</text>
      )}
      <text x={(C0 + C1) / 2} y={cy + cH / 2 - 16} textAnchor="middle" fontSize="12.5" style={{ fill: 'var(--color-on-deep)' }}>{member.detail}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- the narrow graphic (below lg): ribbons only, text in lists

function Narrow({ member, left, right }: { member: TrailMember; left: MoneyIn; right: TradesIn | null }) {
  const L = left.kind === 'flows' ? drawnLeft(left) : [];
  const R = right && right.kind === 'flows' ? tradeNodes(right.t) : [];
  const NW = 360;
  const widths = (vals: number[]) => {
    const total = vals.reduce((n, v) => n + v, 0);
    const room = NW - 4 * Math.max(0, vals.length - 1);
    return vals.map((v) => (total > 0 ? Math.max(3, (v / total) * room) : 0));
  };
  const lw = widths(L.map((i) => i.value ?? 0));
  const rw = widths(R.map((n) => n.count));
  const sum = (ws: number[]) => ws.reduce((n, w) => n + w, 0);
  const lx = stack(0, lw, 4);
  const rx = stack(0, rw, 4);
  const ls = stack((NW - sum(lw)) / 2, lw, 0);
  const rs = stack((NW - sum(rw)) / 2, rw, 0);
  const top = L.length ? 8 : 0;
  const c0 = top + 64;
  const cH = 52;
  const H = c0 + cH + (R.length ? 64 + 8 : 0);
  return (
    <svg viewBox={`0 0 ${NW} ${H}`} aria-hidden="true" className="mx-auto block h-auto w-full max-w-[420px]" data-trail="narrow" focusable="false">
      {L.map((i, k) => (
        <g key={i.key}>
          <path d={vribbon(lx[k], top, ls[k], c0, lw[k], lw[k])} style={{ fill: i.color }} fillOpacity="0.5" {...OUTLINE} />
          <rect x={lx[k]} y={0} width={lw[k]} height={top} style={{ fill: i.color }} {...OUTLINE} />
        </g>
      ))}
      {R.map((n, k) => (
        <g key={n.key}>
          <path d={vribbon(rs[k], c0 + cH, rx[k], c0 + cH + 64, rw[k], rw[k])} style={{ fill: TRADES }} fillOpacity="0.4" {...OUTLINE} />
          <rect x={rx[k]} y={c0 + cH + 64} width={rw[k]} height={8} style={{ fill: TRADES, opacity: k % 2 ? 0.6 : 1 }} {...OUTLINE} />
        </g>
      ))}
      <rect x="0" y={c0} width={NW} height={cH} rx="10" style={{ fill: DEEP }} />
      <text x={NW / 2} y={c0 + 22} textAnchor="middle" fill="#FFFFFF" fontWeight="800" fontSize="15">{member.name.length > 30 ? `${member.name.slice(0, 29)}\u2026` : member.name}</text>
      <text x={NW / 2} y={c0 + 41} textAnchor="middle" fontSize="11.5" style={{ fill: 'var(--color-on-deep)' }}>{member.grade ? `${member.grade} \u00b7 ` : ''}{member.detail}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- text alternative

function ariaFor(member: TrailMember, left: MoneyIn, right: TradesIn | null): string {
  const parts = [`${TRAIL_TITLE}: ${member.name}.`];
  if (left.kind === 'flows') {
    parts.push(`Money in, ${CYCLE} receipts of ${fmtUsd(left.raised)} through ${left.through}: ${left.items.map((i) => `${i.label} ${moneyLine(i)}`).join('; ')}.`);
  } else parts.push(`Money in: ${left.text}`);
  if (right) {
    if (right.kind === 'flows') {
      parts.push(`Disclosed trades touch, ${fmtCount(right.t.counted)} stock purchases and sales: ${tradeNodes(right.t).map((n) => `${n.label} ${n.detail}`).join('; ')}.`);
    } else parts.push(`Disclosed trades: ${right.text}`);
  }
  return parts.join(' ');
}

function Numbers({ left, right }: { left: MoneyIn; right: TradesIn | null }) {
  const th = 'py-1.5 pr-4 text-left font-semibold';
  const td = 'py-1.5 pr-4 align-top';
  return (
    <details className="mt-4 rounded-2xl bg-page px-4 py-3 text-[13.5px]" data-trail="numbers">
      <summary className="cursor-pointer font-semibold text-trades-ink">The numbers behind this graphic</summary>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        {left.kind === 'flows' ? (
          <table className="w-full border-collapse">
            <caption className="pb-1 text-left font-semibold">Money in: {CYCLE} receipts, {fmtUsd(left.raised)} through {left.through}</caption>
            <thead><tr className="border-b border-line"><th scope="col" className={th}>Source category</th><th scope="col" className={th}>Share of receipts</th><th scope="col" className={th}>Dollars</th></tr></thead>
            <tbody>
              {left.items.map((i) => (
                <tr key={i.key} className="border-b border-line/60">
                  <th scope="row" className={`${td} text-left font-normal`}>{i.label}</th>
                  <td className={`${td} font-mono`}>{i.pct == null ? 'unavailable' : pctText(i.pct)}</td>
                  <td className={`${td} font-mono`}>{i.value == null ? 'unavailable' : fmtUsd(i.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p><b>Money in:</b> {left.text}</p>
        )}
        {right && right.kind === 'flows' ? (
          <table className="w-full border-collapse">
            <caption className="pb-1 text-left font-semibold">Disclosed trades by sector, {fmtDate(right.t.start)} to {fmtDate(right.t.end)}: {fmtCount(right.t.counted)} stock purchases and sales</caption>
            <thead><tr className="border-b border-line"><th scope="col" className={th}>Sector</th><th scope="col" className={th}>Purchases</th><th scope="col" className={th}>Sales</th><th scope="col" className={th}>Transactions</th></tr></thead>
            <tbody>
              {[...right.t.sectors, ...(right.t.other ? [right.t.other] : []), ...(right.t.unclassified ? [right.t.unclassified] : [])].map((s) => (
                <tr key={s.key} className="border-b border-line/60">
                  <th scope="row" className={`${td} text-left font-normal`}>{s.key === 'other-sectors' ? `Other sectors (${(s as { sectorCount?: number }).sectorCount})` : s.label}</th>
                  <td className={`${td} font-mono`}>{fmtCount(s.buys)}</td>
                  <td className={`${td} font-mono`}>{fmtCount(s.sells)}</td>
                  <td className={`${td} font-mono`}>{fmtCount(s.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : right ? (
          <p><b>Disclosed trades:</b> {right.text}</p>
        ) : null}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- lists for the narrow layout

const swatch = 'inline-block h-3 w-3 shrink-0 rounded-sm';

function MoneyList({ left }: { left: Extract<MoneyIn, { kind: 'flows' }> }) {
  return (
    <ul className="mt-2 space-y-1 text-[14px]">
      {left.items.map((i) => (
        <li key={i.key} className="flex items-baseline gap-2">
          <span aria-hidden className={swatch} style={{ background: i.color }} />
          <span className="min-w-0 flex-1">{i.label}</span>
          <b className="font-mono text-[13px]">{moneyLine(i)}</b>
        </li>
      ))}
    </ul>
  );
}

function TradeList({ right }: { right: Extract<TradesIn, { kind: 'flows' }> }) {
  return (
    <ul className="mt-2 space-y-1 text-[14px]">
      {tradeNodes(right.t).map((n) => (
        <li key={n.key} className="flex items-baseline gap-2">
          <span aria-hidden className={swatch} style={{ background: TRADES }} />
          <span className="min-w-0 flex-1">{n.label}</span>
          <b className="font-mono text-[13px]">{n.detail}</b>
        </li>
      ))}
    </ul>
  );
}

const tone = (warn: boolean) => `mt-2 rounded-2xl px-4 py-3 text-[14.5px] ${warn ? 'bg-stale-tint text-stale-ink' : 'bg-neutral-tint text-muted'}`;
const sub = 'text-[12px] font-bold uppercase tracking-[0.05em] text-muted';

function Notes({ left, right, heatmap }: { left: MoneyIn; right: TradesIn | null; heatmap: boolean }) {
  return (
    <div className="mt-4 space-y-2 text-[12.5px] text-muted">
      {left.kind === 'flows' && (
        <p>
          Left ribbons are dollars: each group&rsquo;s share of total receipts ({CYCLE}, through {left.through}) applied to the committee&rsquo;s reported total of {fmtUsd(left.raised)}.
          Shares are of total receipts and do not add to 100: loans, transfers and other receipts are in no group.
        </p>
      )}
      {right && (
        <p>
          {TRAIL_COUNTS_LINE}
          {right.kind === 'flows' && (
            <> Counted: individual-stock purchases and sales dated {fmtDate(right.t.start)} to {fmtDate(right.t.end)} as filed
              {right.t.notCounted > 0 ? `; ${fmtCount(right.t.notCounted)} other ${right.t.notCounted === 1 ? 'row' : 'rows'} (options, funds, bonds, exchanges, or dates with a note) ${right.t.notCounted === 1 ? 'is' : 'are'} not counted here`: ''}.
              {' '}Sectors come from the same map as {heatmap ? <Link href={SECTOR_HEATMAP_PATH} className="font-semibold text-trades-ink underline">What Congress is trading</Link> : 'What Congress is trading'}; a ticker the map does not hold, or a trade filed without a ticker, is Unclassified{right.t.unclassified ? ` (${fmtCount(right.t.unclassified.count)} here)` : ''}, never guessed.
              {right.unread > 0 && <> {fmtCount(right.unread)} scanned or paper {right.unread === 1 ? 'report' : 'reports'} from the last 24 months {right.unread === 1 ? 'is' : 'are'} not read yet, so these counts may be incomplete.</>}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Caption() {
  return <p className="mt-3 text-[14px] font-semibold text-ink" data-trail="caption">{TRAIL_CAPTION}</p>;
}

// ---------------------------------------------------------------- member page

export default function MoneyTrail({
  member, money, trades, unread, heatmap,
}: { member: TrailMember; money: CampaignMoneyResult | null; trades: TrailTrades | null; unread: number; heatmap: boolean }) {
  const left = moneyIn(money, member.name);
  const right = tradesIn(member.name, trades, unread);
  return (
    <section className="pt-8" aria-labelledby="p-trail" data-section="money-trail">
      <Card>
        <SectionHead
          as="h2"
          title={<span id="p-trail" className="text-[24px] max-md:text-[22px]">{TRAIL_TITLE}</span>}
          sub="Campaign receipts on the left, disclosed stock trades on the right, with the member in the middle."
        />
        <Wide member={member} left={left} right={right} ariaLabel={ariaFor(member, left, right)} />
        <div className="lg:hidden">
          <p className={sub}>Money in</p>
          {left.kind === 'flows' ? <MoneyList left={left} /> : <p className={tone(left.warn)}>{left.text}</p>}
          <div className="my-4"><Narrow member={member} left={left} right={right} /></div>
          <p className={sub}>Disclosed trades by sector</p>
          {right.kind === 'flows' ? <TradeList right={right} /> : <p className={tone(right.warn)}>{right.text}</p>}
        </div>
        <Numbers left={left} right={right} />
        <Notes left={left} right={right} heatmap={heatmap} />
        <Caption />
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------- voter-page card: money in only

export function MoneyTrailCompact({ member, money }: { member: TrailMember; money: CampaignMoneyResult }) {
  const left = moneyIn(money, member.name);
  const hid = `mt-${member.id}`;
  return (
    <section className="mt-3 min-w-0 rounded-2xl bg-page px-4 py-3" aria-labelledby={hid} data-section="money-trail-compact">
      <h4 id={hid} className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted">{TRAIL_TITLE}: money in</h4>
      {left.kind === 'flows' ? (
        <>
          <MoneyList left={left} />
          <div className="my-3"><Narrow member={member} left={left} right={null} /></div>
          <Numbers left={left} right={null} />
          <Notes left={left} right={null} heatmap={false} />
        </>
      ) : (
        <p className={tone(left.warn)}>{left.text}</p>
      )}
      <p className="mt-2 text-[14px]">
        <Link href={`/people/${member.id}#p-trail`} className="font-semibold text-trades-ink hover:underline">See the full graphic with {member.name}&rsquo;s disclosed trades</Link>
      </p>
      <Caption />
    </section>
  );
}
