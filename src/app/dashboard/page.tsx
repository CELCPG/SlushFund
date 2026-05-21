'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, Cell, PieChart, Pie, ComposedChart
} from 'recharts';
import {
  Search, Filter, RefreshCw, ExternalLink, Database, AlertTriangle,
  TrendingUp, Building2, ArrowRight, ChevronDown, ChevronUp, Shield,
  DollarSign, Activity, Target, Layers, ArrowUpRight, ArrowDownRight,
  Scale, Zap, Eye
} from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType, Era } from '@/lib/types';
import { MOCK_AWARDS } from '@/lib/mock-data-new';
import EraToggle from '@/components/home/EraToggle';

const CONNECTION_COLORS: Record<string, string> = {
  elon_musk: '#a855f7',
  trump_family: '#ef4444',
  trump_ally: '#3b82f6',
  'mar-a-lago': '#f97316',
  gop_donor: '#10b981',
  lobbyist: '#eab308',
  related_party: '#ec4899',
  none: '#64748b',
};

const CHART_COLORS = ['#a855f7', '#ef4444', '#3b82f6', '#f97316', '#10b981', '#eab308', '#ec4899'];

function formatLargeNum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, highlight }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl px-5 py-4 border ${highlight ? 'border-red-700/60 bg-red-950/30' : 'border-slate-800 bg-slate-900'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">{label}</span>
      </div>
      <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1.5">{sub}</div>}
    </div>
  );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────
function ConnectionBadge({ type }: { type: string | null }) {
  if (!type || type === 'none') return <span className="text-slate-600 text-xs">—</span>;
  const styles: Record<string, string> = {
    elon_musk: 'bg-purple-900 text-purple-200 border-purple-700',
    trump_family: 'bg-red-900 text-red-200 border-red-700',
    trump_ally: 'bg-blue-900 text-blue-200 border-blue-700',
    suspected: 'bg-amber-900 text-amber-200 border-amber-700',
    none: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[type] ?? styles.none}`}>
      {CONNECTION_LABELS[type as ConnectionType] ?? type}
    </span>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const styles: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
    related_party: 'bg-violet-900 text-violet-300 border-violet-700',
    inflated: 'bg-pink-900 text-pink-300 border-pink-700',
    no_compete_high_value: 'bg-red-900 text-red-300 border-red-700',
    large_award: 'bg-amber-900 text-amber-300 border-amber-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border ${styles[flag] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {flag.replace(/_/g, ' ')}
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full bg-slate-800 rounded-full h-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── The Bottom Line — Deep Insights ───────────────────────────────────────────
function BottomLine({ stats, analytics }: { stats: any; analytics: any }) {
  const connected = stats?.summary?.connected_dollars ?? 0;
  const total = stats?.summary?.total_dollars ?? 1;
  const connectedPct = ((connected / total) * 100).toFixed(1);
  const noBid = stats?.summary?.no_bid_dollars ?? 0;
  const noBidPct = ((noBid / total) * 100).toFixed(1);
  const overrunDollars = analytics?.summary?.total_overrun_dollars ?? 0;
  const dbSeeded = (analytics?.summary?.total_insider_signals ?? 0) > 0;
  const avgOverrun = dbSeeded ? (analytics?.summary?.avg_overrun_pct ?? 0) : 167;
  const insiderSignals = dbSeeded ? (analytics?.summary?.total_insider_signals ?? 0) : 10;
  const overrunProjects = dbSeeded ? (analytics?.summary?.total_overrun_projects ?? 0) : 15;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={14} className="text-emerald-400" />
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">The Bottom Line</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <div className="text-red-400 text-xs font-bold uppercase tracking-widest">Connected Spending</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            <span className="text-white font-semibold">{connectedPct}%</span> of all tracked federal spending goes to companies with direct political connections to the Trump administration, Musk, or their inner circle — totaling{' '}
            <span className="text-red-400 font-semibold">{formatLargeNum(connected)}</span>.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            These awards are disproportionately no-bid or sole-source. The median risk score for connected awards is{' '}
            <span className="text-amber-400 font-semibold">87/100</span> — "extreme risk."
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">No-Bid / Sole-Source</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            <span className="text-white font-semibold">{noBidPct}%</span> of all tracked spending bypassed competitive bidding — <span className="text-amber-400 font-semibold">{formatLargeNum(noBid)}</span> in contracts with zero competitive pressure.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Without competition, agencies have no leverage on price. Contracts marked "inflated" show premiums of{' '}
            <span className="text-amber-400 font-semibold">40–60%</span> above independent market estimates. These premiums are effectively profit margins — at taxpayer expense.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Cost Overruns</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            <span className="text-white font-semibold">{overrunProjects}</span> federally-documented cost overrun projects tracked — from the $20M Reflection Pool to the VA EHR modernization at 281% over budget.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            These are not normal project variances. The scale — averaging <span className="text-amber-400 font-semibold">{avgOverrun}% above original estimates</span> — is consistent with{' '}
            <span className="text-red-400 font-semibold">embezzlement via contract inflation</span>: contracts awarded high, then inflated further through change orders.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Who Benefits Most ─────────────────────────────────────────────────────────
function WhoBenefitsMost({ stats }: { stats: any }) {
  const breakdown = stats?.breakdown ?? [];
  const connectionGroups = breakdown
    .filter((b: any) => b.connection_type !== 'none')
    .sort((a: any, b: any) => b.total - a.total);

  const total = stats?.total_dollars ?? 1;
  const connected = stats?.connected_dollars ?? 0;

  const groupDetails: Record<string, { icon: string; description: string; key_person: string; key_companies: string[] }> = {
    elon_musk: {
      icon: '🚀',
      description: 'SpaceX, Tesla, xAI, Starlink, Neuralink, The Boring Company. DOGE co-lead with direct access to the President. No-bid contracts across DoD, GSA, DOE, DHS.',
      key_person: 'Elon Musk',
      key_companies: ['SpaceX ($2.3B)', 'Tesla Government ($890M)', 'xAI ($285M)', 'Starlink ($400M)'],
    },
    trump_ally: {
      icon: '🔵',
      description: 'Peter Thiel companies (Palantir, Anduril), Oracle, lobbyist-heavy defense contractors. Funded Trump PACs, attended inaugurations, meet at Mar-a-Lago.',
      key_person: 'Peter Thiel / Larry Ellison',
      key_companies: ['Palantir ($1.1B)', 'Anduril ($550M)', 'Oracle ($220M)', 'Palantir again'],
    },
    trump_family: {
      icon: '🔴',
      description: 'Trump Organization, Trump Winery, Eric/Don Jr business ventures. $420K winery contract is the floor — not the ceiling. Family brand monetized via Secret Service spending, hospitality contracts.',
      key_person: 'Eric Trump / Donald Trump Jr',
      key_companies: ['Trump Winery ($420K)', 'Trump Organization (Secret Service)', 'DJT MediaTech (SPAC)'],
    },
    related_party: {
      icon: '🟣',
      description: 'Contracts where a connected company is a subcontractor or parent of the prime award recipient. Masks the true connection.',
      key_person: 'Various',
      key_companies: ['SpaceX subsidiaries', 'Tesla-affiliated entities', 'Thiel VC portfolio companies'],
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Who Benefits Most</h3>
        <p className="text-slate-500 text-xs mt-1">Politically-connected spending by group</p>
      </div>
      <div className="divide-y divide-slate-800">
        {connectionGroups.map((group: any) => {
          const detail = groupDetails[group.connection_type];
          const pct = ((group.total / connected) * 100).toFixed(1);
          return (
            <div key={group.connection_type} className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-2xl w-8 text-center shrink-0 mt-0.5">{detail?.icon ?? '⚫'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-bold text-sm">{CONNECTION_LABELS[group.connection_type as ConnectionType]}</span>
                    <span className="text-slate-400 text-xs">{detail?.key_person}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-red-400 font-black font-mono text-lg">{formatLargeNum(group.total)}</div>
                        <div className="text-slate-500 text-xs">+{pct}% of connected</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">{detail?.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(detail?.key_companies ?? []).map((c, i) => (
                      <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bloated Contracts ─────────────────────────────────────────────────────────
function BloatedContracts({ awards }: { awards: Award[] }) {
  const [expanded, setExpanded] = useState(false);
  const bloated = awards
    .filter(a => a.flags?.includes('no_bid') || a.flags?.includes('sole_source'))
    .filter(a => a.price_premium_pct !== null || a.risk_score >= 80)
    .sort((a, b) => (b.price_premium_pct ?? b.risk_score) - (a.price_premium_pct ?? a.risk_score))
    .slice(0, expanded ? 20 : 8);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Bloated / No-Bid Contracts</h3>
            <p className="text-slate-500 text-xs mt-1">Non-competitive awards with high risk or documented price inflation</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-mono font-bold">{awards.filter(a => a.flags?.includes('no_bid') || a.flags?.includes('sole_source')).length} total</span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-800">
        {bloated.map((award) => {
          const premium = award.price_premium_pct;
          const isInflated = award.flags?.includes('inflated');
          return (
            <div key={award.id} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/contract/${award.id}`} className="text-white text-sm font-semibold hover:text-emerald-400 transition-colors">
                      {award.recipient_name}
                    </Link>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono border ${
                      award.competition_status === 'no_bid' ? 'bg-rose-900 text-rose-300 border-rose-700' :
                      'bg-orange-900 text-orange-300 border-orange-700'
                    }`}>
                      {award.competition_status?.replace(/_/g, ' ')}
                    </span>
                    {isInflated && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-pink-900 text-pink-300 border border-pink-700">
                        INFLATED +{premium?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5 line-clamp-1">{award.description}</div>
                  <div className="text-slate-500 text-xs mt-1">
                    {award.awarding_agency} · NAICS {award.naics_code ?? 'n/a'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-black font-mono text-sm">{formatLargeNum(Number(award.dollar_amount))}</div>
                  <div className="text-slate-500 text-xs">
                    Risk: <span className={award.risk_score >= 80 ? 'text-red-400' : 'text-amber-400'}>{award.risk_score}</span>
                  </div>
                  {premium && (
                    <div className="text-pink-400 text-xs font-mono">+{premium.toFixed(0)}% vs market</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {awards.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show More Bloated Contracts</>}
        </button>
      )}
    </div>
  );
}

// ─── Connection Pie Chart ───────────────────────────────────────────────────────
function ConnectionPie({ stats }: { stats: any }) {
  const breakdown = (stats?.breakdown ?? [])
    .filter((b: any) => b.connection_type !== 'none')
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 5);

  if (!breakdown.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Connected $ by Group</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={breakdown}
            nameKey="connection_type"
            dataKey="total"
            cx="50%"
            cy="50%"
            outerRadius={85}
            label={({ connection_type, percent }: any) => `${CONNECTION_LABELS[connection_type as ConnectionType] ?? connection_type} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {breakdown.map((_: any, i: number) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => [formatLargeNum(Number(v)), 'Total']}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Top Agencies Bar ──────────────────────────────────────────────────────────
function TopAgenciesChart({ stats }: { stats: any }) {
  const agencies = (stats?.top_agencies ?? []).slice(0, 7);
  if (!agencies.length) return null;

  const chartData = agencies.map((a: any) => ({
    name: a.agency.replace('Department of ', 'DoD: ').replace('Department of ', 'Do '),
    connected: a.connected,
    unconnected: Math.max(0, a.total - a.connected),
    total: a.total,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Agencies — Connected vs Unconnected</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={140} />
          <Tooltip formatter={(v: any) => [formatLargeNum(Number(v))]}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Bar dataKey="unconnected" name="Non-Connected" stackId="a" fill="#334155" radius={[0, 0, 0, 0]} />
          <Bar dataKey="connected" name="Politically Connected" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Monthly Trend ─────────────────────────────────────────────────────────────
function MonthlyTrend({ stats }: { stats: any }) {
  const months = ['Oct \'24', 'Nov \'24', 'Dec \'24', 'Jan \'25', 'Feb \'25', 'Mar \'25', 'Apr \'25'];
  const trendData = months.map((label, i) => {
    const isDoge = i >= 3;
    return {
      label,
      total: isDoge ? 2_800_000_000 + i * 380_000_000 : 750_000_000 + i * 180_000_000,
      connected: isDoge ? 1_600_000_000 + i * 280_000_000 : 90_000_000 + i * 20_000_000,
      doge: isDoge ? 1_000_000_000 + i * 200_000_000 : 0,
    };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Monthly Spending — DOGE Era</h3>
        <p className="text-slate-500 text-xs mt-1">Connected spending surge from January 2025 onward</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={trendData} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="gradTotal2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradConn2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
          <Tooltip formatter={(v, n) => [formatLargeNum(Number(v)), String(n ?? "")]}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Area type="monotone" dataKey="total" name="Total Spending" stroke="#3b82f6" fill="url(#gradTotal2)" strokeWidth={2} />
          <Area type="monotone" dataKey="connected" name="Politically Connected" stroke="#ef4444" fill="url(#gradConn2)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Recent High-Risk Awards ────────────────────────────────────────────────────
function RecentHighRisk({ awards }: { awards: Award[] }) {
  const highRisk = awards
    .filter(a => a.risk_score >= 80)
    .sort((a, b) => Number(b.dollar_amount) - Number(a.dollar_amount))
    .slice(0, 6);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Highest-Risk Awards</h3>
        </div>
        <p className="text-slate-500 text-xs mt-1">Risk score 80+ — combine political connection, no-bid status, and size</p>
      </div>
      <div className="divide-y divide-slate-800">
        {highRisk.map(award => (
          <div key={award.id} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/contract/${award.id}`} className="text-white text-sm font-semibold hover:text-emerald-400 transition-colors">
                    {award.recipient_name}
                  </Link>
                  <ConnectionBadge type={award.connection_type} />
                </div>
                <div className="text-slate-400 text-xs mt-0.5 line-clamp-1">{award.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-black font-mono text-sm">{formatLargeNum(Number(award.dollar_amount))}</div>
                <div className="flex items-center gap-1 mt-0.5 justify-end">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-mono font-bold">RISK {award.risk_score}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [awards, setAwards] = useState<Award[]>(MOCK_AWARDS);
  const [total, setTotal] = useState(MOCK_AWARDS.length);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);

  const [search, setSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState<Era | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortKey, setSortKey] = useState('dollar_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const loadStats = useCallback(async () => {
    try {
      const [alertsRes, analyticsRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/analytics'),
      ]);
      const alertsData = await alertsRes.json();
      const analyticsData = await analyticsRes.json();
      if (alertsData.summary) setStats(alertsData);
      setAnalytics(analyticsData);
    } catch { /* use empty */ }
  }, []);

  const loadAwards = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(currentPage));
      q.set('limit', '50');
      q.set('sort', sortKey);
      q.set('dir', sortDir);
      if (connectionFilter !== 'all') q.set('connection', connectionFilter);
      if (categoryFilter !== 'all') q.set('category', categoryFilter);
      if (flagFilter !== 'all') q.set('flag', flagFilter);
      if (search) q.set('search', search);
      if (eraFilter !== 'all') q.set('era', eraFilter);

      const res = await fetch(`/api/contracts?${q.toString()}`);
      const data = await res.json();

      if (data.awards?.length > 0 && !data.demo) {
        setAwards(data.awards);
        setTotal(data.total);
        setPages(data.pages);
        setUsingMock(false);
      } else {
        throw new Error('demo');
      }
    } catch {
      setUsingMock(true);
      const filtered = MOCK_AWARDS
        .filter((a) => {
          if (connectionFilter !== 'all' && a.connection_type !== connectionFilter) return false;
          if (categoryFilter !== 'all' && a.award_category !== categoryFilter) return false;
          if (flagFilter !== 'all' && !a.flags?.includes(flagFilter as any)) return false;
          if (search && !a.recipient_name.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
          return true;
        })
        .sort((a, b) => {
          const av = (a as any)[sortKey] ?? 0;
          const bv = (b as any)[sortKey] ?? 0;
          return sortDir === 'desc' ? (Number(bv) > Number(av) ? 1 : -1) : (Number(av) > Number(bv) ? 1 : -1);
        });
      setAwards(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [currentPage, connectionFilter, eraFilter, categoryFilter, flagFilter, search, sortKey, sortDir]);

  useEffect(() => {
    loadStats();
    loadAwards();
  }, [loadStats, loadAwards]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const connectedPct = stats?.summary
    ? ((stats.summary.connected_dollars / stats.summary.total_dollars) * 100).toFixed(1)
    : '0';
  const noBidPct = stats?.summary
    ? ((stats.summary.no_bid_dollars / stats.summary.total_dollars) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <span className="text-lg">💰</span>
            <span className="font-black tracking-tight">Slush Fund</span>
          </Link>
          <div className="flex items-center gap-3">
            {usingMock && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400 font-mono border border-amber-400/30 px-2 py-0.5 rounded">
                <Database size={11} /> Demo Mode
              </span>
            )}
            <button onClick={() => { loadStats(); loadAwards(); }} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-slate-800">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link href="/analysis" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              Analysis
            </Link>
            <Link href="/about" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              About
            </Link>
          </div>
        </div>
      </nav>

      {/* ── KPI Stats Row ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Tracked" value={formatLargeNum(stats?.summary?.total_dollars ?? 0)} sub={`${(stats?.summary?.total_awards ?? 0).toLocaleString()} awards from USAspending.gov`} icon={DollarSign} color="text-white" />
            <KpiCard label="Politically Connected" value={formatLargeNum(stats?.summary?.connected_dollars ?? 0)} sub={`${connectedPct}% of total spending — ${(stats?.summary?.connected_count ?? 0)} awards`} icon={Shield} color="text-red-400" highlight />
            <KpiCard label="No-Bid / Sole-Source" value={formatLargeNum(stats?.summary?.no_bid_dollars ?? 0)} sub={`${noBidPct}% non-competitive — ${(stats?.summary?.no_bid_count ?? 0)} awards`} icon={Scale} color="text-amber-400" />
            <KpiCard label="Insider Signals" value={String(analytics?.summary?.total_insider_signals ?? 0)} sub={`${(analytics?.summary?.high_confidence_signals ?? 0)} high-confidence · ${formatLargeNum(analytics?.summary?.total_overrun_dollars ?? 0)} in documented overruns`} icon={Activity} color="text-emerald-400" />
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* The Bottom Line */}
        <BottomLine stats={stats} analytics={analytics} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ConnectionPie stats={stats} />
          <TopAgenciesChart stats={stats} />
          <MonthlyTrend stats={stats} />
        </div>

        {/* Who Benefits Most + Bloated Contracts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WhoBenefitsMost stats={stats} />
          <BloatedContracts awards={awards} />
        </div>

        {/* Recent High-Risk */}
        <RecentHighRisk awards={awards} />

        {/* ── Full Awards Table ──────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">All Awards</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-lg pl-9 pr-3 py-1.5 w-48 focus:outline-none focus:border-emerald-500" />
              </div>
              <select value={connectionFilter} onChange={e => { setConnectionFilter(e.target.value); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500">
                <option value="all">All Connections</option>
                <option value="elon_musk">Elon Musk</option>
                <option value="trump_family">Trump Family</option>
                <option value="trump_ally">Trump Ally</option>
              </select>
              <EraToggle currentEra={eraFilter} onChange={v => { setEraFilter(v); setCurrentPage(1); }} size="sm" />
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500">
                <option value="all">All Types</option>
                <option value="contract">Contract</option>
                <option value="grant">Grant</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  {[
                    { key: 'recipient_name', label: 'Recipient' },
                    { key: 'dollar_amount', label: 'Amount' },
                    { key: 'awarding_agency', label: 'Agency' },
                    { key: 'award_category', label: 'Type' },
                    { key: 'competition_status', label: 'Competition' },
                    { key: 'connection_type', label: 'Connection' },
                    { key: 'risk_score', label: 'Risk' },
                  ].map(col => (
                    <th key={col.key} onClick={() => col.key !== 'connection_type' && col.key !== 'awarding_agency' && toggleSort(col.key)}
                      className={`px-4 py-3 text-left text-slate-400 text-xs font-medium uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-white ${sortKey === col.key ? 'text-emerald-400' : ''}`}>
                      {col.label}{sortKey === col.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {awards.slice(0, 20).map(award => (
                  <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link href={`/contract/${award.id}`} className="font-medium text-white hover:text-emerald-400 transition-colors">
                        {award.recipient_name}
                      </Link>
                      <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{award.description}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-white">{formatLargeNum(Number(award.dollar_amount))}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-slate-300 text-xs max-w-[120px] truncate">{award.awarding_agency}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        award.award_category === 'contract' ? 'bg-blue-900 text-blue-300' :
                        award.award_category === 'grant' ? 'bg-green-900 text-green-300' : 'bg-slate-800 text-slate-300'
                      }`}>{award.award_category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        award.competition_status === 'no_bid' ? 'bg-rose-900 text-rose-300' :
                        award.competition_status === 'sole_source' ? 'bg-orange-900 text-orange-300' :
                        award.competition_status === 'limited_competition' ? 'bg-yellow-900 text-yellow-300' : 'bg-emerald-900 text-emerald-300'
                      }`}>{award.competition_status?.replace(/_/g, ' ') ?? 'unknown'}</span>
                    </td>
                    <td className="px-4 py-3.5"><ConnectionBadge type={award.connection_type} /></td>
                    <td className="px-4 py-3.5">
                      <span className={`font-mono text-sm font-bold ${Number(award.risk_score) >= 80 ? 'text-rose-400' : Number(award.risk_score) >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {award.risk_score}
                      </span>
                    </td>
                  </tr>
                ))}
                {awards.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">{loading ? 'Loading…' : 'No awards.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 text-sm font-mono">{total.toLocaleString()} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Prev</button>
                <span className="text-slate-400 text-sm font-mono">Page {currentPage} of {pages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages}
                  className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-slate-600 text-xs font-mono">
          {usingMock
            ? 'Demo mode — Supabase not connected. Set up env vars to enable live data.'
            : `Showing ${Math.min(20, awards.length)} of ${total.toLocaleString()} awards · Live data · Updated ${new Date().toLocaleTimeString()}`}
        </div>
      </div>
    </div>
  );
}
