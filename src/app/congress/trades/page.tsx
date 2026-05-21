'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line
} from 'recharts';
import {
  Search, Filter, RefreshCw, ExternalLink, TrendingUp, TrendingDown,
  DollarSign, Activity, Users, Eye, AlertTriangle, ChevronDown,
  ChevronUp, Shield, Target, ArrowRight, ArrowUpRight, ArrowDownRight,
  Building2, Scale, Zap, ArrowUp, ArrowDown, Clock
} from 'lucide-react';

const CHART_COLORS = {
  Democrat: '#3b82f6',
  Republican: '#ef4444',
  Independent: '#a855f7',
};

const TX_COLORS: Record<string, string> = {
  BUY: '#10b981',
  SELL: '#ef4444',
  EXCHANGE: '#f97316',
  EXERCISE: '#eab308',
};

const SECTOR_COLORS: Record<string, string> = {
  'AI / Tech': '#8b5cf6',
  'AI / Chips': '#06b6d4',
  Defense: '#ef4444',
  Aerospace: '#f97316',
  'Oil & Gas': '#fbbf24',
  'Renewable Energy': '#22c55e',
  Finance: '#10b981',
  'Hedge Funds': '#14b8a6',
  Biotech: '#ec4899',
  Pharma: '#f43f5e',
  Media: '#a855f7',
  Telecom: '#3b82f6',
  'Real Estate': '#f59e0b',
  Consumer: '#84cc16',
  Automotive: '#eab308',
  Industrials: '#64748b',
  Crypto: '#f97316',
  ETFs: '#475569',
  Other: '#334155',
};

const TICKER_SECTORS: Record<string, string> = {
  // AI / Tech
  MSFT: 'AI / Tech', GOOGL: 'AI / Tech', GOOG: 'AI / Tech', META: 'AI / Tech',
  AMZN: 'AI / Tech', AAPL: 'AI / Tech', CRM: 'AI / Tech',
  ORCL: 'AI / Tech', IBM: 'AI / Tech', ADBE: 'AI / Tech', SNOW: 'AI / Tech',
  UBER: 'AI / Tech', SHOP: 'AI / Tech', SQ: 'AI / Tech', SPOT: 'AI / Tech',
  SNAP: 'AI / Tech', PIN: 'AI / Tech', MTCH: 'AI / Tech',
  NOW: 'AI / Tech', WDAY: 'AI / Tech', APP: 'AI / Tech', DDOG: 'AI / Tech',
  HOOD: 'AI / Tech', EPAM: 'AI / Tech', CTSH: 'AI / Tech', ACN: 'AI / Tech',
  FIS: 'AI / Tech', GPN: 'AI / Tech', GEN: 'AI / Tech',
  CSGP: 'AI / Tech', INTU: 'AI / Tech', ADP: 'AI / Tech',
  PAYX: 'AI / Tech', PAYC: 'AI / Tech', TRMB: 'AI / Tech',
  FICO: 'AI / Tech', JKHY: 'AI / Tech', GDDY: 'AI / Tech',
  // AI / Chips
  NVDA: 'AI / Chips', AMD: 'AI / Chips', INTC: 'AI / Chips', QCOM: 'AI / Chips',
  AMAT: 'AI / Chips', LRCX: 'AI / Chips', KLAC: 'AI / Chips', ASML: 'AI / Chips',
  MU: 'AI / Chips', WDC: 'AI / Chips', STX: 'AI / Chips', NXPI: 'AI / Chips',
  TSM: 'AI / Chips', AVGO: 'AI / Chips',
  // Defense
  PLTR: 'Defense', BA: 'Defense', RTX: 'Defense', LMT: 'Defense',
  NOC: 'Defense', GD: 'Defense', LHX: 'Defense', TDY: 'Defense',
  HII: 'Defense', LDOS: 'Defense', SAIC: 'Defense', CACI: 'Defense',
  // Aerospace
  ULCC: 'Aerospace', DAL: 'Aerospace', LUV: 'Aerospace', AAL: 'Aerospace',
  UAL: 'Aerospace', ALK: 'Aerospace', SKYW: 'Aerospace', MESA: 'Aerospace',
  TDG: 'Aerospace',
  // Oil & Gas
  XOM: 'Oil & Gas', CVX: 'Oil & Gas', COP: 'Oil & Gas', EOG: 'Oil & Gas',
  SLB: 'Oil & Gas', HAL: 'Oil & Gas', DVN: 'Oil & Gas', OXY: 'Oil & Gas',
  PXD: 'Oil & Gas', MRO: 'Oil & Gas', FANG: 'Oil & Gas', CTRA: 'Oil & Gas',
  ET: 'Oil & Gas', ENB: 'Oil & Gas',
  // Renewable Energy
  ENPH: 'Renewable Energy', RUN: 'Renewable Energy', SOLV: 'Renewable Energy',
  NEE: 'Renewable Energy', ED: 'Renewable Energy', AEP: 'Renewable Energy',
  // Finance
  GS: 'Finance', MS: 'Finance', JPM: 'Finance', BAC: 'Finance',
  WFC: 'Finance', C: 'Finance', USB: 'Finance', PNC: 'Finance',
  TFC: 'Finance', COF: 'Finance', AXP: 'Finance', DFH: 'Finance',
  FULT: 'Finance', SYF: 'Finance', ALLY: 'Finance', FSV: 'Finance',
  SCHW: 'Finance', TROW: 'Finance', IVZ: 'Finance',
  APO: 'Finance', CG: 'Finance', BLK: 'Finance',
  VOYG: 'Finance', NDAQ: 'Finance',
  // Biotech / Pharma
  MRNA: 'Biotech', BIIB: 'Biotech', REGN: 'Biotech', VRTX: 'Biotech',
  GILD: 'Biotech', BMRN: 'Biotech', CRSP: 'Biotech', INT: 'Biotech',
  PFE: 'Pharma', JNJ: 'Pharma', LLY: 'Pharma', ABBV: 'Pharma',
  MRK: 'Pharma', BMY: 'Pharma', AMGN: 'Pharma',
  TMO: 'Biotech', PKG: 'Biotech', STE: 'Biotech', BBIO: 'Biotech',
  // Medical Devices
  PODD: 'Medical Devices', DXCM: 'Medical Devices',
  // Healthcare
  UNH: 'Healthcare', HUM: 'Healthcare', CI: 'Healthcare',
  MCK: 'Healthcare', ABC: 'Healthcare',
  // Media
  DIS: 'Media', WBD: 'Media', PARA: 'Media',
  CMCSA: 'Media', CHTR: 'Media',
  // Telecom
  VZ: 'Telecom', T: 'Telecom', CCI: 'Telecom', EQIX: 'Telecom',
  TMUS: 'Telecom', LITE: 'Telecom',
  // Real Estate
  PLD: 'Real Estate', SPG: 'Real Estate', O: 'Real Estate',
  WELL: 'Real Estate', ARE: 'Real Estate',
  // Consumer
  WMT: 'Consumer', TGT: 'Consumer', COST: 'Consumer', HD: 'Consumer',
  LOW: 'Consumer', KO: 'Consumer', PEP: 'Consumer', PG: 'Consumer',
  MDLZ: 'Consumer', KMB: 'Consumer', GIS: 'Consumer', K: 'Consumer',
  KHC: 'Consumer', DG: 'Consumer', DLTR: 'Consumer', OMC: 'Consumer',
  NKE: 'Consumer', TSCO: 'Consumer', PFGC: 'Consumer', DRI: 'Consumer',
  SHW: 'Consumer',
  // Automotive
  TSLA: 'Automotive', RIVN: 'Automotive', F: 'Automotive', GM: 'Automotive',
  // Industrials
  CAT: 'Industrials', DE: 'Industrials', HON: 'Industrials',
  GE: 'Industrials', UPS: 'Industrials', FDX: 'Industrials', ETN: 'Industrials',
  CARR: 'Industrials', PH: 'Industrials', AME: 'Industrials',
  PWR: 'Industrials', EFX: 'Industrials', FISV: 'Industrials',
  // Cybersecurity
  PANW: 'Cybersecurity', FTNT: 'Cybersecurity', CRWD: 'Cybersecurity',
  // Crypto
  COIN: 'Crypto', MSTR: 'Crypto', GBTC: 'Crypto', ETHE: 'Crypto',
  // ETFs / Index
  SPY: 'ETFs', QQQ: 'ETFs', VTI: 'ETFs', IWM: 'ETFs',
  VOO: 'ETFs', VEA: 'ETFs', VWO: 'ETFs', EFA: 'ETFs',
  AGG: 'ETFs', TLT: 'ETFs', GLD: 'ETFs', SLV: 'ETFs',
  // Specialty
  DASH: 'Specialty', MLM: 'Specialty', VRSK: 'Specialty',
  BR: 'Specialty', PGR: 'Specialty',
};

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

function getSector(ticker: string): string {
  return TICKER_SECTORS[ticker] ?? 'Other';
}

function getPartyColor(party: string): string {
  return (CHART_COLORS as Record<string, string>)[party] ?? '#64748b';
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Trade {
  id: string;
  member_name: string;
  member_chamber: 'House' | 'Senate';
  member_party: string;
  member_state: string;
  ticker: string;
  company_name: string;
  transaction_type: 'BUY' | 'SELL' | 'EXCHANGE' | 'EXERCISE';
  amount_min: number;
  amount_max: number;
  amount_range: string;
  transaction_date: string;
  flags: string[];
  has_federal_contract: boolean;
}

interface TopMember {
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  total_trades: number;
  estimated_volume: number;
  buys: number;
  sells: number;
  unique_tickers: number;
}

interface StockAgg {
  ticker: string;
  company_name: string;
  total_trades: number;
  buys: number;
  sells: number;
  estimated_volume: number;
  num_members: number;
}

// ─── Trades Table ─────────────────────────────────────────────────────────────

function TradesTable({ trades, onSearch }: { trades: Trade[]; onSearch: (q: string) => void }) {
  const [search, setSearch] = useState('');
  const [chamber, setChamber] = useState('all');
  const [party, setParty] = useState('all');
  const [txType, setTxType] = useState('all');
  const [sortKey, setSortKey] = useState('transaction_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const filtered = trades.filter(t => {
    if (search && !`${t.member_name} ${t.ticker} ${t.company_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (chamber !== 'all' && t.member_chamber !== chamber) return false;
    if (party !== 'all' && t.member_party !== party) return false;
    if (txType !== 'all' && t.transaction_type !== txType) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortKey];
    const bVal = (b as unknown as Record<string, unknown>)[sortKey];
    const va: string | number = aVal == null ? '' : typeof aVal === 'string' || typeof aVal === 'number' ? aVal : String(aVal);
    const vb: string | number = bVal == null ? '' : typeof bVal === 'string' || typeof bVal === 'number' ? bVal : String(bVal);
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const paginated = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(sorted.length / LIMIT);

  function sort(col: string) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search member, ticker, company..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select value={chamber} onChange={e => { setChamber(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
          <option value="all">All Chambers</option>
          <option value="House">House</option>
          <option value="Senate">Senate</option>
        </select>
        <select value={party} onChange={e => { setParty(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
          <option value="all">All Parties</option>
          <option value="Democrat">Democrat</option>
          <option value="Republican">Republican</option>
        </select>
        <select value={txType} onChange={e => { setTxType(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
          <option value="all">All Types</option>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <span className="text-slate-400 text-xs ml-auto">{filtered.length} trades</span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {[['member_name', 'Member'], ['ticker', 'Ticker'], ['transaction_type', 'Type'], ['amount_max', 'Amount'], ['transaction_date', 'Date'], ['flags', 'Signal']].map(([col, label]) => (
                <th key={col} className="px-4 py-3 text-left text-slate-400 text-xs uppercase tracking-wider font-medium cursor-pointer hover:text-white" onClick={() => sort(col)}>
                  {label}<SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(t => (
              <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getPartyColor(t.member_party) }} />
                    <div>
                      <div className="text-white font-medium text-sm">{t.member_name}</div>
                      <div className="text-slate-500 text-xs">{t.member_chamber} · {t.member_state}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{t.ticker}</span>
                    <span className="text-slate-500 text-xs">{getSector(t.ticker) !== 'Other' && <span className="text-slate-600">{getSector(t.ticker)}</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
                    style={{ backgroundColor: TX_COLORS[t.transaction_type] + '20', color: TX_COLORS[t.transaction_type] }}>
                    {t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE') ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {t.transaction_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white font-mono text-sm font-semibold">{formatDollars(t.amount_max)}</div>
                  <div className="text-slate-500 text-xs">{t.amount_range}</div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.transaction_date)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {t.flags.includes('federal_contractor_overlap') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs border border-purple-700/40" title="Company has federal contracts">
                        <Building2 size={9} /> Fed
                      </span>
                    )}
                    {t.flags.includes('large_trade') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded text-xs border border-amber-700/40">
                        <DollarSign size={9} /> Big
                      </span>
                    )}
                    {t.flags.includes('suspicious') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded text-xs border border-red-700/40">
                        <AlertTriangle size={9} /> ?
                      </span>
                    )}
                    {!t.flags.length && <span className="text-slate-600 text-xs">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No trades match your filters</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-slate-500 text-xs">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white disabled:opacity-40">←</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function Leaderboard({ members }: { members: TopMember[] }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
        <Users size={14} className="text-blue-400" />
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Top Congressional Traders (90d)</h3>
      </div>
      <div className="divide-y divide-slate-800/50">
        {members.map((m, i) => (
          <Link key={m.member_name} href={`/congress/members/${slugify(m.member_name)}`} className="block px-5 py-3 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-600/20 text-orange-400' : 'bg-slate-800 text-slate-500'
            }`}>{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(m.member_party) }} />
                <span className="text-white font-medium text-sm truncate hover:text-emerald-400 transition-colors">{m.member_name}</span>
                <span className="text-slate-500 text-xs">{m.member_chamber} · {m.member_state}</span>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-slate-500">
                <span className="text-emerald-400">{m.buys} buys</span>
                <span className="text-red-400">{m.sells} sells</span>
                <span>{m.unique_tickers} tickers</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-white font-mono font-bold text-sm">{formatDollars(m.estimated_volume)}</div>
              <div className="text-slate-500 text-xs">{m.total_trades} trades</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Stock Heatmap ────────────────────────────────────────────────────────────

function StockHeatmap({ stocks }: { stocks: StockAgg[] }) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const sectorData = Object.entries(
    stocks.reduce<Record<string, { vol: number; buys: number; sells: number; count: number }>>((acc, s) => {
      const sec = getSector(s.ticker);
      if (!acc[sec]) acc[sec] = { vol: 0, buys: 0, sells: 0, count: 0 };
      acc[sec].vol += s.estimated_volume;
      acc[sec].buys += s.buys;
      acc[sec].sells += s.sells;
      acc[sec].count += s.total_trades;
      return acc;
    }, {})
  ).sort((a, b) => b[1].vol - a[1].vol);

  return (
    <div className="space-y-4">
      {/* Sector bars — expanded */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            Sector Volume — Congressional Trading (180d)
          </h3>
          <span className="text-slate-500 text-xs">{sectorData.length} sectors</span>
        </div>
        <div className="space-y-2">
          {sectorData.map(([sector, data]) => {
            const maxVol = Math.max(...sectorData.map(([, d]) => d.vol), 1);
            const pct = (data.vol / maxVol) * 100;
            return (
              <div key={sector} className="group">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-24 text-xs text-slate-300 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SECTOR_COLORS[sector] ?? '#475569' }} />
                    <span className="truncate">{sector}</span>
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all relative"
                      style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[sector] ?? '#475569' }}
                    />
                  </div>
                  <div className="w-28 text-right">
                    <span className="text-white font-mono font-bold text-sm">{formatDollars(data.vol)}</span>
                  </div>
                  <div className="w-24 text-right flex items-center justify-end gap-2">
                    <span className="text-emerald-400 text-xs font-mono">{data.buys}↑</span>
                    <span className="text-red-400 text-xs font-mono">{data.sells}↓</span>
                  </div>
                  <div className="w-12 text-right text-slate-500 text-xs font-mono">{data.count}t</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stock table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            Most Active Stocks
          </h3>
          <span className="text-slate-500 text-xs">{stocks.length} stocks tracked</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Ticker</th>
              <th className="px-5 py-3 text-right">Trades</th>
              <th className="px-5 py-3 text-right">Buys</th>
              <th className="px-5 py-3 text-right">Sells</th>
              <th className="px-5 py-3 text-right">Volume</th>
              <th className="px-5 py-3 text-right">Members</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map(s => (
              <tr key={s.ticker} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{s.ticker}</span>
                    <span className="text-slate-500 text-xs">{s.company_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-white font-mono">{s.total_trades}</td>
                <td className="px-5 py-3 text-right text-emerald-400 font-mono">{s.buys}</td>
                <td className="px-5 py-3 text-right text-red-400 font-mono">{s.sells}</td>
                <td className="px-5 py-3 text-right text-white font-mono font-semibold">{formatDollars(s.estimated_volume)}</td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">{s.num_members}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Party Breakdown ──────────────────────────────────────────────────────────

function PartyChart({ trades }: { trades: Trade[] }) {
  const data = [
    { party: 'Democrat', buys: trades.filter(t => t.member_party === 'Democrat' && (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE'))).length, sells: trades.filter(t => t.member_party === 'Democrat' && (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE'))).length, volume: trades.filter(t => t.member_party === 'Democrat').reduce((s, t) => s + (t.amount_max ?? 0), 0) },
    { party: 'Republican', buys: trades.filter(t => t.member_party === 'Republican' && (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE'))).length, sells: trades.filter(t => t.member_party === 'Republican' && (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE'))).length, volume: trades.filter(t => t.member_party === 'Republican').reduce((s, t) => s + (t.amount_max ?? 0), 0) },
  ];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
        <Scale size={14} className="text-blue-400" />
        Party Trading Breakdown
      </h3>
      <div className="space-y-4">
        {data.map(d => {
          const buyPct = Math.round((d.buys / (d.buys + d.sells || 1)) * 100) || 50;
          return (
            <div key={d.party} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPartyColor(d.party) }} />
                  <span className="text-white font-medium">{d.party}s</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-400">{d.buys} buys</span>
                  <span className="text-red-400">{d.sells} sells</span>
                  <span className="text-slate-400 font-mono">{formatDollars(d.volume)}</span>
                </div>
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500 transition-all" style={{ width: `${buyPct}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${100 - buyPct}%` }} />
              </div>
              <div className="text-xs text-slate-500 text-right">Buy/Sell ratio: {buyPct}/{100 - buyPct}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Federal Contractor Overlap ──────────────────────────────────────────────

function OverlapMap({ trades }: { trades: Trade[] }) {
  const contractTrades = trades.filter(t => t.has_federal_contract);
  const contractTickers = [...new Set(contractTrades.map(t => t.ticker))];

  // Build overlap stats from real trade data
  const tickerStats = contractTrades.reduce<Record<string, { count: number; volume: number; members: Set<string> }>>((acc, t) => {
    if (!acc[t.ticker]) acc[t.ticker] = { count: 0, volume: 0, members: new Set() };
    acc[t.ticker].count++;
    acc[t.ticker].volume += t.amount_max ?? 0;
    acc[t.ticker].members.add(t.member_name);
    return acc;
  }, {});

  const overlapData = Object.entries(tickerStats)
    .map(([ticker, stats]) => ({
      ticker,
      company: ticker,
      trade_count: stats.count,
      contract_volume: formatDollars(stats.volume),
      congress_traders: stats.members.size,
      overlap: stats.count >= 5 ? 'High' : 'Medium' as 'High' | 'Medium',
      color: '#8b5cf6',
    }))
    .sort((a, b) => b.trade_count - a.trade_count)
    .slice(0, 6);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
          <Building2 size={14} className="text-purple-400" />
          Federal Contractor × Congressional Trading Overlap
        </h3>
        <p className="text-slate-500 text-xs mt-1">Where government contract winners intersect with stock purchases by the officials who control the spending</p>
      </div>
      <div className="divide-y divide-slate-800/50">
        {overlapData.map(item => (
          <div key={item.ticker} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
            <div className="w-14 text-center">
              <div className="font-mono font-bold text-white text-lg">{item.ticker}</div>
              <div className="text-slate-500 text-xs">{item.company}</div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-4">
              <div>
                <div className="text-slate-400 text-xs uppercase tracking-wider">Trades (90d)</div>
                <div className="text-white font-mono font-bold">{item.trade_count}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs uppercase tracking-wider">Fed Contracts</div>
                <div className="text-emerald-400 font-mono font-bold">{item.contract_volume}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs uppercase tracking-wider">Congress Traders</div>
                <div className="text-white font-mono font-bold">{item.congress_traders}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs uppercase tracking-wider">Overlap</div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                  item.overlap === 'High' ? 'bg-red-900/40 text-red-400 border border-red-700/40' : 'bg-amber-900/40 text-amber-400 border border-amber-700/40'
                }`}>{item.overlap}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">{label}</span>
      </div>
      <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CongressTradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [topMembers, setTopMembers] = useState<TopMember[]>([]);
  const [stocks, setStocks] = useState<StockAgg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/congress/trades?limit=1000');
      const json = await res.json();
      const liveTrades: Trade[] = json.trades ?? [];

      // Capture last updated from response header or now
      const dateHeader = res.headers.get('date');
      setLastUpdated(dateHeader ? new Date(dateHeader).toLocaleString() : new Date().toLocaleString());

      setTrades(liveTrades);

      // Aggregate top members by volume
      const memberMap = liveTrades.reduce<Record<string, {
        member_name: string; member_party: string; member_chamber: string; member_state: string;
        total_trades: number; estimated_volume: number; buys: number; sells: number; tickers: Set<string>;
      }>>((acc, t) => {
        const key = t.member_name;
        if (!acc[key]) {
          acc[key] = { member_name: t.member_name, member_party: t.member_party, member_chamber: t.member_chamber, member_state: t.member_state, total_trades: 0, estimated_volume: 0, buys: 0, sells: 0, tickers: new Set() };
        }
        acc[key].total_trades++;
        acc[key].estimated_volume += (t.amount_max ?? 0);
        acc[key].tickers.add(t.ticker);
        if (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')) acc[key].buys++;
        else if (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')) acc[key].sells++;
        return acc;
      }, {});

      const aggregatedMembers: TopMember[] = Object.values(memberMap)
        .map(m => ({ ...m, unique_tickers: m.tickers.size }))
        .sort((a, b) => b.estimated_volume - a.estimated_volume)
        .slice(0, 10);

      setTopMembers(aggregatedMembers);

      // Aggregate stocks by ticker
      const stockMap = liveTrades.reduce<Record<string, { ticker: string; company_name: string; total_trades: number; buys: number; sells: number; estimated_volume: number; _members: Set<string> }>>((acc, t) => {
        if (!acc[t.ticker]) {
          acc[t.ticker] = { ticker: t.ticker, company_name: t.company_name, total_trades: 0, buys: 0, sells: 0, estimated_volume: 0, _members: new Set() };
        }
        acc[t.ticker].total_trades++;
        acc[t.ticker].estimated_volume += (t.amount_max ?? 0);
        acc[t.ticker]._members.add(t.member_name);
        if (t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')) acc[t.ticker].buys++;
        else if (t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')) acc[t.ticker].sells++;
        return acc;
      }, {});

      const aggregatedStocks: StockAgg[] = Object.values(stockMap)
        .map(s => ({ ticker: s.ticker, company_name: s.company_name, total_trades: s.total_trades, buys: s.buys, sells: s.sells, estimated_volume: s.estimated_volume, num_members: s._members.size }))
        .sort((a, b) => b.estimated_volume - a.estimated_volume)
        .slice(0, 20);

      setStocks(aggregatedStocks);
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const totalVolume = trades.reduce((s, t) => s + (t.amount_max ?? 0), 0);
  const buyCount = trades.filter(t => t.transaction_type === 'BUY' || t.transaction_type.includes('PURCHASE')).length;
  const sellCount = trades.filter(t => t.transaction_type === 'SELL' || t.transaction_type.includes('SALE')).length;
  const flaggedCount = trades.filter(t => t.flags.includes('federal_contractor_overlap') || t.flags.includes('large_trade')).length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/" className="text-slate-500 text-sm hover:text-white transition-colors">SlushFund</Link>
                <span className="text-slate-600">/</span>
                <span className="text-white font-bold">Congress Trades</span>
              </div>
              <h1 className="text-2xl font-black text-white">
                Politician <span className="text-emerald-400">Stock Trading</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">Stock Act disclosures — tracking who profits from their power</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-blue-400 text-xs hover:text-blue-300 font-medium">
                  <Link href="/analysis/history" className="flex items-center gap-1">
                    View 10-year history <ArrowUpRight size={12} />
                  </Link>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Clock size={11} />
                  <span>Updated {lastUpdated}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-700/40 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-mono">STOCK Act Data · Live</span>
              </div>
              <button
                onClick={fetchTrades}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Loading spinner overlay */}
        {isLoading && trades.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw size={20} className="animate-spin" />
              <span>Loading congressional trades...</span>
            </div>
          </div>
        )}

        {/* Conflict Spotlight */}
        <div className="bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-widest">New Analysis</span>
              </div>
              <h3 className="text-white font-black text-xl mb-1">Company Deep Dives — Conflict of Interest Tracker</h3>
              <p className="text-slate-400 text-sm">Cross-reference congressional stock trades against federal contract data. Track which politicians are buying stock in companies that receive government contracts.</p>
            </div>
            <Link href="/analysis/companies" className="ml-6 shrink-0 flex items-center gap-2 bg-red-900/40 border border-red-700 hover:bg-red-900/60 text-red-300 hover:text-red-200 px-4 py-3 rounded-xl text-sm font-bold transition-all">
              View All Companies <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex items-center gap-6 mt-4 text-xs text-slate-400">
            <span className="font-mono">PLTR · ORCL · NVDA · MSFT · AMZN · GS · JPM · TSLA</span>
            <span>·</span>
            <span>Federal contractors with congressional trading activity</span>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Tracked Trades" value={String(trades.length)} sub={`${lastUpdated ? 'Live data' : '—'}`} icon={Activity} color="text-blue-400" />
          <KpiCard label="Est. Volume" value={formatDollars(totalVolume)} sub="Last 90 days" icon={DollarSign} color="text-emerald-400" />
          <KpiCard label="Buy/Sell" value={`${buyCount}/${sellCount}`} sub="Demn/Rep split" icon={TrendingUp} color="text-purple-400" />
          <KpiCard label="Flagged" value={String(flaggedCount)} sub="Fed contractor overlap" icon={AlertTriangle} color="text-amber-400" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — Leaderboard + Party chart */}
          <div className="space-y-6">
            <Leaderboard members={topMembers} />
            <PartyChart trades={trades} />
          </div>

          {/* Center — Trades table (spans 2 cols visually via CSS) */}
          <div className="lg:col-span-2">
            <TradesTable trades={trades} onSearch={() => {}} />
          </div>
        </div>

        {/* Stock Heatmap */}
        <StockHeatmap stocks={stocks} />

        {/* Federal Contractor Overlap Map */}
        <OverlapMap trades={trades} />

        {/* Info bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Eye size={14} className="text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-1">About This Data</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Congressional stock trades are disclosed under the STOCK Act (2012) within 45 days of execution.
              Amounts shown are ranges (e.g., $1M-$5M), not exact figures. "Federal contractor overlap" means
              the traded company holds active federal contracts — cross-referenced with SlushFund's $17B award database.
              Data sourced from House Clerk Financial Disclosure + Senate EFD systems.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
