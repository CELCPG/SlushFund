'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Building2, DollarSign, TrendingUp, Shield, ExternalLink, Calendar, Flag, Landmark, Newspaper, Link2 } from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType } from '@/lib/types';
import { MOCK_AWARDS } from '@/lib/mock-data-new';
import { getEnrichment, POLITICAL_ENTITIES } from '@/lib/political-entities';

const FLAG_LABELS: Record<string, string> = {
  no_bid: 'No-Bid Award',
  sole_source: 'Sole Source',
  limited_competition: 'Limited Competition',
  related_party: 'Related Party',
  inflated: 'Price Inflated',
  no_compete_high_value: 'High-Value Non-Competitive',
  large_award: 'Large Award',
};

function FlagBadge({ flag }: { flag: string }) {
  const styles: Record<string, string> = {
    no_bid: 'bg-rose-900 text-rose-300 border border-rose-700',
    sole_source: 'bg-orange-900 text-orange-300 border border-orange-700',
    limited_competition: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    related_party: 'bg-violet-900 text-violet-300 border border-violet-700',
    inflated: 'bg-pink-900 text-pink-300 border border-pink-700',
    no_compete_high_value: 'bg-red-900 text-red-300 border border-red-700',
    large_award: 'bg-amber-900 text-amber-300 border border-amber-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${styles[flag] ?? 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
      {FLAG_LABELS[flag] ?? flag}
    </span>
  );
}

export default function ContractPage() {
  const { id } = useParams();
  const [award, setAward] = useState<Award | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/contracts/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.award) { setAward(data.award as Award); setLoading(false); return; }
        }
      } catch { /* fall through to mock */ }
      // Demo fallback
      const mock = MOCK_AWARDS.find(a => a.id === id || a.award_id === id);
      setAward(mock ?? null);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!award) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🔍</div>
        <h2 className="text-white text-2xl font-bold">Award Not Found</h2>
        <p className="text-slate-400">This award doesn&apos;t exist or hasn&apos;t been synced yet.</p>
        <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">← Back to Dashboard</Link>
      </div>
    );
  }

  const competitionColor = award.competition_status === 'no_bid' || award.competition_status === 'sole_source' ? 'text-rose-400' : 'text-emerald-400';
  const riskColor = Number(award.risk_score) >= 80 ? 'text-rose-400' : Number(award.risk_score) >= 50 ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-mono text-sm truncate">{award.recipient_name}</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-white">{award.recipient_name}</h1>
              {award.connection_type && award.connection_type !== 'none' && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${
                  award.connection_type === 'elon_musk' ? 'bg-purple-900 text-purple-200 border-purple-700' :
                  award.connection_type === 'trump_family' ? 'bg-red-900 text-red-200 border-red-700' :
                  'bg-blue-900 text-blue-200 border-blue-700'
                }`}>
                  {CONNECTION_LABELS[award.connection_type as ConnectionType]}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xl">{award.description}</p>
            {award.political_connection && (
              <p className="text-slate-500 text-xs mt-1.5 italic font-mono">🎯 {award.political_connection}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Value</div>
            <div className="text-4xl font-black text-white font-mono">{fmt.dollars(Number(award.dollar_amount))}</div>
            {award.price_premium_pct && (
              <div className="text-rose-400 text-xs font-mono mt-1">⚠ {award.price_premium_pct}% above market</div>
            )}
          </div>
        </div>

        {/* Risk Score Banner */}
        <div className={`rounded-xl border px-6 py-5 ${
          Number(award.risk_score) >= 80 ? 'bg-rose-950/50 border-rose-800' :
          Number(award.risk_score) >= 50 ? 'bg-amber-950/50 border-amber-800' :
          'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <Shield className={Number(award.risk_score) >= 80 ? 'text-rose-400' : 'text-amber-400'} size={20} />
            <span className={`text-3xl font-black ${riskColor}`}>{award.risk_score}</span>
            <div>
              <div className="text-white font-bold text-sm">Risk Score</div>
              <div className="text-slate-400 text-xs">{award.confidence === 'high' ? 'High confidence' : 'Medium confidence'} · {award.connection_type !== 'none' ? 'Political connection detected' : 'No flagged connection'}</div>
            </div>
          </div>
          {award.risk_factors && award.risk_factors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {award.risk_factors.map((factor, i) => (
                <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded font-mono">+ {factor}</span>
              ))}
            </div>
          )}
        </div>

        {/* Flags */}
        {award.flags && award.flags.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="text-amber-400" size={16} />
              <h3 className="text-white font-bold text-sm uppercase tracking-widest">Red Flags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {award.flags.map(f => <FlagBadge key={f} flag={f} />)}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Competition', value: award.competition_status?.replace(/_/g, ' ') ?? 'Unknown', color: competitionColor, icon: <TrendingUp size={16} /> },
            { label: 'Award Type', value: award.award_category?.toUpperCase() ?? award.contract_type, color: 'text-slate-300', icon: <Building2 size={16} /> },
            { label: 'Awarding Agency', value: award.awarding_agency ?? 'Unknown', color: 'text-slate-300', icon: <Building2 size={16} /> },
            { label: 'Date Posted', value: award.posted_date ? new Date(award.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', color: 'text-slate-300', icon: <Calendar size={16} /> },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium uppercase tracking-widest mb-1.5">{stat.icon}{stat.label}</div>
              <div className={`font-bold text-sm ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-white font-bold">Award Details</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {[
              ['Award ID', award.award_id],
              ['Recipient', award.recipient_name],
              ['Parent Company', award.recipient_parent_name ?? '—'],
              ['Location', award.recipient_location ?? award.primary_place_of_performance ?? '—'],
              ['NAICS Code', award.naics_code ?? '—'],
              ['PSC Code', award.psc_code ?? '—'],
              ['Assistance Listing', award.assistance_listing ?? '—'],
              ['CFDA Program', award.cfda_program ?? '—'],
              ['Performance Period', award.performance_start && award.performance_end ? `${new Date(award.performance_start).toLocaleDateString()} → ${new Date(award.performance_end).toLocaleDateString()}` : '—'],
              ['Place of Performance', award.primary_place_of_performance ?? '—'],
              ['Extent Competed', award.extent_competed ?? '—'],
              ['Extent Competed Code', award.extent_competed_code ?? '—'],
            ].filter(([, v]) => v !== '—' && v !== null && v !== undefined && v !== '').map(([label, value]) => (
              <div key={label} className="px-5 py-3 flex items-start justify-between gap-4">
                <span className="text-slate-400 text-sm shrink-0 w-40">{label}</span>
                <span className="text-white text-sm font-mono text-right">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {award.notes && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-bold mb-2 text-sm uppercase tracking-widest">Analyst Notes</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{award.notes}</p>
          </div>
        )}

        {/* Political Connection Evidence */}
        {award.political_connection && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="text-amber-400" size={16} />
                <h3 className="text-white font-bold text-sm uppercase tracking-widest">Political Connection Evidence</h3>
              </div>
              <Link href="/analysis" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                Full Analysis →
              </Link>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">{award.political_connection}</p>

              {/* Attempt to load enrichment for this vendor */}
              {(() => {
                const enrichment = getEnrichment(award.recipient_name);
                if (!enrichment) return null;
                return (
                  <div className="space-y-3">
                    {/* Quick stats */}
                    <div className="flex flex-wrap gap-3">
                      {enrichment.total_fec_contributions > 0 && (
                        <div className="bg-emerald-950/30 border border-emerald-800 rounded-lg px-3 py-2">
                          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                            <Landmark size={10} /> FEC Contributions
                          </div>
                          <div className="text-emerald-400 font-black font-mono text-sm">{fmt.dollars(enrichment.total_fec_contributions)}</div>
                        </div>
                      )}
                      {enrichment.total_lobbying_spend > 0 && (
                        <div className="bg-amber-950/30 border border-amber-800 rounded-lg px-3 py-2">
                          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                            <DollarSign size={10} /> Lobbying Spend
                          </div>
                          <div className="text-amber-400 font-black font-mono text-sm">{fmt.dollars(enrichment.total_lobbying_spend)}</div>
                        </div>
                      )}
                      {enrichment.doge_role && (
                        <div className="bg-purple-950/30 border border-purple-800 rounded-lg px-3 py-2">
                          <div className="text-slate-400 text-xs mb-1">DOGE Role</div>
                          <div className="text-purple-200 text-xs font-medium">{enrichment.doge_role}</div>
                        </div>
                      )}
                      {enrichment.mar_a_lago_visits != null && (
                        <div className="bg-orange-950/30 border border-orange-800 rounded-lg px-3 py-2">
                          <div className="text-slate-400 text-xs mb-1">Mar-a-Lago</div>
                          <div className="text-orange-200 text-xs font-medium">{enrichment.mar_a_lago_visits} documented visits</div>
                        </div>
                      )}
                      {enrichment.inauguration_host && (
                        <div className="bg-blue-950/30 border border-blue-800 rounded-lg px-3 py-2">
                          <div className="text-slate-400 text-xs mb-1">Inauguration</div>
                          <div className="text-blue-200 text-xs font-medium">Host/fundraiser</div>
                        </div>
                      )}
                    </div>

                    {/* Trump PAC contributions */}
                    {enrichment.trump_pac_donors.length > 0 && (
                      <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-widest mb-2">FEC Donations to Trump PACs</h4>
                        <div className="space-y-1">
                          {enrichment.trump_pac_donors.map((d, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-1.5">
                              <div>
                                <span className="text-slate-200 text-xs">{d.name}</span>
                                {d.pac_name && <span className="text-slate-500 text-xs ml-2">via {d.pac_name}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 font-black font-mono text-xs">{fmt.dollars(d.amount)}</span>
                                <span className="text-slate-500 text-xs">{d.date}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* News */}
                    {enrichment.news_investigations.length > 0 && (
                      <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-widest mb-2">News Investigations</h4>
                        <div className="space-y-1">
                          {enrichment.news_investigations.map((n, i) => (
                            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-2 bg-slate-800/50 rounded px-3 py-2 hover:bg-slate-800 transition-colors">
                              <Newspaper size={12} className="text-amber-400 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-slate-200 text-xs block truncate">{n.headline}</span>
                                <span className="text-slate-500 text-xs">{n.outlet} · {n.date}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}


                    {/* Source links */}
                    <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-3">
                      {enrichment.wikipedia_url && (
                        <a href={enrichment.wikipedia_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                          Wikipedia <ExternalLink size={10} />
                        </a>
                      )}
                      {enrichment.opensecrets_url && (
                        <a href={enrichment.opensecrets_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300">
                          OpenSecrets <ExternalLink size={10} />
                        </a>
                      )}
                      {enrichment.fec_main_page && (
                        <a href={enrichment.fec_main_page} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300">
                          FEC.gov <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Sources */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-widest">Sources & Links</h3>
          <div className="flex flex-wrap gap-3">
            {award.fpds_url && (
              <a href={award.fpds_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono">
                FPDS <ExternalLink size={11} />
              </a>
            )}
            {award.usaspending_url && (
              <a href={award.usaspending_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono">
                USAspending.gov <ExternalLink size={11} />
              </a>
            )}
            {award.connection_sources?.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-mono">
                Source {i + 1} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}