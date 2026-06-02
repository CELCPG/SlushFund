'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PAC_CATEGORY_TOTALS } from '@/lib/pac-data';
import { fmtM } from './format';

// ─── Category Breakdown Chart ─────────────────────────────────────────────────
// Vertical bar chart of PAC spending by category 2016-2024.
export default function CategoryChart() {
  const data = PAC_CATEGORY_TOTALS.map((c) => ({
    name: c.category,
    value: c.amount,
    color: c.color,
    pct: c.pct,
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">PAC Spending by Category, 2016-2024</h3>
      <p className="text-slate-500 text-xs mb-4">Total tracked: $9.5B across all PACs and super PACs 2016–2024 cycle</p>
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 70, top: 5, bottom: 5 }} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtM} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            width={200}
            interval={0}
          />
          <Tooltip
            formatter={(v) => [fmtM(Number(v)), 'Total Raised']}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            cursor={{ fill: '#1e293b', fillOpacity: 0.4 }}
          />
          <Bar dataKey="value" name="Dollars" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
