import type { ReactNode } from 'react';

/**
 * D19 charts for /analytics. Drawn on the server with HTML and SVG (no chart library, no client script), so every
 * mark is in the page source. Each chart ships its numbers twice: every mark has an aria-label and a tooltip, and a
 * "Show the numbers" table under the chart carries the same values (keyboard and screen-reader path). Series are told
 * apart by line style and a direct label, never by colour alone; no party colours.
 */

export interface TableCol { key: string; header: string }

/** The text equivalent: a real table in a disclosure, scrolling inside its own box on phones. */
export function NumbersTable({ caption, cols, rows }: { caption: string; cols: TableCol[]; rows: Record<string, ReactNode>[] }) {
  return (
    <details className="sf-numbers mt-4 text-[14px]">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-semibold underline underline-offset-2">Show the numbers</summary>
      <div className="mt-2 max-h-[360px] overflow-auto" tabIndex={0} role="region" aria-label={`${caption} (table)`}>
        <table className="w-full min-w-[260px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.key} scope="col" className={`sticky top-0 bg-card px-2 py-1.5 text-[12px] uppercase tracking-[0.04em] text-muted ${i ? 'text-right' : ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => (
              <tr key={n} className="border-t border-line">
                {cols.map((c, i) => (i === 0
                  ? <th key={c.key} scope="row" className="px-2 py-1.5 font-semibold">{r[c.key]}</th>
                  : <td key={c.key} className="px-2 py-1.5 text-right font-mono">{r[c.key]}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface LineSeries { name: string; values: number[]; dashed?: boolean }

/** Two or more series over the same x labels. One focusable column per x value reads out every series. */
export function MultiLine({ labels, series, unit, summary }: { labels: string[]; series: LineSeries[]; unit: string; summary: string }) {
  const W = 720;
  const H = 200;
  const PAD = 6;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const colW = (W - 2 * PAD) / Math.max(1, n - 1);
  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] font-semibold">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <svg aria-hidden width="30" height="10" viewBox="0 0 30 10"><line x1="0" x2="30" y1="5" y2="5" strokeWidth="4" stroke={s.dashed ? 'currentColor' : 'var(--sf-bar, #6534D9)'} strokeDasharray={s.dashed ? '6 4' : undefined} /></svg>
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <span aria-hidden className="absolute left-0 top-0 font-mono text-[12px] text-muted">{max.toLocaleString('en-US')} {unit}</span>
        <svg role="group" aria-label={summary} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-5 h-[200px] w-full overflow-visible max-md:h-[160px]">
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
          <line x1={PAD} x2={W - PAD} y1={PAD} y2={PAD} stroke="currentColor" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" />
          {series.map((s) => (
            <path
              key={s.name}
              d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.dashed ? 'currentColor' : 'var(--sf-bar, #6534D9)'}
              strokeWidth="3"
              strokeDasharray={s.dashed ? '8 5' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {labels.map((l, i) => {
            const text = `${l}: ${series.map((s) => `${s.name} ${s.values[i].toLocaleString('en-US')}`).join(', ')} ${unit}`;
            return (
              <rect key={l} className="sf-hit" tabIndex={0} role="img" aria-label={text} x={x(i) - colW / 2} y={0} width={colW} height={H} fill="transparent">
                <title>{text}</title>
              </rect>
            );
          })}
        </svg>
        <div aria-hidden className="mt-1 flex justify-between font-mono text-[12px] text-muted">
          <span>{labels[0]}</span>
          <span className="max-sm:hidden">{labels[Math.floor((n - 1) / 2)]}</span>
          <span>{labels[n - 1]}</span>
        </div>
      </div>
    </figure>
  );
}

export interface Bar { label: string; value: number; display: string; aria: string }

/** Vertical bars with the value printed over each bar and the label under it. Every bar is one tab stop. */
export function BarColumns({ bars, summary, unit, minColWidth = 56 }: { bars: Bar[]; summary: string; unit: string; minColWidth?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const H = 150;
  return (
    <figure className="m-0">
      <div role="group" aria-label={summary} className="flex items-end gap-1.5 max-md:gap-1" style={{ minHeight: H + 44 }}>
        {bars.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ minWidth: 0 }}>
            <span aria-hidden className="mb-1 font-mono text-[12px] leading-[14px] max-md:text-[10.5px]">{b.display}</span>
            <div
              tabIndex={0}
              role="img"
              aria-label={b.aria}
              title={b.aria}
              className="sf-hit-bar w-full max-w-[72px] rounded-t-[3px]"
              style={{ height: Math.max(b.value > 0 ? 3 : 1, Math.round((b.value / max) * H)), background: b.value > 0 ? 'var(--sf-bar, #6534D9)' : 'currentColor', opacity: b.value > 0 ? 1 : 0.3, minWidth: Math.min(minColWidth, 12) }}
            />
            <span aria-hidden className="mt-1.5 text-center font-mono text-[11.5px] leading-tight text-muted max-md:text-[10px]">{b.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-[12.5px] text-muted">{unit}</figcaption>
    </figure>
  );
}
