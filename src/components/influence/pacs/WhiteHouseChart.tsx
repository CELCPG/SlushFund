'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WHITE_HOUSE_DONATIONS_2016_2024 } from '@/lib/pac-data';
import { fmtM } from './format';

// ─── White House Spending History ───────────────────────────────────────────────
// Stacked bar chart of money flowing into major-party nominees 2016-2024.
export default function WhiteHouseChart() {
  const data = WHITE_HOUSE_DONATIONS_2016_2024.map((w) => ({
    cycle: w.cycle,
    Trump: w.trump,
    Clinton: w.clinton,
    Biden: w.biden,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">White House Spending by Cycle (PAC + Dark Money)</h3>
      <p className="text-slate-500 text-xs mb-4">Total spending into major party nominees via PACs, super PACs, joint fundraising, dark money 2016–2024</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="cycle" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tickFormatter={fmtM} tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
          <Tooltip
            formatter={(v, n) => [fmtM(Number(v)), String(n)]}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Bar dataKey="Trump" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Clinton" stackId="b" fill="#3b82f6" />
          <Bar dataKey="Biden" stackId="b" fill="#06b6d4" />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {data.map((d) => (
          <div key={d.cycle} className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
            <div className="text-slate-400 text-xs mb-1">{d.cycle}</div>
            <div className="text-red-400 font-black font-mono text-sm">{fmtM(d.Trump)}</div>
            <div className="text-blue-400 font-mono text-xs">{fmtM((d.Clinton ?? 0) + (d.Biden ?? 0))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
