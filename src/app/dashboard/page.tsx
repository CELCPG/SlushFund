'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { trackEvent } from '@/components/Plausible';
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
import EraToggle from '@/components/home/EraToggle';
import { KpiCard, ConnectionBadge } from '@/components/ui';
import RiskScore from '@/components/RiskScore';
import { recipientHref } from '@/lib/recipient-resolver';

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

// ─── The Bottom Line: Deep Insights ───────────────────────────────────────────
function BottomLine({ stats, analytics, competition }: { stats: any; analytics: any; competition: any }) {
  const connected = stats?.summary?.connected_dollars ?? 0;
  const total = stats?.summary?.total_dollars ?? 1;
  const connectedPct = ((connected / total) * 100).toFixed(1);
  const connectedCount = stats?.summary?.connected_count ?? 0;
  const noBid = stats?.summary?.no_bid_dollars ?? 0;
  const noBidPct = ((noBid / total) * 100).toFixed(1);
  const noBidCount = stats?.summary?.no_bid_count ?? 0;
  const overrunDollars = analytics?.summary?.total_overrun_dollars ?? 0;
  const dbSeeded = (analytics?.summary?.total_insider_signals ?? 0) > 0;
  const avgOverrun = dbSeeded ? (analytics?.summary?.avg_overrun_pct ?? 0) : null;
  const insiderSignals = dbSeeded ? (analytics?.summary?.total_insider_signals ?? 0) : 0;
  const overrunProjects = dbSeeded ? (analytics?.summary?.total_overrun_projects ?? 0) : 0;

  // The hardcoded "40-60% above market" claim is removed: the live dataset
  // has price_premium_pct = null for almost all awards, so we don't have
  // the data to back that specific number up. We surface what we actually have.
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
            <span className="text-white font-semibold">{connectedPct}%</span> of all tracked federal spending goes to companies with direct political connections to the Trump administration, Musk, or their inner circle, totaling{' '}
            <span className="text-red-400 font-semibold">{formatLargeNum(connected)}</span> across <span className="text-white font-semibold">{connectedCount.toLocaleString()}</span> awards.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            The top connected vendors (SpaceX, Palantir, xAI, Anduril) account for most of that figure. See the &ldquo;Who Benefits Most&rdquo; section below for the breakdown.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">No-Bid / Sole-Source</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            <span className="text-white font-semibold">{noBidPct}%</span> of tracked spending bypassed competitive bidding: <span className="text-amber-400 font-semibold">{formatLargeNum(noBid)}</span> across <span className="text-white font-semibold">{noBidCount.toLocaleString()}</span> {noBidCount === 1 ? 'award' : 'awards'}.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            The {noBidCount}-award count is the strict <code className="text-amber-400">competition_status = no_bid / sole_source</code> signal. The <code className="text-amber-400">no_compete_high_value</code> flag (risk-engine signal) surfaces {competition?.by_no_compete_flag ?? 0} additional non-competitive awards that the status field has not been updated for. {competition && (
              <>{competition.unknown_or_null?.toLocaleString() ?? '—'} of {competition.total_awards?.toLocaleString() ?? '—'} tracked awards have <code className="text-amber-400">competition_status = unknown</code>, so the true no-bid exposure is likely higher. The biggest known no-bid contracts (SpaceX, Palantir, GSA EV) are surfaced in the <Link href="/analysis/conflicts" className="text-blue-400 hover:underline">Conflicts</Link> and <Link href="/analysis/cost-overruns" className="text-blue-400 hover:underline">Cost Overruns</Link> pages.</>
            )}
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Cost Overruns</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            <span className="text-white font-semibold">{overrunProjects}</span> federally-documented cost overrun projects tracked, from the $20M Reflection Pool to the VA EHR modernization at 281% over budget. Total overrun value: <span className="text-emerald-400 font-semibold">{formatLargeNum(overrunDollars)}</span>.
          </p>
          {avgOverrun !== null && (
            <p className="text-slate-400 text-xs leading-relaxed">
              Average overrun is <span className="text-amber-400 font-semibold">{avgOverrun}% above original estimates</span>. These are not normal project variances. Many are GAO-flagged, some under OIG investigation.
            </p>
          )}
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

  // connected_dollars on the API lives at stats.summary.connected_dollars, not
  // at the top level. Fall back to summing the breakdown rows so the percentage
  // is always meaningful (avoid division by zero in the UI).
  const connected =
    Number(stats?.summary?.connected_dollars ?? 0) ||
    connectionGroups.reduce((s: number, g: any) => s + Number(g.total ?? 0), 0) ||
    1;

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
      description: 'Trump Organization, Trump Winery, Eric/Don Jr business ventures. $420K winery contract is the floor, not the ceiling. Family brand monetized via Secret Service spending, hospitality contracts.',
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
  const bloatedAll = awards
    .filter(a => a.flags?.includes('no_bid') || a.flags?.includes('sole_source'))
    .filter(a => a.price_premium_pct !== null || a.risk_score >= 80)
    .sort((a, b) => (b.price_premium_pct ?? b.risk_score) - (a.price_premium_pct ?? a.risk_score));
  if (bloatedAll.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Bloated / No-Bid Contracts</h3>
        <p className="text-slate-500 text-xs mt-2">
          Of the top 50 awards on the live feed, none carry a no-bid/sole-source
          signal. The 21 known no-bid/sole-source contracts (SpaceX, Palantir,
          GSA EV, etc.) are listed in the <Link href="/analysis/cost-overruns" className="text-blue-400 hover:underline">Cost Overruns</Link> and <Link href="/analysis/conflicts" className="text-blue-400 hover:underline">Conflicts</Link> pages.
        </p>
      </div>
    );
  }
  const bloated = bloatedAll.slice(0, expanded ? 20 : 8);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Bloated / No-Bid Contracts</h3>
            <p className="text-slate-500 text-xs mt-1">Non-competitive awards with high risk or documented price inflation</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-mono font-bold">{bloatedAll.length} shown</span>
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
      {bloatedAll.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {bloatedAll.length} Bloated Contracts</>}
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
  // The API's get_top_agencies RPC now deduplicates by agency (picks the most-
  // used agency_code per awarding_agency) so each agency shows up exactly once.
  const agencies = (stats?.top_agencies ?? [])
    .slice()
    .sort((a: any, b: any) => Number(b.total ?? 0) - Number(a.total ?? 0))
    .slice(0, 7);
  if (!agencies.length) return null;

  const chartData = agencies.map((a: any) => ({
    name: String(a.agency ?? '')
      .replace('Department of Homeland Security', 'Homeland Sec')
      .replace('Department of Defense', 'Defense')
      .replace('Department of Health and Human Services', 'HHS')
      .replace('Department of ', '')
      .replace('General Services Administration', 'GSA'),
    connected: Number(a.connected ?? 0),
    unconnected: Math.max(0, Number(a.total ?? 0) - Number(a.connected ?? 0)),
    total: Number(a.total ?? 0),
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Agencies: Connected vs Unconnected</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={formatLargeNum} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} />
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
function MonthlyTrend() {
  const [trendData, setTrendData] = useState<Array<{ label: string; total: number; connected: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/spending-trend')
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const months = (json?.months ?? []) as Array<{ label: string; total: number; connected: number }>;
        // Use the most recent 12 months for a readable chart
        setTrendData(months.slice(-12).map(m => ({
          label: m.label,
          total: Number(m.total ?? 0),
          connected: Number(m.connected ?? 0),
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Monthly Spending: 12-Month Trend</h3>
        <p className="text-slate-500 text-xs mt-1">From USAspending.gov awards in our database. Connected line is the politically-connected subset of total.</p>
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
      {loading && (
        <p className="text-slate-600 text-xs text-center mt-2">Loading…</p>
      )}
      {!loading && trendData.length === 0 && (
        <p className="text-slate-500 text-xs text-center mt-2">No trend data available.</p>
      )}
    </div>
  );
}

// ─── Recent High-Risk Awards ────────────────────────────────────────────────────
function RecentHighRisk({ awards }: { awards: Award[] }) {
  const highRisk = awards
    .filter(a => a.risk_score >= 80)
    .sort((a, b) => Number(b.dollar_amount) - Number(a.dollar_amount))
    .slice(0, 6);

  if (highRisk.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Highest-Risk Awards</h3>
        </div>
        <p className="text-slate-500 text-xs">
          No awards with risk score 80+ in the current dataset. The Top High-Risk list is computed in the <code className="text-amber-400">/api/alerts</code> response above and is also viewable on the <Link href="/analysis/conflicts" className="text-blue-400 hover:underline">Conflicts</Link> page.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Highest-Risk Awards</h3>
        </div>
        <p className="text-slate-500 text-xs mt-1">Risk score 80+. Combines political connection, no-bid status, and size.</p>
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
  // useSearchParams() requires a Suspense boundary at the page level.
  // We split the page into a thin wrapper and the inner component.
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 font-mono text-sm animate-pulse">Loading dashboard…</div>
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // Tri-state: 'loading' | 'unavailable' | 'live'. Default 'loading'.
  // We never show mock/demo data in production. If Supabase is down,
  // we render a styled "Data updating" empty state instead.
  const [dataSource, setDataSource] = useState<'loading' | 'unavailable' | 'live'>('loading');

  const [search, setSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState<Era | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState<'all' | 'defense' | 'tech' | 'covid'>('all');
  const [sortKey, setSortKey] = useState('risk_score');
  const urlSearchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read initial state from URL params so filtered views are shareable.
  useEffect(() => {
    const c = urlSearchParams.get('connection');
    if (c && ['all', 'elon_musk', 'trump_family', 'trump_ally'].includes(c)) {
      setConnectionFilter(c);
    }
    const cat = urlSearchParams.get('category');
    if (cat && ['all', 'contract', 'grant'].includes(cat)) {
      setCategoryFilter(cat);
    }
    const era = urlSearchParams.get('era');
    if (era) setEraFilter(era as any);
    const flag = urlSearchParams.get('flag');
    if (flag) setFlagFilter(flag);
    const topic = urlSearchParams.get('topic');
    if (topic && ['all', 'defense', 'tech', 'covid'].includes(topic)) {
      setTopicFilter(topic as any);
    }
    const sort = urlSearchParams.get('sort');
    if (sort) setSortKey(sort);
    const dir = urlSearchParams.get('dir');
    if (dir === 'asc' || dir === 'desc') setSortDir(dir);
    const q = urlSearchParams.get('q');
    if (q) setSearch(q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Sync state → URL params whenever a filter changes (placed after
  // all state declarations so dependencies are reachable).
  useEffect(() => {
    const params = new URLSearchParams();
    if (connectionFilter !== 'all') params.set('connection', connectionFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (eraFilter !== 'all') params.set('era', eraFilter);
    if (flagFilter !== 'all') params.set('flag', flagFilter);
    if (topicFilter !== 'all') params.set('topic', topicFilter);
    if (sortKey !== 'risk_score') params.set('sort', sortKey);
    if (sortDir !== 'desc') params.set('dir', sortDir);
    if (search) params.set('q', search);
    const next = params.toString();
    const current = urlSearchParams.toString();
    if (next !== current) {
      // Use replace so we don't pollute browser history on every keystroke.
      router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionFilter, categoryFilter, eraFilter, flagFilter, topicFilter, sortKey, sortDir, search]);

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

      if (data.awards?.length > 0) {
        setAwards(data.awards);
        setTotal(data.total);
        setPages(data.pages);
        setDataSource('live');
      } else {
        throw new Error('no awards returned');
      }
    } catch {
      // No mock data fallback. Render a styled "Data updating" empty state.
      setDataSource('unavailable');
      setAwards([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, connectionFilter, eraFilter, categoryFilter, flagFilter, topicFilter, search, sortKey, sortDir]);

  useEffect(() => {
    loadStats();
    loadAwards();
  }, [loadStats, loadAwards]);

  // Track filter changes as Plausible events (debounced to once per second).
  useEffect(() => {
    const t = setTimeout(() => {
      trackEvent('dashboard_filter', {
        connection: connectionFilter,
        category: categoryFilter,
        flag: flagFilter,
        era: eraFilter,
        sort: `${sortKey}:${sortDir}`,
        has_search: search ? '1' : '0',
      });
    }, 800);
    return () => clearTimeout(t);
  }, [connectionFilter, categoryFilter, flagFilter, eraFilter, sortKey, sortDir, search]);

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
  const competition = stats?.competition_coverage ?? null;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Site nav (shared) — refresh moved to page-level control below */}

      {/* ── KPI Stats Row ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Tracked" value={formatLargeNum(stats?.summary?.total_dollars ?? 0)} sub={`${(stats?.summary?.total_awards ?? 0).toLocaleString()} awards from USAspending.gov`} icon={DollarSign} color="text-white" />
            <KpiCard label="Politically Connected" value={formatLargeNum(stats?.summary?.connected_dollars ?? 0)} sub={`${connectedPct}% of total spending (${(stats?.summary?.connected_count ?? 0)} awards)`} icon={Shield} color="text-red-400" highlight />
            <KpiCard label="No-Bid / Sole-Source" value={formatLargeNum(stats?.summary?.no_bid_dollars ?? 0)} sub={`${noBidPct}% non-competitive (${(stats?.summary?.no_bid_count ?? 0)} awards)`} icon={Scale} color="text-amber-400" />
            <KpiCard label="Insider Signals" value={String(analytics?.summary?.total_insider_signals ?? 0)} sub={`${(analytics?.summary?.high_confidence_signals ?? 0)} high-confidence · ${formatLargeNum(analytics?.summary?.total_overrun_dollars ?? 0)} in documented overruns`} icon={Activity} color="text-emerald-400" />
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* The Bottom Line */}
        <BottomLine stats={stats} analytics={analytics} competition={competition} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ConnectionPie stats={stats} />
          <TopAgenciesChart stats={stats} />
          <MonthlyTrend />
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
          {/* Topic tab row */}
          <div className="px-5 pt-4 pb-0 flex items-center gap-1 border-b border-slate-800">
            {([
              { key: 'all', label: 'All' },
              { key: 'defense', label: 'Defense' },
              { key: 'tech', label: 'Tech & AI' },
              { key: 'covid', label: 'COVID' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setTopicFilter(tab.key); setCurrentPage(1); }}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  topicFilter === tab.key
                    ? 'border-slush-red text-white bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto text-xs text-slate-500 font-mono">
              {awards.length.toLocaleString()} awards
            </div>
          </div>
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Awards</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-lg pl-9 pr-3 py-1.5 w-48 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-lg p-0.5">
                {([
                  { key: 'all', label: 'All', color: 'slate' },
                  { key: 'elon_musk', label: 'Musk', color: 'emerald' },
                  { key: 'trump_family', label: 'Trump Family', color: 'red' },
                  { key: 'trump_ally', label: 'Trump Ally', color: 'amber' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setConnectionFilter(opt.key); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                      connectionFilter === opt.key
                        ? opt.key === 'elon_musk' ? 'bg-emerald-600 text-white' :
                          opt.key === 'trump_family' ? 'bg-red-600 text-white' :
                          opt.key === 'trump_ally' ? 'bg-amber-600 text-white' :
                          'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <EraToggle currentEra={eraFilter} onChange={v => { setEraFilter(v); setCurrentPage(1); }} size="sm" />
              <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-lg p-0.5">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'contract', label: 'Contract' },
                  { key: 'grant', label: 'Grant' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setCategoryFilter(opt.key); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                      categoryFilter === opt.key
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
                {awards.slice(0, 20).map(award => {
                  const entityHref = recipientHref(award.recipient_name, award.id);
                  const isEntityLink = entityHref.startsWith('/entity/');
                  return (
                  <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link href={entityHref} className="font-medium text-white hover:text-emerald-400 transition-colors">
                        {award.recipient_name}
                        {isEntityLink && <span className="ml-1.5 text-[10px] text-red-400 font-mono uppercase tracking-widest">entity →</span>}
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
                      <RiskScore score={Number(award.risk_score || 0)} size="sm" compact />
                    </td>
                  </tr>
                  );
                })}
                {awards.length === 0 && dataSource === 'unavailable' && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-mono uppercase tracking-widest text-slate-400">
                          Data updating
                        </span>
                        <p className="text-slate-500 text-sm max-w-sm">
                          We&apos;re refreshing the feed. Check back in a minute, or hit refresh.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {awards.length === 0 && dataSource !== 'unavailable' && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">{loading ? 'Loading…' : 'No awards match your filters.'}</td></tr>
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

        <div className="flex items-center justify-center gap-3 text-center text-slate-500 text-xs font-mono">
          <button
            onClick={() => { loadStats(); loadAwards(); }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <span>
            {dataSource === 'loading'
              ? 'Loading awards…'
              : `Showing ${Math.min(20, awards.length)} of ${total.toLocaleString()} awards from USAspending.gov`}
          </span>
        </div>
      </div>
    </div>
  );
}
