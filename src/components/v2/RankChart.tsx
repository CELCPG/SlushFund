/**
 * D10 charts for the leaderboard: a ranked horizontal bar chart (top 25) and a monthly line. Drawn with HTML/SVG on the
 * server, each with the same numbers as a screen-reader table. One colour for every bar: party is a text label only.
 */

export function RankBars({ rows, label, unit }: { rows: { key: string; name: string; tag: string; value: number; display: string }[]; label: string; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Member</th><th scope="col">{unit}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><th scope="row">{r.name} ({r.tag})</th><td>{r.display}</td></tr>)}</tbody>
        </table>
      </div>
      <ol aria-hidden className="sf-rank space-y-1.5 max-md:space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="sf-rank-row grid grid-cols-[minmax(0,270px)_1fr] items-center gap-3 text-[13px] max-md:grid-cols-1 max-md:gap-1">
            <span className="min-w-0 md:truncate"><span className="mr-1 inline-block w-[3ch] text-right font-mono text-muted">{i + 1}.</span>{r.name} <span className="text-muted">({r.tag})</span></span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="sf-rank-bar h-4 min-w-[2px] shrink rounded-r-[4px] bg-trades" style={{ width: `${Math.max(1, (r.value / max) * 70)}%` }} />
              <span className="sf-rank-value whitespace-nowrap font-mono text-[12px]">{r.display}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function MonthLine({ points, label, lagFrom }: { points: { month: string; count: number }[]; label: string; lagFrom?: string }) {
  const W = 720;
  const H = 140;
  const X0 = 4;
  const top = 8;
  const base = H - 2;
  const max = Math.max(1, ...points.map((p) => p.count));
  const x = (i: number) => X0 + (i * (W - 2 * X0)) / Math.max(1, points.length - 1);
  const y = (n: number) => base - (n / max) * (base - top);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
  const lagIdx = lagFrom ? points.findIndex((p) => p.month >= lagFrom) : -1;
  const mon = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return (
    <>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Month of the trade date</th><th scope="col">Transactions</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.month}><th scope="row">{mon(p.month)}</th><td>{p.count}</td></tr>)}</tbody>
        </table>
      </div>
      {/* Tick text is HTML, not SVG <text>: the plot stretches to the card width, and stretched SVG text distorts. */}
      <div aria-hidden className="sf-chart relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[140px] w-full max-md:h-[120px]" preserveAspectRatio="none">
          {[0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={base - f * (base - top)} y2={base - f * (base - top)} className="sf-grid" stroke="currentColor" strokeOpacity="0.14" vectorEffect="non-scaling-stroke" />)}
          <line x1={0} x2={W} y1={base} y2={base} className="sf-axis" stroke="currentColor" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
          {lagIdx > 0 && <rect x={x(lagIdx)} y={top} width={W - X0 - x(lagIdx)} height={base - top} fill="#FFE066" opacity="0.35" />}
          <path className="sf-line" d={d} fill="none" stroke="#6534D9" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="sf-tick absolute left-0 top-0 -translate-y-1/2 bg-card pr-1.5 font-mono text-[11.5px] text-muted">{max.toLocaleString('en-US')}</span>
        <div className="relative mt-1.5 h-[16px]">
          {points.map((p, i) => {
            const last = i === points.length - 1;
            if (!(i % 3 === 0 || last)) return null;
            const edge = i === 0 ? { left: 0 } : last ? { right: 0 } : { left: `${(x(i) / W) * 100}%`, transform: 'translateX(-50%)' };
            return <span key={p.month} style={edge} className={`sf-tick absolute whitespace-nowrap font-mono text-[11.5px] leading-[16px] text-muted${i % 6 !== 0 && !last ? ' max-md:hidden' : ''}`}>{mon(p.month)}</span>;
          })}
        </div>
      </div>
    </>
  );
}
