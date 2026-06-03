'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, ExternalLink,
  Shield, Building2, DollarSign, Clock, Filter, Search, Info, BarChart2
} from 'lucide-react';
import { COST_OVERRUNS } from '@/lib/cost-overruns-data';
import type { CostOverrun, OverrunCategory, OverrunFlag } from '@/lib/types';

// ─── Formatting helpers ─────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
function fmtFull(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const CATEGORY_LABELS: Record<OverrunCategory, string> = {
  defense_weapons: 'Weapons / Missiles',
  defense_ships: 'Naval Ships',
  defense_aircraft: 'Aircraft',
  defense_it: 'Defense IT',
  border_security: 'Border Security',
  construction: 'Construction',
  it_modernization: 'IT Modernization',
  nuclear: 'Nuclear / Energy',
  healthcare: 'Healthcare',
  space: 'Space',
  postal: 'Postal',
  civilian_it: 'Civilian IT',
  infrastructure: 'Infrastructure',
};

const CATEGORY_COLORS: Record<OverrunCategory, string> = {
  defense_weapons: '#ef4444',
  defense_ships: '#f97316',
  defense_aircraft: '#f59e0b',
  defense_it: '#8b5cf6',
  border_security: '#a855f7',
  construction: '#ec4899',
  it_modernization: '#3b82f6',
  nuclear: '#06b6d4',
  healthcare: '#10b981',
  space: '#14b8a6',
  postal: '#84cc16',
  civilian_it: '#6366f1',
  infrastructure: '#64748b',
};

const FLAG_LABELS: Record<OverrunFlag, string> = {
  sole_source: 'Sole Source',
  no_bid: 'No Bid',
  limited_competition: 'Limited Competition',
  cost_plus: 'Cost-Plus Contract',
  non_competitive: 'Non-Competitive',
  gao_high_risk: 'GAO High Risk',
  oig_investigation: 'OIG Investigation',
  congressional_override: 'Congress Override',
  political_connection: 'Political Connection',
  mid_project_contractor_change: 'Mid-Project Contractor Change',
  emergency_waiver: 'Emergency Waiver',
  single_bid: 'Single Bid',
  delayed: 'Delayed',
  scope_creep: 'Scope Creep',
  bundling: 'Bundling',
};

const COMPETITION_LABELS: Record<string, string> = {
  sole_source: 'Sole Source',
  no_bid: 'No Bid',
  limited_competition: 'Limited Competition',
  open_competition: 'Competitive',
  unknown: 'Unknown',
};

const SECTOR_OPTIONS = ['All', 'Defense', 'Civilian', 'Construction'];
const MIN_OVERRUN_OPTIONS = ['Any', '50%+', '100%+', '200%+', '500%+'];
const COMPETITION_OPTIONS = ['All', 'Sole Source / No Bid', 'Limited Competition', 'Any Non-Competitive'];

// ─── Chart color by category ───────────────────────────────────────────────────
function getBarColor(category: OverrunCategory): string {
  return CATEGORY_COLORS[category] ?? '#64748b';
}

// ─── Custom tooltip for bar chart ──────────────────────────────────────────────
function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CostOverrun;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm shadow-2xl">
      <div className="text-white font-bold mb-1">{d.project_name}</div>
      <div className="text-amber-400 font-black text-lg">+{d.overrun_pct.toLocaleString()}% overrun</div>
      <div className="text-slate-400 mt-1">
        <div>Original: <span className="text-slate-300 font-mono">{fmt(d.original_cost)}</span></div>
        <div>Final: <span className="text-red-400 font-mono font-bold">{fmt(d.final_cost)}</span></div>
      </div>
      <div className="text-slate-500 text-xs mt-2">{d.agency}</div>
      <div className="text-slate-500 text-xs">{d.contractor}</div>
    </div>
  );
}

// ─── Project detail row ─────────────────────────────────────────────────────────
function ProjectDetail({ co }: { co: CostOverrun }) {
  return (
    <div className="px-6 py-5 bg-slate-900/50 border-t border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Cost breakdown */}
        <div>
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Cost Breakdown</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Original Estimate</span>
              <span className="text-white font-mono font-semibold text-sm">{fmt(co.original_cost)}</span>
            </div>
            {co.current_cost && co.current_cost !== co.original_cost && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Current Approved</span>
                <span className="text-amber-400 font-mono font-semibold text-sm">{fmt(co.current_cost)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-700 pt-2">
              <span className="text-slate-400 text-sm">Final / Projected</span>
              <span className="text-red-400 font-mono font-black text-sm">{fmt(co.final_cost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Overrun Amount</span>
              <span className="text-red-500 font-mono font-bold text-sm">{fmt(co.overrun_dollars)}</span>
            </div>
            {co.delay_years && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Delay</span>
                <span className="text-amber-400 font-mono text-sm">{co.delay_years} years</span>
              </div>
            )}
          </div>
        </div>

        {/* Flags & contracting */}
        <div>
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Red Flags</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {co.flags.map(flag => (
              <span key={flag} className="text-xs bg-red-900/40 border border-red-700 text-red-300 px-2 py-0.5 rounded-full font-medium">
                {FLAG_LABELS[flag]}
              </span>
            ))}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Competition:</span>
              <span className={`font-semibold ${
                co.competition_status === 'no_bid' || co.competition_status === 'sole_source'
                  ? 'text-red-400' : co.competition_status === 'limited_competition'
                  ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {COMPETITION_LABELS[co.competition_status] ?? co.competition_status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Contract Type:</span>
              <span className="text-slate-200 font-medium">{co.contract_type.replace('_', ' ')}</span>
            </div>
            {co.gao_high_risk && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⚠</span>
                <span className="text-amber-400 font-semibold text-xs">On GAO High-Risk List</span>
              </div>
            )}
            {co.oig_investigation && (
              <div className="flex items-center gap-2">
                <span className="text-red-400">🔍</span>
                <span className="text-red-400 font-semibold text-xs">OIG Investigation Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Political connection & oversight */}
        <div>
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Political & Oversight</div>
          <div className="space-y-1.5 text-sm">
            {co.political_connection && (
              <div className="text-slate-300 leading-relaxed">{co.political_connection}</div>
            )}
            {co.oversight_committee && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Committee:</span>
                <span className="text-slate-200 text-xs">{co.oversight_committee}</span>
              </div>
            )}
            {(co.trump_donor || co.mar_a_lago_visitor) && (
              <div className="flex gap-1.5 mt-1">
                {co.trump_donor && <span className="text-xs bg-purple-900/40 border border-purple-600 text-purple-300 px-2 py-0.5 rounded-full">Trump Donor</span>}
                {co.mar_a_lago_visitor && <span className="text-xs bg-purple-900/40 border border-purple-600 text-purple-300 px-2 py-0.5 rounded-full">Mar-a-Lago</span>}
              </div>
            )}
            {co.contractor_total_federal_contracts && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400">Contractor Federal $:</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">{fmt(co.contractor_total_federal_contracts)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description + notes */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Project Description</div>
          <p className="text-slate-300 text-xs leading-relaxed">{co.description}</p>
          {co.program_description && (
            <p className="text-slate-400 text-xs leading-relaxed mt-1 italic">{co.program_description}</p>
          )}
        </div>
        <div>
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Notes</div>
          <p className="text-slate-300 text-xs leading-relaxed">{co.notes}</p>
        </div>
      </div>

      {/* Source links */}
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <a href={co.source_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
          <ExternalLink size={11} /> GAO / Source Report
        </a>
        {co.oig_report_urls?.map(url => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <ExternalLink size={11} /> OIG Report
          </a>
        ))}
        {co.congressional_hearing && (
          <span className="text-xs text-slate-500 italic">{co.congressional_hearing}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CostOverrunsPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'overrun_pct' | 'overrun_dollars' | 'original_cost' | 'final_cost'>('overrun_pct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<OverrunCategory | 'All'>('All');
  const [filterSector, setFilterSector] = useState('All');
  const [filterMinOverrun, setFilterMinOverrun] = useState('Any');
  const [filterCompetition, setFilterCompetition] = useState('All');
  const [filterText, setFilterText] = useState('');
  const [onlyHighRisk, setOnlyHighRisk] = useState(false);
  const [onlyOig, setOnlyOig] = useState(false);
  const [onlyPolitical, setOnlyPolitical] = useState(false);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalOriginal = useMemo(() => COST_OVERRUNS.reduce((s, c) => s + c.original_cost, 0), []);
  const totalFinal = useMemo(() => COST_OVERRUNS.reduce((s, c) => s + c.final_cost, 0), []);
  const totalOverrun = totalFinal - totalOriginal;
  const medianOverrunPct = useMemo(() => {
    const sorted = [...COST_OVERRUNS].sort((a, b) => a.overrun_pct - b.overrun_pct);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid].overrun_pct : Math.round((sorted[mid - 1].overrun_pct + sorted[mid].overrun_pct) / 2);
  }, []);
  const worstProject = useMemo(() => [...COST_OVERRUNS].sort((a, b) => b.overrun_pct - a.overrun_pct)[0], []);
  const soleSourceNoBid = COST_OVERRUNS.filter(c =>
    c.competition_status === 'no_bid' || c.competition_status === 'sole_source'
  );
  const gaoHighRisk = COST_OVERRUNS.filter(c => c.gao_high_risk);
  const oigInvestigations = COST_OVERRUNS.filter(c => c.oig_investigation);
  const politicalConnections = COST_OVERRUNS.filter(c => c.trump_donor || c.mar_a_lago_visitor || c.political_connection);
  const totalOverrunSoleSource = soleSourceNoBid.reduce((s, c) => s + c.overrun_dollars, 0);

  // ── Filtered + sorted data ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...COST_OVERRUNS];

    // Text search
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      data = data.filter(c =>
        c.project_name.toLowerCase().includes(q) ||
        c.contractor.toLowerCase().includes(q) ||
        c.agency.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }

    // Category
    if (filterCategory !== 'All') data = data.filter(c => c.category === filterCategory);

    // Sector
    if (filterSector !== 'All') {
      if (filterSector === 'Defense') data = data.filter(c => c.category.startsWith('defense') || c.category === 'nuclear');
      else if (filterSector === 'Civilian') data = data.filter(c => ['healthcare', 'space', 'postal', 'civilian_it', 'border_security', 'it_modernization'].includes(c.category));
      else if (filterSector === 'Construction') data = data.filter(c => c.category === 'construction');
    }

    // Min overrun
    if (filterMinOverrun !== 'Any') {
      const min = parseInt(filterMinOverrun);
      data = data.filter(c => c.overrun_pct >= min);
    }

    // Competition
    if (filterCompetition !== 'All') {
      if (filterCompetition === 'Sole Source / No Bid') data = data.filter(c => c.competition_status === 'no_bid' || c.competition_status === 'sole_source');
      else if (filterCompetition === 'Limited Competition') data = data.filter(c => c.competition_status === 'limited_competition');
      else if (filterCompetition === 'Any Non-Competitive') data = data.filter(c => c.competition_status === 'no_bid' || c.competition_status === 'sole_source' || c.competition_status === 'limited_competition');
    }

    // Quick filters
    if (onlyHighRisk) data = data.filter(c => c.gao_high_risk);
    if (onlyOig) data = data.filter(c => c.oig_investigation);
    if (onlyPolitical) data = data.filter(c => c.trump_donor || c.mar_a_lago_visitor || c.political_connection);

    // Sort
    data.sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1;
      return mult * ((a[sortKey] as number) - (b[sortKey] as number));
    });

    return data;
  }, [sortKey, sortDir, filterCategory, filterSector, filterMinOverrun, filterCompetition, filterText, onlyHighRisk, onlyOig, onlyPolitical]);

  // ── Chart data (top 15 by % for readability) ────────────────────────────
  const chartData = useMemo(() =>
    [...COST_OVERRUNS]
      .sort((a, b) => b.overrun_pct - a.overrun_pct)
      .slice(0, 15)
      .map(c => ({
        ...c,
        label: c.project_name.length > 28 ? c.project_name.slice(0, 26) + '…' : c.project_name,
      })),
    []
  );

  // ── Category counts ──────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: COST_OVERRUNS.length };
    for (const co of COST_OVERRUNS) {
      counts[co.category] = (counts[co.category] ?? 0) + 1;
    }
    return counts;
  }, []);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/analysis" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Analysis
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">Cost Overruns</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-slate-500 text-xs">{COST_OVERRUNS.length} projects tracked</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={28} className="text-amber-400 mt-1 shrink-0" />
            <div>
              <h1 className="text-4xl font-black text-white mb-1">Cost Overrun Tracker</h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                Federal projects that ballooned beyond their original budget with little oversight or accountability.
                {medianOverrunPct > 0 && <> Median overrun across all projects: <strong className="text-amber-400">{medianOverrunPct}%</strong>.</>}
                {' '}These are documented cases actual system-wide waste is significantly higher.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Projects Tracked</div>
            <div className="text-white font-black text-2xl">{COST_OVERRUNS.length}</div>
            <div className="text-slate-600 text-xs">documented cases</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Total Original Cost</div>
            <div className="text-white font-black text-2xl">{fmt(totalOriginal)}</div>
            <div className="text-slate-600 text-xs">initial budgets</div>
          </div>
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
            <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Total Cost Growth</div>
            <div className="text-red-400 font-black text-2xl">{fmt(totalOverrun)}</div>
            <div className="text-slate-500 text-xs">above original budgets</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Worst Offender</div>
            <div className="text-amber-400 font-black text-sm leading-tight">{worstProject?.project_name.slice(0, 22)}{worstProject && worstProject.project_name.length > 22 ? '…' : ''}</div>
            <div className="text-red-400 text-xs font-bold">+{worstProject?.overrun_pct.toLocaleString()}%</div>
          </div>
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
            <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Sole Source / No Bid</div>
            <div className="text-white font-black text-2xl">{soleSourceNoBid.length}</div>
            <div className="text-slate-500 text-xs">{fmt(totalOverrunSoleSource)} wasted</div>
          </div>
          <div className="bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-3">
            <div className="text-amber-400 text-xs uppercase tracking-widest mb-1">GAO High Risk</div>
            <div className="text-white font-black text-2xl">{gaoHighRisk.length}</div>
            <div className="text-slate-500 text-xs">programs flagged</div>
          </div>
        </div>

        {/* ── Quick filter chips ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'GAO High Risk Only', state: onlyHighRisk, set: setOnlyHighRisk },
            { label: 'OIG Investigation', state: onlyOig, set: setOnlyOig },
            { label: 'Political Connection', state: onlyPolitical, set: setOnlyPolitical },
          ].map(({ label, state, set }) => (
            <button key={label} onClick={() => set(!state)}
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                state
                  ? 'bg-red-900/40 border-red-600 text-red-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {state ? '✓ ' : ''}{label}
            </button>
          ))}
          <div className="ml-auto text-xs text-slate-600 self-center">
            {filtered.length} of {COST_OVERRUNS.length} projects shown
          </div>
        </div>

        {/* ── Bar Chart ─────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-amber-400" />
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">Top Projects by Overrun %</h2>
            <span className="text-slate-500 text-xs ml-auto">Click a bar to expand details</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <RechartsBarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} onClick={(d: any) => d && setSelectedProject(p => p === d.activeLabel ? null : d.activeLabel)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} angle={-20} textAnchor="end" interval={0} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="overrun_pct" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.category)} fillOpacity={selectedProject === entry.label ? 1 : 0.85} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-500">{CATEGORY_LABELS[cat as OverrunCategory]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters + Table ────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Filter bar */}
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search projects, contractors…"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 w-56"
                />
              </div>

              {/* Category */}
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600">
                <option value="All">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v} ({categoryCounts[k] ?? 0})</option>
                ))}
              </select>

              {/* Sector */}
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600">
                {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Min overrun */}
              <select value={filterMinOverrun} onChange={e => setFilterMinOverrun(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600">
                {MIN_OVERRUN_OPTIONS.map(s => <option key={s} value={s}>{s} Overrun</option>)}
              </select>

              {/* Competition */}
              <select value={filterCompetition} onChange={e => setFilterCompetition(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600">
                {COMPETITION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Clear */}
              {(filterCategory !== 'All' || filterSector !== 'All' || filterMinOverrun !== 'Any' || filterCompetition !== 'All' || filterText || onlyHighRisk || onlyOig || onlyPolitical) && (
                <button onClick={() => { setFilterCategory('All'); setFilterSector('All'); setFilterMinOverrun('Any'); setFilterCompetition('All'); setFilterText(''); setOnlyHighRisk(false); setOnlyOig(false); setOnlyPolitical(false); }}
                  className="text-xs text-slate-500 hover:text-white transition-colors ml-auto">
                  Clear filters ×
                </button>
              )}
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-800/50 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-widest">
            <div className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('overrun_pct')}>
              Project <SortIcon k="overrun_pct" />
            </div>
            <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('overrun_dollars')}>
              Overrun $ <SortIcon k="overrun_dollars" />
            </div>
            <div className="col-span-1 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('overrun_pct')}>
              % <SortIcon k="overrun_pct" />
            </div>
            <div className="col-span-2">Contractor</div>
            <div className="col-span-1">Agency</div>
            <div className="col-span-2">Flags</div>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-slate-600 text-4xl mb-3">🔍</div>
              <div className="text-slate-400 font-semibold">No projects match your filters</div>
              <div className="text-slate-600 text-xs mt-1">Try adjusting your filters or clearing them</div>
            </div>
          ) : (
            filtered.map(co => (
              <div key={co.id} className="border-b border-slate-800 last:border-0">
                {/* Summary row */}
                <button
                  onClick={() => setSelectedProject(p => p === co.id ? null : co.id)}
                  className={`w-full text-left px-5 py-3.5 hover:bg-slate-800/50 transition-colors grid grid-cols-12 gap-2 items-start ${selectedProject === co.id ? 'bg-slate-800/40' : ''}`}
                >
                  {/* Project name + badges */}
                  <div className="col-span-4 flex items-start gap-2">
                    <span className="text-slate-400 text-xs mt-0.5 shrink-0">{selectedProject === co.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                    <div>
                      <div className="text-white text-sm font-semibold leading-tight">{co.project_name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{co.start_year}{co.end_year ? `–${co.end_year}` : '–ongoing'}</span>
                        {co.gao_high_risk && <span className="text-xs bg-amber-900/40 border border-amber-700 text-amber-300 px-1.5 py-0.5 rounded font-medium">GAO High Risk</span>}
                        {co.oig_investigation && <span className="text-xs bg-red-900/40 border border-red-700 text-red-300 px-1.5 py-0.5 rounded font-medium">OIG</span>}
                      </div>
                    </div>
                  </div>

                  {/* Overrun dollars */}
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-red-400 font-mono font-bold text-sm">{fmt(co.overrun_dollars)}</span>
                    <span className="text-slate-600 text-xs">above original</span>
                  </div>

                  {/* Overrun pct */}
                  <div className="col-span-1 text-right">
                    <span className={`font-mono font-black text-sm ${co.overrun_pct >= 500 ? 'text-red-500' : co.overrun_pct >= 100 ? 'text-red-400' : co.overrun_pct >= 50 ? 'text-amber-400' : 'text-slate-300'}`}>
                      +{co.overrun_pct.toLocaleString()}%
                    </span>
                  </div>

                  {/* Contractor */}
                  <div className="col-span-2 text-slate-300 text-xs leading-relaxed">{co.contractor}</div>

                  {/* Agency */}
                  <div className="col-span-1 text-slate-500 text-xs leading-relaxed">{co.awarding_subagency ?? co.agency}</div>

                  {/* Flags */}
                  <div className="col-span-2 flex flex-wrap gap-1">
                    {(co.competition_status === 'no_bid' || co.competition_status === 'sole_source') && (
                      <span className="text-xs bg-red-900/30 border border-red-800 text-red-300 px-1.5 py-0.5 rounded font-medium">Sole Source</span>
                    )}
                    {co.competition_status === 'limited_competition' && (
                      <span className="text-xs bg-amber-900/30 border border-amber-800 text-amber-300 px-1.5 py-0.5 rounded font-medium">Limited</span>
                    )}
                    {co.trump_donor && <span className="text-xs bg-purple-900/30 border border-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-medium">Trump Donor</span>}
                    {co.political_connection && !co.trump_donor && <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Political</span>}
                  </div>
                </button>

                {/* Expanded detail */}
                {selectedProject === co.id && <ProjectDetail co={co} />}
              </div>
            ))
          )}
        </div>

        {/* ── Disclaimer ─────────────────────────────────────────────────── */}
        <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-4 flex gap-3">
          <Info size={14} className="text-slate-600 mt-0.5 shrink-0" />
          <p className="text-slate-500 text-xs leading-relaxed">
            All cost data is sourced from publicly available GAO reports, OIG investigations, congressional testimony, NASA/Navy/DoD budget documents, and USAspending.gov. Overrun percentages are calculated from the original budgeted cost versus the most recent approved estimate or final cost. Some projects may have had legitimate scope changes that justify cost growth the purpose of this tracker is accountability, not presumption of fraud. Median overrun across all projects: <strong className="text-slate-400">{medianOverrunPct}%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
