'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, Cell
} from 'recharts';
import {
  ArrowLeft, RefreshCw, Clock, DollarSign, TrendingUp, Activity,
  Users, ChevronDown, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import type { CongressTrade } from '@/app/api/congress/trades/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDollars(n: number | null | undefined): string {
  if (!n && n !== 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function formatFullDollars(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type PartyKey = 'dem' | 'rep';
type ChamberKey = 'senate' | 'house';

interface YearPartyAgg {
  year: number;
  dem_trades: number;
  rep_trades: number;
  dem_volume: number;
  rep_volume: number;
  dem_senate: number;
  dem_house: number;
  rep_senate: number;
  rep_house: number;
  dem_buys: number;
  dem_sells: number;
  rep_buys: number;
  rep_sells: number;
}

interface MemberYearAgg {
  member_name: string;
  member_party: string;
  member_chamber: string;
  member_state: string;
  total_trades: number;
  estimated_volume: number;
  buys: number;
  sells: number;
  unique_tickers: number;
  _tickers: Set<string>;
}

type ChartMode = 'trades' | 'volume' | 'chamber';

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isVolume = d.dem_volume !== undefined;
  const demVal = isVolume ? d.dem_volume : d.dem_trades;
  const repVal = isVolume ? d.rep_volume : d.rep_trades;
  const demLabel = isVolume ? formatFullDollars(demVal) : `${demVal} trades`;
  const repLabel = isVolume ? formatFullDollars(repVal) : `${repVal} trades`;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-sm">
      <div className="text-white font-bold text-base mb-2">{label}</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-blue-400 font-medium">Democrats:</span>
          <span className="text-white font-mono font-semibold">{demLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-red-400 font-medium">Republicans:</span>
          <span className="text-white font-mono font-semibold">{repLabel}</span>
        </div>
        <div className="border-t border-slate-700 pt-1.5 mt-2 flex justify-between">
          <span className="text-slate-400 text-xs">Total:</span>
          <span className="text-white font-mono font-bold text-xs">
            {isVolume ? formatFullDollars(demVal + repVal) : `${d.dem_trades + d.rep_trades} trades`}
          </span>
        </div>
      </div>
    </div>
  );
}

function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-sm">
      <div className="text-white font-bold mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-300 text-xs">{p.name}</span>
          </div>
          <span className="text-white font-mono text-xs font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('trades');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [chamberFilter, setChamberFilter] = useState<string>('all');
  const [yearRange, setYearRange] = useState<[number, number]>([2016, 2026]);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/congress/trades?limit=1000');
      const json = await res.json();
      setTrades(json.trades ?? []);
      const dateHeader = res.headers.get('date');
      setLastUpdated(dateHeader ? new Date(dateHeader).toLocaleString() : new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // ── Aggregate by year + party ──────────────────────────────────────────────
  const aggByYear: YearPartyAgg[] = (() => {
    const map: Record<number, YearPartyAgg> = {};
    for (let y = yearRange[0]; y <= yearRange[1]; y++) {
      map[y] = {
        year: y,
        dem_trades: 0, rep_trades: 0,
        dem_volume: 0, rep_volume: 0,
        dem_senate: 0, dem_house: 0,
        rep_senate: 0, rep_house: 0,
        dem_buys: 0, dem_sells: 0,
        rep_buys: 0, rep_sells: 0,
      };
    }

    for (const t of trades) {
      if (!t.transaction_date) continue;
      const year = new Date(t.transaction_date).getFullYear();
      if (year < yearRange[0] || year > yearRange[1]) continue;
      if (chamberFilter !== 'all' && t.member_chamber !== chamberFilter) continue;

      const isDem = t.member_party === 'Democrat';
      const isRep = t.member_party === 'Republican';
      const partyKey: PartyKey = isDem ? 'dem' : 'rep';
      const chamberKey: ChamberKey = t.member_chamber.toLowerCase() as ChamberKey;
      if (partyKey === 'dem') {
        map[year].dem_trades++;
        map[year].dem_volume += t.amount_max ?? 0;
        if (chamberKey === 'senate') map[year].dem_senate++;
        else map[year].dem_house++;
        if (t.transaction_type === 'BUY') map[year].dem_buys++;
        else if (t.transaction_type === 'SELL') map[year].dem_sells++;
      } else {
        map[year].rep_trades++;
        map[year].rep_volume += t.amount_max ?? 0;
        if (chamberKey === 'senate') map[year].rep_senate++;
        else map[year].rep_house++;
        if (t.transaction_type === 'BUY') map[year].rep_buys++;
        else if (t.transaction_type === 'SELL') map[year].rep_sells++;
      }
    }

    return Object.values(map).sort((a, b) => a.year - b.year);
  })();

  // ── Aggregate leaderboard by year ─────────────────────────────────────────
  const leaderboardByYear: MemberYearAgg[] = (() => {
    const map: Record<string, MemberYearAgg> = {};
    for (const t of trades) {
      if (!t.transaction_date) continue;
      const year = new Date(t.transaction_date).getFullYear();
      if (year !== selectedYear) continue;
      if (t.member_party !== 'Democrat' && t.member_party !== 'Republican') continue;
      if (chamberFilter !== 'all' && t.member_chamber !== chamberFilter) continue;

      const key = t.member_name;
      if (!map[key]) {
        map[key] = { member_name: t.member_name, member_party: t.member_party, member_chamber: t.member_chamber, member_state: t.member_state, total_trades: 0, estimated_volume: 0, buys: 0, sells: 0, unique_tickers: 0, _tickers: new Set() };
      }
      map[key].total_trades++;
      map[key].estimated_volume += t.amount_max ?? 0;
      map[key]._tickers.add(t.ticker);
      if (t.transaction_type === 'BUY') map[key].buys++;
      else if (t.transaction_type === 'SELL') map[key].sells++;
    }
    return Object.values(map)
      .map(m => ({ ...m, unique_tickers: m._tickers.size }))
      .sort((a, b) => b.estimated_volume - a.estimated_volume)
      .slice(0, 10);
  })();

  // ── Top sectors for most active year ───────────────────────────────────────
  const topSectorsByYear = (() => {
    const sectors: Record<string, { count: number; vol: number; dem: number; rep: number }> = {};
    const TICKER_SECTORS: Record<string, string> = {
      NVDA: 'AI/Chips', AMD: 'AI/Chips', INTC: 'AI/Chips', QCOM: 'AI/Chips',
      MSFT: 'AI/Tech', GOOGL: 'AI/Tech', GOOG: 'AI/Tech', META: 'AI/Tech',
      AMZN: 'AI/Tech', AAPL: 'AI/Tech',
      PLTR: 'Defense', BA: 'Defense', RTX: 'Defense', LMT: 'Defense',
      NOC: 'Defense', GD: 'Defense', LHX: 'Defense',
      XOM: 'Energy', CVX: 'Energy', COP: 'Energy', EOG: 'Energy',
      GS: 'Finance', MS: 'Finance', JPM: 'Finance', BAC: 'Finance', BLK: 'Finance',
      TSLA: 'Auto/EV', F: 'Auto/EV', RIVN: 'Auto/EV',
      PYPL: 'Fintech', SQ: 'Fintech', COIN: 'Crypto',
      SPY: 'ETF', QQQ: 'ETF', VTI: 'ETF', IWM: 'ETF',
    };

    for (const t of trades) {
      if (!t.transaction_date) continue;
      const year = new Date(t.transaction_date).getFullYear();
      if (year !== selectedYear) continue;
      const sector = TICKER_SECTORS[t.ticker] ?? 'Other';
      if (!sectors[sector]) sectors[sector] = { count: 0, vol: 0, dem: 0, rep: 0 };
      sectors[sector].count++;
      sectors[sector].vol += t.amount_max ?? 0;
      if (t.member_party === 'Democrat') sectors[sector].dem++;
      if (t.member_party === 'Republican') sectors[sector].rep++;
    }

    return Object.entries(sectors)
      .map(([sector, d]) => ({ sector, ...d }))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 6);
  })();

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalTrades = trades.filter(t => t.member_party === 'Democrat' || t.member_party === 'Republican').length;
  const totalVolume = trades
    .filter(t => t.member_party === 'Democrat' || t.member_party === 'Republican')
    .reduce((s, t) => s + (t.amount_max ?? 0), 0);
  const mostActiveYear = aggByYear.reduce((max, y) =>
    (y.dem_trades + y.rep_trades) > (max.dem_trades + max.rep_trades) ? y : max, aggByYear[0] ?? { year: 0, dem_trades: 0, rep_trades: 0 });
  const topTickerEntry = Object.entries(
    trades.reduce<Record<string, number>>((acc, t) => {
      acc[t.ticker] = (acc[t.ticker] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const availableYears = aggByYear.map(y => y.year).filter(y => y >= yearRange[0] && y <= yearRange[1]);

  // ── Chart Data ─────────────────────────────────────────────────────────────
  const barChartData = aggByYear.map(y => ({
    year: String(y.year),
    dem_trades: y.dem_trades,
    rep_trades: y.rep_trades,
    dem_volume: y.dem_volume,
    rep_volume: y.rep_volume,
    dem_senate: y.dem_senate,
    dem_house: y.dem_house,
    rep_senate: y.rep_senate,
    rep_house: y.rep_house,
    dem_buys: y.dem_buys,
    dem_sells: y.dem_sells,
    rep_buys: y.rep_buys,
    rep_sells: y.rep_sells,
  }));

  const lineChartData = aggByYear.map(y => ({
    year: String(y.year),
    'Democrat Trades': y.dem_trades,
    'Republican Trades': y.rep_trades,
    'Democrat Volume': y.dem_volume,
    'Republican Volume': y.rep_volume,
  }));

  const isVolumeMode = chartMode === 'volume';
  const isChamberMode = chartMode === 'chamber';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/congress/trades" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Congress Trades
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">10-Year History</span>
          <div className="ml-auto flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Clock size={11} /> <span>Updated {lastUpdated}</span>
              </div>
            )}
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-mono">STOCK Act Data</span>
          </div>
          <button onClick={fetchTrades} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-white mb-1">
            Congress Trading History <span className="text-blue-400">— 10 Years of Data</span>
          </h1>
          <p className="text-slate-400 text-sm">Democrat vs Republican stock trading activity, 2016–2026</p>
        </div>

        {/* Loading */}
        {loading && trades.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw size={20} className="animate-spin" /> <span>Loading trades…</span>
            </div>
          </div>
        )}

        {/* ── KPI Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Trades" value={totalTrades.toLocaleString()} sub="All parties, 2016–2026" icon={Activity} color="text-blue-400" />
          <StatCard label="Total Volume" value={formatDollars(totalVolume)} sub="Dem + Rep combined" icon={DollarSign} color="text-emerald-400" />
          <StatCard label="Most Active Year" value={String(mostActiveYear?.year ?? '—')} sub={`${mostActiveYear ? (mostActiveYear.dem_trades + mostActiveYear.rep_trades).toLocaleString() : '—'} trades`} icon={TrendingUp} color="text-purple-400" />
          <StatCard label="Top Ticker (All Time)" value={topTickerEntry?.[0] ?? '—'} sub={`${topTickerEntry?.[1] ?? 0} trades`} icon={BarChart3} color="text-amber-400" />
        </div>

        {/* ── Filters Row ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 items-center p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Year Range:</span>
            <div className="flex items-center gap-1">
              {[2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                <button key={y} onClick={() => {
                  if (y >= yearRange[0] && y <= yearRange[1]) {
                    setYearRange(prev => [y, prev[1]]);
                  } else {
                    setYearRange(prev => [prev[0], y]);
                  }
                }} className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
                  y >= yearRange[0] && y <= yearRange[1]
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                }`}>{y}</button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-slate-400 text-xs">Chamber:</span>
            <select value={chamberFilter} onChange={e => setChamberFilter(e.target.value)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs">
              <option value="all">All</option>
              <option value="House">House</option>
              <option value="Senate">Senate</option>
            </select>
          </div>
        </div>

        {/* ── Main Bar Chart ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">
              {isChamberMode ? 'Trades by Chamber' : 'Democrat vs Republican — Trade Count'}
            </h3>
            <div className="flex items-center gap-1">
              {(['trades', 'volume', 'chamber'] as ChartMode[]).map(mode => (
                <button key={mode} onClick={() => setChartMode(mode)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  chartMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                  {mode === 'trades' ? 'Trade Count' : mode === 'volume' ? 'Dollar Volume' : 'By Chamber'}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            {isChamberMode ? (
              <BarChart data={barChartData} margin={{ left: 5, right: 15, top: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="dem_senate" stackId="dem" fill="#3b82f6" opacity={0.7} name="Dem Senate" />
                <Bar dataKey="dem_house" stackId="dem" fill="#3b82f6" opacity={1} name="Dem House" />
                <Bar dataKey="rep_senate" stackId="rep" fill="#ef4444" opacity={0.7} name="Rep Senate" />
                <Bar dataKey="rep_house" stackId="rep" fill="#ef4444" opacity={1} name="Rep House" />
              </BarChart>
            ) : (
              <BarChart data={barChartData} margin={{ left: 5, right: 15, top: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey={isVolumeMode ? 'dem_volume' : 'dem_trades'} fill="#3b82f6" name={isVolumeMode ? 'Democrat $' : 'Democrat Trades'} radius={[4, 4, 0, 0]} />
                <Bar dataKey={isVolumeMode ? 'rep_volume' : 'rep_trades'} fill="#ef4444" name={isVolumeMode ? 'Republican $' : 'Republican Trades'} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* Totals row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {barChartData.map(d => {
              const total = isVolumeMode
                ? (d.dem_volume as number) + (d.rep_volume as number)
                : (d.dem_trades as number) + (d.rep_trades as number);
              const label = isVolumeMode ? formatDollars(total) : `${total} trades`;
              return (
                <div key={d.year as string} className="text-center">
                  <div className="text-white text-xs font-mono font-semibold">{d.year as string}</div>
                  <div className="text-slate-400 text-xs font-mono">{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Party Split Line Chart ───────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Party Split Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineChartData} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<LineTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Democrat Trades" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Democrat Trades" />
              <Line type="monotone" dataKey="Republican Trades" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} name="Republican Trades" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
            <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-blue-500" /> Higher blue = more Dem trades that year</div>
            <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-red-500" /> Higher red = more Rep trades that year</div>
          </div>
        </div>

        {/* ── Two-Column Section ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Sectors — Most Active Year */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Top Sectors — {selectedYear}</h3>
            <p className="text-slate-500 text-xs mb-4">Trade volume by sector for the most active year</p>
            <div className="space-y-3">
              {topSectorsByYear.map(s => {
                const maxVol = topSectorsByYear[0]?.vol || 1;
                const pct = (s.vol / maxVol) * 100;
                return (
                  <div key={s.sector} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-400 font-mono">{s.sector}</div>
                    <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-purple-500/80" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-24 text-right">
                      <div className="text-white text-xs font-mono font-semibold">{formatDollars(s.vol)}</div>
                      <div className="text-slate-500 text-xs">{s.count} trades</div>
                    </div>
                  </div>
                );
              })}
              {topSectorsByYear.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">No sector data available</div>
              )}
            </div>
          </div>

          {/* Member Leaderboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-widest">Member Leaderboard — {selectedYear}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Top traders by estimated volume</p>
              </div>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
              >
                {availableYears.length > 0 ? availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                )) : (
                  [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))
                )}
              </select>
            </div>
            <div className="divide-y divide-slate-800/50">
              {leaderboardByYear.map((m, i) => {
                const partyColor = m.member_party === 'Democrat' ? '#3b82f6' : '#ef4444';
                return (
                  <div key={m.member_name} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-slate-400/20 text-slate-300' :
                      i === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-slate-800 text-slate-500'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: partyColor }} />
                        <span className="text-white text-sm font-medium truncate">{m.member_name}</span>
                        <span className="text-slate-500 text-xs">{m.member_chamber} · {m.member_state}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        <span className="text-emerald-400 flex items-center gap-0.5"><ArrowUpRight size={10} /> {m.buys} buys</span>
                        <span className="text-red-400 flex items-center gap-0.5"><ArrowDownRight size={10} /> {m.sells} sells</span>
                        <span>{m.unique_tickers} tickers</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-mono font-bold text-sm">{formatDollars(m.estimated_volume)}</div>
                      <div className="text-slate-500 text-xs">{m.total_trades} trades</div>
                    </div>
                  </div>
                );
              })}
              {leaderboardByYear.length === 0 && (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">No data for {selectedYear}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Buy/Sell Ratio by Year ──────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Buy/Sell Ratio by Year</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={aggByYear.map(y => ({
              year: String(y.year),
              'Dem Buys': y.dem_buys,
              'Dem Sells': y.dem_sells,
              'Rep Buys': y.rep_buys,
              'Rep Sells': y.rep_sells,
            }))} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<LineTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey="Dem Buys" fill="#3b82f6" opacity={0.7} name="Dem Buys" />
              <Bar dataKey="Dem Sells" fill="#3b82f6" opacity={0.3} name="Dem Sells" />
              <Bar dataKey="Rep Buys" fill="#ef4444" opacity={0.7} name="Rep Buys" />
              <Bar dataKey="Rep Sells" fill="#ef4444" opacity={0.3} name="Rep Sells" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Data Note ──────────────────────────────────────────────────── */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Clock size={14} className="text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-1">About This Data</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Data sourced from House Clerk Financial Disclosure + Senate EFD systems under the STOCK Act (2012).
              Amounts shown are range maximums (e.g., $1M-$5M → $5M). Currently showing ~926 recent trades — backfill in progress to reach 20,000+ historical records covering 2016–2026.
              Party affiliation as of trade date. Independent and non-partisan members excluded from aggregate totals.
              Historical backfill will populate missing years as data becomes available.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}