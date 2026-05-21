'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ArrowLeft, Users, DollarSign, TrendingUp, TrendingDown, Building2,
  Calendar, ArrowUp, ArrowDown, BarChart2, Clock, ExternalLink, Filter,
  ChevronDown, ChevronUp, AlertTriangle, Shield, ArrowRight, Search
} from 'lucide-react';
import type { CongressTrade } from '@/app/api/congress/trades/route';

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDollars(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function formatMonth(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function unslug(id: string): string {
  return id.replace(/-/g, ' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TickerStats {
  ticker: string;
  company_name: string;
  trades: number;
  buys: number;
  sells: number;
  total_volume: number;
  avg_size: number;
  has_federal_contract: boolean;
}

interface MonthlyBucket {
  month: string;
  buys: number;
  sells: number;
}

type Tab = 'overview' | 'tickers' | 'timeline' | 'contracts';

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'trades' | 'buys' | 'sells' | 'volume' | 'avg';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: SortDir }) {
  if (sortKey !== col) return <span className="text-slate-600 ml-1">↕</span>;
  return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}


export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = typeof params.id === 'string' ? params.id : '';
  const decodedName = unslug(memberId);

  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchTicker, setSearchTicker] = useState('');

  // Recent trades pagination
  const [recentPage, setRecentPage] = useState(1);
  const RECENT_LIMIT = 20;

  // ─── Fetch trades ─────────────────────────────────────────────────────────
  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/congress/trades?member=${encodeURIComponent(decodedName)}&limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrades(data.trades ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load trades');
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [decodedName]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // ─── Compute stats ────────────────────────────────────────────────────────
  const stats = (() => {
    if (!trades.length) return null;
    const buys = trades.filter(t => t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')).length;
    const sells = trades.filter(t => t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')).length;
    const tickers = [...new Set(trades.map(t => t.ticker))];
    const totalVolume = trades.reduce((s, t) => s + (t.amount_max ?? 0), 0);
    const firstTrade = trades.reduce((earliest, t) => {
      if (!t.transaction_date) return earliest;
      const d = new Date(t.transaction_date);
      return d < earliest ? d : earliest;
    }, new Date('2099-01-01'));

    const chamber = trades[0].member_chamber;
    const party = trades[0].member_party;
    const state = trades[0].member_state;

    return { totalTrades: trades.length, buys, sells, tickers: tickers.length, totalVolume, firstTrade, chamber, party, state };
  })();

  // ─── Ticker table ─────────────────────────────────────────────────────────
  const tickerStats = (() => {
    const map = new Map<string, TickerStats>();
    for (const t of trades) {
      if (!map.has(t.ticker)) {
        map.set(t.ticker, { ticker: t.ticker, company_name: t.company_name, trades: 0, buys: 0, sells: 0, total_volume: 0, avg_size: 0, has_federal_contract: t.has_federal_contract });
      }
      const s = map.get(t.ticker)!;
      s.trades++;
      if (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')) s.buys++;
      else if (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')) s.sells++;
      s.total_volume += t.amount_max ?? 0;
    }
    for (const s of map.values()) {
      s.avg_size = s.trades > 0 ? Math.round(s.total_volume / s.trades) : 0;
    }
    return [...map.values()];
  })();

  const filteredTickers = tickerStats.filter(t => {
    if (!searchTicker) return true;
    return t.ticker.toLowerCase().includes(searchTicker.toLowerCase()) ||
      t.company_name.toLowerCase().includes(searchTicker.toLowerCase());
  });

  const sortedTickers = [...filteredTickers].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortKey === 'trades') { va = a.trades; vb = b.trades; }
    else if (sortKey === 'buys') { va = a.buys; vb = b.buys; }
    else if (sortKey === 'sells') { va = a.sells; vb = b.sells; }
    else if (sortKey === 'volume') { va = a.total_volume; vb = b.total_volume; }
    else if (sortKey === 'avg') { va = a.avg_size; vb = b.avg_size; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ─── Timeline data ────────────────────────────────────────────────────────
  const monthlyData = (() => {
    const buckets = new Map<string, MonthlyBucket>();
    for (const t of trades) {
      if (!t.transaction_date) continue;
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!buckets.has(key)) buckets.set(key, { month: label, buys: 0, sells: 0 });
      const b = buckets.get(key)!;
      if (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')) b.buys++;
      else if (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')) b.sells++;
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  })();

  // ─── Recent trades ─────────────────────────────────────────────────────────
  const recentSorted = [...trades].sort((a, b) => {
    const da = a.transaction_date ?? '';
    const db = b.transaction_date ?? '';
    return db.localeCompare(da);
  });
  const recentPaginated = recentSorted.slice((recentPage - 1) * RECENT_LIMIT, recentPage * RECENT_LIMIT);
  const recentTotalPages = Math.ceil(trades.length / RECENT_LIMIT);

  // ─── Federal contractor tickers ─────────────────────────────────────────────
  const contractTickers = tickerStats.filter(t => t.has_federal_contract);

  // ─── Tab switching ─────────────────────────────────────────────────────────
  function changeTab(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-mono">Loading {decodedName}...</p>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (error || trades.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🔍</div>
        <h2 className="text-white text-2xl font-bold">Member Not Found</h2>
        <p className="text-slate-400 text-center max-w-sm">
          {error ?? `No trades found for "${decodedName}". Check the spelling or browse the full trades page.`}
        </p>
        <div className="flex gap-3 mt-2">
          <Link href="/congress/trades" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1">
            ← All Trades
          </Link>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const partyColor: Record<string, string> = {
    Democrat: 'bg-blue-900/30 text-blue-300 border-blue-700',
    Republican: 'bg-red-900/30 text-red-300 border-red-700',
    Independent: 'bg-purple-900/30 text-purple-300 border-purple-700',
  };
  const chamberColor: Record<string, string> = {
    House: 'bg-slate-800 text-slate-300 border-slate-600',
    Senate: 'bg-amber-900/30 text-amber-300 border-amber-700',
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 size={14} /> },
    { id: 'tickers', label: 'Tickers', icon: <TrendingUp size={14} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
    { id: 'contracts', label: 'Contracts', icon: <Building2 size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/congress/trades" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Congress
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-white font-semibold text-sm">Member Profile</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">{decodedName}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${partyColor[stats.party] ?? 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                {stats.party}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${chamberColor[stats.chamber] ?? 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                {stats.chamber}
              </span>
              <span className="text-slate-400 text-xs font-mono">{stats.state}</span>
              {stats.firstTrade.getFullYear() !== 2099 && (
                <span className="text-slate-500 text-xs flex items-center gap-1">
                  <Calendar size={11} /> Since {stats.firstTrade.getFullYear()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-700/40 rounded-lg shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-mono">STOCK Act · Live</span>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Trades', value: String(stats.totalTrades), icon: <BarChart2 size={13} />, color: 'text-blue-400' },
            { label: 'Est. Volume', value: formatDollars(stats.totalVolume), icon: <DollarSign size={13} />, color: 'text-emerald-400' },
            { label: 'Buys / Sells', value: `${stats.buys} / ${stats.sells}`, icon: null, color: 'text-white' },
            { label: 'Unique Tickers', value: String(stats.tickers), icon: null, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5">
              <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest mb-1.5 ${s.color}`}>
                {s.icon}<span className={s.color}>{s.label}</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-emerald-400 border-emerald-400 bg-emerald-900/10'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Ticker cards grid */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp size={13} className="text-emerald-400" />
                Traded Tickers ({tickerStats.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tickerStats
                  .sort((a, b) => b.total_volume - a.total_volume)
                  .map(t => (
                    <div key={t.ticker} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-mono font-bold text-white text-lg">{t.ticker}</div>
                          <div className="text-slate-500 text-xs truncate max-w-[140px]">{t.company_name}</div>
                        </div>
                        {t.has_federal_contract && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs border border-purple-700/40 shrink-0" title="Federal contractor">
                            <Building2 size={9} /> Fed
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <div className="text-slate-500 text-xs">Trades</div>
                          <div className="text-white font-mono font-bold text-sm">{t.trades}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Buys</div>
                          <div className="text-emerald-400 font-mono font-bold text-sm">{t.buys}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Sells</div>
                          <div className="text-red-400 font-mono font-bold text-sm">{t.sells}</div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <div className="text-slate-400 text-xs">Volume</div>
                        <div className="text-white font-mono font-semibold text-sm">{formatDollars(t.total_volume)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* All tickers summary table */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart2 size={13} className="text-blue-400" />
                All Tickers Summary
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'volume') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('volume'); setSortDir('desc'); } }}>
                          Ticker <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-left text-slate-400">Company</th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'trades') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('trades'); setSortDir('desc'); } }}>
                          Trades <SortIcon col="trades" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'buys') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('buys'); setSortDir('desc'); } }}>
                          Buys <SortIcon col="buys" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'sells') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('sells'); setSortDir('desc'); } }}>
                          Sells <SortIcon col="sells" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'volume') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('volume'); setSortDir('desc'); } }}>
                          Volume <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'avg') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('avg'); setSortDir('desc'); } }}>
                          Avg Size <SortIcon col="avg" sortKey={sortKey} sortDir={sortDir} />
                        </th>
                        <th className="px-4 py-3 text-center">Fed?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTickers.map(t => (
                        <tr key={t.ticker} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-white">{t.ticker}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{t.company_name}</td>
                          <td className="px-4 py-3 text-right text-white font-mono">{t.trades}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-mono">{t.buys}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-mono">{t.sells}</td>
                          <td className="px-4 py-3 text-right text-white font-mono font-semibold">{formatDollars(t.total_volume)}</td>
                          <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">{formatDollars(t.avg_size)}</td>
                          <td className="px-4 py-3 text-center">
                            {t.has_federal_contract
                              ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs"><Building2 size={9} /> Yes</span>
                              : <span className="text-slate-600 text-xs">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={13} className="text-amber-400" />
                Recent Trades
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Ticker</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPaginated.slice(0, 10).map(t => (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-white">{t.ticker}</div>
                          <div className="text-slate-500 text-xs">{t.company_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                            t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
                          }`}>
                            {t.transaction_type === 'BUY' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-white font-mono font-semibold">{formatDollars(t.amount_max)}</div>
                          <div className="text-slate-500 text-xs">{t.amount_range}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.transaction_date)}</td>
                        <td className="px-4 py-3">
                          {t.flags.includes('federal_contractor_overlap')
                            ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs border border-purple-700/40"><Building2 size={9} /> Fed</span>
                            : <span className="text-slate-600 text-xs">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {recentTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                    <span className="text-slate-500 text-xs">Page {recentPage} of {recentTotalPages}</span>
                    <div className="flex gap-1">
                      <button disabled={recentPage === 1} onClick={() => setRecentPage(p => p - 1)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white disabled:opacity-40">←</button>
                      <button disabled={recentPage === recentTotalPages} onClick={() => setRecentPage(p => p + 1)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white disabled:opacity-40">→</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TICKERS TAB */}
        {activeTab === 'tickers' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter tickers..."
                  value={searchTicker}
                  onChange={e => setSearchTicker(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-slate-500 text-xs">{sortedTickers.length} tickers</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'volume') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('volume'); setSortDir('desc'); } }}>
                        Ticker <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'trades') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('trades'); setSortDir('desc'); } }}>
                        Trades <SortIcon col="trades" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'buys') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('buys'); setSortDir('desc'); } }}>
                        Buys <SortIcon col="buys" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'sells') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('sells'); setSortDir('desc'); } }}>
                        Sells <SortIcon col="sells" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'volume') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('volume'); setSortDir('desc'); } }}>
                        Volume <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => { if (sortKey === 'avg') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('avg'); setSortDir('desc'); } }}>
                        Avg Size <SortIcon col="avg" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-center">Federal Contract?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTickers.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-12 text-slate-500">No tickers match your filter</td></tr>
                    )}
                    {sortedTickers.map(t => (
                      <tr key={t.ticker} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-white text-lg">{t.ticker}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{t.company_name}</td>
                        <td className="px-4 py-3 text-right text-white font-mono">{t.trades}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-mono">{t.buys}</td>
                        <td className="px-4 py-3 text-right text-red-400 font-mono">{t.sells}</td>
                        <td className="px-4 py-3 text-right text-white font-mono font-semibold">{formatDollars(t.total_volume)}</td>
                        <td className="px-4 py-3 text-right text-slate-400 font-mono text-sm">{formatDollars(t.avg_size)}</td>
                        <td className="px-4 py-3 text-center">
                          {t.has_federal_contract
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs border border-purple-700/40"><Building2 size={9} /> Yes</span>
                            : <span className="text-slate-600 text-xs">No</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart2 size={13} className="text-blue-400" />
                Monthly Trade Activity
              </h3>
              {monthlyData.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No timeline data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar dataKey="buys" name="Buys" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="sells" name="Sells" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Monthly breakdown table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Month</th>
                    <th className="px-4 py-3 text-right text-emerald-400">Buys</th>
                    <th className="px-4 py-3 text-right text-red-400">Sells</th>
                    <th className="px-4 py-3 text-right text-white">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map(m => (
                    <tr key={m.month} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300 font-medium">{m.month}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">{m.buys}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-mono">{m.sells}</td>
                      <td className="px-4 py-3 text-right text-white font-mono font-bold">{m.buys + m.sells}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTRACTS TAB */}
        {activeTab === 'contracts' && (
          <div className="space-y-4">
            {contractTickers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                <Building2 size={32} className="text-slate-600 mx-auto mb-3" />
                <h3 className="text-white font-bold mb-1">No Federal Contractor Holdings</h3>
                <p className="text-slate-400 text-sm">None of this member&apos;s traded tickers are registered federal contractors.</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl px-5 py-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-amber-200 text-sm leading-relaxed">
                    <strong>{decodedName}</strong> holds positions in {contractTickers.length} federal contractor{contractTickers.length !== 1 ? 's' : ''}.
                    These companies collectively receive billions in government contracts — contracts that Congress controls.
                  </p>
                </div>
                <ContractTickerCards tickers={contractTickers} memberName={decodedName} />
              </>
            )}
          </div>
        )}

        {/* Info bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-1">About This Data</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Congressional stock trades disclosed under the STOCK Act (2012) within 45 days. Amounts shown are ranges.
              &quot;Federal contractor&quot; means the company holds active federal contracts — cross-referenced with SlushFund&apos;s award database.
              Source: House Clerk Financial Disclosure + Senate EFD.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Contract Ticker Cards (lazy-loaded contracts per ticker) ────────────────

function ContractTickerCards({ tickers, memberName }: { tickers: TickerStats[]; memberName: string }) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [contractData, setContractData] = useState<Record<string, { loading: boolean; awards: unknown[] }>>({});

  useEffect(() => {
    if (expandedTicker && !contractData[expandedTicker]) {
      setContractData(prev => ({
        ...prev,
        [expandedTicker]: { loading: true, awards: [] },
      }));
      const tickerEntry = tickers.find(t => t.ticker === expandedTicker);
      if (!tickerEntry) return;
      fetch(`/api/contracts?search=${encodeURIComponent(tickerEntry.company_name)}&limit=5`)
        .then(r => r.json())
        .then(d => {
          setContractData(prev => ({
            ...prev,
            [expandedTicker]: { loading: false, awards: d.awards ?? [] },
          }));
        })
        .catch(() => {
          setContractData(prev => ({
            ...prev,
            [expandedTicker]: { loading: false, awards: [] },
          }));
        });
    }
  }, [expandedTicker, contractData, tickers]);

  return (
    <div className="space-y-3">
      {tickers.map(t => (
        <div key={t.ticker} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-mono font-bold text-white text-xl">{t.ticker}</div>
              <div>
                <div className="text-slate-200 text-sm font-medium">{t.company_name}</div>
                <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                  <span className="text-emerald-400">{t.buys} buys</span>
                  <span className="text-red-400">{t.sells} sells</span>
                  <span className="font-mono">{formatDollars(t.total_volume)} volume</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs border border-purple-700/40">
                <Building2 size={9} /> Fed Contractor
              </span>
              <button
                onClick={() => setExpandedTicker(expandedTicker === t.ticker ? null : t.ticker)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors"
              >
                {contractData[t.ticker]?.loading ? (
                  <><div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading...</>
                ) : expandedTicker === t.ticker ? (
                  <>Hide <ChevronUp size={13} /></>
                ) : (
                  <>Contracts <ChevronDown size={13} /></>
                )}
              </button>
            </div>
          </div>

          {expandedTicker === t.ticker && (
            <div className="border-t border-slate-800 px-5 py-4">
              {contractData[t.ticker]?.loading ? (
                <div className="text-center py-6 text-slate-500 text-sm">Loading contract data...</div>
              ) : (contractData[t.ticker]?.awards ?? []).length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No contract records found for {t.company_name} in the award database.
                  <br /><span className="text-xs">This company may be a federal contractor but has no matching records in the current dataset.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-slate-400 text-xs uppercase tracking-widest mb-2">Recent Federal Contracts</h4>
                  {(contractData[t.ticker]?.awards ?? []).map((award: any, i: number) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 text-sm font-medium">{award.recipient_name}</div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          {award.awarding_agency ?? 'Agency unknown'} · {award.competition_status?.replace(/_/g, ' ') ?? 'Competition unknown'}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-white font-mono font-bold">{formatDollars(Number(award.dollar_amount))}</div>
                        <div className="text-slate-500 text-xs">{award.posted_date ? formatDate(award.posted_date) : '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
