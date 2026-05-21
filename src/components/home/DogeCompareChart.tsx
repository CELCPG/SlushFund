'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

const DATA = [
  { name: 'Claimed by DOGE', value: 130, fill: '#64748b' },
  { name: 'Verified by auditors', value: 28, fill: '#10b981' },
  { name: 'Unverified gap', value: 102, fill: '#E63946' },
];

/** Code-built comparison chart: DOGE claimed vs. verified savings ($B). */
export default function DogeCompareChart() {
  return (
    <div className="w-full">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }}>
            <XAxis type="number" hide domain={[0, 145]} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: '#aaaabc', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={26}>
              {DATA.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => `$${v}B`}
                style={{ fill: '#e8e8f0', fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-slate-500 text-xs mt-1">
        DOGE counts projected future savings. We count what auditors confirmed actually happened.
      </p>
    </div>
  );
}
