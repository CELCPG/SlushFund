import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Landmark,
  Bitcoin,
  FileText,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import { getHomeStats, formatCompactUSD } from '@/lib/home-stats';
import Hero from '@/components/home/Hero';
import WhatIsSlushFund from '@/components/home/WhatIsSlushFund';
import LiveStatsBand from '@/components/home/LiveStatsBand';
import LoopDiagram from '@/components/home/LoopDiagram';
import TrackCard from '@/components/home/TrackCard';
import DogeCompareChart from '@/components/home/DogeCompareChart';

export const revalidate = 3600;

const TICKERS = [
  { ticker: 'NVDA', note: '9 buys · Beijing delegation during chip-export talks' },
  { ticker: 'PLTR', note: '8 buys · DHS contract awarded mid-buying' },
  { ticker: 'ORCL', note: '11 buys · Ellison donated $250K+ to inauguration' },
  { ticker: 'COIN', note: '6 buys · won US Marshals crypto custody' },
];

const DATA_SOURCES = [
  'USAspending.gov',
  'OGE Form 278-T',
  'FEC.gov',
  'OpenSecrets.org',
  'QuiverQuant',
];

export default async function Home() {
  const stats = await getHomeStats();

  return (
    <div className="min-h-screen bg-slate-950">
      <Hero />

      <WhatIsSlushFund />

      <LiveStatsBand stats={stats} />

      <LoopDiagram />

      {/* ─── THREE TRACKS ─── */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--slush-red)]">
              Three databases
            </span>
            <h2 className="text-white font-black text-3xl md:text-4xl mt-3 mb-3">
              Pick a thread. Pull it.
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              SlushFund tracks money along three connected paths. Each one is searchable,
              sourced, and updated from public filings.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <TrackCard
              accent="emerald"
              icon={<BarChart3 size={19} />}
              title="Federal Spending"
              subtitle="Contracts · Grants · No-Bid Awards"
              href="/dashboard"
              ctaLabel="Open the dashboard"
              chartData={[8, 14, 11, 19, 16, 24, 21]}
              stats={[
                { label: 'Tracked', value: formatCompactUSD(stats.totalDollars), color: 'text-white' },
                {
                  label: 'Politically Connected',
                  value: formatCompactUSD(stats.connectedDollars),
                  color: 'text-red-400',
                },
                { label: 'Flagged Awards', value: String(stats.flaggedCount), color: 'text-amber-400' },
                {
                  label: 'No-Bid Contracts',
                  value: formatCompactUSD(stats.noBidDollars),
                  color: 'text-orange-400',
                },
              ]}
            />
            <TrackCard
              accent="blue"
              icon={<Landmark size={19} />}
              title="Congress Trading"
              subtitle="House · Senate · Presidential"
              href="/congress/trades"
              ctaLabel="View all trades"
              chartData={[12, 9, 17, 13, 22, 18, 26]}
              stats={[
                { label: 'Congress Trades', value: String(stats.congressTrades), color: 'text-white' },
                { label: 'Members Tracked', value: String(stats.membersTracked), color: 'text-blue-400' },
                { label: 'Trump Q1 2026', value: '$220M+', color: 'text-red-400' },
                {
                  label: 'Contractor Overlap',
                  value: String(stats.contractorOverlap),
                  color: 'text-amber-400',
                },
              ]}
            />
            <TrackCard
              accent="orange"
              icon={<Bitcoin size={19} />}
              title="Crypto & Influence"
              subtitle="PAC Money · Mining · Holdings"
              href="/influence"
              ctaLabel="Follow the influence"
              chartData={[6, 11, 9, 15, 13, 20, 17]}
              stats={[
                {
                  label: 'PAC Donations',
                  value: formatCompactUSD(stats.cryptoPacDollars),
                  color: 'text-orange-400',
                },
                { label: 'Pro-Crypto Officials', value: '15', color: 'text-emerald-400' },
                { label: 'BTC Mining Facilities', value: '8', color: 'text-blue-400' },
                {
                  label: 'Politicians Holding BTC',
                  value: String(stats.politiciansHoldingBtc),
                  color: 'text-purple-400',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ─── FEATURED INVESTIGATIONS ─── */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--slush-red)]">
              Featured investigations
            </span>
            <h2 className="text-white font-black text-3xl md:text-4xl mt-3">
              Where the loop is running right now.
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Trump OGE */}
            <div className="bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border border-red-900/40 rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <FileText size={14} className="text-red-400" />
                <span className="text-xs font-mono bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded">
                  PRESIDENTIAL · OGE FORM 278-T
                </span>
              </div>
              <h3 className="text-white font-black text-xl mb-2">Trump Q1 2026 Stock Trades</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                3,711 disclosed transactions worth $220M–$750M. No blind trust. Trades intersect
                executive decisions on AI chip exports, federal contracting, and Treasury policy.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Total trades', value: '3,711' },
                  { label: '68% buys', value: '2,196' },
                  { label: 'Contractor overlap', value: '66+' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-center"
                  >
                    <div className="text-lg font-black font-mono text-white">{s.value}</div>
                    <div className="text-slate-500 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 mb-5">
                {TICKERS.map((t) => (
                  <div key={t.ticker} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-black text-white w-12 shrink-0">{t.ticker}</span>
                    <span className="text-slate-400">{t.note}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <Link
                  href="/congress/trades/trump"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  View Trump trades <ArrowRight size={15} />
                </Link>
                <Link
                  href="/congress/trades"
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors border border-slate-700"
                >
                  All congress trades
                </Link>
              </div>
            </div>

            {/* DOGE */}
            <div className="bg-gradient-to-br from-red-950/30 via-slate-900 to-slate-900 border border-red-900/40 rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <TrendingDown size={14} className="text-red-400" />
                <span className="text-xs font-mono bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded uppercase">
                  DOGE Special Report
                </span>
              </div>
              <h3 className="text-white font-black text-xl mb-2">DOGE: The Real Score</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                DOGE claims $130B in savings. Independent auditors verified $28B. The $102B gap is
                projected future savings counted as fact.
              </p>

              <DogeCompareChart />

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/doge"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  See the real score <ArrowRight size={15} />
                </Link>
                <Link
                  href="/doge#winners"
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors border border-slate-700"
                >
                  Who&apos;s winning
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DATA SOURCES / TRUST ─── */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
            <div className="flex items-center gap-3 shrink-0">
              <ShieldAlert size={20} className="text-emerald-400" />
              <div>
                <div className="text-white font-bold">Every claim is sourced.</div>
                <div className="text-slate-500 text-sm">
                  Public records only. No leaks, no anonymous tips.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {DATA_SOURCES.map((s) => (
                <span
                  key={s}
                  className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5"
                >
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="/about"
              className="md:ml-auto text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 shrink-0"
            >
              Our methodology <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-white font-black text-3xl md:text-5xl mb-4">
            Start following the money.
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
            It&apos;s all public. It&apos;s all searchable. Pick where you want to dig in.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-[var(--slush-red)] hover:bg-[var(--slush-red-dark)] text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              <BarChart3 size={16} /> Federal Spending
            </Link>
            <Link
              href="/congress/trades"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Landmark size={16} /> Congress Trading
            </Link>
            <Link
              href="/influence"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Bitcoin size={16} /> Crypto & Influence
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
