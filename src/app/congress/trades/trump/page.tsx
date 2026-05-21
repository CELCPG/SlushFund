'use client';

import { useState, useEffect } from 'react';

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

export default function TrumpTradesPage() {
  const [trades, setTrades] = useState<TrumpTrade[]>([]);
  const [contractors, setContractors] = useState<Record<string, FederalContractor>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');

  useEffect(() => {
    fetch('/api/congress/trades/trump')
      .then(r => r.json())
      .then(d => {
        setTrades(d.trades);
        setContractors(d.federal_contract_overlap || {});
        setTotal(d.total);
        setLoading(false);
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
  const sales = trades.filter(t => t.transaction_type === 'SALE');
  const contractOverlap = trades.filter(t => t.has_federal_contract);

  const formatAmount = (min: number, max: number) => {
    const avg = (min + max) / 2;
    if (avg >= 1e6) return `$${(avg / 1e6).toFixed(1)}M`;
    return `$${(avg / 1e3).toFixed(0)}K`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading OGE filing data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-red-950 via-slate-900 to-slate-950 border-b border-red-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">PRESIDENTIAL</span>
                <span className="text-xs font-mono bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700">OGE FORM 278-T</span>
                <span className="text-xs text-slate-400">Filed May 12, 2026</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">Trump Q1 2026 Stock Trades</h1>
              <p className="text-slate-400 text-sm">Office of Government Ethics · Form 278-T · Jan 6 – Mar 30, 2026 · 3,711 transactions disclosed</p>
            </div>
            <a
              href="https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/5326D3AF5BE7C25385258DF7002DD1B7/$FILE/Trump%2C%20Donald%20J.-05.08.2026-278T.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors"
            >
              View OGE PDF ↗
            </a>
          </div>

          {/* KEY STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
              <div className="text-2xl font-bold text-white">$220M–$750M</div>
              <div className="text-xs text-slate-400 mt-1">Total disclosed value</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
              <div className="text-2xl font-bold text-green-400">3,642</div>
              <div className="text-xs text-slate-400 mt-1">Equity transactions</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
              <div className="text-2xl font-bold text-white">{purchases.length}</div>
              <div className="text-xs text-slate-400 mt-1">Purchases (2:1 ratio)</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-red-800/50">
              <div className="text-2xl font-bold text-red-400">{contractOverlap.length}</div>
              <div className="text-xs text-slate-400 mt-1">Fed contractor overlaps</div>
            </div>
          </div>

          {/* ⚠️ CALLOUT */}
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <div className="text-sm text-yellow-200 font-semibold mb-1">⚠️ Why this matters — the journalism angle</div>
            <div className="text-xs text-yellow-100/80 leading-relaxed">
              Unlike every modern president since Lyndon Johnson, Trump's assets are <strong>not in a blind trust</strong>. They are managed through accounts controlled by his children. Every trade intersects with executive branch policy — AI chip exports, federal contracting, Treasury decisions. This is the first presidency where the border between personal portfolio and presidential decision-making is functionally absent.
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MAIN TRADES TABLE */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white">All Trump Trades in Database</h2>
                <div className="flex gap-2">
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
                  { month: 'March', txns: 1319, buys: 983, sells: 336, note: '1,319 transactions — 35% of entire quarter' },
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
                  <div className="text-xs text-yellow-100/80">188 purchases vs 11 sales — most aggressive single-day buying session of the quarter</div>
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
                  { ticker: 'PLTR', note: '8 buys + 4 large sales', flag: 'DHS awarded PLTR contract March 2026 — concurrent with buying' },
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
                Filed late — "Filer paid late fees" notation on cover page<br/>
                Note: Trump Organization states trades are executed via "fully discretionary accounts independently managed by third-party financial institutions with no family involvement in decision-making"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}