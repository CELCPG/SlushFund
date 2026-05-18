'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, Building2, Shield, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType } from '@/lib/types';
import { MOCK_AWARDS } from '@/lib/mock-data-new';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DefenseStats {
  totalDollars: number;
  totalAwards: number;
  muskDollars: number;
  allyDollars: number;
  noBidDollars: number;
  noBidCount: number;
  soleSourceCount: number;
  soleSourceDollars: number;
}

interface BranchOption { value: string; label: string }
interface CompetitionOption { value: string; label: string }
interface ConnectionOption { value: string; label: string }
interface SortOption { value: string; label: string }

const BRANCHES: BranchOption[] = [
  { value: 'all', label: 'All Branches' },
  { value: 'space_force', label: 'Space Force' },
  { value: 'air_force', label: 'Air Force' },
  { value: 'army', label: 'Army' },
  { value: 'navy', label: 'Navy' },
  { value: 'dha', label: 'Defense Health Agency' },
  { value: 'other', label: 'Other DoD' },
];

const COMPETITIONS: CompetitionOption[] = [
  { value: 'all', label: 'All Competition' },
  { value: 'no_bid', label: 'No-Bid' },
  { value: 'sole_source', label: 'Sole Source' },
  { value: 'limited_competition', label: 'Limited Competition' },
  { value: 'open_competition', label: 'Open Competition' },
];

const CONNECTIONS: ConnectionOption[] = [
  { value: 'all', label: 'All Connections' },
  { value: 'elon_musk', label: 'Elon Musk' },
  { value: 'trump_ally', label: 'Trump Ally' },
  { value: 'trump_family', label: 'Trump Family' },
  { value: 'connected', label: 'All Connected' },
];

const SORTS: SortOption[] = [
  { value: 'dollar_amount', label: 'Dollar Amount' },
  { value: 'risk_score', label: 'Risk Score' },
  { value: 'posted_date', label: 'Date' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function detectBranch(subAgency: string | null): string {
  if (!subAgency) return 'other';
  const s = subAgency.toLowerCase();
  if (s.includes('space force')) return 'space_force';
  if (s.includes('air force')) return 'air_force';
  if (s.includes('army')) return 'army';
  if (s.includes('navy')) return 'navy';
  if (s.includes('defense health') || s.includes('dha')) return 'dha';
  return 'other';
}

function filterDoD(awards: Award[]): Award[] {
  return awards.filter(a =>
    a.awarding_agency_code.startsWith('97') ||
    a.awarding_agency.toLowerCase().includes('defense') ||
    a.funding_agency_code.startsWith('97') ||
    a.funding_agency.toLowerCase().includes('defense')
  );
}

function computeStats(dodAwards: Award[]): DefenseStats {
  const totalDollars = dodAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);
  const totalAwards = dodAwards.length;
  const muskDollars = dodAwards
    .filter(a => a.connection_type === 'elon_musk')
    .reduce((s, a) => s + Number(a.dollar_amount), 0);
  const allyDollars = dodAwards
    .filter(a => a.connection_type === 'trump_ally' || a.connection_type === 'trump_family')
    .reduce((s, a) => s + Number(a.dollar_amount), 0);
  const noBid = dodAwards.filter(a => a.competition_status === 'no_bid');
  const soleSource = dodAwards.filter(a => a.competition_status === 'sole_source');
  const noBidDollars = noBid.reduce((s, a) => s + Number(a.dollar_amount), 0);
  return {
    totalDollars,
    totalAwards,
    muskDollars,
    allyDollars,
    noBidDollars,
    noBidCount: noBid.length + soleSource.length,
    soleSourceCount: soleSource.length,
    soleSourceDollars: soleSource.reduce((s, a) => s + Number(a.dollar_amount), 0),
  };
}

// ─── Badges ──────────────────────────────────────────────────────────────────
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

function CompetitionBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    open_competition: 'bg-emerald-900 text-emerald-300 border-emerald-700',
    unknown: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? styles.unknown}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const styles: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    non_competitive: 'bg-red-900 text-red-300 border-red-700',
    no_compete_high_value: 'bg-red-900 text-red-300 border-red-700',
    large_award: 'bg-amber-900 text-amber-300 border-amber-700',
    inflated: 'bg-pink-900 text-pink-300 border-pink-700',
    related_party: 'bg-violet-900 text-violet-300 border-violet-700',
    cost_plus: 'bg-slate-700 text-slate-300 border-slate-600',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border ${styles[flag] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {flag.replace(/_/g, ' ')}
    </span>
  );
}

function RiskScore({ score }: { score: number }) {
  const n = Number(score);
  return (
    <span className={`font-mono text-sm font-bold ${
      n >= 80 ? 'text-rose-400' :
      n >= 50 ? 'text-amber-400' :
      'text-slate-400'
    }`}>
      {n}
    </span>
  );
}

function BranchBadge({ branch }: { branch: string }) {
  const styles: Record<string, string> = {
    space_force: 'bg-indigo-900 text-indigo-200 border-indigo-700',
    air_force: 'bg-sky-900 text-sky-200 border-sky-700',
    army: 'bg-green-900 text-green-200 border-green-700',
    navy: 'bg-blue-900 text-blue-200 border-blue-700',
    dha: 'bg-cyan-900 text-cyan-200 border-cyan-700',
    other: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[branch] ?? styles.other}`}>
      {BRANCHES.find(b => b.value === branch)?.label ?? branch}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, colorClass, icon
}: {
  label: string; value: string; sub?: string; colorClass: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-start gap-3">
      <div className={`mt-0.5 shrink-0 ${colorClass}`}>{icon}</div>
      <div>
        <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-2xl font-black ${colorClass}`}>{value}</div>
        {sub && <div className="text-slate-500 text-xs mt-1 font-mono">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

export default function DefensePage() {
  const [allAwards, setAllAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [competitionFilter, setCompetitionFilter] = useState('all');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [sortKey, setSortKey] = useState('dollar_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Stats
  const [stats, setStats] = useState<DefenseStats>({
    totalDollars: 0, totalAwards: 0, muskDollars: 0, allyDollars: 0,
    noBidDollars: 0, noBidCount: 0, soleSourceCount: 0, soleSourceDollars: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contracts?category=contract&limit=100');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const dod = filterDoD(data.awards as Award[]);
      setAllAwards(dod);
      setStats(computeStats(dod));
      setUsingMock(false);
    } catch {
      const dod = filterDoD(MOCK_AWARDS);
      setAllAwards(dod);
      setStats(computeStats(dod));
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtered + sorted ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allAwards.filter(a => {
      if (branchFilter !== 'all') {
        const b = detectBranch(a.awarding_sub_agency);
        if (b !== branchFilter) return false;
      }
      if (competitionFilter !== 'all' && a.competition_status !== competitionFilter) return false;
      if (connectionFilter !== 'all') {
        if (connectionFilter === 'connected') {
          if (!a.connection_type || a.connection_type === 'none') return false;
        } else if (a.connection_type !== connectionFilter) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (!a.recipient_name.toLowerCase().includes(q) &&
            !a.description.toLowerCase().includes(q) &&
            !a.awarding_sub_agency.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === 'desc'
        ? (bv > av ? 1 : -1)
        : (av > bv ? 1 : -1);
    });
  }, [allAwards, branchFilter, competitionFilter, connectionFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
    setCurrentPage(1);
  }

  function handleFilterChange() { setCurrentPage(1); }

  const noBidRate = stats.totalAwards > 0
    ? ((stats.noBidCount / stats.totalAwards) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={20} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-medium uppercase tracking-widest">Deep Dive</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Defense Spending</h1>
            <p className="text-slate-400 mt-1">
              DoD contracts, grants, and awards — all branches, all connection types tracked.
              {usingMock && (
                <span className="ml-2 text-amber-400 text-xs font-mono border border-amber-400/30 px-2 py-0.5 rounded">Demo Mode</span>
              )}
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Total DoD Spending"
              value={fmt.compact(stats.totalDollars)}
              sub={`${stats.totalAwards.toLocaleString()} awards`}
              colorClass="text-white"
              icon={<Building2 size={18} />}
            />
            <StatCard
              label="Total Awards"
              value={stats.totalAwards.toLocaleString()}
              sub="all types"
              colorClass="text-blue-400"
              icon={<Shield size={18} />}
            />
            <StatCard
              label="Musk-Linked Awards"
              value={fmt.compact(stats.muskDollars)}
              sub="Elon Musk connected"
              colorClass="text-purple-400"
              icon={<AlertTriangle size={18} />}
            />
            <StatCard
              label="Trump Ally Awards"
              value={fmt.compact(stats.allyDollars)}
              sub="allies + family"
              colorClass="text-rose-400"
              icon={<AlertTriangle size={18} />}
            />
            <StatCard
              label="No-Bid / Sole-Source"
              value={fmt.compact(stats.noBidDollars)}
              sub={`${stats.noBidCount} awards · ${noBidRate}%`}
              colorClass="text-amber-400"
              icon={<AlertTriangle size={18} />}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-6">

          {/* Sidebar Filters */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                <Filter size={14} /> Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Branch</label>
                  <select
                    value={branchFilter}
                    onChange={(e) => { setBranchFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {BRANCHES.map(b => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Competition</label>
                  <select
                    value={competitionFilter}
                    onChange={(e) => { setCompetitionFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {COMPETITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Connection</label>
                  <select
                    value={connectionFilter}
                    onChange={(e) => { setConnectionFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {CONNECTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Sort By</label>
                  <select
                    value={sortKey}
                    onChange={(e) => { setSortKey(e.target.value); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {SORTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">

            {/* Search */}
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search vendors, descriptions, agencies..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                className="bg-transparent text-white placeholder-slate-500 w-full focus:outline-none text-sm"
              />
              {search && (
                <button onClick={() => { setSearch(''); handleFilterChange(); }} className="text-slate-500 hover:text-white text-xs">Clear</button>
              )}
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      {[
                        { key: 'recipient_name', label: 'Vendor' },
                        { key: 'dollar_amount', label: 'Amount' },
                        { key: 'awarding_sub_agency', label: 'Branch' },
                        { key: 'competition_status', label: 'Competition' },
                        { key: 'connection_type', label: 'Connection' },
                        { key: 'risk_score', label: 'Risk' },
                        { key: 'flags', label: 'Flags' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => col.key !== 'flags' && col.key !== 'connection_type' && toggleSort(col.key)}
                          className={`px-4 py-3 text-left text-slate-400 text-xs font-medium uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-white ${sortKey === col.key ? 'text-blue-400' : ''}`}
                        >
                          {col.label}{sortKey === col.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          {loading ? 'Loading defense awards...' : 'No defense awards match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((award) => (
                        <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/contract/${award.id}`}
                              className="font-medium text-white hover:text-blue-400 transition-colors"
                            >
                              {award.recipient_name}
                            </Link>
                            <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{award.description}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-white">{fmt.dollars(Number(award.dollar_amount))}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <BranchBadge branch={detectBranch(award.awarding_sub_agency)} />
                          </td>
                          <td className="px-4 py-3.5">
                            <CompetitionBadge status={award.competition_status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <ConnectionBadge type={award.connection_type} />
                          </td>
                          <td className="px-4 py-3.5">
                            <RiskScore score={award.risk_score} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {award.flags?.slice(0, 2).map((f) => <FlagBadge key={f} flag={f} />)}
                              {award.flags && award.flags.length > 2 && (
                                <span className="text-slate-500 text-xs">+{award.flags.length - 2}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 text-sm font-mono">
                  {loading ? '...' : `${filtered.length.toLocaleString()} results · Page ${currentPage} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center text-slate-600 text-xs font-mono">
              {usingMock
                ? 'Demo mode — Supabase not connected. Showing sample DoD awards.'
                : `Showing ${paginated.length} of ${filtered.length.toLocaleString()} DoD awards · Updated ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}