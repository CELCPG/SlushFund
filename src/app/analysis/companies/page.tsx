'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  ArrowLeft, Landmark, AlertTriangle, TrendingUp, DollarSign,
  Building2, Shield, ExternalLink, ChevronDown, ChevronUp,
  Activity, Users, Clock, Target, ArrowRight, Search, Filter
} from 'lucide-react';
import StockChart from '@/components/StockChart';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ef4444', '#f97316', '#10b981', '#eab308', '#ec4899'];

function formatMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Data types ───────────────────────────────────────────────────────────────
interface Trade {
  id: number;
  member_name: string;
  member_chamber: string;
  member_party: string;
  ticker: string;
  company_name: string;
  transaction_type: string;
  amount_min: number;
  amount_max: number;
  amount_range: string;
  transaction_date: string;
  has_federal_contract: boolean;
  signal_type: string;
}

interface Company {
  ticker: string;
  company_name: string;
  trade_count: number;
  total_volume: number;
  purchases: number;
  sales: number;
  has_contract: boolean;
  parties: string[];
  chambers: string[];
  top_members: { name: string; chamber: string; party: string; trades: number; volume: number }[];
  trade_history: { month: string; count: number; buys: number; sells: number }[];
  related_contracts: { recipient_name: string; total: number; count: number; agencies: string }[];
}

function isPublicTicker(ticker: string): boolean {
  const publicTickers = new Set([
    'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'PLTR', 'META', 'AAPL',
    'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'IBM', 'BA', 'LMT', 'RTX',
    'NOC', 'GS', 'JPM', 'BAC', 'WFC', 'XOM', 'CVX', 'PFE', 'JNJ', 'UNH',
    'LLY', 'MRK', 'ABBV', 'TMO', 'COST', 'WMT', 'HD', 'MCD', 'NKE',
    'DIS', 'CMCSA', 'VZ', 'T', 'CSCO', 'ADBE', 'PYPL', 'SQ', 'SHOP',
    'UBER', 'LYFT', 'ABNB', 'SNOW', 'ZS', 'CRWD', 'PANW', 'NET',
    'DDOG', 'TEAM', 'NOW', 'OKTA', 'SFDC', 'WORK', 'ZM', 'DOCU',
    'U', 'FVRR', 'TWLO', 'SPLK', 'DBX', 'BOX', 'ZEN', 'CONST',
    'RBLX', 'EPAM', 'CDNS', 'SNPS', 'ARM', 'COIN', 'MSTR', 'RIOT',
    'HOOD', 'APP', 'DUOL', 'GPRO', 'FIS', 'FISV', 'GLOB', 'IT',
    'ACN', 'CTSH', 'IBM', 'INFY', 'QCOM', 'TXN', 'AVGO', 'ADI',
    'MCHP', 'MU', 'WDC', 'STX', 'NTAP', 'ANET', 'FSLR', 'SEDG',
    'ENPH', 'SPWR', 'RUN', 'NEE', 'FSLR', 'BE', 'PLD', 'AMT',
    'EQIX', 'CCI', 'DLR', 'SBAC', 'O', 'SPG', 'AM', 'AVB', 'EQR',
    'VTR', 'DOC', 'OHI', 'MPW', 'HST', 'RHP', 'SBRA', 'UHS',
    'THC', 'CYH', 'HCA', 'CNC', 'HUM', 'CI', 'ELV', 'MOH',
    'ALGN', 'EW', 'DXCM', 'TMO', 'LH', 'DGX', 'IQV', 'REGN',
    'VRTX', 'BIIB', 'MRNA', 'NVAX', 'INO', 'REGN', 'MRK', 'AZN',
    'PFE', 'JNJ', 'ABT', 'TGT', 'ROST', 'TJX', 'DLTR', 'DG',
    'BBY', 'W', 'YUM', 'CMG', 'DPZ', 'MCD', 'SBUX', 'CSCO',
  ]);
  return publicTickers.has(ticker.toUpperCase());
}

// ─── Company Card ──────────────────────────────────────────────────────────────
function CompanyCard({ company, onSelect }: { company: Company; onSelect: () => void }) {
  const partyColors: Record<string, string> = { Republican: 'text-red-400', Democrat: 'text-blue-400', Independent: 'text-purple-400' };
  const partyBg: Record<string, string> = { Republican: 'bg-red-900/30', Democrat: 'bg-blue-900/30', Independent: 'bg-purple-900/30' };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-600/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-black text-lg">{company.ticker}</span>
            <span className="text-slate-400 text-sm">{company.company_name}</span>
            {company.has_contract && (
              <span className="inline-flex items-center gap-1 bg-emerald-900/40 border border-emerald-700 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                <Building2 size={10} /> Federal Contract
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            <span className="font-mono">{company.trade_count} trades</span>
            <span>·</span>
            <span className="font-mono">{company.purchases} buys / {company.sales} sells</span>
          </div>
          {isPublicTicker(company.ticker) ? (
            <div className="mb-3">
              <StockChart ticker={company.ticker} />
            </div>
          ) : (
            <div className="text-xs text-slate-600 mb-2 italic">Private company — no public stock data</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-white font-black font-mono text-lg">{formatMoney(company.total_volume)}</div>
          <div className="text-slate-500 text-xs">total volume</div>
        </div>
      </div>

      {/* Top traders */}
      {company.top_members.length > 0 && (
        <div className="mb-3">
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Top Trader</div>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">{company.top_members[0].name}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${partyColors[company.top_members[0].party] ?? 'text-slate-400'} ${partyBg[company.top_members[0].party] ?? 'bg-slate-800'}`}>
              {company.top_members[0].party} · {company.top_members[0].chamber}
            </span>
            <span className="text-slate-400 text-xs font-mono ml-auto">{company.top_members[0].trades} trades · {formatMoney(company.top_members[0].volume)}</span>
          </div>
        </div>
      )}

      {/* Parties */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {company.parties.map(p => (
          <span key={p} className={`text-xs font-bold px-2 py-0.5 rounded ${partyColors[p] ?? 'text-slate-400'} ${partyBg[p] ?? 'bg-slate-800'}`}>{p}</span>
        ))}
        {company.chambers.map(c => (
          <span key={c} className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">{c}</span>
        ))}
      </div>

      {/* Related contract highlight */}
      {company.related_contracts.length > 0 && (
        <div className="bg-slate-800/60 rounded-lg px-3 py-2 mb-3">
          <div className="text-slate-500 text-xs mb-1">Related federal contracts</div>
          {company.related_contracts.slice(0, 2).map(rc => (
            <div key={rc.recipient_name} className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{rc.recipient_name}</span>
              <span className="text-amber-400 font-mono font-bold">{formatMoney(rc.total)}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onSelect}
        className="w-full mt-2 py-2 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-400 text-sm font-bold hover:bg-blue-900/50 hover:text-blue-300 transition-all flex items-center justify-center gap-2">
        <TrendingUp size={14} /> Deep Dive Analysis
      </button>
    </div>
  );
}

// ─── Conflict Flash Alert ───────────────────────────────────────────────────────
function ConflictAlert({ company, trades }: { company: Company; trades: Trade[] }) {
  const buyCount = company.purchases;
  const sellCount = company.sales;
  const contractStr = company.related_contracts.length > 0
    ? `$${(company.related_contracts[0].total / 1e9).toFixed(2)}B in federal contracts`
    : 'federal contractor';

  return (
    <div className="bg-red-950/60 border border-red-800 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-red-400" />
        <h3 className="text-red-400 font-bold text-sm uppercase tracking-widest">Conflict of Interest Analysis</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Trading Activity</div>
          <div className="text-white font-black text-2xl">{buyCount} buys / {sellCount} sells</div>
          <div className="text-slate-400 text-xs mt-1">Total volume: {formatMoney(company.total_volume)}</div>
        </div>
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Federal Contractor Status</div>
          <div className="text-white font-black text-2xl">{company.has_contract ? 'YES — Active Contract' : 'Not flagged'}</div>
          <div className="text-slate-400 text-xs mt-1">{contractStr}</div>
        </div>
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Congressional Oversight</div>
          <div className="text-white font-black text-sm">
            {[...new Set(trades.map(t => t.member_chamber))].join(' + ')} members
          </div>
          <div className="text-slate-400 text-xs mt-1">{[...new Set(trades.map(t => t.member_party))].join(', ')} represented</div>
        </div>
      </div>
    </div>
  );
}

// ─── Journalist Findings ──────────────────────────────────────────────────────
function JournalistFindings({ company, trades, contracts }: { company: Company; trades: Trade[]; contracts: any[] }) {
  const highValueTrades = trades.filter(t => t.amount_max >= 50000);
  const suspiciousTrades = trades.filter(t => t.signal_type === 'suspicious' || t.signal_type === 'high_value');
  const recentTrades = trades.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Headline finding */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-amber-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Key Finding</h3>
        </div>
        <p className="text-slate-300 text-base leading-relaxed">
          <span className="text-white font-semibold">{[...new Set(trades.map(t => t.member_name))].length} members of Congress</span> have traded
          <span className="text-blue-400 font-semibold"> {company.company_name} ({company.ticker})</span> across
          <span className="text-white font-semibold"> {company.trade_count} transactions</span> totaling
          <span className="text-emerald-400 font-semibold"> {formatMoney(company.total_volume)}</span>.
          {company.has_contract && (
            <span className="text-red-400"> The company holds <span className="font-black">{contracts.length > 0 ? formatMoney(contracts[0].total) : 'active'} federal contracts</span> — creating a direct conflict when legislators trade its stock while overseeing the agencies awarding those contracts.</span>
          )}
        </p>
      </div>

      {/* Recent trades */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {recentTrades.map(t => (
            <div key={t.id} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.transaction_type.includes('SALE') ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{t.member_name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.member_party === 'Republican' ? 'bg-red-900/40 text-red-400' : t.member_party === 'Democrat' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>
                      {t.member_party}
                    </span>
                    <span className="text-slate-500 text-xs">{t.member_chamber}</span>
                    <span className={`text-xs font-mono font-bold ml-auto ${t.transaction_type.includes('SALE') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t.transaction_type.includes('SALE') ? 'SOLD' : 'BOUGHT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="font-mono">{t.amount_range}</span>
                    <span>·</span>
                    <span>{t.transaction_date}</span>
                    {t.has_federal_contract && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Building2 size={10} /> Has federal contract
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trades over $50K */}
      {highValueTrades.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">
              High-Value Trades (≥$50K) — {highValueTrades.length} transactions
            </h3>
          </div>
          <div className="divide-y divide-slate-800">
            {highValueTrades.map(t => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-semibold">{t.member_name}</span>
                    <span className="text-slate-400 text-xs ml-2">{t.member_party} · {t.member_chamber}</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-black text-sm ${t.transaction_type.includes('SALE') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t.transaction_type.includes('SALE') ? 'SOLD' : 'BOUGHT'} {t.amount_range}
                    </div>
                    <div className="text-slate-500 text-xs">{t.transaction_date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspicious signals */}
      {suspiciousTrades.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <h3 className="text-amber-400 font-bold text-sm uppercase tracking-widest">
                Suspicious / High-Value Signals — {suspiciousTrades.length} flagged
              </h3>
            </div>
          </div>
          <div className="divide-y divide-amber-900/50">
            {suspiciousTrades.map(t => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{t.member_name}</span>
                      <span className="text-amber-400 text-xs font-mono">{t.amount_range}</span>
                      <span className={`text-xs font-mono font-bold ${t.transaction_type.includes('SALE') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {t.transaction_type}
                      </span>
                    </div>
                    <div className="text-slate-400 text-xs mt-1">{t.transaction_date} · {t.member_party} · {t.member_chamber}</div>
                    {t.signal_type && t.signal_type !== 'routine' && (
                      <div className="mt-1.5 bg-amber-900/30 border border-amber-700/50 rounded px-2 py-1 text-amber-300 text-xs">
                        Signal: {t.signal_type} — trade occurred near federal contract activity period
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Federal contracts */}
      {contracts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-emerald-400" />
              <h3 className="text-white font-bold text-sm uppercase tracking-widest">
                Federal Contracts — {contracts.length} awards totaling {formatMoney(contracts.reduce((s, c) => s + c.total, 0))}
              </h3>
            </div>
          </div>
          <div className="divide-y divide-slate-800">
            {contracts.map(c => (
              <div key={c.recipient_name} className="px-5 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white font-semibold text-sm">{c.recipient_name}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{c.agencies}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-emerald-400 font-black font-mono text-lg">{formatMoney(c.total)}</div>
                    <div className="text-slate-500 text-xs">{c.count} awards</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Oversight connection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Congressional Oversight Angle</h3>
        <div className="space-y-3">
          {trades.filter(t => t.member_chamber === 'Senate').length > 0 && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-3">
              <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Senate Oversight</div>
              <div className="text-slate-300 text-sm">
                {trades.filter(t => t.member_chamber === 'Senate').length} Senate trades in {company.ticker}. Senators on relevant committees may have oversight authority over the agencies awarding contracts to {company.company_name}.
              </div>
            </div>
          )}
          {trades.filter(t => t.member_chamber === 'House').length > 0 && (
            <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg px-4 py-3">
              <div className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-1">House Oversight</div>
              <div className="text-slate-300 text-sm">
                {trades.filter(t => t.member_chamber === 'House').length} House trades in {company.ticker}. House members may sit on committees with direct appropriations or oversight authority over federal spending to this company.
              </div>
            </div>
          )}
          {company.has_contract && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3">
              <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Conflict Alert</div>
              <div className="text-slate-300 text-sm">
                {company.ticker} holds federal contracts. Any legislator who trades this stock while sitting on an oversight committee for the awarding agency is in violation of fiduciary duty and federal conflict-of-interest law (18 U.S.C. § 208).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/congress/trades?sort=volume&limit=500')
      .then(r => r.json())
      .then(data => {
        const rawTrades: Trade[] = data.trades ?? [];
        const grouped: Record<string, Company> = {};

        for (const t of rawTrades) {
          const key = t.ticker;
          if (!grouped[key]) {
            grouped[key] = {
              ticker: t.ticker,
              company_name: t.company_name ?? t.ticker,
              trade_count: 0,
              total_volume: 0,
              purchases: 0,
              sales: 0,
              has_contract: false,
              parties: [],
              chambers: [],
              top_members: [],
              trade_history: [],
              related_contracts: [],
            };
          }
          grouped[key].trade_count++;
          grouped[key].total_volume += t.amount_max ?? 0;
          if (t.transaction_type?.includes('SALE')) {
            grouped[key].sales++;
          } else {
            grouped[key].purchases++;
          }
          if (t.has_federal_contract) grouped[key].has_contract = true;
        }

        // Aggregate parties/chambers
        for (const key in grouped) {
          const g = grouped[key];
          const byMember: Record<string, any> = {};
          for (const t of rawTrades.filter((tr: Trade) => tr.ticker === key)) {
            if (!byMember[t.member_name]) {
              byMember[t.member_name] = { name: t.member_name, chamber: t.member_chamber, party: t.member_party, trades: 0, volume: 0 };
            }
            byMember[t.member_name].trades++;
            byMember[t.member_name].volume += t.amount_max ?? 0;
          }
          g.top_members = Object.values(byMember).sort((a: any, b: any) => b.volume - a.volume).slice(0, 3);
          g.parties = [...new Set(rawTrades.filter((tr: Trade) => tr.ticker === key).map((tr: Trade) => tr.member_party).filter(Boolean))];
          g.chambers = [...new Set(rawTrades.filter((tr: Trade) => tr.ticker === key).map((tr: Trade) => tr.member_chamber).filter(Boolean))];
        }

        const sorted = Object.values(grouped)
          .filter(c => c.trade_count >= 2)
          .sort((a, b) => b.total_volume - a.total_volume)
          .slice(0, 50);

        setCompanies(sorted);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/congress/trades?ticker=${selected.ticker}&sort=date&limit=200`)
      .then(r => r.json())
      .then(data => setTrades(data.trades ?? []));

    // Fetch related contracts
    fetch(`/api/contracts?search=${encodeURIComponent(selected.company_name)}&limit=5&sort=dollars&order=desc`)
      .then(r => r.json())
      .then(data => {
        const items = data.contracts ?? [];
        const grouped: Record<string, any> = {};
        for (const c of items) {
          const name = c.recipient_name ?? c.vendor_name ?? 'Unknown';
          if (!grouped[name]) grouped[name] = { recipient_name: name, total: 0, count: 0, agencies: new Set() };
          grouped[name].total += Number(c.dollar_amount) || 0;
          grouped[name].count++;
          if (c.awarding_agency) grouped[name].agencies.add(c.awarding_agency);
        }
        setContracts(Object.values(grouped).map((g: any) => ({ ...g, agencies: [...g.agencies].join('; ') })));
      });
  }, [selected]);

  const filtered = companies.filter(c =>
    c.ticker.toLowerCase().includes(filter.toLowerCase()) ||
    c.company_name.toLowerCase().includes(filter.toLowerCase())
  );

  const contractHolders = filtered.filter(c => c.has_contract);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading company analysis…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">Company Deep Dives</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 text-xs">{companies.length} companies tracked</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Company Deep Dives</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            Conflict of interest analysis: which companies have federal contracts AND congressional stock trading. Cross-referencing trade activity against federal award data to surface potential insider trading and oversight conflicts.
          </p>
        </div>

        {/* Conflict summary banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
            <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Federal Contractors Tracked</div>
            <div className="text-white font-black text-2xl">{contractHolders.length}</div>
            <div className="text-slate-400 text-xs">with congressional trades</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Companies</div>
            <div className="text-white font-black text-2xl">{companies.length}</div>
            <div className="text-slate-400 text-xs">with trade activity</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Trade Volume</div>
            <div className="text-white font-black text-2xl">{formatMoney(companies.reduce((s, c) => s + c.total_volume, 0))}</div>
            <div className="text-slate-400 text-xs">from tracked trades</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Buy / Sell Ratio</div>
            <div className="text-white font-black text-2xl">{companies.reduce((s, c) => s + c.purchases, 0)} : {companies.reduce((s, c) => s + c.sales, 0)}</div>
            <div className="text-slate-400 text-xs">across all companies</div>
          </div>
        </div>

        {selected ? (
          <div>
            <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft size={14} /> Back to all companies
            </button>

            {/* Company header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-4">
                <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Ticker</div>
                <div className="text-white font-black text-3xl">{selected.ticker}</div>
              </div>
              <div className="flex-1">
                <div className="text-white font-black text-2xl">{selected.company_name}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-slate-400 text-sm">{selected.trade_count} trades · {formatMoney(selected.total_volume)} volume</span>
                  {selected.has_contract && (
                    <span className="inline-flex items-center gap-1 bg-emerald-900/40 border border-emerald-700 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                      <Building2 size={10} /> Federal Contractor
                    </span>
                  )}
                </div>
                {isPublicTicker(selected.ticker) ? (
                  <div className="mt-3 max-w-xs">
                    <StockChart ticker={selected.ticker} />
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-600 italic">Private company — no public stock data</div>
                )}
              </div>
            </div>

            <ConflictAlert company={selected} trades={trades} />
            <JournalistFindings company={selected} trades={trades} contracts={contracts} />
          </div>
        ) : (
          <div>
            {/* Search/filter */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by ticker or company name…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="text-slate-500 text-sm">{filtered.length} companies</div>
            </div>

            {/* Federal contractors first */}
            <div className="mb-8">
              {contractHolders.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={14} className="text-emerald-400" />
                    <h2 className="text-emerald-400 font-bold text-sm uppercase tracking-widest">Federal Contractors — Priority Review</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {contractHolders.map(c => (
                      <CompanyCard key={c.ticker} company={c} onSelect={() => setSelected(c)} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* All other companies */}
            <div>
              <h2 className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-4">All Tracked Companies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.filter(c => !c.has_contract).map(c => (
                  <CompanyCard key={c.ticker} company={c} onSelect={() => setSelected(c)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
