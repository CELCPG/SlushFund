'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface TimelineChartProps {
  data: Record<string, number> | undefined;
  /** Pre-COVID baseline average in dollars, drawn as a reference line. */
  preCovidAverage?: number;
}

// Quarter label like "Q1 FY2020" → chronological sort key {year, q}
function quarterSortKey(label: string): { year: number; q: number } | null {
  const m = label.match(/^Q([1-4])\s+FY(\d{4})$/i);
  if (!m) return null;
  return { q: parseInt(m[1], 10), year: parseInt(m[2], 10) };
}

// Build a chart-friendly array, sorted chronologically and limited to the
// COVID-response window so the user sees the spike, not 15 years of noise.
function buildSeries(
  data: Record<string, number>,
  startYear: number,
  endYear: number
): { label: string; value: number; highlight: boolean }[] {
  const rows: { label: string; value: number; year: number; q: number }[] = [];
  for (const [label, value] of Object.entries(data)) {
    const key = quarterSortKey(label);
    if (!key) continue;
    if (key.year < startYear || key.year > endYear) continue;
    rows.push({ label, value, year: key.year, q: key.q });
  }
  rows.sort((a, b) => (a.year - b.year) || (a.q - b.q));

  // Highlight the three biggest COVID quarters (Q2/Q3 FY2020 + Q1 FY2020).
  const topValues = [...rows].sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.value);
  const topSet = new Set(topValues);

  return rows.map((r) => ({ label: r.label, value: r.value, highlight: topSet.has(r.value) }));
}

function formatB(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

interface TooltipPayloadItem {
  payload: { label: string; value: number; highlight: boolean };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 shadow-lg">
      <div className="text-xs font-mono text-slate-400 mb-1">{p.label}</div>
      <div className="text-white font-bold font-mono">{formatB(p.value)}</div>
      {p.highlight && (
        <div className="text-[10px] uppercase tracking-wider text-amber-400 mt-1">
          Peak COVID quarter
        </div>
      )}
    </div>
  );
}

export default function TimelineChart({ data, preCovidAverage }: TimelineChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-slate-400 text-sm py-8 text-center border border-slate-800 rounded-lg">
        Quarterly data will appear after FY2020–2021 data is backfilled.
      </div>
    );
  }

  // Default to the COVID-response window (FY2020 through FY2022).
  const series = buildSeries(data, 2020, 2022);

  if (series.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-8 text-center border border-slate-800 rounded-lg">
        No quarterly obligations recorded for FY2020–FY2022.
      </div>
    );
  }

  const peak = series.reduce((max, r) => (r.value > max.value ? r : max), series[0]);
  const total = series.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500">
            FY2020 – FY2022 · quarterly obligations
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {formatB(total)}
          </div>
        </div>
        <div className="text-xs text-slate-400 text-right">
          Peak quarter:{' '}
          <span className="text-amber-400 font-mono font-bold">
            {peak.label} · {formatB(peak.value)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsBarChart data={series} margin={{ top: 32, right: 24, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              tickFormatter={(v) => formatB(v)}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(245, 158, 11, 0.06)' }}
            />
            {preCovidAverage !== undefined && preCovidAverage > 0 && (
              <ReferenceLine
                y={preCovidAverage}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{
                  value: `Pre-COVID baseline: ${formatB(preCovidAverage)}`,
                  position: 'top',
                  fill: '#cbd5e1',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {series.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.highlight ? '#f59e0b' : '#b45309'}
                  fillOpacity={entry.highlight ? 0.95 : 0.6}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-amber-400 rounded-sm" />
          <span>Peak COVID quarter</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-amber-700/60 rounded-sm" />
          <span>Other FY20–FY22 quarter</span>
        </div>
        {preCovidAverage !== undefined && preCovidAverage > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-slate-500" />
            <span>FY2018–FY2019 quarterly baseline</span>
          </div>
        )}
      </div>
    </div>
  );
}
