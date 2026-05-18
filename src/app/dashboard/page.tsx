'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, RefreshCw, ExternalLink, Database, AlertTriangle, TrendingUp, Building2 } from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType } from '@/lib/types';
import { MOCK_AWARDS } from '@/lib/mock-data-new';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  total_awards: number;
  total_dollars: number;
  contract_count: number;
  grant_count: number;
  connected_dollars: number;
  flagged_dollars: number;
  no_bid_dollars: number;
}

interface AwardsResponse {
  awards: Award[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  demo?: boolean;
}

// ─── API Helpers ───────────────────────────────────────────────────────────────
async function fetchAwards(params: {
  page?: number;
  limit?: number;
  connection?: string;
  category?: string;
  flag?: string;
  search?: string;
  sort?: string;
  dir?: string;
  risk_min?: string;
}): Promise<AwardsResponse> {
  const q = new URLSearchParams();
  const { page = 1, limit = 50, connection, category, flag, search, sort = 'dollar_amount', dir = 'desc', risk_min } = params;
  q.set('page', String(page));
  q.set('limit', String(limit));
  q.set('sort', sort);
  q.set('dir', dir);
  if (connection && connection !== 'all') q.set('connection', connection);
  if (category && category !== 'all') q.set('category', category);
  if (flag && flag !== 'all') q.set('flag', flag);
  if (search) q.set('search', search);
  if (risk_min) q.set('risk_min', risk_min);
  const res = await fetch(`/api/contracts?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Pre-compute mock stats ────────────────────────────────────────────────────
const MOCK_STATS: DashboardStats = {
  total_awards: MOCK_AWARDS.length,
  total_dollars: MOCK_AWARDS.reduce((s, a) => s + Number(a.dollar_amount), 0),
  contract_count: MOCK_AWARDS.filter(a => a.award_category === 'contract').length,
  grant_count: MOCK_AWARDS.filter(a => a.award_category === 'grant').length,
  connected_dollars: MOCK_AWARDS.filter(a => a.connection_type && a.connection_type !== 'none').reduce((s, a) => s + Number(a.dollar_amount), 0),
  flagged_dollars: MOCK_AWARDS.filter(a => a.flags && a.flags.length > 0).reduce((s, a) => s + Number(a.dollar_amount), 0),
  no_bid_dollars: MOCK_AWARDS.filter(a => a.competition_status === 'no_bid' || a.competition_status === 'sole_source').reduce((s, a) => s + Number(a.dollar_amount), 0),
};

const CONNECTION_BREAKDOWN = [
  { type: 'elon_musk', label: 'Elon Musk', total: MOCK_AWARDS.filter(a => a.connection_type === 'elon_musk').reduce((s, a) => s + Number(a.dollar_amount), 0), count: MOCK_AWARDS.filter(a => a.connection_type === 'elon_musk').length },
  { type: 'trump_ally', label: 'Trump Ally / Donor', total: MOCK_AWARDS.filter(a => a.connection_type === 'trump_ally').reduce((s, a) => s + Number(a.dollar_amount), 0), count: MOCK_AWARDS.filter(a => a.connection_type === 'trump_ally').length },
  { type: 'trump_family', label: 'Trump Family', total: MOCK_AWARDS.filter(a => a.connection_type === 'trump_family').reduce((s, a) => s + Number(a.dollar_amount), 0), count: MOCK_AWARDS.filter(a => a.connection_type === 'trump_family').length },
];

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

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [awards, setAwards] = useState<Award[]>(MOCK_AWARDS);
  const [total, setTotal] = useState(MOCK_AWARDS.length);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortKey, setSortKey] = useState('dollar_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [stats, setStats] = useState<DashboardStats>({
    total_awards: 0,
    total_dollars: 0,
    contract_count: 0,
    grant_count: 0,
    connected_dollars: 0,
    flagged_dollars: 0,
    no_bid_dollars: 0,
  });
  const [connectionBreakdown, setConnectionBreakdown] = useState<Array<{ type: string; label: string; total: number; count: number }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAwards({
        page: currentPage,
        limit: 50,
        connection: connectionFilter,
        category: categoryFilter,
        flag: flagFilter,
        search,
        sort: sortKey,
        dir: sortDir,
      });

      if (data.awards.length === 0 && data.demo) {
        throw new Error('demo_mode');
      }

      setAwards(data.awards as Award[]);
      setTotal(data.total);
      setPages(data.pages);
      setUsingMock(false);

      // Also fetch alerts stats
      const alertsRes = await fetch('/api/alerts');
      const alertsData = await alertsRes.json();
      if (alertsData.summary) {
        setStats(alertsData.summary);
      }
      if (alertsData.breakdown) {
        const bd = alertsData.breakdown.map((b: any) => ({
          type: b.connection_type,
          label: CONNECTION_LABELS[b.connection_type as ConnectionType] ?? b.connection_type,
          total: b.total,
          count: b.count,
        }));
        setConnectionBreakdown(bd);
      }
    } catch {
      setUsingMock(true);
      // Apply filters to mock data
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
          return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
        });
      setAwards(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [currentPage, connectionFilter, categoryFilter, flagFilter, search, sortKey, sortDir]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

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
            <button onClick={loadData} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-slate-800">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link href="/dashboard" className="px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Dashboard</Link>
            <Link href="/about" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800">About</Link>
          </div>
        </div>
      </nav>

      {/* Stats Row */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Tracked', value: fmt.compact(stats.total_dollars), sub: `${stats.total_awards} awards`, color: 'text-white' },
              { label: 'Contracts', value: String(stats.contract_count ?? 0), sub: fmt.compact(stats.total_dollars * 0.85), color: 'text-blue-400' },
              { label: 'Grants', value: String(stats.grant_count ?? 0), sub: fmt.compact(stats.total_dollars * 0.15), color: 'text-green-400' },
              { label: 'Connected Vendors', value: fmt.compact(stats.connected_dollars), sub: 'political link', color: 'text-purple-400' },
              { label: 'No-Bid / Sole-Source', value: fmt.compact(stats.no_bid_dollars), sub: 'flagged', color: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
                <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">{stat.label}</div>
                <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-slate-500 text-xs mt-1 font-mono">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-5">

            {/* Connection Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest">By Connection</h3>
              <div className="space-y-3">
                {connectionBreakdown.map((group) => (
                  <div key={group.type}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 text-sm font-medium">{group.label}</span>
                      <span className="text-slate-500 text-xs font-mono">{fmt.compact(group.total)} <span className="text-slate-600">({group.count})</span></span>
                    </div>
                    <MiniBar value={group.total} max={Math.max(...connectionBreakdown.map(g => g.total), 1)} color={
                      group.type === 'elon_musk' ? '#a855f7' :
                      group.type === 'trump_family' ? '#ef4444' :
                      group.type === 'trump_ally' ? '#3b82f6' : '#475569'
                    } />
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                <Filter size={14} /> Filters
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1 block">Category</label>
                  <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                    <option value="all">All Types</option>
                    <option value="contract">Contracts</option>
                    <option value="grant">Grants</option>
                    <option value="loan">Loans</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1 block">Connection</label>
                  <select value={connectionFilter} onChange={(e) => { setConnectionFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                    <option value="all">All Connections</option>
                    <option value="elon_musk">Elon Musk</option>
                    <option value="trump_family">Trump Family</option>
                    <option value="trump_ally">Trump Ally</option>
                    <option value="suspected">Suspected</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1 block">Flag Type</label>
                  <select value={flagFilter} onChange={(e) => { setFlagFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                    <option value="all">All Flags</option>
                    <option value="no_bid">No Bid</option>
                    <option value="sole_source">Sole Source</option>
                    <option value="related_party">Related Party</option>
                    <option value="inflated">Inflated</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1 block">Sort By</label>
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                    <option value="dollar_amount">Amount</option>
                    <option value="risk_score">Risk Score</option>
                    <option value="posted_date">Date</option>
                    <option value="recipient_name">Vendor</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-5">

            {/* Search */}
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search vendors, agencies, descriptions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-white placeholder-slate-500 w-full focus:outline-none text-sm"
              />
              {search && <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white text-xs">Clear</button>}
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      {[
                        { key: 'recipient_name', label: 'Recipient' },
                        { key: 'dollar_amount', label: 'Amount' },
                        { key: 'award_category', label: 'Type' },
                        { key: 'competition_status', label: 'Competition' },
                        { key: 'connection_type', label: 'Connection' },
                        { key: 'risk_score', label: 'Risk' },
                        { key: 'flags', label: 'Flags' },
                        { key: 'posted_date', label: 'Date' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => col.key !== 'flags' && col.key !== 'connection_type' && toggleSort(col.key)}
                          className={`px-4 py-3 text-left text-slate-400 text-xs font-medium uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-white ${sortKey === col.key ? 'text-emerald-400' : ''}`}
                        >
                          {col.label}{sortKey === col.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {awards.map((award) => (
                      <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <Link href={`/contract/${award.id}`} className="font-medium text-white hover:text-emerald-400 transition-colors">
                            {award.recipient_name}
                          </Link>
                          <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{award.description}</div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-white">{fmt.dollars(Number(award.dollar_amount))}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            award.award_category === 'contract' ? 'bg-blue-900 text-blue-300' :
                            award.award_category === 'grant' ? 'bg-green-900 text-green-300' :
                            award.award_category === 'loan' ? 'bg-purple-900 text-purple-300' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {award.award_category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            award.competition_status === 'no_bid' ? 'bg-rose-900 text-rose-300' :
                            award.competition_status === 'sole_source' ? 'bg-orange-900 text-orange-300' :
                            award.competition_status === 'limited_competition' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-emerald-900 text-emerald-300'
                          }`}>
                            {award.competition_status?.replace(/_/g, ' ') ?? 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <ConnectionBadge type={award.connection_type} />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`font-mono text-sm font-bold ${
                            Number(award.risk_score) >= 80 ? 'text-rose-400' :
                            Number(award.risk_score) >= 50 ? 'text-amber-400' :
                            'text-slate-400'
                          }`}>
                            {award.risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {award.flags?.slice(0, 2).map((f) => <FlagBadge key={f} flag={f} />)}
                            {award.flags && award.flags.length > 2 && (
                              <span className="text-slate-500 text-xs">+{award.flags.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-slate-400 text-xs font-mono">
                            {award.posted_date ? new Date(award.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {awards.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          {loading ? 'Loading...' : 'No awards match your filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 text-sm font-mono">{total.toLocaleString()} total</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Prev</button>
                    <span className="text-slate-400 text-sm font-mono">Page {currentPage} of {pages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages} className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Next</button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center text-slate-600 text-xs font-mono">
              {usingMock ? 'Demo mode — Supabase not connected. Set up env vars to enable live data.' : `Showing ${awards.length} awards · Data from USAspending.gov · Updated ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}