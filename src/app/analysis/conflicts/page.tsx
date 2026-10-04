'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Scale, Landmark, Building2, Clock, ChevronLeft, ExternalLink,
} from 'lucide-react';
import type { ConflictLeader, FlaggedTrade } from '@/app/api/conflicts/route';

interface ConflictsData {
  leaderboard: ConflictLeader[];
  flagged_trades: FlaggedTrade[];
  stats: {
    total_scored: number;
    total_flagged: number;
    band_70_plus: number;
    band_45_69: number;
    late_transaction_count: number;
    committee_conflicts: number;
  };
}

const TIER: Record<string, { label: string; cls: string; dot: string }> = {
  score_70_plus: { label: 'SCORE 70-100', cls: 'bg-red-950/60 text-red-300 border-red-800', dot: 'bg-red-500' },
  score_45_69: { label: 'SCORE 45-69', cls: 'bg-orange-950/50 text-orange-300 border-orange-800', dot: 'bg-orange-500' },
  score_20_44: { label: 'SCORE 20-44', cls: 'bg-amber-950/40 text-amber-300 border-amber-800', dot: 'bg-amber-500' },
  score_under_20: { label: 'SCORE 0-19', cls: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-600' },
};

const SOURCE_URL: Record<string, string> = {
  House_Clerk: 'https://disclosures-clerk.house.gov/FinancialDisclosure',
  Senate_EFD: 'https://efdsearch.senate.gov/search/',
};

function fmtMoney(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function partyColor(p: string): string {
  if (p === 'Democrat') return 'text-blue-400';
  if (p === 'Republican') return 'text-red-400';
  return 'text-slate-400';
}

export default function ConflictsPage() {
  const [data, setData] = useState<ConflictsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<'all' | 'score_70_plus' | 'score_45_69'>('all');

  useEffect(() => {
    fetch('/api/conflicts')
      .then((r) => r.json())
      .then((d: ConflictsData) => setData(d))
      .catch((e) => console.error('Failed to load conflicts:', e))
      .finally(() => setLoading(false));
  }, []);

  const flagged = (data?.flagged_trades ?? []).filter(
    (t) => tierFilter === 'all' || t.conflict_tier === tierFilter,
  );
  const maxConflicted = Math.max(1, ...(data?.leaderboard ?? []).map((m) => m.signal_trades));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* breadcrumb */}
        <Link href="/analysis/history" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-4">
          <ChevronLeft size={14} /> Congress Trades
        </Link>

        {/* header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono bg-red-950/60 text-red-300 border border-red-900 px-2 py-0.5 rounded uppercase tracking-widest">
              Conflict Engine
            </span>
          </div>
          <h1 className="text-4xl font-black mb-2">
            The Conflict <span className="text-red-500">Engine</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-3xl leading-relaxed">
            Every one of {data?.stats.total_scored.toLocaleString() ?? '—'} congressional
            trades, scored against four documented signals: whether the member sits on a
            committee with jurisdiction over the company, whether that company holds federal
            contracts, whether the disclosure broke the STOCK Act&apos;s 45-day deadline, and
            the size of the position. Each flag is a verifiable fact not a legal conclusion.
          </p>
        </div>

        {loading && <div className="text-slate-500 py-20 text-center">Scoring trades…</div>}

        {data && !loading && (
          <>
            {/* stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { icon: <AlertTriangle size={15} />, label: 'Trades with any signal', value: data.stats.total_flagged.toLocaleString(), sub: `of ${data.stats.total_scored.toLocaleString()} scored`, color: 'text-amber-400' },
                { icon: <Scale size={15} />, label: 'Score 45 and up', value: (data.stats.band_70_plus + data.stats.band_45_69).toLocaleString(), sub: `${data.stats.band_70_plus} at 70 and up`, color: 'text-red-400' },
                { icon: <Clock size={15} />, label: 'Filed late', value: data.stats.late_transaction_count.toLocaleString(), sub: 'transactions filed more than 45 days after the trade', color: 'text-orange-400' },
                { icon: <Landmark size={15} />, label: 'Committee conflicts', value: data.stats.committee_conflicts.toLocaleString(), sub: 'traded a stock they oversee', color: 'text-red-400' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>{s.icon}</div>
                  <div className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-slate-300 text-xs font-semibold">{s.label}</div>
                  <div className="text-slate-600 text-xs">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* leaderboard */}
            <h2 className="text-lg font-bold mb-1">Most Conflicted Members</h2>
            <p className="text-slate-500 text-xs mb-3">
              Ranked by trades scoring 45 or more. {data.leaderboard.length} members shown.
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-10">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase tracking-widest border-b border-slate-800">
                      <th className="text-left py-2.5 px-3 w-8">#</th>
                      <th className="text-left py-2.5 px-3">Member</th>
                      <th className="text-right py-2.5 px-3">Trades with a signal</th>
                      <th className="text-right py-2.5 px-3 hidden sm:table-cell">Late reports</th>
                      <th className="text-right py-2.5 px-3 hidden sm:table-cell">Committee</th>
                      <th className="text-right py-2.5 px-3">Score 45+</th>
                      <th className="text-right py-2.5 px-3">Peak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((m, i) => (
                      <tr key={`${m.member_name}-${m.member_state}`} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className={`font-semibold ${partyColor(m.member_party)}`}>{m.member_name}</div>
                          <div className="text-slate-600 text-xs">
                            {m.member_party[0]} · {m.member_chamber} · {m.member_state} · {m.total_trades} trades
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden md:block w-20 h-1.5 bg-slate-800 rounded">
                              <div className="h-full bg-amber-500 rounded" style={{ width: `${(m.signal_trades / maxConflicted) * 100}%` }} />
                            </div>
                            <span className="font-mono text-slate-200 w-10 text-right">{m.signal_trades}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-orange-400 hidden sm:table-cell">{m.late_report_count}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-400 hidden sm:table-cell">{m.committee_conflicts}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-red-300">{m.high_signal_trades}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-mono font-black text-white">{m.peak_conflict_score}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* flagged trades */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Highest-Scoring Flagged Trades</h2>
              <div className="flex gap-1">
                {(['all', 'score_70_plus', 'score_45_69'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                      tierFilter === t ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {t === 'all' ? 'All' : TIER[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 mb-10">
              {flagged.map((t) => {
                const tier = TIER[t.conflict_tier] ?? TIER.score_under_20;
                return (
                  <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${partyColor(t.member_party)}`}>{t.member_name}</span>
                          <span className="text-slate-500 text-xs">{t.member_party[0]} · {t.member_chamber}-{t.member_state}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tier.cls}`}>{tier.label}</span>
                        </div>
                        <div className="text-slate-300 text-sm mt-0.5">
                          <span className="font-mono font-bold text-white">{t.transaction_type}</span>{' '}
                          <span className="font-mono text-emerald-300">{t.ticker}</span>{' '}
                          <span className="text-slate-500">{t.company_name}</span>{' '}
                          <span className="text-slate-500">· {t.transaction_date} · {fmtMoney(t.amount_min)}–{fmtMoney(t.amount_max)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black font-mono text-white leading-none">{t.conflict_score}</div>
                        <div className="text-slate-600 text-[10px] uppercase tracking-widest">score</div>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {t.conflict_reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${tier.dot}`} />
                          {r}
                        </li>
                      ))}
                    </ul>
                    {SOURCE_URL[t.source_system] && (
                      <a
                        href={SOURCE_URL[t.source_system]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-400 hover:underline"
                      >
                        <ExternalLink size={11} /> Verify in {t.source_system === 'House_Clerk' ? 'House Clerk disclosures' : 'Senate EFD'}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* methodology */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold text-sm mb-2">
                <Building2 size={14} /> How the score is built
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400">
                <p><span className="text-red-300 font-mono">+45</span> Committee jurisdiction member sits on a committee overseeing the traded company&apos;s sector (seats as listed on the trade date).</p>
                <p><span className="text-red-300 font-mono">+30</span> Federal contractor the company holds federal contracts, verified against USAspending award records.</p>
                <p><span className="text-red-300 font-mono">+15</span> Filed late: disclosed more than 45 days after the trade (the STOCK Act sets 45).</p>
                <p><span className="text-red-300 font-mono">+10</span> Large position disclosed amount range tops $250,000.</p>
              </div>
              <p className="text-slate-600 text-xs mt-3 leading-relaxed">
                Score bands: 70-100, 45-69, 20-44, under 20. Committee conflicts are scored
                against the committee seats listed on the trade date (snapshots of
                unitedstates/congress-legislators; where none is complete, no committee
                signal is computed). Every signal links back to a primary
                source; a conflict score documents timing and overlap it is not an
                allegation of a crime.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
