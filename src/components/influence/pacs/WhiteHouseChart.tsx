'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WHITE_HOUSE_DONATIONS_2016_2024 } from '@/lib/pac-data';
import { fmtM } from './format';

// ─── White House Spending History ───────────────────────────────────────────────
// Total spending into major-party nominees per cycle (2016-2024). Uses
// dem_nominee field so the chart works regardless of who the Dem candidate
// was — Clinton 2016, Biden 2020, Harris 2024.
export default function WhiteHouseChart() {
  // Each row gets a "Dem" key (for the bar) plus a separate label field for
  // the tooltip + bottom grid so we can show "Harris" not "Dem".
  const data = WHITE_HOUSE_DONATIONS_2016_2024.map((w) => ({
    cycle: w.cycle,
    dem_nominee: w.dem_nominee,
    Trump: w.trump,
    Dem: w.dem,
  }));

  const demColor = '#3b82f6';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">
        White House Spending by Cycle (PAC + Dark Money)
      </h3>
      <p className="text-slate-500 text-xs mb-4">
        Total spending into major-party nominees via PACs, super PACs, joint
        fundraising, dark money 2016–2024
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="cycle" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            width={70}
          />
          <Tooltip
            formatter={(v, n) => [fmtM(Number(v)), String(n)]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return String(label);
              return `${row.cycle} · Trump vs ${row.dem_nominee}`;
            }}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            formatter={(value: string) => {
              if (value === 'Dem') return <span style={{ color: '#cbd5e1' }}>Democratic nominee</span>;
              if (value === 'Trump') return <span style={{ color: '#cbd5e1' }}>Republican nominee</span>;
              return <span style={{ color: '#cbd5e1' }}>{value}</span>;
            }}
          />
          <Bar dataKey="Trump" fill="#ef4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Dem" fill={demColor} radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {data.map((d) => (
          <div
            key={d.cycle}
            className="bg-slate-800/50 rounded-lg px-3 py-2 text-center"
          >
            <div className="text-slate-400 text-xs mb-1">
              {d.cycle} · Trump vs {d.dem_nominee}
            </div>
            <div className="text-red-400 font-black font-mono text-sm">
              R · {fmtM(d.Trump)}
            </div>
            <div className="text-blue-400 font-mono text-xs">
              D · {fmtM(d.Dem)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
