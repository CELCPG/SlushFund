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
      <ol aria-hidden className="sf-rank space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,190px)_1fr] items-center gap-3 text-[13px] max-md:grid-cols-[minmax(0,120px)_1fr]">
            <span className="truncate"><span className="font-mono text-muted">{i + 1}.</span> {r.name} <span className="text-muted">({r.tag})</span></span>
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
  const H = 160;
  const P = 28;
  const max = Math.max(1, ...points.map((p) => p.count));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (n: number) => H - P - (n / max) * (H - 2 * P);
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
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="currentColor" strokeOpacity="0.3" />
        <text x={P} y={14} fontSize="11" fill="currentColor" opacity="0.7">{max.toLocaleString('en-US')}</text>
        {lagIdx > 0 && <rect x={x(lagIdx)} y={P / 2} width={W - P - x(lagIdx)} height={H - P - P / 2} fill="#FFE066" opacity="0.35" />}
        <path className="sf-line" d={d} fill="none" stroke="#6534D9" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (i % 3 === 0 || i === points.length - 1 ? <text key={p.month} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.7">{mon(p.month)}</text> : null))}
      </svg>
    </>
  );
}
