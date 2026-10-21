/**
 * D18 chart: purchases and sales per month, two lines in the same server-drawn SVG style as MonthLine (RankChart.tsx).
 * Purchases are a solid line, sales a dashed one, so the two never depend on colour; the same numbers sit in a
 * screen-reader table. Counts of transactions, not money.
 */

export default function BuySellMonths({ points, label, lagFrom }: { points: { month: string; buys: number; sells: number }[]; label: string; lagFrom?: string }) {
  const W = 720;
  const H = 180;
  const P = 28;
  const max = Math.max(1, ...points.map((p) => Math.max(p.buys, p.sells)));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (n: number) => H - P - (n / max) * (H - 2 * P);
  const path = (pick: (p: (typeof points)[number]) => number) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  const lagIdx = lagFrom ? points.findIndex((p) => p.month >= lagFrom) : -1;
  const mon = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const step = points.length > 13 ? 3 : 1;
  return (
    <>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Month of the trade date</th><th scope="col">Purchases</th><th scope="col">Sales</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.month}><th scope="row">{mon(p.month)}</th><td>{p.buys}</td><td>{p.sells}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" aria-hidden>
        <span className="inline-flex items-center gap-2"><svg width="30" height="8" aria-hidden><line x1="0" x2="30" y1="4" y2="4" stroke="var(--sf-bar, #6534D9)" strokeWidth="4" /></svg>Purchases</span>
        <span className="inline-flex items-center gap-2"><svg width="30" height="8" aria-hidden><line x1="0" x2="30" y1="4" y2="4" stroke="var(--color-ink, #14142B)" strokeWidth="4" strokeDasharray="6 4" /></svg>Sales</span>
      </div>
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="currentColor" strokeOpacity="0.3" />
        <text x={P} y={14} fontSize="11" fill="currentColor" opacity="0.7">{max.toLocaleString('en-US')}</text>
        {lagIdx > 0 && <rect x={x(lagIdx)} y={P / 2} width={W - P - x(lagIdx)} height={H - P - P / 2} fill="#FFE066" opacity="0.35" />}
        <path d={path((p) => p.sells)} fill="none" stroke="var(--color-ink, #14142B)" strokeWidth="3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />
        <path className="sf-line" d={path((p) => p.buys)} fill="none" stroke="#6534D9" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (i % step === 0 || i === points.length - 1 ? <text key={p.month} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.7">{mon(p.month)}</text> : null))}
      </svg>
    </>
  );
}
