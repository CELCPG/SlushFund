import Link from 'next/link';
import { ArrowRight, TrendingUp, AlertTriangle, Globe, Shield } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0f172a_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-mono uppercase tracking-widest">Live Data · FY2024–FY2026</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-4">
            Slush<br />
            <span className="text-emerald-400">Fund</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mt-4 leading-relaxed">
            Tracking every federal contract, grant, and spending authorization from the Trump administration — and the political connections behind them.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/dashboard" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-lg transition-colors">
              View Dashboard <ArrowRight size={18} />
            </Link>
            <Link href="/about" className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium px-6 py-3 rounded-lg transition-colors">
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-800">
            {[
              { label: 'Total Spending Tracked', value: '$4.2B', sub: 'FY2024–FY2026', color: 'text-white' },
              { label: 'Flagged Contracts', value: '847', sub: 'No-bid / sole-source', color: 'text-amber-400' },
              { label: 'Political Connections', value: '312', sub: 'Identified vendors', color: 'text-purple-400' },
              { label: 'Suspicious Awards', value: '$890M', sub: 'Potential waste', color: 'text-red-400' },
            ].map((stat) => (
              <div key={stat.label} className="px-8 py-8 first:pl-0">
                <div className={`text-4xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-slate-400 text-sm mt-1 font-medium">{stat.label}</div>
                <div className="text-slate-600 text-xs mt-0.5 font-mono">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white mb-12">What We Track</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: <Globe size={24} className="text-emerald-400" />,
              title: 'Federal Contract Database',
              desc: 'Every federal contract award published on USAspending.gov — tracked, filtered, and analyzed.',
            },
            {
              icon: <Shield size={24} className="text-purple-400" />,
              title: 'Political Connection Mapping',
              desc: 'We cross-reference vendor names against Trump family, Elon Musk companies, and known allies.',
            },
            {
              icon: <AlertTriangle size={24} className="text-amber-400" />,
              title: 'Suspicious Award Detection',
              desc: 'No-bid contracts, sole-source awards, and inflated pricing flagged automatically.',
            },
            {
              icon: <TrendingUp size={24} className="text-blue-400" />,
              title: 'Spending Trends',
              desc: 'Monthly/dashboard tracking of where money flows — by agency, company, and connection type.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-emerald-900/20 to-purple-900/20 border border-emerald-800/30 rounded-xl p-8">
          <h3 className="text-white font-bold text-xl mb-3">🚨 FY2026 — DOGE Spending Surge</h3>
          <p className="text-slate-300 leading-relaxed">
            Since January 2025, the Trump administration has accelerated federal contract awards to politically connected vendors.
            Our system is flagging contracts from SpaceX, Anduril, Tesla, and firms tied to White House advisors at increasing rates.
            Browse the dashboard to see the full picture.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 mt-4 text-emerald-400 hover:text-emerald-300 font-medium">
            Explore the data <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            Built with USAspending.gov public data · Updated daily · Open source
          </p>
          <p className="text-slate-600 text-xs font-mono">data.gov · fpds.gov · usaspending.gov</p>
        </div>
      </footer>
    </div>
  );
}