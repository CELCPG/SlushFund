import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import TimelineChart from '@/components/covid/TimelineChart';
import Footer from '@/components/Footer';

export const revalidate = 3600;

async function getCovidStats() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slushfund.net';
  try {
    const res = await fetch(`${baseUrl}/api/covid-stats`, { cache: 'no-store' });
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
  const stats = await getCovidStats();

  const hasData = stats && stats.total_covid_awards > 0;

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
          <p className="text-slate-300 text-lg max-w-2xl leading-relaxed">
            Every dollar the federal government spent on pandemic response — no-bid contracts,
            inflated prices, and politically connected vendors — tracked from FY2020 to FY2021.
          </p>
          <div className="flex gap-6 mt-6 text-sm">
            <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium">
              Full Dashboard <ArrowRight size={14} />
            </Link>
            <Link href="/compare" className="text-slate-400 hover:text-white flex items-center gap-1 font-medium">
              Biden vs Trump <ArrowRight size={14} />
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
                sublabel={`${formatLargeNumber(stats.covid_no_bid_dollars)} no-bid`}
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

      {/* Timeline */}
      {hasData && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-white font-black text-2xl mb-6">Quarterly COVID Spending</h2>
            <TimelineChart data={stats.by_quarter} />
          </div>
        </section>
      )}

      {/* By Agency */}
      {hasData && stats.by_agency && stats.by_agency.length > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-white font-black text-2xl mb-6">Spending by Agency</h2>
            <div className="space-y-2">
              {stats.by_agency.slice(0, 10).map((a: any) => (
                <div
                  key={a.agency}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3 border border-slate-800"
                >
                  <div>
                    <div className="text-white font-medium">{a.agency}</div>
                    <div className="text-xs text-slate-400">{a.award_count} contracts</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-bold">${formatCompact(a.total_covid_obligations)}</div>
                    {a.no_bid_count > 0 && (
                      <div className="text-xs text-red-400">{a.no_bid_count} no-bid</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Vendors */}
      {hasData && stats.top_vendors && stats.top_vendors.length > 0 && (
        <section className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-white font-black text-2xl mb-6">Top COVID Contractors</h2>
            <div className="space-y-2">
              {stats.top_vendors.slice(0, 20).map((v: any, i: number) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-4">{i + 1}</span>
                    <div>
                      <div className="text-white font-medium">{v.name}</div>
                      <div className="text-xs text-slate-400">{v.award_count} contracts</div>
                    </div>
                  </div>
                  <div className="text-white font-mono font-bold text-right">
                    ${formatCompact(v.total_covid_obligations)}
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
            <h3 className="text-white font-semibold mb-2">📊 Methodology</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              COVID spending data is sourced from USAspending.gov and filtered to awards where{' '}
              <code className="text-amber-400">covid_obligations &gt; 0</code>. This includes CARES Act
              awards, PPP loans processed as contracts, Provider Relief Fund payments, and COVID-related
              procurement by DOD, HHS, and FEMA. Awards flagged as no-bid or sole-source are marked
              suspicious based on GAO investigations into COVID contracting practices.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}