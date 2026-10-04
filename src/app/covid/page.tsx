import Link from 'next/link';
import { ArrowRight, AlertTriangle, TrendingUp, Building2, Users, Clock, Skull } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import TimelineChart from '@/components/covid/TimelineChart';
import CovidFraudSection, { type CovidFraudStats } from '@/components/covid/CovidFraudSection';
import {
  buildAgencyGroups,
  vendorConcentration,
  preCovidBaselineAverage,
  obligationOutlayGap,
  findAnomalies,
  formatPct,
  type CovidStats,
} from '@/lib/covid-analysis';

export const revalidate = 3600;

async function getCovidStats(): Promise<CovidStats | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slushfund.net';
  try {
    const res = await fetch(`${baseUrl}/api/covid-stats`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getCovidFraudStats(): Promise<CovidFraudStats | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slushfund.net';
  try {
    const res = await fetch(`${baseUrl}/api/covid-fraud`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function formatCompact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

export default async function CovidPage() {
  const [stats, fraudStats] = await Promise.all([getCovidStats(), getCovidFraudStats()]);
  const hasData = stats && stats.total_covid_awards > 0;

  // Run all derivations up front so the render stays declarative.
  const gap = stats ? obligationOutlayGap(stats) : null;
  const baseline = stats ? preCovidBaselineAverage(stats.by_quarter, 2018, 2019) : null;
  const concentration = stats ? vendorConcentration(stats.top_vendors, stats.total_covid_obligations, 10) : null;
  const agencyGroups = stats ? buildAgencyGroups(stats.by_agency) : [];
  const anomalies = stats ? findAnomalies(stats.by_quarter, { windowStart: 2020, windowEnd: 2022, minValue: 500_000_000 }) : [];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Special Report</span>
            <span className="text-xs font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded">
              COVID-19
            </span>
          </div>
          <h1 className="text-white font-black text-4xl md:text-5xl mb-3">
            COVID Spending Tracker
          </h1>
          <p className="text-slate-300 text-lg max-w-3xl leading-relaxed">
            Every dollar the federal government tagged as pandemic response contracts, awards,
            and pass-throughs to states broken out by quarter, agency, and vendor.
            Tracked against a pre-COVID baseline so the spike is actually visible.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm">
            <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium">
              Full Dashboard <ArrowRight size={14} />
            </Link>
            <Link href="/compare" className="text-slate-400 hover:text-white flex items-center gap-1 font-medium">
              Biden vs Trump <ArrowRight size={14} />
            </Link>
            <Link href="/analysis" className="text-slate-400 hover:text-white flex items-center gap-1 font-medium">
              Cost Overruns <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <section className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {hasData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="COVID Obligations"
                value={formatLargeNumber(stats.total_covid_obligations)}
                sublabel="total committed"
                accent="amber"
              />
              <StatCard
                label="COVID Outlays"
                value={formatLargeNumber(stats.total_covid_outlays)}
                sublabel="actual spend"
                accent="amber"
              />
              <StatCard
                label="COVID Awards"
                value={String(stats.total_covid_awards)}
                sublabel="awards flagged COVID"
                accent="blue"
              />
              <StatCard
                label="No-Bid COVID"
                value={String(stats.covid_no_bid_count)}
                sublabel={
                  stats.covid_no_bid_count === 0
                    ? 'none tracked'
                    : `${formatLargeNumber(stats.covid_no_bid_dollars)} no-bid`
                }
                accent="red"
              />
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg font-medium text-slate-300 mb-2">No COVID data yet</p>
              <p className="text-sm">
                Awards with <code className="text-amber-400">covid_obligations &gt; 0</code> will appear here after the next sync.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* The Real Story: obligated vs outlays gap */}
      {hasData && gap && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-red-400" />
              <h2 className="text-white font-black text-2xl">The obligated-vs-outlays gap</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              <span className="text-white font-semibold">Obligations</span> are promises to spend:
              the money a federal agency has committed to a contract. <span className="text-white font-semibold">Outlays</span> are
              the actual cash that has left the Treasury. The gap between the two is the most important number
              on this page, because most of the headlines you saw in 2020 reported obligations as if they were
              already spent.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">
                  Obligated
                </div>
                <div className="text-3xl font-black text-white font-mono">
                  {formatLargeNumber(gap.obligated)}
                </div>
                <div className="text-xs text-slate-500 mt-1">committed by federal agencies</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">
                  Actually spent
                </div>
                <div className="text-3xl font-black text-amber-400 font-mono">
                  {formatLargeNumber(gap.outlayed)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {formatPct(gap.gapPercent)} of obligated
                </div>
              </div>
              <div className="bg-slate-900 border border-red-900/40 rounded-lg p-5">
                <div className="text-xs font-mono uppercase tracking-widest text-red-400 mb-2">
                  Not yet spent
                </div>
                <div className="text-3xl font-black text-red-400 font-mono">
                  {formatLargeNumber(gap.gap)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  obligations still pending outlay
                </div>
              </div>
            </div>

            {/* Visual bar: obligated (full) vs outlayed (filled portion) */}
            <div className="mt-6">
              <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-amber-400 h-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, gap.gapPercent)}%` }}
                >
                  <span className="text-[10px] font-mono text-slate-900 font-bold">
                    {formatPct(gap.gapPercent, 0)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
                <span>$0</span>
                <span>{formatLargeNumber(gap.obligated)} obligated</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Fraud & suspicious-awards section */}
      {fraudStats && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 mb-2">
              <Skull size={18} className="text-red-400" />
              <h2 className="text-white font-black text-2xl">COVID fraud &amp; suspicious awards</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              Federal COVID-tagged awards that the risk-scoring engine has flagged as suspicious &mdash; on
              political connection, on price, on competition, or on structural red flags. The COVID response
              is the single largest fraud-attractor in modern federal procurement: emergency waivers stripped
              out normal competition rules, the spending scale was unprecedented, and oversight staffing was
              thin. The dataset below shows what our feed actually surfaces &mdash; and where its gaps are.
            </p>
            <CovidFraudSection stats={fraudStats} />
          </div>
        </section>
      )}

      {/* Timeline */}
      {hasData && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-white font-black text-2xl mb-2">Quarterly COVID Spending</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-3xl">
              Federal COVID-tagged obligations by quarter. The dashed line shows the FY2018–FY2019
              quarterly average a rough baseline for what &ldquo;normal&rdquo; agency spending looked like before
              the pandemic response began.
            </p>
            <TimelineChart
              data={stats.by_quarter}
              preCovidAverage={baseline && baseline.average > 0 ? baseline.average : undefined}
            />
          </div>
        </section>
      )}

      {/* Anomaly callout: out-of-window quarters */}
      {hasData && anomalies.length > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-amber-400" />
              <h2 className="text-white font-black text-2xl">Anomalies: tagged COVID but dated outside the pandemic window</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              The list below shows quarters that don&apos;t fit the COVID-response window (FY2020–FY2022) but still
              carry a non-trivial COVID obligation tag. Backdated award postings, misclassified records, or
              obligations that retroactively got relabeled &mdash; worth a closer look.
            </p>
            <div className="space-y-2">
              {anomalies.slice(0, 5).map((a) => (
                <div
                  key={a.label}
                  className="flex items-center justify-between bg-slate-900 border border-amber-900/30 rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="text-white font-mono font-medium">{a.label}</div>
                    <div className="text-xs text-slate-400">{a.reason}</div>
                  </div>
                  <div className="text-amber-400 font-mono font-bold">
                    {formatLargeNumber(a.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Concentration: top N vendors */}
      {hasData && concentration && concentration.topNPercent > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} className="text-amber-400" />
              <h2 className="text-white font-black text-2xl">How concentrated was the money?</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              {concentration.topNVendors.length === 0 ? (
                <>No vendor data available.</>
              ) : (
                <>
                  The top {concentration.topN} recipients pulled in{' '}
                  <span className="text-amber-400 font-bold font-mono">
                    {formatLargeNumber(concentration.topNObligations)}
                  </span>{' '}
                  that&apos;s <span className="text-white font-semibold">{formatPct(concentration.topNPercent)}</span> of
                  all federal COVID-tagged obligations.
                </>
              )}
            </p>
            <div className="space-y-2">
              {concentration.topNVendors.map((v, i) => (
                <div key={v.name + i} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-4">{i + 1}</span>
                      <div className="text-white font-medium">{v.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono font-bold">{formatCompact(v.obligations)}</div>
                      <div className="text-xs text-amber-400 font-mono">{formatPct(v.pct)}</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.min(100, v.pct * 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Bar widths scaled to highlight the largest shares; the percentage label is the true share of total.
            </p>
          </div>
        </section>
      )}

      {/* By Agency (grouped) */}
      {hasData && agencyGroups.length > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={18} className="text-amber-400" />
              <h2 className="text-white font-black text-2xl">Spending by Agency Cluster</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              Raw agency names grouped into the federal departments they belong to. The cluster totals
              make the operating story easier to read than 30+ separate agency rows.
            </p>
            <div className="space-y-2">
              {agencyGroups.slice(0, 10).map((g) => {
                const pct = stats && stats.total_covid_obligations > 0
                  ? (g.obligations / stats.total_covid_obligations) * 100
                  : 0;
                return (
                  <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-white font-medium">{g.label}</div>
                        <div className="text-xs text-slate-400">
                          {g.award_count} awards across {g.agencies.length} {g.agencies.length === 1 ? 'agency' : 'agencies'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-mono font-bold">{formatCompact(g.obligations)}</div>
                        <div className="text-xs text-amber-400 font-mono">{formatPct(pct)}</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500/80"
                        style={{ width: `${Math.min(100, pct * 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Bar widths scaled for readability; the percentage label is the true share of total COVID obligations.
            </p>
          </div>
        </section>
      )}

      {/* Top vendors raw list (kept, but framed as a "long tail" view) */}
      {hasData && stats.top_vendors && stats.top_vendors.length > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-white font-black text-2xl mb-2">Top 20 COVID Contractors</h2>
            <p className="text-slate-400 text-sm max-w-3xl mb-6">
              Raw ranking by total obligations. A surprising number of the top recipients are
              state emergency-management agencies receiving federal pass-throughs not the
              private contractors most headlines focused on.
            </p>
            <div className="space-y-1.5">
              {stats.top_vendors.slice(0, 20).map((v, i) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-2.5 border border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-500 w-6 shrink-0">{i + 1}</span>
                    <div className="text-white font-medium truncate">{v.name}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-white font-mono font-bold text-sm">
                      {formatCompact(v.total_covid_obligations)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {v.award_count} {v.award_count === 1 ? 'award' : 'awards'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Methodology */}
      <section className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <TrendingUp size={16} className="text-amber-400" />
              Methodology
            </h3>
            <div className="text-slate-400 text-sm leading-relaxed space-y-2">
              <p>
                COVID spending data is sourced from USAspending.gov and filtered to awards where{' '}
                <code className="text-amber-400">covid_obligations &gt; 0</code>. This includes CARES Act
                awards, PPP loans processed as contracts, Provider Relief Fund payments, and COVID-related
                procurement by DOD, HHS, and FEMA. Awards flagged as no-bid or sole-source are marked
                suspicious based on GAO investigations into COVID contracting practices.
              </p>
              <p>
                The <span className="text-white font-semibold">obligated vs outlays gap</span> uses USAspending&apos;s
                obligation and outlay fields, not the budget authority figures commonly cited in news
                coverage. Outlay figures lag obligations by months or years, so the gap is expected
                &mdash; but its size is what tells you how much of the headline number was actually
                converted into real economic activity.
              </p>
              <p>
                The <span className="text-white font-semibold">anomaly</span> section flags any quarter outside
                the FY2020&ndash;FY2022 response window with obligations over $500M. Most are legitimate
                edge cases (late-tagged awards, retroactive obligations) &mdash; the section exists to make
                the data&apos;s edges visible, not to claim fraud.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
