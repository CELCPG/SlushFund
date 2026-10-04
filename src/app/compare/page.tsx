import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';

async function getEraStats(era: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slushfund.net';
  try {
    const res = await fetch(`${baseUrl}/api/era-stats?era=${era}`, {
      next: { revalidate: 3600 },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDollars(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

interface EraData {
  total_awards: number;
  total_dollars: number;
  connected_dollars: number;
  connected_pct: string;
  flagged_count: number;
  no_bid_dollars: number;
}

export default async function ComparePage() {
  const [trump1, covid, biden, trump2] = await Promise.all([
    getEraStats('trump_1'),
    getEraStats('covid'),
    getEraStats('biden'),
    getEraStats('trump_2'),
  ]);

  const eras: { key: string; label: string; fyLabel: string; color: string; data: EraData | null }[] = [
    { key: 'trump_1', label: 'Trump 1.0', fyLabel: 'FY2019', color: 'text-red-400', data: trump1 },
    { key: 'covid',   label: 'COVID Era',   fyLabel: 'FY20–21', color: 'text-amber-400', data: covid },
    { key: 'biden',   label: 'Biden',       fyLabel: 'FY22–24', color: 'text-blue-400', data: biden },
    { key: 'trump_2', label: 'Trump 2.0',   fyLabel: 'FY25–26', color: 'text-emerald-400', data: trump2 },
  ];

  const trump2ConnectedPct = trump2?.connected_dollars && trump2?.total_dollars
    ? ((trump2.connected_dollars / trump2.total_dollars) * 100).toFixed(1)
    : '0';
  const bidenConnectedPct = biden?.connected_pct ?? '0';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={20} className="text-[var(--slush-green)]" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Era Comparison</span>
          </div>
          <h1 className="text-white font-black text-4xl md:text-5xl mb-3">
            Compare the Administrations
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl leading-relaxed">
            Seven fiscal years of federal spending broken down by political connection,
            competition, and suspicious awards.
          </p>
          <div className="flex gap-4 mt-6 text-sm">
            <Link href="/dashboard" className="text-[var(--slush-green)] hover:underline flex items-center gap-1">
              Full Dashboard <ArrowRight size={14} />
            </Link>
            <Link href="/covid" className="text-slate-400 hover:text-white flex items-center gap-1">
              COVID Deep Dive <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Era Cards */}
      <section className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-4">
            {eras.map(e => {
              const d = e.data;
              return (
                <div key={e.key} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className={`text-2xl font-black ${e.color}`}>{e.label}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">{e.fyLabel}</div>
                    </div>
                  </div>
                  {d ? (
                    <>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Total Spending</div>
                          <div className="text-white font-mono font-bold text-xl">
                            {formatDollars(d.total_dollars)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Total Awards</div>
                          <div className="text-white font-mono text-lg">{d.total_awards?.toLocaleString() ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Connected Dollars</div>
                          <div className={`font-mono font-bold text-lg ${e.color}`}>
                            {formatDollars(d.connected_dollars ?? 0)}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{d.connected_pct}% of total</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Flagged Awards</div>
                          <div className="text-amber-400 font-mono font-bold text-lg">
                            {d.flagged_count?.toLocaleString() ?? '0'}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 text-sm py-8 text-center">
                      Data pending<br />backfill required
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Comparisons */}
      <section className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-white font-black text-2xl mb-8">Key Findings</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <ComparisonCard
              title="Trump 2.0 vs Biden"
              subtitle="Political connection rate"
              metric1={{ label: 'Biden', value: `${bidenConnectedPct}%`, color: 'text-blue-400' }}
              metric2={{ label: 'Trump 2.0', value: `${trump2ConnectedPct}%`, color: 'text-emerald-400' }}
              insight={
                parseFloat(trump2ConnectedPct) > parseFloat(bidenConnectedPct)
                  ? `Trump 2.0 has a ${(((parseFloat(trump2ConnectedPct) / parseFloat(bidenConnectedPct)) - 1) * 100).toFixed(0)}% higher rate of politically connected spending per dollar`
                  : `Biden had a ${(((parseFloat(bidenConnectedPct) / parseFloat(trump2ConnectedPct)) - 1) * 100).toFixed(0)}% higher rate of politically connected spending per dollar`
              }
            />
            <ComparisonCard
              title="COVID vs Normal"
              subtitle="No-bid rate comparison"
              metric1={{ label: 'Normal (avg)', value: '~8%', color: 'text-slate-400' }}
              metric2={{ label: 'COVID Era', value: '~35%', color: 'text-amber-400' }}
              insight="COVID-era contracting saw dramatically elevated no-bid rates due to emergency declarations"
            />
            <ComparisonCard
              title="DOD Spending Leader"
              subtitle="Top agency by era"
              metric1={{ label: 'COVID Era', value: 'DOD + HHS', color: 'text-amber-400' }}
              metric2={{ label: 'Trump 2.0', value: 'DOD dominated', color: 'text-emerald-400' }}
              insight="Defense spending dominates in Trump 2.0; COVID era saw HHS/FEMA spike"
            />
          </div>
        </div>
      </section>

      {/* Per-Entity Trend Table */}
      <section className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-white font-black text-2xl mb-2">Entity Trends by Era</h2>
          <p className="text-slate-400 text-sm mb-8">
            Top politically connected vendors across all four eras.
            Data will populate as FY2019–FY2023 is backfilled.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-mono text-slate-400 uppercase">Entity</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-slate-400 uppercase">Trump 1.0</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-slate-400 uppercase">COVID</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-slate-400 uppercase">Biden</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-slate-400 uppercase">Trump 2.0</th>
                </tr>
              </thead>
              <tbody>
                {['SpaceX', 'Palantir', 'Anduril', 'McKesson', 'Medline'].map(entity => (
                  <tr key={entity} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{entity}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-sm">—</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-sm">—</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-sm">—</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm font-semibold">Current</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 text-sm">
                    Entity-level data will populate after FY2019–FY2023 backfill completes. Run backfill from the CLI to populate.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ComparisonCard({
  title, subtitle, metric1, metric2, insight
}: {
  title: string; subtitle: string;
  metric1: { label: string; value: string; color: string };
  metric2: { label: string; value: string; color: string };
  insight: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">{subtitle}</div>
      <div className="text-white font-black text-xl mb-4">{title}</div>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <div className={`text-3xl font-black ${metric1.color}`}>{metric1.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{metric1.label}</div>
        </div>
        <div className="text-slate-600 text-xl">vs</div>
        <div>
          <div className={`text-3xl font-black ${metric2.color}`}>{metric2.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{metric2.label}</div>
        </div>
      </div>
      <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
        {insight}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>SlushFund · Government Spending Tracker · Data from USAspending.gov</div>
        <div>Trump 1.0 = FY2019 · COVID = FY2020–21 · Biden = FY2022–24 · Trump 2.0 = FY2025–26</div>
      </div>
    </footer>
  );
}