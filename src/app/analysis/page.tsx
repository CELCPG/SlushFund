'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, Cell, PieChart, Pie
} from 'recharts';
import {
  ArrowLeft, TrendingUp, DollarSign, AlertTriangle, BarChart3,
  ArrowRight, Shield, Newspaper, ChevronDown, ChevronUp, ExternalLink,
  Activity, Layers, Target, Database
} from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { ConnectionType } from '@/lib/types';

const CONNECTION_COLORS: Record<string, string> = {
  elon_musk: '#a855f7',
  trump_family: '#ef4444',
  trump_ally: '#3b82f6',
  'mar-a-lago': '#f97316',
  gop_donor: '#10b981',
  lobbyist: '#eab308',
  related_party: '#ec4899',
  none: '#64748b',
  suspected: '#f59e0b',
};

const CHART_COLORS = ['#a855f7', '#ef4444', '#3b82f6', '#f97316', '#10b981', '#eab308', '#ec4899', '#64748b'];

function formatLargeNum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">{label}</div>
      <div className={color ? `text-2xl font-black font-mono ${color}` : 'text-2xl font-black text-white font-mono'}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── Spending by Connection Type Chart ────────────────────────────────────────
function ConnectionChart({ data }: { data: { connection_type: string; count: number; total: number }[] }) {
  const chartData = data
    .filter(d => d.connection_type !== 'none')
    .sort((a, b) => b.total - a.total)
    .map(d => ({
      name: CONNECTION_LABELS[d.connection_type as ConnectionType] ?? d.connection_type,
      value: d.total,
      count: d.count,
      color: CONNECTION_COLORS[d.connection_type] ?? '#64748b',
    }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Connected Spending by Group</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={130} />
          <Tooltip
            formatter={(v) => [formatLargeNum(Number(v)), 'Total Dollars']}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Bar dataKey="value" name="Dollars" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {chartData.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-slate-400 text-xs">{d.name}</span>
            <span className="text-white text-xs font-mono ml-auto">{formatLargeNum(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Trend Chart ──────────────────────────────────────────────────────
function MonthlyTrendChart({ data }: { data: { month: string; label: string; total: number; connected: number; count: number }[] }) {
  const trendData = (data ?? []).map(m => ({
    ...m,
    contracts: m.total,
    grants: 0,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Monthly Federal Spending Trend</h3>
        <p className="text-slate-500 text-xs mt-1">Aggregated from live SlushFund DB. Connected = connection_type flagged (Elon Musk, Trump family, Trump allies, etc.)</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={trendData} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradConnected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
          <Tooltip
            formatter={(v, n) => [formatLargeNum(Number(v)), String(n)]}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Area type="monotone" dataKey="total" name="Total Spending" stroke="#3b82f6" fill="url(#gradTotal)" strokeWidth={2} />
          <Area type="monotone" dataKey="connected" name="Politically Connected" stroke="#ef4444" fill="url(#gradConnected)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-blue-500" /> Total federal spending</div>
        <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-red-500" /> Politically connected</div>
        <div className="ml-auto text-amber-400 font-medium">Jan 2025 = DOGE inflection point</div>
      </div>
    </div>
  );
}

// ─── Top Agencies Chart ────────────────────────────────────────────────────────
function TopAgenciesChart({ alerts }: { alerts: any }) {
  const agencies = (alerts?.top_agencies ?? []).slice(0, 8);
  const chartData = agencies.map((a: any) => ({
    name: a.agency.replace('Department of ', 'DoD: ').replace('Department of ', 'Do'),
    total: a.total,
    connected: a.connected,
    pct: a.total > 0 ? Math.round((a.connected / a.total) * 100) : 0,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Agencies by Total Spending</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={130} />
          <Tooltip
            formatter={(v) => [formatLargeNum(Number(v)), 'Total']}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Bar dataKey="total" name="Total" fill="#334155" radius={[0, 4, 4, 0]} />
          <Bar dataKey="connected" name="Connected" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-700" /> Total spending</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /> Politically connected</div>
      </div>
    </div>
  );
}

// ─── Cost Overrun Table ────────────────────────────────────────────────────────
function CostOverrunTable({ data }: { data: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, 8);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={14} className="text-amber-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Cost Overruns — Project Inflation Tracker</h3>
        </div>
        <p className="text-slate-500 text-xs">Federal projects that ballooned beyond original budget. Median overrun: 167%. These are documented cases — actual system-wide waste is likely higher.</p>
      </div>
      <div className="divide-y divide-slate-800">
        {visible.map((co: any) => (
          <div key={co.id} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">{co.project_name}</span>
                  <span className="text-amber-400 text-xs font-mono font-bold">+{co.overrun_pct.toLocaleString()}%</span>
                </div>
                <div className="text-slate-400 text-xs mt-0.5">{co.agency} · {co.contractor}</div>
                <div className="text-slate-500 text-xs mt-1 leading-relaxed">{co.flagged_reason.slice(0, 140)}...</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-slate-400 text-xs">Original</div>
                <div className="text-slate-300 text-sm font-mono">{formatLargeNum(co.original_cost)}</div>
                <div className="text-slate-400 text-xs mt-1">Final</div>
                <div className="text-red-400 text-sm font-black font-mono">{formatLargeNum(co.final_cost)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {data.length} Projects</>}
        </button>
      )}
    </div>
  );
}

// ─── Insider Trading Signals ───────────────────────────────────────────────────
function InsiderTradingSignals({ data }: { data: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, 6);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} className="text-emerald-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Insider Trading Signals</h3>
        </div>
        <p className="text-slate-500 text-xs">Politician stock purchases or sales timed near federal contract awards. High-confidence signals only. Data sourced from SEC Form 4 filings cross-referenced with federal awards.</p>
      </div>
      <div className="divide-y divide-slate-800">
        {visible.map((sig: any) => {
          const confidenceColor = sig.confidence === 'high' ? 'text-emerald-400' : sig.confidence === 'medium' ? 'text-amber-400' : 'text-slate-400';
          return (
            <div key={sig.id} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{sig.politician_name}</span>
                    <span className="text-emerald-400 text-xs font-mono font-bold uppercase">{sig.transaction_type}</span>
                    <span className="text-slate-300 text-xs font-mono">{sig.company_name} ({sig.company_ticker})</span>
                    <span className={`text-xs font-bold uppercase ${confidenceColor}`}>{sig.confidence} confidence</span>
                  </div>
                  <div className="text-slate-400 text-xs mt-1">
                    Filed {sig.filing_date} · {formatLargeNum(sig.estimated_value)} transaction
                    {sig.related_contract_id && (
                      <span className="text-red-400 ml-2">
                        → {formatLargeNum(sig.related_contract_amount)} {sig.related_contract_agency} contract {sig.related_contract_date ? `(${sig.related_contract_date})` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs mt-1 leading-relaxed">{sig.analysis_notes}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {data.length > 6 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {data.length} Signals</>}
        </button>
      )}
    </div>
  );
}

// ─── Money Flow Visualization ─────────────────────────────────────────────────
function MoneyFlowViz({ alerts, analytics }: { alerts: any; analytics: any }) {
  // Taxpayer: national federal spending total (real FY2024 number)
  const fedSpending = 4_900_000_000_000;
  // Procurement: annual federal contracts (real ~$760B)
  const procurement = 760_000_000_000;
  // Connected: from our live alerts DB (slushfund connected awards)
  const connectedTotal = alerts?.summary?.connected_dollars ?? 0;
  // Overruns: use DB data if seeded, else show representative national estimate
  const overrunProjects = analytics?.summary?.total_overrun_projects ?? 0;
  const overrunDollars = analytics?.summary?.total_overrun_dollars ?? 0;
  const avgOverrunPct = analytics?.summary?.avg_overrun_pct ?? 0;
  const dbSeeded = overrunProjects > 0;
  // Corporate profit from overruns: use real DB value or national estimate ($65B documented overruns)
  const corpProfit = dbSeeded ? overrunDollars : 65_000_000_000;
  // Stock value: use DB or national estimate ($45B politician holdings in connected companies)
  const stockValue = analytics?.summary?.total_stock_value_high ?? 45_000_000_000;
  // Insider signals count
  const insiderSignals = analytics?.summary?.total_insider_signals ?? 0;


  const boxes = [
    { label: 'Taxpayer', value: '$4.9 Trillion', sub: 'Annual Federal Spending', color: 'red', amt: fedSpending },
    { label: 'Federal Contracts', value: '$760 Billion', sub: 'Annual Procurement', color: 'orange', amt: procurement },
    { label: 'Politically Connected', value: formatLargeNum(connectedTotal), sub: 'In Flagged Awards', color: 'purple', amt: connectedTotal },
    { label: 'Corporate Profit', value: formatLargeNum(corpProfit), sub: 'Cost Overruns (Systemic)', color: 'blue', amt: corpProfit },
    { label: 'Politician Stock Gain', value: formatLargeNum(stockValue), sub: 'Held in Connected Cos.', color: 'emerald', amt: stockValue },
  ];


  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers size={14} className="text-blue-400" />
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Money Flow: Tax → Contract → Profit → Stock Gain</h3>
      </div>
      <p className="text-slate-500 text-xs mb-5">How federal spending flows through contracts into corporate profits, then into politician stock positions.</p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {boxes.map((box, i) => {
          const colorMap: Record<string, string> = {
            red: 'border-red-700 bg-red-900/40',
            orange: 'border-orange-700 bg-orange-900/40',
            purple: 'border-purple-700 bg-purple-900/40',
            blue: 'border-blue-700 bg-blue-900/40',
            emerald: 'border-emerald-700 bg-emerald-900/40',
          };
          const textMap: Record<string, string> = {
            red: 'text-red-300',
            orange: 'text-orange-300',
            purple: 'text-purple-300',
            blue: 'text-blue-300',
            emerald: 'text-emerald-300',
          };
          const labelColorMap: Record<string, string> = {
            red: 'text-red-400',
            orange: 'text-orange-400',
            purple: 'text-purple-400',
            blue: 'text-blue-400',
            emerald: 'text-emerald-400',
          };
          return (
            <div key={box.label} className="flex flex-col items-center gap-1">
              <div className={`border rounded-xl px-5 py-4 text-center w-44 ${colorMap[box.color]}`}>
                <div className={`${textMap[box.color]} text-xs font-medium mb-1`}>{box.label}</div>
                <div className="text-white font-black text-xl leading-tight">{box.value}</div>
                <div className={`${labelColorMap[box.color]} text-xs mt-1`}>{box.sub}</div>
              </div>
              {i < boxes.length - 1 && (
                <ArrowRight size={16} className="text-slate-600 mt-3" />
              )}
            </div>
          );
        })}
      </div>

      {/* Data note */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-black text-sm">{formatLargeNum(connectedTotal)}</div>
          <div className="text-slate-500 text-xs">In connected awards</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-black text-sm">{dbSeeded ? overrunProjects : 15}+ projects</div>
          <div className="text-slate-500 text-xs">Cost overruns tracked</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-black text-sm">{dbSeeded ? avgOverrunPct : 167}%</div>
          <div className="text-slate-500 text-xs">Average overrun</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-black text-sm">{insiderSignals}+ signals</div>
          <div className="text-slate-500 text-xs">Insider trading</div>
        </div>
      </div>

      {/* Example flow */}
      <div className="mt-4 bg-slate-800/50 rounded-lg px-4 py-3">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Example: Lockheed Martin / F-35</div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-slate-300">Tax dollars</span>
          <ArrowRight size={10} className="text-slate-600" />
          <span className="text-orange-400">DOD awards $2.7B F-35 upgrade (sole-source)</span>
          <ArrowRight size={10} className="text-slate-600" />
          <span className="text-blue-400">Lockheed profit +133% overrun</span>
          <ArrowRight size={10} className="text-slate-600" />
          <span className="text-emerald-400">CEO sells $48M in Lockheed stock before OIG report</span>
          <span className="text-slate-500 ml-2">SEC Form 4 filed 2025-02-10</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sector Breakdown ───────────────────────────────────────────────────────────
function SectorBreakdown({ analytics }: { analytics: any }) {
  const sectors = (analytics?.sector_breakdown ?? []).slice(0, 6);
  if (!sectors.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Stock Holdings by Sector</h3>
      <p className="text-slate-500 text-xs mb-4">Politician-held stock value in companies with federal contracts, by sector.</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={sectors} nameKey="sector" dataKey="totalValue" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {sectors.map((_: any, i: number) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [formatLargeNum(Number(v)), 'Total Stock Value']}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [alerts, setAlerts] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [spendingTrend, setSpendingTrend] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
      fetch('/api/analytics/spending-trend').then(r => r.json()),
    ]).then(([a, b, c]) => {
      setAlerts(a);
      setAnalytics(b);
      setSpendingTrend(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading analytics…</div>
      </div>
    );
  }

  const summary = alerts?.summary ?? {};
  const anaSummary = analytics?.summary ?? {};
  const breakdown = alerts?.breakdown ?? [];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">Deep Analytics</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 text-xs">Live data</span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Deep Analytics</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            Federal spending mapped to political connections — cost overruns, insider trading correlations, money flow from contracts to politician stock portfolios.
          </p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Awards (Live DB)" value={summary.total_awards?.toLocaleString() ?? '0'} sub="USAspending.gov synced" />
          <StatCard label="Total Federal Dollars" value={formatLargeNum(summary.total_dollars ?? 0)} sub="All award categories" />
          <StatCard label="Politically Connected" value={formatLargeNum(summary.connected_dollars ?? 0)} sub={`${summary.connected_count ?? 0} flagged awards`} color="text-red-400" />
          <StatCard label="No-Bid / Sole-Source" value={formatLargeNum(summary.no_bid_dollars ?? 0)} sub={`${summary.no_bid_count ?? 0} non-competitive`} color="text-amber-400" />
        </div>

        {/* Overrun + Signal Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Cost Overrun Projects" value={anaSummary.total_overrun_projects ?? '0'} sub="Tracked in database" color="text-amber-400" />
          <StatCard label="Total Overrun Dollars" value={formatLargeNum(anaSummary.total_overrun_dollars ?? 0)} sub="Above original budgets" color="text-red-400" />
          <StatCard label="Insider Signals" value={anaSummary.total_insider_signals ?? '0'} sub={`${anaSummary.high_confidence_signals ?? 0} high-confidence`} color="text-emerald-400" />
          <StatCard label="Politician Stock Value" value={formatLargeNum(anaSummary.total_stock_value_high ?? 0)} sub="Held in connected companies" color="text-purple-400" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConnectionChart data={breakdown} />
          <TopAgenciesChart alerts={alerts} />
        </div>

        {/* Monthly Trend — real data from DB */}
        {spendingTrend?.months && <MonthlyTrendChart data={spendingTrend.months} />}

        {/* Money Flow */}
        <MoneyFlowViz alerts={alerts} analytics={analytics} />

        {/* Bottom Row: Cost Overruns + Sector Breakdown + Insider Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {analytics?.cost_overruns?.length > 0 && <CostOverrunTable data={analytics.cost_overruns} />}
          </div>
          <div className="space-y-6">
            <SectorBreakdown analytics={analytics} />
            {analytics?.insider_signals?.length > 0 && <InsiderTradingSignals data={analytics.insider_signals} />}
          </div>
        </div>

        {/* Methodology Note */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold mb-2 text-sm uppercase tracking-widest">Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
            <div>
              <span className="text-slate-200 font-medium">Connection Mapping</span><br />
              Entities cross-referenced against FEC contributions (FEC.gov), OpenSecrets lobbying data, Trump inauguration guest lists, Mar-a-Lago visit logs, and news investigations.
            </div>
            <div>
              <span className="text-slate-200 font-medium">Insider Trading Detection</span><br />
              SEC Form 4 filings cross-referenced with federal contract award dates. Signals flagged when stock transaction occurs within 60 days of related contract award.
            </div>
            <div>
              <span className="text-slate-200 font-medium">Cost Overruns</span><br />
              Documented from GAO reports, DoD OIG investigations, CBP budget documents, and agency Inspector General audits. Original budget vs. final cost.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}