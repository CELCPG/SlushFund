import Link from 'next/link';
import { cn } from '@/lib/cn';
import { fmtCount } from '@/lib/v2/format';
import type { SectorCell } from '@/lib/v2/sector-agg';

/**
 * D18 sector heatmap. A grid of links (Tab moves cell to cell; Enter opens the sector's drill-down). Color is the accent
 * mixed into the card color, with the number and a text label on every cell, so color is never the only signal. Party is
 * not a color here. Two measures: total transactions (purchases + sales) and net (purchases minus sales).
 * The Unclassified cell is not a sector: it stays neutral and is left out of the color scale.
 */

export type Measure = 'total' | 'net';

const accent = 'var(--sf-accent, var(--color-trades))';
const cool = 'var(--color-trades-ink, #4C22B0)';

function tone(cell: SectorCell, measure: Measure, max: number): { background: string } {
  const v = measure === 'total' ? cell.total : Math.abs(cell.net);
  const pct = max > 0 ? Math.round((v / max) * 34) : 0; // at most 34% color keeps the ink text above 4.5:1
  const hue = measure === 'net' && cell.net < 0 ? cool : accent;
  return { background: `color-mix(in srgb, ${hue} ${pct}%, var(--color-card))` };
}

export function heatmapLabel(cell: SectorCell, measure: Measure): string {
  const split = `${fmtCount(cell.buys)} purchases, ${fmtCount(cell.sells)} sales`;
  if (measure === 'total') return `${cell.label}: ${fmtCount(cell.total)} transactions (${split})`;
  const dir = cell.net === 0 ? 'purchases equal sales' : cell.net > 0 ? `${fmtCount(cell.net)} more purchases than sales` : `${fmtCount(-cell.net)} more sales than purchases`;
  return `${cell.label}: ${dir} (${split})`;
}

function Tile({ c, measure, max, neutral, selected, href }: { c: SectorCell; measure: Measure; max: number; neutral?: boolean; selected: boolean; href: string }) {
  const big = measure === 'total' ? fmtCount(c.total)! : `${c.net > 0 ? '+' : c.net < 0 ? '\u2212' : ''}${fmtCount(Math.abs(c.net))}`;
  const sub = measure === 'total' ? 'transactions' : c.net > 0 ? 'more purchases than sales' : c.net < 0 ? 'more sales than purchases' : 'purchases equal sales';
  const share = c.total ? Math.round((c.buys / c.total) * 100) : 0;
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={heatmapLabel(c, measure)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block h-full min-h-[118px] rounded-lg border p-3 text-ink no-underline hover:border-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-accent,var(--color-trades))]',
        neutral ? 'border-dashed border-line' : 'border-line',
        selected && 'border-[3px] border-solid border-ink',
      )}
      style={neutral ? { background: 'var(--color-card)' } : tone(c, measure, max)}
    >
      <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.04em]">{c.label}</span>
      <span className="mt-1 block font-display text-[34px] font-extrabold leading-none tracking-[-0.5px] max-md:text-[28px]">{big}</span>
      <span className="mt-0.5 block text-[12px]">{sub}</span>
      <span className="mt-2 block h-1.5 w-full bg-[color:var(--color-line)]" aria-hidden>
        <span className="block h-full bg-ink" style={{ width: `${share}%` }} />
      </span>
      <span className="mt-1 block font-mono text-[11.5px]">{fmtCount(c.buys)} purchases &middot; {fmtCount(c.sells)} sales</span>
    </Link>
  );
}

export default function SectorHeatmap({ cells, unclassified, measure, selected, hrefFor }: { cells: SectorCell[]; unclassified: SectorCell; measure: Measure; selected: string; hrefFor: (key: string) => string }) {
  const max = Math.max(1, ...cells.map((c) => (measure === 'total' ? c.total : Math.abs(c.net))));
  return (
    <ul className="sf-heat m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2 p-0 max-md:grid-cols-2">
      {cells.map((c) => (
        <li key={c.key} className="min-w-0"><Tile c={c} measure={measure} max={max} selected={selected === c.key} href={hrefFor(c.key)} /></li>
      ))}
      <li className="min-w-0"><Tile c={unclassified} measure={measure} max={max} neutral selected={selected === unclassified.key} href={hrefFor(unclassified.key)} /></li>
    </ul>
  );
}
