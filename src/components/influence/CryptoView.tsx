'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ArrowLeft, TrendingUp, DollarSign, AlertTriangle, Shield, ChevronDown,
  ChevronUp, Users, Building2, Pickaxe, Scale, ArrowRight, ExternalLink,
  Bitcoin, Users2, Landmark, Zap
} from 'lucide-react';
import {
  CRYPTO_POLITICIANS, CRYPTO_PACS, CRYPTO_COMPANIES, CRYPTO_MINING_FACILITIES,
  MONEY_FLOW_NODES, CRYPTO_ENTITY_ENRICHMENT, CRYPTO_EXCHANGES
} from '@/lib/crypto-data';

const CHART_COLORS = ['#f97316', '#a855f7', '#22c55e', '#3b82f6', '#eab308', '#ef4444', '#06b6d4'];

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmtM(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── Politician Card ─────────────────────────────────────────────────────────
function PoliticianCard({ p }: { p: typeof CRYPTO_POLITICIANS[0] }) {
  const [open, setOpen] = useState(false);
  const stanceColor = p.crypto_stance === 'pro-crypto' ? 'text-emerald-400' : p.crypto_stance === 'anti-crypto' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg shrink-0">
            {p.name[0]}
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{p.name}</div>
            <div className="text-slate-400 text-xs">{p.position}{p.state ? ` · ${p.state}` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold uppercase ${stanceColor}`}>{p.stance_label}</span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3 border-t border-slate-800">
          {p.btc_holdings && (
            <div className="pt-3">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Crypto Holdings (Self-Disclosed)</div>
              <div className="flex gap-4">
                {p.btc_holdings && <span className="text-xs text-orange-400 font-mono">₿ {p.btc_holdings}</span>}
                {p.eth_holdings && <span className="text-xs text-blue-400 font-mono">Ξ {p.eth_holdings}</span>}
              </div>
            </div>
          )}
          {p.notable_statements.length > 0 && (
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Notable Statements</div>
              <div className="space-y-1">
                {p.notable_statements.map((s, i) => (
                  <div key={i} className="text-slate-300 text-xs leading-relaxed">"{s}"</div>
                ))}
              </div>
            </div>
          )}
          {p.congress_actions.length > 0 && (
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Congressional Actions</div>
              <div className="space-y-1">
                {p.congress_actions.map((a, i) => (
                  <div key={i} className="text-slate-300 text-xs leading-relaxed">• {a}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PAC Row ────────────────────────────────────────────────────────────────
function PACRow({ pac }: { pac: typeof CRYPTO_PACS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-900/50 border border-orange-700 flex items-center justify-center text-orange-300 text-xs font-bold shrink-0">
            {pac.abbr.slice(0, 2)}
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{pac.pac_name}</div>
            <div className="text-slate-400 text-xs">{pac.parent_org}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-black font-mono text-sm">{fmtM(pac.amountRaised)}</span>
          <span className="text-slate-500 text-xs">{pac.year}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-slate-800">
          <div className="pt-3 mb-2">
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Top Recipients</div>
            <div className="space-y-1.5">
              {pac.top_recipients.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.party === 'R' ? 'bg-red-500' : r.party === 'D' ? 'bg-blue-500' : 'bg-slate-500'}`} />
                    <span className="text-slate-200 text-xs">{r.name}</span>
                    <span className="text-slate-500 text-xs">({r.party})</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-xs">{fmtM(r.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-500">Stance: {pac.stance}</div>
        </div>
      )}
    </div>
  );
}

// ─── Company Table ──────────────────────────────────────────────────────────
function CompanyTable() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? CRYPTO_COMPANIES : CRYPTO_COMPANIES.slice(0, 8);
  const connColor: Record<string, string> = {
    elon_musk: 'text-purple-400',
    trump_family: 'text-red-400',
    trump_ally: 'text-blue-400',
    gop_donor: 'text-emerald-400',
    none: 'text-slate-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Crypto Companies — Political Connections</h3>
        <p className="text-slate-500 text-xs mt-1">Which crypto companies have federal contracts, political donations, or regulatory ties</p>
      </div>
      <div className="divide-y divide-slate-800">
        {visible.map((c) => (
          <div key={c.company_name} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">{c.company_name}</span>
                  {c.ticker && <span className="text-xs font-mono text-slate-500">{c.ticker}</span>}
                  <span className={`text-xs uppercase font-bold ${connColor[c.connection_type] ?? 'text-slate-400'}`}>
                    {c.connection_type?.replace('_', ' ')}
                  </span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{c.sector}</span>
                </div>
                <div className="text-slate-400 text-xs mt-0.5">{c.political_connection}</div>
                {c.federal_dollars > 0 && (
                  <div className="text-red-400 text-xs mt-1 font-mono">
                    Federal contracts: {fmtM(c.federal_dollars)}
                  </div>
                )}
                <div className="text-slate-500 text-xs mt-1 leading-relaxed">{c.notes.slice(0, 160)}…</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {CRYPTO_COMPANIES.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {CRYPTO_COMPANIES.length} Companies</>}
        </button>
      )}
    </div>
  );
}

// ─── Mining Table ───────────────────────────────────────────────────────────
function MiningTable() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? CRYPTO_MINING_FACILITIES : CRYPTO_MINING_FACILITIES.slice(0, 6);
  const powerColor: Record<string, string> = { nuclear: 'text-blue-400', renewable: 'text-emerald-400', gas: 'text-orange-400', coal: 'text-slate-500', mixed: 'text-slate-400' };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Pickaxe size={14} className="text-orange-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Bitcoin Mining Facilities — US Operations</h3>
        </div>
        <p className="text-slate-500 text-xs mt-1">Crypto mining facilities with energy source, political connections, and state data</p>
      </div>
      <div className="divide-y divide-slate-800">
        {visible.map((m) => (
          <div key={m.company_name + m.location} className="px-5 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">{m.company_name}</span>
                  <span className="text-slate-400 text-xs">{m.location} · {m.state}</span>
                  <span className={`text-xs font-mono font-bold ${powerColor[m.power_source] ?? 'text-slate-400'}`}>
                    {m.power_source.toUpperCase()} POWER
                  </span>
                </div>
                {m.political_connection && (
                  <div className="text-slate-400 text-xs mt-0.5">{m.political_connection}</div>
                )}
                <div className="text-slate-500 text-xs mt-1">{m.notes}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-mono font-bold text-sm">~{m.hashrate_mw} MW</div>
                <div className="text-slate-500 text-xs">hash rate</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {CRYPTO_MINING_FACILITIES.length > 6 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All Mining Facilities</>}
        </button>
      )}
    </div>
  );
}

// ─── PAC Breakdown Chart ─────────────────────────────────────────────────────
function PACBreakdown() {
  const data = CRYPTO_PACS.map(p => ({
    name: p.abbr,
    value: p.amountRaised,
    color: CHART_COLORS[CRYPTO_PACS.indexOf(p) % CHART_COLORS.length],
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Crypto PAC Fundraising — 2024 Cycle</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} nameKey="name" dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: any) => [fmtM(Number(v)), 'Raised']} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-slate-300 text-xs">{d.name}</span>
            </div>
            <span className="text-white text-xs font-mono">{fmtM(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Money Flow Viz ─────────────────────────────────────────────────────────
function MoneyFlowViz() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} className="text-orange-400" />
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Money Flow: Crypto Industry → Politicians → Regulatory Outcomes</h3>
      </div>
      <p className="text-slate-500 text-xs mb-5">How $178M in crypto PAC donations translate into policy decisions that benefit the crypto industry</p>

      {/* Layer 1: Sources */}
      <div className="mb-4">
        <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Step 1 — Crypto PAC Money ($178M+ raised)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CRYPTO_PACS.slice(0, 3).map((pac) => (
            <div key={pac.pac_name} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
              <div className="text-white text-xs font-semibold">{pac.abbr}</div>
              <div className="text-orange-400 font-black font-mono text-sm">{fmtM(pac.amountRaised)}</div>
              <div className="text-slate-500 text-xs">→ {pac.top_recipients[0]?.name.slice(0, 20)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-2 mb-4 text-slate-500">
        <ArrowRight size={16} /> <span className="text-xs">PAC money flows to politicians who support crypto</span>
      </div>

      {/* Layer 2: Outcomes */}
      <div className="mb-4">
        <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Step 2 — Regulatory Wins for Crypto</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { title: 'SEC Enforcement Halted', desc: 'Gensler replaced. Coinbase/SBF cases dropped or settled cheaply.', color: 'border-emerald-700 bg-emerald-900/20' },
            { title: 'FIT21 Act Passed', desc: 'Comprehensive crypto regulatory framework — passed House 2025.', color: 'border-blue-700 bg-blue-900/20' },
            { title: 'BITCOIN Act Proposed', desc: 'Lummis bill — proposes 5% of Treasury holdings in bitcoin.', color: 'border-orange-700 bg-orange-900/20' },
          ].map((item) => (
            <div key={item.title} className={`border rounded-lg px-3 py-2 ${item.color}`}>
              <div className="text-white text-xs font-semibold">{item.title}</div>
              <div className="text-slate-300 text-xs mt-0.5 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-2 mb-4 text-slate-500">
        <ArrowRight size={16} /> <span className="text-xs">Favorable regulations → crypto company profits surge</span>
      </div>

      {/* Layer 3: Outcomes */}
      <div>
        <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Step 3 — Who Benefits</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { name: 'Tesla / Elon Musk', detail: 'Holds $1B+ in BTC · DOGE shapes crypto regulation', amount: '$1B+ corporate BTC holdings', color: 'text-purple-400' },
            { name: 'Coinbase', detail: 'SEC lawsuit dropped. Fairshake PAC investment returned 10x in policy wins.', amount: '$78M PAC donation → multi-billion value', color: 'text-blue-400' },
            { name: 'MicroStrategy / Saylor', detail: 'BITCOIN Act advocacy directly inflates MSTR stock.', amount: '$250K in donations → $45B in BTC', color: 'text-orange-400' },
            { name: 'Bitcoin Miners', detail: 'FIT21 creates clear rules. RIOT/MARA stock up 300%+ on news.', amount: '$15M in PAC → billions in market cap', color: 'text-emerald-400' },
          ].map((item) => (
            <div key={item.name} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
              <div className={`text-sm font-semibold ${item.color}`}>{item.name}</div>
              <div className="text-slate-300 text-xs mt-0.5">{item.detail}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">{item.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Crypto View (embedded in the Influence hub) ─────────────────────────────
export default function CryptoView() {
  const [tab, setTab] = useState<'overview' | 'politicians' | 'companies' | 'mining' | 'trumpcrypto' | 'exchanges'>('overview');
  const proCount = CRYPTO_POLITICIANS.filter(p => p.crypto_stance === 'pro-crypto').length;
  const antiCount = CRYPTO_POLITICIANS.filter(p => p.crypto_stance === 'anti-crypto').length;
  const totalPAC = CRYPTO_PACS.reduce((s, p) => s + p.amountRaised, 0);
  const connectedCompanies = CRYPTO_COMPANIES.filter(c => c.connection_type !== 'none').length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Home
          </Link>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            <Bitcoin size={16} className="text-orange-400" />
            <span className="text-slate-300 font-medium text-sm">Crypto & Government</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-slate-500 text-xs">180+ entities tracked</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-white mb-2">
            Crypto <span className="text-orange-400">& Government</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            The 360° view of all ties between the cryptocurrency industry and the federal government — politicians who own crypto, crypto company political donations, bitcoin mining facilities, regulatory capture, and the money flow from PAC contributions to policy decisions.
          </p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pro-Crypto Politicians" value={String(proCount)} sub="In Congress + White House" icon={Users} color="text-emerald-400" />
          <StatCard label="Anti-Crypto Politicians" value={String(antiCount)} sub="Key opponents in Congress" icon={Shield} color="text-red-400" />
          <StatCard label="Crypto PAC Money (2024)" value={fmtM(totalPAC)} sub="Fairshake + a16z + Stand With Crypto" icon={DollarSign} color="text-orange-400" />
          <StatCard label="Crypto cos. w/ Political Ties" value={String(connectedCompanies)} sub="Federal contracts or PAC ties" icon={Building2} color="text-purple-400" />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-slate-800">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'politicians', label: 'Politicians' },
            { key: 'companies', label: 'Companies' },
            { key: 'mining', label: 'Mining Facilities' },
            { key: 'trumpcrypto', label: 'Trump Crypto' },
            { key: 'exchanges', label: 'Exchanges' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-orange-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <MoneyFlowViz />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PACBreakdown />
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Crypto Stance in Congress</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: 'Pro-Crypto', count: proCount, fill: '#22c55e' },
                    { name: 'Anti-Crypto', count: antiCount, fill: '#ef4444' },
                    { name: 'Mixed/Unclear', count: 3, fill: '#64748b' },
                  ]} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: any) => [v, 'Politicians']}
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {[{ fill: '#22c55e' }, { fill: '#ef4444' }, { fill: '#64748b' }].map((c, i) => <Cell key={i} fill={c.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Politicians Tab */}
        {tab === 'politicians' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 uppercase tracking-widest text-emerald-400">Pro-Crypto Politicians</h2>
              <p className="text-slate-500 text-xs">Elected officials who support cryptocurrency — through legislation, disclosures, or public advocacy</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {CRYPTO_POLITICIANS.filter(p => p.crypto_stance === 'pro-crypto').map(p => (
                <PoliticianCard key={p.name} p={p} />
              ))}
            </div>
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-1 uppercase tracking-widest text-red-400">Anti-Crypto Politicians</h2>
              <p className="text-slate-500 text-xs mb-4">Elected officials actively opposed to cryptocurrency or pushing restrictive regulation</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {CRYPTO_POLITICIANS.filter(p => p.crypto_stance === 'anti-crypto').map(p => (
                  <PoliticianCard key={p.name} p={p} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Companies Tab */}
        {tab === 'companies' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 uppercase tracking-widest">Crypto Industry Political Donations</h2>
              <p className="text-slate-500 text-xs">PAC fundraising by crypto industry players in the 2024 election cycle — bipartisan strategy is intentional</p>
            </div>
            <div className="space-y-3">
              {CRYPTO_PACS.map(pac => <PACRow key={pac.pac_name} pac={pac} />)}
            </div>
            <CompanyTable />
          </div>
        )}

        {/* Mining Tab */}
        {tab === 'mining' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 uppercase tracking-widest text-orange-400">Bitcoin Mining in America</h2>
              <p className="text-slate-500 text-xs">US bitcoin mining facilities — their energy sources, political connections, and regulatory exposure</p>
            </div>
            <MiningTable />
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Why This Matters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
                <div>
                  <span className="text-slate-200 font-medium">Energy Consumption</span><br />
                  Bitcoin mining now consumes ~15-20 GW in the US — equivalent to ~15 million homes. Mostly in Texas (ERCOT grid) using gas and coal.
                </div>
                <div>
                  <span className="text-slate-200 font-medium">Political Power</span><br />
                  Riot Platforms and Marathon Digital have spent $5M+ on lobbying. They support candidates who favor cheap energy and light-touch crypto regulation.
                </div>
                <div>
                  <span className="text-slate-200 font-medium"> Musk Connection</span><br />
                  Tesla holds $1B+ in Bitcoin on its balance sheet. Musk\'s DOGE role shapes energy AND crypto policy — both his personal crypto interests and federal spending on energy.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trump Crypto Tab */}
        {tab === 'trumpcrypto' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-red-950/40 to-orange-950/40 border border-red-800/40 rounded-xl p-6">
              <h2 className="text-white font-black text-2xl mb-2">Trump Family Crypto Empire</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Three distinct crypto ventures. Hundreds of millions raised. Multiple ongoing federal investigations.
                A pattern of using presidential power to enrich the Trump family through cryptocurrency.
              </p>
            </div>

            {/* The Three Coins */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">The Three Coins</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {
                    name: 'World Liberty Financial',
                    ticker: 'WLFI',
                    role: 'The Family Venture',
                    detail: 'DeFi protocol. Trump co-founder emeritus. Don Jr., Eric, Barron as co-founders. Raised $550M+. 75% of proceeds to Trump family. $1B profit by Dec 2025.',
                    color: 'border-blue-700 bg-blue-950/20',
                    accent: 'text-blue-400',
                    badges: ['Active DeFi Protocol', '$550M+ Raised', '75% to Trump Family'],
                  },
                  {
                    name: '$TRUMP Coin',
                    ticker: '$TRUMP',
                    role: 'The MemeCoin',
                    detail: 'Launched hours before inauguration. Peak $45.47. Chainalysis: 58 early investors made $10M+ each. ~764,000 small holders lost. Classic pump-and-dump.',
                    color: 'border-red-700 bg-red-950/20',
                    accent: 'text-red-400',
                    badges: ['Pump-and-Dump Pattern', 'Peak $45.47', '$10M+ for 58 Insiders'],
                  },
                  {
                    name: '$MELANIA Coin',
                    ticker: '$MELANIA',
                    role: 'The First Lady Coin',
                    detail: 'Launched day before inauguration. Peaked $13.73. Crashed to $0.10. Federal lawsuit Oct 2025: Meteora execs accused of pump-and-dump fraud. Melania not named as defendant.',
                    color: 'border-purple-700 bg-purple-950/20',
                    accent: 'text-purple-400',
                    badges: ['Pump-and-Dump Lawsuit', 'Peak $13.73', '< 1% Remain'],
                  },
                ].map(coin => (
                  <div key={coin.ticker} className={`border rounded-xl p-5 ${coin.color}`}>
                    <div className={`text-xs font-bold uppercase mb-1 ${coin.accent}`}>{coin.ticker}</div>
                    <div className="text-white font-bold text-lg mb-0.5">{coin.name}</div>
                    <div className="text-slate-400 text-xs mb-3">{coin.role}</div>
                    <p className="text-slate-300 text-xs leading-relaxed mb-3">{coin.detail}</p>
                    <div className="flex flex-wrap gap-1">
                      {coin.badges.map(b => (
                        <span key={b} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{b}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WLFI Investor & Conflict Map */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">WLFI - Money Flow and Conflicts</h3>
              <div className="space-y-3">
                {[
                  {
                    entity: 'Justin Sun',
                    role: 'WLFI Advisor / Tron Founder',
                    investment: '$30M+ invested (Feb 2025)',
                    conflict: 'SEC investigation into Sun DROPPED weeks after his $30M WLFI investment. Founder of Tron blockchain - WLFI USD1 runs on Tron.',
                    color: 'border-orange-700 bg-orange-950/20',
                  },
                  {
                    entity: 'MGX / Tahnoun bin Zayed',
                    role: 'Abu Dhabi Royal Family (UAE NSA)',
                    investment: '$2B USD1 stablecoin + $500M for 49% stake',
                    conflict: 'Trump admin approved advanced chip exports to UAE company linked to Tahnoun weeks after Abu Dhabi deal. Potential emoluments clause violation. Never publicly disclosed.',
                    color: 'border-yellow-700 bg-yellow-950/20',
                  },
                  {
                    entity: 'Changpeng Zhao / Binance',
                    role: 'Pardoned Crypto Exchange Founder',
                    investment: 'Binance helped enrich WLFI through exchange - then Zhao pardoned (Jan 2025)',
                    conflict: 'Convicted of AML violations Nov 2023. Trump pardoned him Jan 2025. Binance was used for the $2B USD1 Binance deal with MGX.',
                    color: 'border-amber-700 bg-amber-950/20',
                  },
                ].map(item => (
                  <div key={item.entity} className={`border rounded-xl p-4 ${item.color}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-bold text-sm">{item.entity}</div>
                        <div className="text-slate-400 text-xs">{item.role}</div>
                        <div className="text-emerald-400 text-xs font-mono mt-1">{item.investment}</div>
                      </div>
                    </div>
                    <div className="text-red-300 text-xs mt-2 leading-relaxed">{item.conflict}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* WLFI Crypto People */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">WLFI Founders & Inner Circle</h3>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <div className="grid grid-cols-3 gap-4 text-xs text-slate-400 uppercase tracking-widest">
                    <div>Person</div>
                    <div>Role</div>
                    <div>Connection</div>
                  </div>
                </div>
                {[
                  { name: 'Donald Trump', role: 'Co-founder Emeritus', detail: '70% of DT Marks DEFI LLC (22.5B tokens). $57.4M reported on financial disclosure. $1B+ profit by Dec 2025.' },
                  { name: 'Donald Trump Jr.', role: 'Co-founder', detail: 'Part of DT Marks DEFI LLC. Shares in family 75% proceeds.' },
                  { name: 'Eric Trump', role: 'Co-founder', detail: 'Chief Strategy Adviser of WLFI. Shares in family 75% proceeds.' },
                  { name: 'Barron Trump', role: 'Co-founder', detail: 'Youngest co-founder.' },
                  { name: 'Zach Witkoff', role: 'Co-founder', detail: 'Son of Steve Witkoff (Trump diplomat / Putin met). Applied for WLFI national banking license Jan 2026. Met with Binance founder in Abu Dhabi.' },
                  { name: 'Alex Witkoff', role: 'Co-founder', detail: 'Brother of Zach Witkoff. Son of Steve Witkoff.' },
                  { name: 'Zachary Folkman', role: 'Co-founder', detail: 'One of four original founders.' },
                  { name: 'Chase Herro', role: 'Co-founder', detail: 'One of four original founders.' },
                  { name: 'Steve Witkoff', role: 'WLFI Father', detail: 'Trump ally. Met privately with Putin Jan 2025 before inauguration. Became US diplomat. Father of Zach and Alex Witkoff.' },
                ].map(row => (
                  <div key={row.name} className="px-5 py-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                    <div className="grid grid-cols-3 gap-4 items-start">
                      <div className="text-white text-sm font-semibold">{row.name}</div>
                      <div className="text-slate-400 text-xs">{row.role}</div>
                      <div className="text-slate-300 text-xs leading-relaxed">{row.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* The Pattern */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">The Pattern</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
                <div>
                  <span className="text-white font-medium">Use the presidency to launch crypto ventures.</span><br />
                  Trump announces WLFI days after winning 2024 election. Launches $TRUMP hours before inauguration. Melania launches $MELANIA day before.
                </div>
                <div>
                  <span className="text-white font-medium">Attract investors with promises of regulatory access.</span><br />
                  Justin Sun invests $30M+ after Tron SEC investigation is quietly dropped. UAE royal family invests $2.5B.
                </div>
                <div>
                  <span className="text-white font-medium">Insiders profit. Retail loses.</span><br />
                  Chainalysis: 58 early $TRUMP investors each made $10M+. ~764,000 small holders lost. $MELANIA crashed 99% within months.
                </div>
                <div>
                  <span className="text-white font-medium">Pardon co-conspirators.</span><br />
                  Changpeng Zhao (Binance founder, convicted of AML crimes) pardoned Jan 2025. Binance helped enrich WLFI, then Zhao pardoned.
                </div>
              </div>
            </div>

            {/* Sources */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Sources</h3>
              <div className="space-y-1 text-xs text-slate-500">
                <div>- Wikipedia / World Liberty Financial (https://en.wikipedia.org/wiki/World_Liberty_Financial)</div>
                <div>- Forbes: Trump Family WLFI Token Debuts (2025-09-02)</div>
                <div>- Washington Post: Trump coin gold rush (2025-05-08)</div>
                <div>- The Guardian: Melania memecoin fraud lawsuit (2025-10-23)</div>
                <div>- Forbes: Melania under fire (2025-10-22)</div>
                <div>- CBS News: Trump WLFI wealth boosted by $5B (2025-09)</div>
                <div>- Reuters: MGX World Liberty USD1 $2B Binance deal (2025-05)</div>
              </div>
            </div>
          </div>
        )}

        {/* Exchanges Tab */}
        {tab === 'exchanges' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-950/40 to-cyan-950/40 border border-blue-800/40 rounded-xl p-6">
              <h2 className="text-white font-black text-2xl mb-2">Crypto Exchanges</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Major global crypto exchanges mapped for political connections, regulatory conflicts, and ties to the Trump administration, foreign governments, and known bad actors.
              </p>
            </div>

            {/* Key Conflicts Highlight */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Binance -- Trump Pardon',
                  detail: 'Changpeng Zhao convicted of AML crimes. Trump pardoned him Jan 2025. Binance helped enrich WLFI via token trading. WLFI USD1 used in $2B Binance deal with Abu Dhabi.',
                  color: 'border-red-700 bg-red-950/20',
                  accent: 'text-red-400',
                },
                {
                  title: 'Bitfinex -- Revolving Door',
                  detail: 'Jay Clayton (Trump-appointed SEC Chair) joined Bitfinex parent iFinex board Jan 2021 -- one month after resigning from SEC. Direct revolving door.',
                  color: 'border-yellow-700 bg-yellow-950/20',
                  accent: 'text-yellow-400',
                },
                {
                  title: 'Coinbase -- SEC Lawsuit',
                  detail: 'SEC sued Coinbase June 2023 for securities violations. Case ongoing but shifted under Trump admin. $6.6B revenue in 2024. $4.2M federal lobbying.',
                  color: 'border-blue-700 bg-blue-950/20',
                  accent: 'text-blue-400',
                },
                {
                  title: 'Circle -- USDC Lobbying',
                  detail: 'Circle issued USDC ($53B+ market cap). Jeremy Allaire spent $2M+ on federal lobbying for FIT21 and stablecoin legislation. Used by Coinbase and Uniswap.',
                  color: 'border-green-700 bg-green-950/20',
                  accent: 'text-emerald-400',
                },
              ].map(item => (
                <div key={item.title} className={`border rounded-xl p-4 ${item.color}`}>
                  <div className={`text-sm font-bold mb-1 ${item.accent}`}>{item.title}</div>
                  <p className="text-slate-300 text-xs leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            {/* Exchanges Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest">All Exchanges</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {CRYPTO_EXCHANGES.map(ex => {
                  const connColor = {
                    trump_ally: 'text-red-400',
                    foreign_sovereign: 'text-yellow-400',
                    elon_musk: 'text-purple-400',
                    trump_family: 'text-red-500',
                    none: 'text-slate-400',
                  }[ex.connection_type] ?? 'text-slate-400';
                  return (
                    <div key={ex.name} className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-bold text-sm">{ex.name}</span>
                            <span className={`text-xs font-bold uppercase ${connColor}`}>
                              {ex.connection_type?.replace('_', ' ')}
                            </span>
                            {ex.trump_pac_donations && ex.trump_pac_donations > 0 && (
                              <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded">
                                ${(ex.trump_pac_donations/1000000).toFixed(1)}M PAC
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-xs mb-1">
                            {ex.founders} · Founded {ex.founded} · HQ: {ex.headquarters}
                          </div>
                          <div className="text-slate-300 text-xs leading-relaxed mb-1">
                            {ex.political_connection.slice(0, 200)}
                            {ex.political_connection.length > 200 ? '...' : ''}
                          </div>
                          {ex.regulatory_conflicts && (
                            <div className="text-slate-500 text-xs mt-1 leading-relaxed">
                              <span className="text-slate-600">Regulatory: </span>{ex.regulatory_conflicts.slice(0, 120)}...
                            </div>
                          )}
                          {ex.wallet_hacks && (
                            <div className="text-amber-500 text-xs mt-1">
                              Hacked: {ex.wallet_hacks.slice(0, 80)}
                            </div>
                          )}
                        </div>
                        {ex.trading_volume_approx && (
                          <div className="text-right shrink-0">
                            <div className="text-white font-mono font-bold text-sm">
                              ${(ex.trading_volume_approx/1000000000).toFixed(0)}B
                            </div>
                            <div className="text-slate-500 text-xs">/mo volume</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm mb-2">Data Sources & Disclaimer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 leading-relaxed">
            <div>
              <span className="text-slate-200 font-medium">Political Donations</span><br />
              Federal Election Commission (FEC.gov), OpenSecrets.org — individual contributions and PAC filings. PAC donations aggregated by OpenSecrets 2024 cycle data.
            </div>
            <div>
              <span className="text-slate-200 font-medium">Crypto Holdings</span><br />
              Senate Financial Disclosures (required for holdings above $1,000). Not all members disclose crypto. Holdings shown are self-reported estimates.
            </div>
            <div>
              <span className="text-slate-200 font-medium">Mining Facilities</span><br />
              Company filings, press releases, and industry reports. Energy consumption estimates from Cambridge Bitcoin Electricity Consumption Index and company disclosures.
            </div>
            <div>
              <span className="text-slate-200 font-medium">Limitations</span><br />
              This page tracks public disclosures and documented connections. Many political cryptocurrency connections are not publicly disclosed. This is investigative journalism — not legal advice.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}