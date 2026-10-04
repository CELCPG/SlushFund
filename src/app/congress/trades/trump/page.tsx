'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bitcoin, TrendingUp, ExternalLink, AlertTriangle, BarChart3, Coins, Building2, FileText, Scale } from 'lucide-react';

interface TrumpTrade {
  ticker: string;
  company_name: string;
  transaction_type: 'PURCHASE' | 'SALE';
  amount_range: string;
  amount_min: number;
  amount_max: number;
  transaction_date: string;
  notes?: string;
  has_federal_contract: boolean;
  contract_links?: string[];
}

interface FederalContractor {
  company: string;
  amount: number;
  agency: string;
}

type CryptoKind =
  | 'token_sale'
  | 'paper_gain'
  | 'royalty_stream'
  | 'insider_sale'
  | 'pac_spend'
  | 'insider_unlock';

interface CryptoEarning {
  id: string;
  label: string;
  date_or_window: string;
  gross_or_paper_usd: number;
  realized_or_paper: 'realized' | 'paper';
  kind: CryptoKind;
  source_label: string;
  source_url: string;
  party: 'president' | 'family' | 'orbit';
  conflict_note: string;
}

interface Summary {
  stock_trades: {
    count: number;
    disclosed_value_range_low: number;
    disclosed_value_range_high: number;
    source: string;
  };
  crypto: {
    realized_usd: number;
    paper_usd: number;
    combined_gross_usd: number;
    rows: number;
  };
  last_updated: string;
}

type Tab = 'stocks' | 'crypto';

const formatUSD = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const formatAmount = (min: number, max: number) => {
  const avg = (min + max) / 2;
  if (avg >= 1e6) return `$${(avg / 1e6).toFixed(1)}M`;
  return `$${(avg / 1e3).toFixed(0)}K`;
};

const partyBadge = (party: 'president' | 'family' | 'orbit') => {
  const map: Record<string, { label: string; cls: string }> = {
    president: { label: 'President', cls: 'bg-red-900/40 text-red-300 border-red-800' },
    family: { label: 'Family', cls: 'bg-purple-900/40 text-purple-300 border-purple-800' },
    orbit: { label: 'Orbit', cls: 'bg-blue-900/40 text-blue-300 border-blue-800' },
  };
  const s = map[party];
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${s.cls}`}>{s.label}</span>;
};

const kindLabel: Record<CryptoKind, string> = {
  token_sale: 'Token/Equity Sale',
  paper_gain: 'Paper Gain (MtM)',
  royalty_stream: 'Royalty Stream',
  insider_sale: 'Insider Cashout',
  pac_spend: 'PAC Spend (Family-Benefit)',
  insider_unlock: 'Insider Unlock (Allocation)',
};

export default function TrumpTradesPage() {
  const [tab, setTab] = useState<Tab>('stocks');

  // Stocks
  const [trades, setTrades] = useState<TrumpTrade[]>([]);
  const [contractors, setContractors] = useState<Record<string, FederalContractor>>({});
  const [total, setTotal] = useState(0);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');

  // Crypto
  const [crypto, setCrypto] = useState<CryptoEarning[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cryptoLoading, setCryptoLoading] = useState(true);

  useEffect(() => {
    fetch('/api/congress/trades/trump')
      .then(r => r.json())
      .then(d => {
        // New unified shape (with back-compat fallback to old {trades, total})
        setTrades(d.stocks ?? d.trades ?? []);
        setContractors(d.federal_contract_overlap ?? {});
        setTotal((d.stocks ?? d.trades ?? []).length);
        setStocksLoading(false);
        setCrypto(d.crypto ?? []);
        setSummary(d.summary ?? null);
        setCryptoLoading(false);
      });
  }, []);

  const uniqueTickers = [...new Set(trades.map(t => t.ticker))];

  const filtered = trades
    .filter(t => tickerFilter === 'all' || t.ticker === tickerFilter)
    .filter(t => typeFilter === 'all' || t.transaction_type === typeFilter)
    .sort((a, b) => {
      if (sortKey === 'date') return b.transaction_date.localeCompare(a.transaction_date);
      return b.amount_max - a.amount_max;
    });

  const purchases = trades.filter(t => t.transaction_type === 'PURCHASE');
  const contractOverlap = trades.filter(t => t.has_federal_contract);

  // Combined headline = stock range + crypto realized + crypto paper
  // We display these as three separate values; the page never silently sums.
  const stockLow = summary?.stock_trades.disclosed_value_range_low ?? 0;
  const stockHigh = summary?.stock_trades.disclosed_value_range_high ?? 0;
  const cryptoRealized = summary?.crypto.realized_usd ?? 0;
  const cryptoPaper = summary?.crypto.paper_usd ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-red-950 via-slate-900 to-slate-950 border-b border-red-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs font-mono bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">PRESIDENTIAL</span>
                <span className="text-xs font-mono bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700">OGE FORM 278-T</span>
                <span className="text-xs text-slate-400">Filed May 12, 2026</span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400">Last updated {summary?.last_updated ?? '2026-07-07'}</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">Trump Profiteering From Office</h1>
              <p className="text-slate-400 text-sm">Q1 2026 stock trades (OGE 278-T) + family crypto / NFT / PAC flows. Each dollar figure has a source.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href="https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/5326D3AF5BE7C25385258DF7002DD1B7/$FILE/Trump%2C%20Donald%20J.-05.08.2026-278T.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors"
              >
                View OGE PDF ↗
              </a>
              <Link
                href="/investigations/trump-govt-crypto-holdings"
                className="text-xs font-mono bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 px-3 py-1.5 rounded border border-purple-800 transition-colors"
              >
                Crypto Holdings Investigation ↗
              </Link>
              <Link
                href="/investigations/trump-world-liberties-magazine"
                className="text-xs font-mono bg-blue-900/40 hover:bg-blue-900/60 text-blue-200 px-3 py-1.5 rounded border border-blue-800 transition-colors"
              >
                Trump World PAC Network ↗
              </Link>
            </div>
          </div>

          {/* ⚠️ CALLOUT */}
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <div className="text-sm text-yellow-200 font-semibold mb-1">⚠️ Why this matters</div>
            <div className="text-xs text-yellow-100/80 leading-relaxed">
              Unlike every modern president since Lyndon Johnson, Trump&apos;s assets are <strong>not in a blind trust</strong>. They are managed through accounts controlled by his children. This page separates the President&apos;s own equity trades (OGE 278-T) from the family&apos;s crypto / NFT / PAC flows — different universes, different rules, different sources. Where a figure is paper vs realized, we say so.
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED SUMMARY CARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border-2 border-red-900/40 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Combined Profiteering From Office</div>
            <span className="text-[10px] font-mono bg-red-900/40 text-red-200 px-2 py-0.5 rounded border border-red-800">DISTINCT FIGURES, NOT A CLEAN SUM</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stock trades (range) */}
            <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Stock trades (Q1 2026)</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatUSD(stockLow)}–{formatUSD(stockHigh)}</div>
              <div className="text-xs text-slate-400 mt-1">{total.toLocaleString()} transactions · OGE range</div>
            </div>

            {/* Crypto realized */}
            <div className="bg-slate-900/80 rounded-lg p-4 border border-green-900/40">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Crypto realized (cash)</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{formatUSD(cryptoRealized)}</div>
              <div className="text-xs text-slate-400 mt-1">Token sales + royalties + insider cashout + PAC legal-fee routing</div>
            </div>

            {/* Crypto paper */}
            <div className="bg-slate-900/80 rounded-lg p-4 border border-yellow-900/40">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Crypto paper (MtM)</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">{formatUSD(cryptoPaper)}</div>
              <div className="text-xs text-slate-400 mt-1">Mark-to-market. Not yet sold. Evaporates with price.</div>
            </div>

            {/* Crypto rows */}
            <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Crypto rows tracked</span>
              </div>
              <div className="text-2xl font-bold text-white">{summary?.crypto.rows ?? crypto.length}</div>
              <div className="text-xs text-slate-400 mt-1">Each with a primary source URL</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-slate-800">
            <button
              onClick={() => setTab('stocks')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                tab === 'stocks'
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Stocks (OGE 278-T)
                <span className="text-[10px] font-mono text-slate-500">· {total.toLocaleString()} trades</span>
              </span>
            </button>
            <button
              onClick={() => setTab('crypto')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                tab === 'crypto'
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bitcoin className="w-4 h-4" />
                Crypto / NFT / PAC
                <span className="text-[10px] font-mono text-slate-500">· {summary?.crypto.rows ?? crypto.length} rows</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === 'stocks' && (
          <StocksTab
            trades={trades}
            contractors={contractors}
            total={total}
            loading={stocksLoading}
            filtered={filtered}
            purchases={purchases}
            contractOverlap={contractOverlap}
            uniqueTickers={uniqueTickers}
            tickerFilter={tickerFilter}
            typeFilter={typeFilter}
            sortKey={sortKey}
            setTickerFilter={setTickerFilter}
            setTypeFilter={setTypeFilter}
            setSortKey={setSortKey}
          />
        )}
        {tab === 'crypto' && (
          <CryptoTab
            earnings={crypto}
            loading={cryptoLoading}
            summary={summary}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STOCKS TAB
// =============================================================================
function StocksTab(props: {
  trades: TrumpTrade[];
  contractors: Record<string, FederalContractor>;
  total: number;
  loading: boolean;
  filtered: TrumpTrade[];
  purchases: TrumpTrade[];
  contractOverlap: TrumpTrade[];
  uniqueTickers: string[];
  tickerFilter: string;
  typeFilter: string;
  sortKey: 'date' | 'amount';
  setTickerFilter: (v: string) => void;
  setTypeFilter: (v: string) => void;
  setSortKey: (v: 'date' | 'amount') => void;
}) {
  const {
    trades, contractors, total, loading, filtered, purchases, contractOverlap,
    uniqueTickers, tickerFilter, typeFilter, sortKey,
    setTickerFilter, setTypeFilter, setSortKey,
  } = props;

  if (loading) {
    return <div className="text-center py-20 text-slate-400 animate-pulse">Loading OGE filing data…</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* MAIN TRADES TABLE */}
      <div className="lg:col-span-2">
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-white">All Trump Trades in Database</h2>
            <div className="flex gap-2 flex-wrap">
              <select
                value={tickerFilter}
                onChange={e => setTickerFilter(e.target.value)}
                className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700"
              >
                <option value="all">All Tickers</option>
                {uniqueTickers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700"
              >
                <option value="all">All Types</option>
                <option value="PURCHASE">Purchases</option>
                <option value="SALE">Sales</option>
              </select>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as 'date' | 'amount')}
                className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Ticker</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-400">Company</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-400">Type</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-400">Amount</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((trade, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {trade.has_federal_contract && (
                        <span className="text-yellow-500 text-xs" title="Federal contractor overlap">⚡</span>
                      )}
                      <span className="font-mono font-semibold text-white">{trade.ticker}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{trade.company_name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      trade.transaction_type === 'PURCHASE'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {trade.transaction_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-200 text-xs">
                    {formatAmount(trade.amount_min, trade.amount_max)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400 text-xs">{trade.transaction_date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            Showing {filtered.length} of {total} parsed trades from OGE 278-T filing · Amounts are disclosed ranges
          </div>
        </div>

        {/* NOTES */}
        {filtered.some(t => t.notes) && (
          <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">📌 Context Notes</h3>
            <div className="space-y-2">
              {filtered.filter(t => t.notes).map((t, i) => (
                <div key={i} className="text-xs text-slate-300 bg-slate-800/50 rounded p-3 border-l-2 border-yellow-600">
                  <span className="font-mono font-semibold text-yellow-400">{t.ticker}</span>: {t.notes}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SIDEBAR */}
      <div className="space-y-6">
        {/* Timeline */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📅 Q1 Volume Timeline</h3>
          <div className="space-y-3">
            {[
              { month: 'January', txns: 380, buys: 242, sells: 138, note: '380 transactions' },
              { month: 'February', txns: 479, buys: 237, sells: 242, note: '479 transactions' },
              { month: 'March', txns: 1319, buys: 983, sells: 336, note: '1,319 transactions, 35% of entire quarter' },
            ].map(m => (
              <div key={m.month} className="bg-slate-800/50 rounded p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-white">{m.month}</span>
                  <span className="text-xs text-slate-400">{m.txns.toLocaleString()} txns</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${(m.buys / m.txns) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-green-400">🟢 {m.buys}</span>
                  <span className="text-xs text-red-400">🔴 {m.sells}</span>
                </div>
                {m.note && <p className="text-xs text-slate-500 mt-1">{m.note}</p>}
              </div>
            ))}
            <div className="bg-yellow-900/30 border border-yellow-800/50 rounded p-3">
              <div className="text-xs text-yellow-200 font-semibold">March 23 alone</div>
              <div className="text-xs text-yellow-100/80">188 purchases vs 11 sales most aggressive single-day buying session of the quarter</div>
            </div>
          </div>
        </div>

        {/* Federal Contractor Overlap */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">⚡ Federal Contractor Overlap</h3>
          <div className="space-y-3">
            {Object.entries(contractors)
              .filter(([ticker]) => trades.some(t => t.ticker === ticker))
              .map(([ticker, info]) => (
                <div key={ticker} className="bg-slate-800/50 rounded p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-white">{ticker}</span>
                    <span className="text-xs text-green-400">Fed contractor</span>
                  </div>
                  <div className="text-xs text-slate-300">{info.company}</div>
                  {info.amount > 0 && (
                    <div className="text-xs text-yellow-400 mt-1">
                      ${(info.amount / 1e9).toFixed(1)}B in federal contracts
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5">{info.agency}</div>
                </div>
              ))}
            <div className="text-xs text-slate-500 pt-1">
              {contractOverlap.length} Trump trades intersect with companies that hold federal contracts tracked by SlushFund
            </div>
          </div>
        </div>

        {/* Key Holdings */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">🏦 Key Holdings Summary</h3>
          <div className="space-y-2">
            {[
              { ticker: 'NVDA', note: '9 purchases, $1.8M–$6.6M each', flag: 'Jensen Huang on delegation to Beijing during NVDA export policy talks' },
              { ticker: 'ORCL', note: '11 purchases, $2.2M–$10.6M each', flag: 'Larry Ellison donated $250K+ to Trump inauguration' },
              { ticker: 'MSFT', note: '9 purchases, $2.4M–$8.1M each', flag: 'Microsoft Azure Government holds major DoD contracts' },
              { ticker: 'AMD', note: '10 purchases', flag: 'AMD AI chips subject to export controls set by admin' },
              { ticker: 'PLTR', note: '8 buys + 4 large sales', flag: 'DHS awarded PLTR contract March 2026 concurrent with buying' },
              { ticker: 'AMZN', note: '4 large sales, $5M–$25M each', flag: 'AMZN = $17.5B largest fed contractor in SlushFund' },
              { ticker: 'COIN', note: '6 purchases', flag: 'Coinbase won US Marshals crypto custody under this admin' },
            ].map(item => (
              <div key={item.ticker} className="bg-slate-800/50 rounded p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono font-bold text-white text-sm">{item.ticker}</span>
                  <span className="text-xs text-slate-400">{item.note}</span>
                </div>
                <div className="text-xs text-yellow-400/80">{item.flag}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Data source:</strong> OGE Form 278-T · Trump, Donald J. · Certified May 8, 2026 · Received May 12, 2026<br/>
            Filed late: &quot;Filer paid late fees&quot; notation on cover page<br/>
            Note: Trump Organization states trades are executed via &quot;fully discretionary accounts independently managed by third-party financial institutions with no family involvement in decision-making&quot;
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CRYPTO TAB
// =============================================================================
function CryptoTab(props: {
  earnings: CryptoEarning[];
  loading: boolean;
  summary: Summary | null;
}) {
  const { earnings, loading, summary } = props;

  if (loading) {
    return <div className="text-center py-20 text-slate-400 animate-pulse">Loading crypto earnings…</div>;
  }

  const realized = earnings.filter(e => e.realized_or_paper === 'realized');
  const paper = earnings.filter(e => e.realized_or_paper === 'paper');

  return (
    <div className="space-y-8">
      {/* RELATED INVESTIGATIONS */}
      <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 rounded-xl border border-purple-900/50 p-5">
        <div className="flex items-start gap-3">
          <Scale className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Read the deep dives</h3>
            <p className="text-xs text-slate-300 mb-3">
              The rows below are sourced data points. The full investigations give the receipts:
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/investigations/trump-govt-crypto-holdings"
                className="text-xs font-mono bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 px-3 py-2 rounded border border-purple-800 transition-colors inline-flex items-center gap-2"
              >
                <Bitcoin className="w-3 h-3" />
                Officials Hold $4B in Government-Adjacent Crypto ↗
              </Link>
              <Link
                href="/investigations/trump-world-liberties-magazine"
                className="text-xs font-mono bg-blue-900/40 hover:bg-blue-900/60 text-blue-200 px-3 py-2 rounded border border-blue-800 transition-colors inline-flex items-center gap-2"
              >
                <Building2 className="w-3 h-3" />
                Trump World PAC Network ↗
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* METHODOLOGY NOTE */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-2">How to read this table</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-green-400 mb-1">Realized</div>
            <p>Cash already received. WLFI token + equity sales, NFT secondary-market royalties, $TRUMP insider cashout, PAC money routed to Trump legal defense.</p>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-yellow-400 mb-1">Paper (MtM)</div>
            <p>Mark-to-market valuation. Not yet sold. Evaporates with price. Included because the family uses these valuations for net-worth signaling and collateral.</p>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          Totals: <span className="text-green-400 font-mono">{formatUSD(summary?.crypto.realized_usd ?? 0)}</span> realized · <span className="text-yellow-400 font-mono">{formatUSD(summary?.crypto.paper_usd ?? 0)}</span> paper · not summed apples-to-apples.
        </div>
      </div>

      {/* REALIZED ROWS */}
      {realized.length > 0 && (
        <CryptoSection title="Realized Income (cash received)" rows={realized} tone="realized" />
      )}

      {/* PAPER ROWS */}
      {paper.length > 0 && (
        <CryptoSection title="Paper Gains (mark-to-market, not yet sold)" rows={paper} tone="paper" />
      )}

      {/* EDITORIAL NOTE */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-300">Editorial note:</strong> Every row above carries a primary source URL. If a figure is wrong, it&apos;s wrong against a citable source — tell us and we&apos;ll update. Where the family-vs-president distinction matters (e.g. $TRUMP memecoin profits flowed to CIC Digital LLC and Fight Fight Fight LLC, not the President personally), we note it. The Save America PAC row is included as the &quot;dark side&quot; — donor money routed to the family&apos;s legal benefit is functionally a transfer, even when structured through a leadership PAC.
      </div>
    </div>
  );
}

function CryptoSection({ title, rows, tone }: {
  title: string;
  rows: CryptoEarning[];
  tone: 'realized' | 'paper';
}) {
  const isRealized = tone === 'realized';
  const accent = isRealized ? 'green' : 'yellow';
  return (
    <div>
      <h2 className={`text-lg font-bold text-${accent}-400 mb-3 flex items-center gap-2`}>
        {isRealized ? <Coins className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
        {title}
      </h2>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {kindLabel[r.kind]}
                  </span>
                  {partyBadge(r.party)}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    isRealized
                      ? 'bg-green-900/40 text-green-300 border-green-800'
                      : 'bg-yellow-900/40 text-yellow-300 border-yellow-800'
                  }`}>
                    {r.realized_or_paper.toUpperCase()}
                  </span>
                </div>
                <div className="text-base font-semibold text-white">{r.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{r.date_or_window}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold font-mono ${isRealized ? 'text-green-400' : 'text-yellow-400'}`}>
                  {r.gross_or_paper_usd === 0 ? 'Allocation' : formatUSD(r.gross_or_paper_usd)}
                </div>
                {r.gross_or_paper_usd === 0 && (
                  <div className="text-[10px] text-slate-500 mt-0.5">Insider unlock (paper)</div>
                )}
              </div>
            </div>

            {/* Conflict note */}
            <div className="bg-slate-800/50 rounded p-3 border-l-2 border-red-600 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="text-red-300 font-semibold">Conflict:</span> {r.conflict_note}
                </div>
              </div>
            </div>

            {/* Source */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="text-slate-500">
                <span className="text-slate-400 font-semibold">Source:</span> {r.source_label}
              </div>
              <a
                href={r.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 font-mono"
              >
                <ExternalLink className="w-3 h-3" />
                {r.source_url.length > 60 ? r.source_url.slice(0, 60) + '…' : r.source_url}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
