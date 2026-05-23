'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { fmt as fmtUtil } from '@/lib/utils';

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

const PHARMA_TICKERS = new Set([
  // Major pharmaceuticals
  'PFE', 'JNJ', 'ABBV', 'MRK', 'LLY', 'AMGN', 'BMY', 'AZN', 'GSK', 'NVO', 'ISRG', 'MDT', 'SYK', 'ZTS',
  // Biotech & life sciences
  'MRNA', 'GILD', 'BIIB', 'REGN', 'VRTX', 'CRSP', 'DTIL', 'BMY', 'ALXN', 'REGN', 'VRTX',
  // Health tech & services
  'UNH', 'CI', 'HUM', 'CNC', 'MOH', 'ELV', 'HQY',
  // Biotech ETFs
  'XBI', 'IBB', 'FHLC', 'VBIV', 'INO', 'CTXR', 'REGN', 'ABBV',
  // Major medtech
  'DXCM', 'TMO', 'DHR', 'ABT', 'ISRG', 'MDT', 'SYK',
]);

const PHARMA_NAMES: Record<string, string> = {
  PFE: 'Pfizer',
  MRNA: 'Moderna',
  JNJ: 'Johnson & Johnson',
  ABBV: 'AbbVie',
  UNH: 'UnitedHealth',
  MRK: 'Merck',
  LLY: 'Eli Lilly',
  AMGN: 'Amgen',
  GILD: 'Gilead',
  BIIB: 'Biogen',
  REGN: 'Regeneron',
  VRTX: 'Vertex',
  CRSP: 'CRISPR Therapeutics',
  DTIL: 'Intellia Therapeutics',
  BMY: 'Bristol-Myers Squibb',
  AZN: 'AstraZeneca',
  GSK: 'GSK',
  NVO: 'Novo Nordisk',
  ISRG: 'Intuitive Surgical',
  MDT: 'Medtronic',
  SYK: 'Stryker',
  ZTS: 'Zoetis',
  BILI: 'Bilibili',
};

const TX_COLORS: Record<string, string> = {
  BUY: '#10b981',
  SELL: '#ef4444',
  EXCHANGE: '#f97316',
  EXERCISE: '#eab308',
};

interface Trade {
  member_name: string;
  member_chamber: 'House' | 'Senate';
  member_party: string;
  member_state: string;
  ticker: string;
  company_name: string;
  transaction_type: 'BUY' | 'SELL' | 'EXCHANGE' | 'EXERCISE';
  amount_min: number | null;
  amount_max: number | null;
  transaction_date: string | null;
  source_system: string;
}

function parseAmount(amt: number | null): number {
  return amt ?? 0;
}

export default function PharmaStocksView() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/trades?limit=1000')
      .then((r) => r.json())
      .then((d) => {
        const all: Trade[] = d.trades ?? d.data ?? [];
        setTrades(all.filter((t) => PHARMA_TICKERS.has(t.ticker?.toUpperCase())));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build per-ticker counts
  const tickerCounts: Record<string, number> = {};
  const memberCounts: Record<string, number> = {};
  const chamberCounts = { House: 0, Senate: 0 };
  const txTypeCounts: Record<string, number> = {};

  trades.forEach((t) => {
    tickerCounts[t.ticker] = (tickerCounts[t.ticker] ?? 0) + 1;
    memberCounts[t.member_name] = (memberCounts[t.member_name] ?? 0) + 1;
    if (t.member_chamber) chamberCounts[t.member_chamber]++;
    txTypeCounts[t.transaction_type] = (txTypeCounts[t.transaction_type] ?? 0) + 1;
  });

  const topTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ticker, count]) => ({ ticker, count }));

  const topMembers = Object.entries(memberCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const txPie = Object.entries(txTypeCounts).map(([type, count]) => ({ name: type, value: count }));

  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: '#e2e8f0' },
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16 text-center text-sm text-slate-500">
        Loading pharma stock trades…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-10">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          Congress Pharma Stock Trades
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          Which congress members own pharmaceutical and healthcare stocks — tagged from the existing congress trading database.
          Showing {trades.length} pharma trades from 2024–2026.
        </p>
      </header>

      {/* Summary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <TrendingUp size={14} className="text-emerald-400" />
            <span>Pharma Trades</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{trades.length}</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <TrendingUp size={14} className="text-blue-400" />
            <span>Unique Ticklers</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">{Object.keys(tickerCounts).length}</div>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <TrendingUp size={14} className="text-purple-400" />
            <span>Congress Members</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">{Object.keys(memberCounts).length}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>Buy / Sell</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {txTypeCounts.BUY ?? 0} / {txTypeCounts.SELL ?? 0}
          </div>
        </div>
      </section>

      {/* Charts row */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Top tickers bar chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Most-Traded Pharma Stocks
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topTickers} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis dataKey="ticker" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} trades`, 'Count']} {...tooltipStyle} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tx type breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Transaction Types
          </h2>
          <div className="flex items-center justify-center h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={txPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {txPie.map((entry) => (
                    <Cell key={entry.name} fill={TX_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top members table */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Most Active Pharma Traders in Congress
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-center px-4 py-3">Chamber</th>
                <th className="text-center px-4 py-3">Party</th>
                <th className="text-right px-4 py-3">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {topMembers.map(({ name, count }) => {
                const trade = trades.find((t) => t.member_name === name);
                return (
                  <tr key={name} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{trade?.member_chamber ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {trade?.member_party && (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          trade.member_party === 'Democrat' ? 'text-blue-400 bg-blue-400/10' :
                          trade.member_party === 'Republican' ? 'text-red-400 bg-red-400/10' :
                          'text-purple-400 bg-purple-400/10'
                        }`}>
                          {trade.member_party}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-mono">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent trades feed */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Recent Pharma Trades
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-right px-4 py-3">Filed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {trades.slice(0, 25).map((t, i) => (
                <tr key={i} className="text-slate-300 hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{t.member_name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-amber-400">{t.ticker}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        color: TX_COLORS[t.transaction_type] ?? '#94a3b8',
                        background: `${TX_COLORS[t.transaction_type] ?? '#64748b'}20`,
                      }}
                    >
                      {t.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.company_name ?? PHARMA_NAMES[t.ticker] ?? t.ticker}</td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                    {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}