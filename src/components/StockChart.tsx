'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StockData {
  ticker: string;
  currentPrice: number;
  data: { date: string; price: number; volume: number }[];
}

export default function StockChart({ ticker }: { ticker: string }) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/stock/${ticker}?range=3mo`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [ticker]);

  if (loading) return <div className="h-48 bg-slate-800/50 animate-pulse rounded-lg" />;
  if (error || !data || !data.data.length) return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No stock data available</div>;

  const startPrice = data.data[0]?.price ?? 0;
  const endPrice = data.currentPrice ?? data.data[data.data.length - 1]?.price ?? 0;
  const pctChange = startPrice ? ((endPrice - startPrice) / startPrice * 100).toFixed(1) : '0';
  const isUp = endPrice >= startPrice;
  const color = isUp ? '#22c55e' : '#ef4444';
  const gradId = `stockGrad${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-white font-bold">{ticker}</span>
        <div className="text-right">
          <span className="text-white font-mono font-bold">${endPrice.toFixed(2)}</span>
          <span className={`ml-2 text-xs font-mono font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{pctChange}%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data.data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} hide />
          <YAxis tick={{ fill: '#64748b', fontSize: 9 }} hide domain={['auto', 'auto']} />
          <Tooltip
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
            labelStyle={{ color: '#94a3b8', fontSize: 10 }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}