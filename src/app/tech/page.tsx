'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, Cpu, Cloud, Shield, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType } from '@/lib/types';
import { MOCK_AWARDS } from '@/lib/mock-data-new';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TechStats {
  total_tech: number;
  ai_companies: number;
  cloud_infra: number;
  cybersecurity: number;
  no_bid_tech: number;
  no_bid_tech_count: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TECH_VENDOR_PATTERNS = {
  'AI & ML': /xai|openai|scale\s*ai|coreweave|anthropic|anduril|palantir/i,
  'Cloud': /aws|amazon\s*web|oracle|ibm|coreweave|microsoft|google\s*cloud/i,
  'Cybersecurity': /crowd\s*strike|palo\s*alto|booz\s*allen|zscaler|cloudflare|okta|fireeye/i,
  'Software': /palantir|oracle|ibm|salesforce|servicenow|adobe|microsoft/i,
  'Hardware': /tesla|spacex|starlink|cisco|dell|hp|nvidia|intel/i,
};

const AI_COMPANIES = ['xAI Holdings', 'OpenAI Government', 'OpenAI Research', 'Scale AI', 'CoreWeave', 'Anthropic'];
const CLOUD_INFRA = ['AWS', 'Oracle', 'IBM', 'CoreWeave', 'Microsoft Azure', 'Google Cloud'];
const CYBERSECURITY = ['CrowdStrike', 'Palo Alto Networks', 'Booz Allen Hamilton', 'Zscaler', 'Cloudflare'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function classifyCategory(vendorName: string): string {
  if (/xai|openai|scale\s*ai|coreweave|anthropic|anduril|anduril\s*(ai|health)/i.test(vendorName)) return 'AI & ML';
  if (/aws|oracle|ibm|coreweave|microsoft|google\s*cloud/i.test(vendorName)) return 'Cloud';
  if (/crowd|palo\s*alto|booz\s*allen|zscaler|cloudflare/i.test(vendorName)) return 'Cybersecurity';
  if (/palantir|oracle|ibm|salesforce|microsoft/i.test(vendorName)) return 'Software';
  if (/tesla|spacex|starlink|cisco|dell|hp|nvidia|intel/i.test(vendorName)) return 'Hardware';
  return 'Software';
}

function computeTechStats(awards: Award[]): TechStats {
  const techAwards = awards.filter(a => a.award_category === 'contract' || a.award_category === 'grant');

  const aiDollars = awards
    .filter(a => AI_COMPANIES.some(c => a.recipient_name.includes(c)))
    .reduce((s, a) => s + Number(a.dollar_amount), 0);

  const cloudDollars = awards
    .filter(a => CLOUD_INFRA.some(c => a.recipient_name.includes(c)))
    .reduce((s, a) => s + Number(a.dollar_amount), 0);

  const cyberDollars = awards
    .filter(a => CYBERSECURITY.some(c => a.recipient_name.includes(c)))
    .reduce((s, a) => s + Number(a.dollar_amount), 0);

  const noBidTechAwards = awards.filter(a =>
    (a.competition_status === 'no_bid' || a.competition_status === 'sole_source') &&
    TECH_VENDOR_PATTERNS['AI & ML'].test(a.recipient_name)
  );
  const noBidTechDollars = noBidTechAwards.reduce((s, a) => s + Number(a.dollar_amount), 0);

  return {
    total_tech: techAwards.reduce((s, a) => s + Number(a.dollar_amount), 0),
    ai_companies: aiDollars,
    cloud_infra: cloudDollars,
    cybersecurity: cyberDollars,
    no_bid_tech: noBidTechDollars,
    no_bid_tech_count: noBidTechAwards.length,
  };
}

// ─── Badge Components ─────────────────────────────────────────────────────────
function CompetitionBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    open_competition: 'bg-emerald-900 text-emerald-300 border-emerald-700',
    unknown: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  const label: Record<string, string> = {
    no_bid: 'No Bid',
    sole_source: 'Sole Source',
    limited_competition: 'Limited',
    open_competition: 'Open',
    unknown: 'Unknown',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? map.unknown}`}>
      {label[status] ?? status}
    </span>
  );
}

function ConnectionBadge({ type }: { type: string | null }) {
  if (!type || type === 'none') return <span className="text-slate-600 text-xs">—</span>;
  const map: Record<string, string> = {
    elon_musk: 'bg-purple-900 text-purple-200 border-purple-700',
    trump_family: 'bg-red-900 text-red-200 border-red-700',
    trump_ally: 'bg-blue-900 text-blue-200 border-blue-700',
    suspected: 'bg-amber-900 text-amber-200 border-amber-700',
    none: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[type] ?? map.none}`}>
      {CONNECTION_LABELS[type as ConnectionType] ?? type}
    </span>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const map: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
    related_party: 'bg-violet-900 text-violet-300 border-violet-700',
    inflated: 'bg-pink-900 text-pink-300 border-pink-700',
    no_compete_high_value: 'bg-red-900 text-red-300 border-red-700',
    large_award: 'bg-amber-900 text-amber-300 border-amber-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border ${map[flag] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {flag.replace(/_/g, ' ')}
    </span>
  );
}

function RiskBadge({ score }: { score: number }) {
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

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function TechPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [stats, setStats] = useState<TechStats>({ total_tech: 0, ai_companies: 0, cloud_infra: 0, cybersecurity: 0, no_bid_tech: 0, no_bid_tech_count: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [competitionFilter, setCompetitionFilter] = useState('all');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [sortKey, setSortKey] = useState('dollar_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(currentPage), limit: '100', sort: sortKey, dir: sortDir });
      const res = await fetch(`/api/contracts?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (!data.awards || data.awards.length === 0) throw new Error('no_data');

      // Only show tech/AI vendors from the API response
      const techNames = ['spacex', 'tesla', 'xai', 'openai', 'palantir', 'anduril', 'scale ai', 'coreweave', 'oracle', 'palo alto', 'crowdstrike', 'aws', 'ibm', 'anthropic', 'starlink', 'boring', 'neuralink'];
      const techAwards = (data.awards as Award[]).filter(a =>
        techNames.some(t => a.recipient_name.toLowerCase().includes(t))
      );

      setAwards(techAwards);
      setTotal(data.total);
      setPages(data.pages);
      setUsingMock(false);
      setStats(computeTechStats(data.awards as Award[]));
    } catch {
      setUsingMock(true);
      // Filter from mock data
      let filtered = MOCK_AWARDS.filter(a => {
        const techNames = ['spacex', 'tesla', 'xai', 'openai', 'palantir', 'anduril', 'scale ai', 'coreweave', 'oracle', 'palo alto', 'crowdstrike', 'aws', 'ibm', 'anthropic', 'starlink'];
        if (!techNames.some(t => a.recipient_name.toLowerCase().includes(t))) return false;
        return true;
      });

      // Apply category filter
      if (categoryFilter !== 'all') {
        filtered = filtered.filter(a => classifyCategory(a.recipient_name) === categoryFilter);
      }
      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter === 'no_bid') filtered = filtered.filter(a => a.competition_status === 'no_bid');
        else if (competitionFilter === 'sole_source') filtered = filtered.filter(a => a.competition_status === 'sole_source');
        else if (competitionFilter === 'limited_competition') filtered = filtered.filter(a => a.competition_status === 'limited_competition');
      }
      // Apply connection filter
      if (connectionFilter !== 'all') {
        filtered = filtered.filter(a => a.connection_type === connectionFilter);
      }
      // Apply search
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(a =>
          a.recipient_name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        );
      }

      // Sort
      filtered.sort((a, b) => {
        const av = (a as any)[sortKey] ?? 0;
        const bv = (b as any)[sortKey] ?? 0;
        return sortDir === 'desc' ? (Number(bv) > Number(av) ? 1 : -1) : (Number(av) > Number(bv) ? 1 : -1);
      });

      setAwards(filtered);
      setTotal(filtered.length);
      setPages(1);
      setStats(computeTechStats(MOCK_AWARDS));
    } finally {
      setLoading(false);
    }
  }, [currentPage, categoryFilter, competitionFilter, connectionFilter, search, sortKey, sortDir]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function handleFilterChange() { setCurrentPage(1); }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-2">
              <Cpu size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Tech &amp; AI Spending</h1>
              <p className="text-slate-400 text-sm mt-1">Government contracts and grants for technology companies, AI vendors, cloud infrastructure, and cybersecurity</p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">Total Tech $</div>
              <div className="text-2xl font-black text-white">{fmt.compact(stats.total_tech)}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">across all awards</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1 flex items-center gap-1">
                <Cpu size={10} className="text-purple-400" /> AI Companies
              </div>
              <div className="text-2xl font-black text-purple-400">{fmt.compact(stats.ai_companies)}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">xAI, OpenAI, CoreWeave, etc.</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1 flex items-center gap-1">
                <Cloud size={10} className="text-blue-400" /> Cloud / Infra
              </div>
              <div className="text-2xl font-black text-blue-400">{fmt.compact(stats.cloud_infra)}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">AWS, Oracle, IBM, CoreWeave</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1 flex items-center gap-1">
                <Shield size={10} className="text-green-400" /> Cybersecurity
              </div>
              <div className="text-2xl font-black text-green-400">{fmt.compact(stats.cybersecurity)}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">CrowdStrike, Palo Alto, Booz Allen</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1 flex items-center gap-1">
                <AlertTriangle size={10} className="text-rose-400" /> No-Bid Tech
              </div>
              <div className="text-2xl font-black text-rose-400">{fmt.compact(stats.no_bid_tech)}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">{stats.no_bid_tech_count} uncompeted awards</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-6">

          {/* Sidebar filters */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                <Filter size={14} /> Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="AI & ML">AI &amp; ML</option>
                    <option value="Cloud">Cloud / Infrastructure</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Software">Software</option>
                    <option value="Hardware">Hardware</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Competition</label>
                  <select
                    value={competitionFilter}
                    onChange={(e) => { setCompetitionFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Types</option>
                    <option value="no_bid">No Bid</option>
                    <option value="sole_source">Sole Source</option>
                    <option value="limited_competition">Limited Competition</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Connection</label>
                  <select
                    value={connectionFilter}
                    onChange={(e) => { setConnectionFilter(e.target.value); handleFilterChange(); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Connections</option>
                    <option value="elon_musk">Elon Musk</option>
                    <option value="trump_family">Trump Family</option>
                    <option value="trump_ally">Trump Ally</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-widest mb-1.5 block">Sort By</label>
                  <select
                    value={sortKey}
                    onChange={(e) => { setSortKey(e.target.value); }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="dollar_amount">Dollar Amount</option>
                    <option value="risk_score">Risk Score</option>
                    <option value="posted_date">Date</option>
                  </select>
                </div>

                {usingMock && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono border border-amber-400/30 px-2.5 py-1.5 rounded bg-amber-900/20">
                    <Database size={11} /> Demo Mode
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-5">

            {/* Search bar */}
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search vendors, contracts, descriptions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                className="bg-transparent text-white placeholder-slate-500 w-full focus:outline-none text-sm"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); handleFilterChange(); }}
                  className="text-slate-500 hover:text-white text-xs transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={loadData}
                className="shrink-0 flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-slate-800 ml-2"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
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
                        { key: 'category', label: 'Category' },
                        { key: 'competition_status', label: 'Competition' },
                        { key: 'connection_type', label: 'Connection' },
                        { key: 'risk_score', label: 'Risk' },
                        { key: 'flags', label: 'Flags' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => ['flags'].includes(col.key) ? undefined : toggleSort(col.key)}
                          className={`px-4 py-3 text-left text-slate-400 text-xs font-medium uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-white ${
                            ['flags'].includes(col.key) ? 'cursor-default' : ''
                          } ${sortKey === col.key ? 'text-emerald-400' : ''}`}
                        >
                          {col.label}
                          {sortKey === col.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {awards.map((award) => {
                      const category = classifyCategory(award.recipient_name);
                      return (
                        <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/contract/${award.id}`}
                              className="font-medium text-white hover:text-emerald-400 transition-colors"
                            >
                              {award.recipient_name}
                            </Link>
                            <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{award.description}</div>
                            <div className="text-slate-600 text-xs mt-0.5 font-mono">
                              {award.posted_date ? new Date(award.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-white">{fmt.dollars(Number(award.dollar_amount))}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              category === 'AI & ML' ? 'bg-purple-900 text-purple-300' :
                              category === 'Cloud' ? 'bg-blue-900 text-blue-300' :
                              category === 'Cybersecurity' ? 'bg-green-900 text-green-300' :
                              category === 'Hardware' ? 'bg-orange-900 text-orange-300' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {category}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <CompetitionBadge status={award.competition_status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <ConnectionBadge type={award.connection_type} />
                          </td>
                          <td className="px-4 py-3.5">
                            <RiskBadge score={award.risk_score} />
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
                      );
                    })}
                    {awards.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          {loading ? 'Loading...' : 'No tech vendors match your filters.'}
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
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-slate-400 text-sm font-mono">Page {currentPage} of {pages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pages, p + 1))}
                      disabled={currentPage === pages}
                      className="px-3 py-1 rounded text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom note */}
            <div className="text-center text-slate-600 text-xs font-mono">
              {usingMock
                ? 'Demo mode — showing mock data. Connect Supabase to enable live data.'
                : `Showing ${awards.length} tech awards · Data from USAspending.gov · Updated ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}