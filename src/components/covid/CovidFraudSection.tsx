'use client';

import { AlertTriangle, DollarSign, Flag, Link2, TrendingUp, Info } from 'lucide-react';

export interface CovidFraudStats {
  total_awards: number;
  flagged_count: number;
  flagged_dollars: number;
  price_flagged_count: number;
  price_flagged_dollars: number;
  connection_flagged_count: number;
  connection_flagged_dollars: number;
  no_bid_count: number;
  no_bid_dollars: number;
  high_risk_count: number;
  high_risk_dollars: number;
  price_premium_count: number;
  avg_price_premium_pct: number;
  total_inflated_overpayment: number;
  top_suspicious_vendors: {
    name: string;
    flagged_award_count: number;
    award_count: number;
    flagged_dollars: number;
    total_dollars: number;
    max_risk_score: number;
  }[];
  flag_breakdown: Record<string, number>;
  highest_risk_awards: {
    award_id: string;
    recipient_name: string;
    awarding_agency: string;
    covid_obligations: number;
    risk_score: number;
    risk_factors: string[];
    flags: string[];
    price_flags: string[];
    connection_flags: string[];
    price_premium_pct: number | null;
    description: string;
  }[];
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

// Human-friendly labels for flag values that come from the data pipeline.
const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  no_bid: { label: 'No-bid', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  sole_source: { label: 'Sole-source', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  limited_competition: { label: 'Limited competition', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  inflated: { label: 'Price inflated', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  related_party: { label: 'Politically connected', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  no_compete_high_value: { label: 'High-value no-compete', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  large_award: { label: 'Large award', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  emergency: { label: 'Emergency designation', color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
};

function FlagPill({ flag }: { flag: string }) {
  const def = FLAG_LABELS[flag] ?? { label: flag, color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded border ${def.color}`}>
      {def.label}
    </span>
  );
}

export default function CovidFraudSection({ stats }: { stats: CovidFraudStats }) {
  const total = stats.total_awards;
  const flaggedPct = total > 0 ? (stats.flagged_count / total) * 100 : 0;
  const highRiskPct = total > 0 ? (stats.high_risk_count / total) * 100 : 0;
  const noFraudSignal = stats.flagged_count === 0 && stats.high_risk_count === 0 && stats.price_premium_count === 0;

  return (
    <div className="space-y-8">
      {/* Headline metric strip */}
      <div className={`grid gap-3 ${stats.price_flagged_count > 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
        <div className="bg-slate-900 border border-red-900/40 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-red-400 mb-1">
            <Flag size={12} />
            <span>Flagged awards</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.flagged_count}
            <span className="text-sm text-slate-500 font-normal"> / {total}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {fmtPct(flaggedPct)} of COVID awards
          </div>
        </div>
        {stats.price_flagged_count > 0 && (
          <div className="bg-slate-900 border border-amber-900/40 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">
              <DollarSign size={12} />
              <span>Price flagged (inflated)</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {fmt(stats.price_flagged_dollars)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {stats.price_flagged_count} {stats.price_flagged_count === 1 ? 'award' : 'awards'} above market
            </div>
          </div>
        )}
        <div className="bg-slate-900 border border-purple-900/40 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-purple-400 mb-1">
            <Link2 size={12} />
            <span>Politically connected</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {fmt(stats.connection_flagged_dollars)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stats.connection_flagged_count} {stats.connection_flagged_count === 1 ? 'award' : 'awards'}
          </div>
        </div>
        <div className="bg-slate-900 border border-red-900/40 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-red-400 mb-1">
            <AlertTriangle size={12} />
            <span>High-risk (70+)</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.high_risk_count}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {fmtPct(highRiskPct)} of COVID awards
          </div>
        </div>
      </div>

      {noFraudSignal ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center">
          <p className="text-slate-400 text-sm">
            No fraud-signal flags (price, competition, political connection) are populated on any
            COVID-tagged award in the current dataset. The data pipeline either hasn&apos;t run
            risk scoring on COVID awards yet, or the source USAspending feed is missing the
            competition/extent_competed fields for FY2020–FY2021 records.
          </p>
        </div>
      ) : (
        <>
          {/* Data-coverage callout */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex gap-3">
            <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <span className="text-white font-semibold">What this section shows and doesn&apos;t.</span>{' '}
              The fraud-signal fields populated on COVID awards in the current dataset are almost
              entirely political-connection matches and size flags. The dataset does{' '}
              <span className="text-slate-200">not</span> have price-premium or over-market
              comparison data for any COVID award (zero records with{' '}
              <code className="text-amber-400">price_premium_pct</code> populated), and zero
              COVID awards carry a no-bid or sole-source competition status. PPE-loan fraud
              in the popular press (fake vendors, double-billing, identity theft) operates
              mostly through SBA&apos;s Paycheck Protection Program and HHS Provider Relief Fund
              flows, which the current USAspending-derived feed does not surface. The
              high-risk awards below are real &mdash; they&apos;re state emergency-management
              agencies that overlap with the political-connection database.
            </div>
          </div>

          {/* Price-inflation story */}
          {stats.price_premium_count > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-amber-400" />
                <h3 className="text-white font-semibold">Price-inflation snapshot</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">
                    Awards with market-rate data
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.price_premium_count}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">
                    Average price premium
                  </div>
                  <div className="text-xl font-bold text-amber-400 font-mono">
                    {fmtPct(stats.avg_price_premium_pct)}
                  </div>
                  <div className="text-xs text-slate-500">vs estimated market rate</div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">
                    Estimated overpayment
                  </div>
                  <div className="text-xl font-bold text-red-400 font-mono">
                    {fmt(stats.total_inflated_overpayment)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                PPE and emergency-procurement contracts from FY2020–FY2021 are the canonical
                example: respirators that retailed for $1–$3 were contracted at $50–$70 under
                emergency waivers. The figures above are the subset of COVID awards where the
                dataset has both the obligation and a comparator market-rate estimate.
              </p>
            </div>
          )}

          {/* Flag breakdown */}
          {Object.keys(stats.flag_breakdown).length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">What the fraud flags are flagging</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(stats.flag_breakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([flag, count]) => (
                    <div
                      key={flag}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between"
                    >
                      <FlagPill flag={flag} />
                      <div className="text-right">
                        <div className="text-white font-bold font-mono">{count}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {((count / stats.flagged_count) * 100).toFixed(0)}% of flagged
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top suspicious vendors */}
          {stats.top_suspicious_vendors.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Top vendors with flagged COVID awards</h3>
              <div className="space-y-1.5">
                {stats.top_suspicious_vendors.map((v, i) => {
                  const flaggedPctOfTotal = v.total_dollars > 0
                    ? (v.flagged_dollars / v.total_dollars) * 100
                    : 0;
                  return (
                    <div
                      key={v.name + i}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{i + 1}</span>
                          <div className="text-white font-medium truncate">{v.name}</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-amber-400 font-mono font-bold text-sm">
                            {fmt(v.flagged_dollars)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            of {fmt(v.total_dollars)} total
                            {flaggedPctOfTotal > 0 && (
                              <span className="text-red-400 ml-1">· {flaggedPctOfTotal.toFixed(0)}% flagged</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {v.max_risk_score != null && v.max_risk_score > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wide shrink-0">
                            Max risk
                          </div>
                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                v.max_risk_score >= 70
                                  ? 'bg-red-500'
                                  : v.max_risk_score >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${v.max_risk_score}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 shrink-0">
                            {v.max_risk_score}/100
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Highest-risk individual awards the receipts */}
          {stats.highest_risk_awards.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Highest-risk individual COVID awards</h3>
              <p className="text-xs text-slate-500 mb-3">
                The specific awards the risk-scoring engine flagged as most concerning. Risk factors
                shown in parentheses &mdash; they explain exactly what triggered the score.
              </p>
              <div className="space-y-2">
                {stats.highest_risk_awards.map((a) => (
                  <div
                    key={a.award_id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-white font-medium">{a.recipient_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {a.award_id} · {a.awarding_agency}
                        </div>
                        {a.description && (
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {a.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-white font-mono font-bold">
                          {fmt(a.covid_obligations)}
                        </div>
                        <div
                          className={`text-xs font-mono mt-0.5 ${
                            a.risk_score >= 70
                              ? 'text-red-400'
                              : a.risk_score >= 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          risk {a.risk_score}/100
                        </div>
                        {a.price_premium_pct != null && (
                          <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                            +{a.price_premium_pct.toFixed(0)}% over market
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {a.flags?.map((f) => <FlagPill key={f} flag={f} />)}
                    </div>
                    {a.risk_factors && a.risk_factors.length > 0 && (
                      <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-2 mt-2">
                        {a.risk_factors.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
