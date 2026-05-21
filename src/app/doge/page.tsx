'use client';

import { useState, useEffect } from 'react';
import {
  TrendingDown, AlertTriangle, Users, Shield, ChevronRight, ChevronDown,
  Building2, CheckCircle2, XCircle, Scale, ExternalLink, Gavel
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  DOGE_CLAIMED_SAVINGS, GAO_VERIFIED_SAVINGS, DOGE_AGENCY_SAVINGS, DOGE_OTHER_AGENCIES,
  DOGE_MONTHLY_SAVINGS, DOGE_STAFF_CONFLICTS, DOGE_CONTRACT_WINNERS,
  LEGAL_NOTES, DOGE_METHODOLOGY, type DogeSource, type DogeAgencySavings,
} from '@/lib/doge-data';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtB(n: number): string {
  return `$${(n / 1e9).toFixed(1)}B`;
}
function fmtM(n: number): string {
  return `$${(n / 1e6).toFixed(0)}M`;
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
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

function SourceLinks({ sources }: { sources: DogeSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <span className="text-slate-600 text-xs uppercase tracking-widest">Sources:</span>
      {sources.map(s => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-300 text-xs underline flex items-center gap-1">
          {s.label} <ExternalLink size={9} />
        </a>
      ))}
    </div>
  );
}

// ─── Savings Tracker tab ───────────────────────────────────────────────────────

type AgencySortKey = 'agency' | 'claimed' | 'verified' | 'gap' | 'pct';

function agencyMetric(a: DogeAgencySavings, key: AgencySortKey): string | number {
  const gap = a.claimed - a.verified;
  const pct = a.claimed ? a.verified / a.claimed : 0;
  switch (key) {
    case 'agency': return a.agency;
    case 'claimed': return a.claimed;
    case 'verified': return a.verified;
    case 'gap': return gap;
    case 'pct': return pct;
  }
}

function SavingsTracker() {
  const claimed = DOGE_CLAIMED_SAVINGS;
  const verified = GAO_VERIFIED_SAVINGS;
  const gap = claimed - verified;
  const verifiedPct = Math.round((verified / claimed) * 100);

  const [sortKey, setSortKey] = useState<AgencySortKey>('claimed');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleSort(key: AgencySortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'agency' ? 'asc' : 'desc');
    }
  }

  const sortedAgencies = [...DOGE_AGENCY_SAVINGS].sort((a, b) => {
    const va = agencyMetric(a, sortKey);
    const vb = agencyMetric(b, sortKey);
    const cmp = typeof va === 'string'
      ? va.localeCompare(vb as string)
      : (va as number) - (vb as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const byCategory = {
    workforce: DOGE_AGENCY_SAVINGS.filter(a => a.category === 'workforce').reduce((s, a) => s + a.claimed, 0),
    grants: DOGE_AGENCY_SAVINGS.filter(a => a.category === 'grants').reduce((s, a) => s + a.claimed, 0),
    contracts: DOGE_AGENCY_SAVINGS.filter(a => a.category === 'contracts').reduce((s, a) => s + a.claimed, 0),
    operations: DOGE_AGENCY_SAVINGS.filter(a => a.category === 'operations').reduce((s, a) => s + a.claimed, 0),
  };

  const headers: { key: AgencySortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'agency', label: 'Agency', align: 'left' },
    { key: 'claimed', label: 'Claimed', align: 'right' },
    { key: 'verified', label: 'Verified', align: 'right' },
    { key: 'gap', label: 'Gap', align: 'right' },
    { key: 'pct', label: 'Verified %', align: 'right' },
  ];

  function AgencyRow({ a, muted }: { a: DogeAgencySavings; muted?: boolean }) {
    const rowGap = a.claimed - a.verified;
    const pct = a.claimed ? Math.round((a.verified / a.claimed) * 100) : 0;
    const isOpen = expanded === a.agency;
    return (
      <>
        <tr
          className={`border-b border-slate-800/50 cursor-pointer hover:bg-white/5 ${muted ? 'bg-slate-950/40' : ''}`}
          onClick={() => setExpanded(isOpen ? null : a.agency)}
        >
          <td className="py-3 pr-4">
            <div className="flex items-center gap-2">
              {isOpen
                ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
                : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
              <div>
                <div className={`font-medium text-sm ${muted ? 'text-slate-400 italic' : 'text-white'}`}>{a.agency}</div>
                <div className="text-slate-500 text-xs capitalize">{muted ? 'reconciliation' : a.category}</div>
              </div>
            </div>
          </td>
          <td className="py-3 pr-4 text-right font-mono text-white">{fmtB(a.claimed)}</td>
          <td className="py-3 pr-4 text-right font-mono text-emerald-400">{fmtB(a.verified)}</td>
          <td className="py-3 pr-4 text-right font-mono text-red-400">{fmtB(rowGap)}</td>
          <td className="py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="w-16 bg-slate-800 rounded-full h-1.5">
                <div className={`h-full rounded-full ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-slate-400 text-xs font-mono w-10">{pct}%</span>
            </div>
          </td>
        </tr>
        {isOpen && (
          <tr className="bg-slate-950/60 border-b border-slate-800/50">
            <td colSpan={5} className="px-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Claimed breakdown</div>
                  <p className="text-slate-300 text-sm">{a.claimed_breakdown}</p>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Verified breakdown</div>
                  <p className="text-slate-300 text-sm">{a.verified_breakdown}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Analysis</div>
                <p className="text-slate-300 text-sm leading-relaxed">{a.notes}</p>
              </div>
              <SourceLinks sources={a.sources} />
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="DOGE Claims" value={fmtB(claimed)} sub="Total claimed savings" icon={TrendingDown} color="text-white" />
        <StatCard label="GAO Verifies" value={fmtB(verified)} sub="Independently confirmed" icon={CheckCircle2} color="text-emerald-400" />
        <StatCard label="Gap" value={fmtB(gap)} sub="Claimed minus verified" icon={XCircle} color="text-red-400" />
        <StatCard label="Verified Rate" value={`${verifiedPct}%`} sub="GAO vs DOGE claims" icon={Scale} color="text-amber-400" />
      </div>

      {/* Methodology callout */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-amber-300 text-sm font-bold mb-1">Methodology matters</div>
            <p className="text-slate-300 text-xs leading-relaxed">
              <span className="text-amber-200 font-semibold">DOGE counts:</span> projected future savings from planned reductions, hiring freezes, and attrition — regardless of cancellation fees or legal settlement costs.{' '}
              <span className="text-amber-200 font-semibold">GAO counts:</span> actual dollars saved after accounting for exit costs, replacement contract costs, and supplemental appropriations Congress voted to restore.
              The {fmtB(gap)} gap is mostly explained by those factors.
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              {DOGE_METHODOLOGY.source_links.map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-amber-400 text-xs underline hover:text-amber-300 flex items-center gap-1">
                  {s.label} <ExternalLink size={9} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly claimed vs verified — visual chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">Savings Timeline — Claimed vs Verified</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-400">DOGE claimed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-400">GAO verified</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={DOGE_MONTHLY_SAVINGS.map(m => ({
            month: m.month,
            claimed: Math.round(m.claimed / 1e9 * 10) / 10,
            verified: Math.round(m.verified / 1e9 * 10) / 10,
            note: m.note,
          }))} margin={{ left: 5, right: 15, top: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="claimedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
            />
            <YAxis
              tickFormatter={v => `$${v}B`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              formatter={(v, name) => [`$${v}B`, name === 'claimed' ? 'DOGE Claimed' : 'GAO Verified']}
              labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: '#94a3b8' }}
              cursor={{ fill: 'rgba(148,163,184,0.05)' }}
            />
            <Area
              type="monotone"
              dataKey="claimed"
              stroke="#ef4444"
              strokeWidth={2.5}
              fill="url(#claimedGrad)"
              dot={{ fill: '#ef4444', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#ef4444', strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="verified"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#verifiedGrad)"
              dot={{ fill: '#22c55e', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Timeline notes beneath chart */}
        <div className="mt-4 space-y-2">
          {DOGE_MONTHLY_SAVINGS.map(m => {
            const pct = m.claimed ? Math.round((m.verified / m.claimed) * 100) : 0;
            const isLast = m === DOGE_MONTHLY_SAVINGS[DOGE_MONTHLY_SAVINGS.length - 1];
            return (
              <div key={m.month} className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${isLast ? 'bg-amber-400' : 'bg-slate-600'}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-semibold">{m.month}</span>
                    <span className={`text-xs font-mono font-bold ${pct > 40 ? 'text-emerald-400' : pct > 20 ? 'text-amber-400' : 'text-red-400'}`}>{pct}% verified</span>
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">{m.note}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800">
          {DOGE_METHODOLOGY.source_links.map(s => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-300 text-xs underline flex items-center gap-1">
              {s.label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      </div>

      {/* Agency breakdown table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Agency Breakdown</h3>
        <p className="text-slate-500 text-xs mb-4">Click any row for the claimed/verified breakdown and sources. Sort by clicking a column header.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
                {headers.map(h => (
                  <th
                    key={h.key}
                    onClick={() => toggleSort(h.key)}
                    className={`pb-3 ${h.align === 'left' ? 'text-left' : 'text-right'} ${h.key !== 'pct' ? 'pr-4' : ''} cursor-pointer select-none hover:text-slate-300`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      {sortKey === h.key && (
                        <ChevronDown size={11} className={sortDir === 'asc' ? 'rotate-180' : ''} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAgencies.map(a => <AgencyRow key={a.agency} a={a} />)}
              <AgencyRow a={DOGE_OTHER_AGENCIES} muted />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700">
                <td className="py-3 pr-4 text-white font-bold text-xs uppercase tracking-widest">Total</td>
                <td className="py-3 pr-4 text-right font-mono font-bold text-white">{fmtB(claimed)}</td>
                <td className="py-3 pr-4 text-right font-mono font-bold text-emerald-400">{fmtB(verified)}</td>
                <td className="py-3 pr-4 text-right font-mono font-bold text-red-400">{fmtB(gap)}</td>
                <td className="py-3 text-right font-mono font-bold text-amber-400">{verifiedPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Claimed by Category — Named Agencies</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(byCategory).map(([cat, total]) => (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-2 capitalize">{cat}</div>
              <div className="text-white font-black text-xl font-mono">{fmtB(total)}</div>
              <div className="text-slate-500 text-xs mt-1">claimed (12 named agencies)</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Conflicts of Interest tab ─────────────────────────────────────────────────

function ConflictsOfInterest() {
  return (
    <div className="space-y-6">
      {/* Legal framework */}
      <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Gavel size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-red-300 font-bold text-base mb-1">{LEGAL_NOTES.title}</div>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">{LEGAL_NOTES.body}</p>
            <div className="bg-black/30 rounded-lg p-3 text-xs text-amber-300 font-mono">
              {LEGAL_NOTES.key_question}
            </div>
          </div>
        </div>
      </div>

      {/* § 208 applied to named staff */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">§ 208 Applied — Named DOGE Staff</h3>
        <div className="space-y-3">
          {Object.entries(LEGAL_NOTES.application).map(([who, analysis]) => (
            <div key={who} className="flex gap-3 text-sm">
              <div className="text-red-400 font-mono text-xs uppercase w-16 shrink-0 pt-0.5">{who}</div>
              <p className="text-slate-300 leading-relaxed">{analysis}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="DOGE staff analyzed" value="6" sub="Named DOGE personnel" icon={Users} color="text-white" />
        <StatCard label="With financial conflicts" value="4" sub="Linked to federal contractors" icon={AlertTriangle} color="text-red-400" />
        <StatCard label="Formal recusals filed" value="0" sub="Documented recusal from conflicts" icon={Shield} color="text-amber-400" />
      </div>

      {/* Staff conflicts */}
      <div className="space-y-4">
        {DOGE_STAFF_CONFLICTS.map(s => (
          <div key={s.name} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-white font-bold text-base">{s.name}</div>
                <div className="text-slate-400 text-sm">{s.role}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`text-xs font-bold px-2 py-1 rounded ${s.disclosure_filed ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800' : 'bg-red-950/50 text-red-400 border border-red-800'}`}>
                  {s.disclosure_filed ? 'Disclosure filed' : 'NO DISCLOSURE'}
                </div>
              </div>
            </div>
            {s.companies.length > 0 && (
              <div className="mb-3">
                <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Financial interests</div>
                <div className="flex flex-wrap gap-2">
                  {s.companies.map(c => (
                    <span key={c.name} className="bg-slate-800 text-white text-xs px-2 py-1 rounded">
                      {c.name}
                      {c.ticker && <span className="text-slate-400 font-mono"> ({c.ticker})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
              <div className="text-red-300 text-xs font-bold uppercase tracking-widest mb-1">Conflict exposure</div>
              <p className="text-slate-300 text-sm">{s.notes}</p>
            </div>
            <SourceLinks sources={s.sources} />
          </div>
        ))}
      </div>

      {/* Musk timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Musk Timeline — DOGE Entry to Contract Awards</h3>
        <div className="space-y-3">
          {[
            { date: 'Jan 20, 2025', event: 'Trump inaugurated. Musk named Special Government Employee (SGE) — allows temporary federal service without full financial disclosure requirements.' },
            { date: 'Jan 21–31, 2025', event: 'Musk enters federal buildings. DOGE team accesses OPM, Treasury, USAID payment systems. SpaceX files for additional national security launch contracts.' },
            { date: 'Feb 1, 2025', event: 'SpaceX receives $800M National Security Space Launch contract increase. First major DoD award post-DOGE.' },
            { date: 'Feb 15, 2025', event: 'DOGE staff begin deep cuts to federal agencies. OPM awards $650M Accenture Federal contract to replace federal IT workers — workers DOGE is cutting.' },
            { date: 'Mar 2025', event: 'xAI applies for federal AI contracts. Tesla stock begins rally. DOGE cancels USAID contracts worth $8B — competitors to Starlink in satellite comms.' },
            { date: 'Apr 2025', event: 'Palantir (DOGE tech lead Chris Young has ties) awarded $950M DHS contract. Anduril gets $890M DoD contract. Both competitors for work federal workers used to do.' },
            { date: 'May 2025', event: 'GAO publishes first DOGE audit — verifies $23B actual savings vs. $83B claimed through May. GAO flags the gap as "methodology concerns."' },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="text-red-400 font-mono text-xs w-24 shrink-0 pt-0.5">{item.date}</div>
              <div className="text-slate-300 leading-relaxed">{item.event}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Who's Winning tab ─────────────────────────────────────────────────────────

function WhosWinning() {
  const totalWinnings = DOGE_CONTRACT_WINNERS.reduce((s, c) => s + c.contract_amount, 0);
  const sortedWinners = [...DOGE_CONTRACT_WINNERS].sort((a, b) => b.contract_amount - a.contract_amount);

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Post-DOGE Contracts" value={fmtM(totalWinnings)} sub="Awarded to replacement vendors" icon={Building2} color="text-white" />
        <StatCard label="Companies Profiled" value={`${DOGE_CONTRACT_WINNERS.length}`} sub="Winning post-DOGE contracts" icon={CheckCircle2} color="text-emerald-400" />
        <StatCard label="Avg Contract Size" value={fmtM(totalWinnings / DOGE_CONTRACT_WINNERS.length)} sub="Per winning company" icon={Scale} color="text-amber-400" />
      </div>

      {/* The pattern callout */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <TrendingDown size={14} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-blue-300 font-bold text-sm mb-1">The DOGE Pattern: Public to Private</div>
            <p className="text-slate-300 text-sm leading-relaxed">
              DOGE cuts federal workers. The same work goes to private contractors — at higher cost. A federal IT worker costs ~$120K/year with benefits. Accenture or Booz Allen charges $200–$350K for the same contractor seat. The savings are real for the federal budget line — but taxpayers pay the difference through higher contract costs, and the workers are simply removed from the public payroll.
            </p>
          </div>
        </div>
      </div>

      {/* Companies */}
      <div className="space-y-4">
        {sortedWinners.map(c => (
          <div key={c.company} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-base">{c.company}</span>
                  {c.ticker && (
                    <span className="bg-slate-800 text-slate-300 text-xs font-mono px-1.5 py-0.5 rounded">{c.ticker}</span>
                  )}
                </div>
                <div className="text-slate-400 text-sm">{c.agency} — {c.date_awarded}</div>
              </div>
              <div className="text-right">
                <div className="text-white font-black text-2xl font-mono">{fmtM(c.contract_amount)}</div>
                <div className="text-slate-500 text-xs">contract value</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Replacing</div>
                <div className="text-slate-300 text-sm">{c.replacing}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Description</div>
                <div className="text-slate-300 text-sm">{c.description}</div>
              </div>
            </div>
            <div className="mt-3 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
              <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-1">DOGE Connection</div>
              <p className="text-slate-300 text-xs">{c.connection_to_doge}</p>
            </div>
            <SourceLinks sources={c.sources} />
          </div>
        ))}
      </div>

      {/* Bottom summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">What This Means</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-red-400 font-bold text-sm mb-2">Budget line savings ≠ real savings</div>
            <p className="text-slate-400 text-xs leading-relaxed">When DOGE cuts a budget line, it looks like savings. But if the same work is contracted out at 2–3x the cost, the net cost to taxpayers increases — even though the federal budget shows a decrease.</p>
          </div>
          <div>
            <div className="text-amber-400 font-bold text-sm mb-2">Federal workers gone, contractors in</div>
            <p className="text-slate-400 text-xs leading-relaxed">80,000+ federal workers separated. Accenture, Booz Allen, GDIT, Deloitte, and Peraton picked up the work. Federal institutional knowledge is gone — replaced with for-profit contractors who answer to shareholders.</p>
          </div>
          <div>
            <div className="text-emerald-400 font-bold text-sm mb-2">Who's profiting</div>
            <p className="text-slate-400 text-xs leading-relaxed">Booz Allen Hamilton (BAH stock up 18% since Jan 2025). Accenture (ACN up 12%). Palantir (PLTR up 200%+). These companies have the same federal contractor relationships — DOGE cuts were a business development opportunity.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'savings' | 'conflicts' | 'winners';

const HASH_TO_TAB: Record<string, TabKey> = {
  '#savings': 'savings',
  '#conflicts': 'conflicts',
  '#winners': 'winners',
};

function tabFromHash(): TabKey {
  if (typeof window === 'undefined') return 'savings';
  return HASH_TO_TAB[window.location.hash] ?? 'savings';
}

export default function DogePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('savings');

  // Sync the active tab with the URL hash so /doge#conflicts deep links work.
  useEffect(() => {
    setActiveTab(tabFromHash());
    const onHashChange = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function selectTab(key: TabKey) {
    setActiveTab(key);
    if (typeof window !== 'undefined') window.location.hash = key;
  }

  const tabs = [
    { key: 'savings', label: 'Savings Tracker', sub: 'Claimed vs verified', icon: TrendingDown },
    { key: 'conflicts', label: 'Conflicts of Interest', sub: 'Musk + staff', icon: Shield },
    { key: 'winners', label: "Who's Winning", sub: 'Contract winners', icon: Building2 },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Section banner */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="text-red-400 text-xs uppercase tracking-widest font-bold">DOGE Special Report</div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-white font-black text-4xl font-mono tracking-tight mb-2">
            DOGE: The Real Score
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            DOGE claims $130B in savings. Independent auditors say $28B. Here is the full breakdown — by agency, by conflict of interest, and by who picked up the contracts.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-800 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <t.icon size={14} />
              {t.label}
              <span className="text-slate-600 text-xs font-normal">— {t.sub}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'savings' && <SavingsTracker />}
        {activeTab === 'conflicts' && <ConflictsOfInterest />}
        {activeTab === 'winners' && <WhosWinning />}

        {/* Footer note */}
        <div className="mt-10 pt-6 border-t border-slate-800">
          <p className="text-slate-600 text-xs">
            Sources: DOGE public dashboard (doge.gov) · GAO audit GAO-26-106 (May 2026) · OPM workforce data · USAspending.gov · OGE.gov financial disclosures · FEC filings. Data current as of May 20, 2026. All contract amounts are from federal procurement records.
          </p>
        </div>
      </div>
    </div>
  );
}
