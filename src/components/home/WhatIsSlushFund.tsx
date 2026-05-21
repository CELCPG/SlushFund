import Link from 'next/link';
import { BarChart3, Landmark, Bitcoin, ArrowRight } from 'lucide-react';

const PILLARS = [
  {
    icon: BarChart3,
    accent: 'emerald',
    title: 'Federal Spending',
    desc: 'Every contract and grant cross-referenced against the Trump family, Elon Musk companies, and known allies. No-bid awards and inflated prices flagged automatically.',
    href: '/dashboard',
    cta: 'Open the dashboard',
  },
  {
    icon: Landmark,
    accent: 'blue',
    title: 'Congress Trading',
    desc: 'House, Senate, and presidential stock trades from official OGE disclosures, matched against the companies those same officials regulate and fund.',
    href: '/congress/trades',
    cta: 'View congressional trades',
  },
  {
    icon: Bitcoin,
    accent: 'orange',
    title: 'Crypto & Influence',
    desc: 'Crypto PAC donations, dark money, and politician holdings, traced from the check that gets written to the policy and contracts it buys.',
    href: '/influence',
    cta: 'Follow the influence',
  },
] as const;

const ACCENT: Record<string, { icon: string; bg: string; border: string; hover: string; link: string }> = {
  emerald: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-700',
    hover: 'hover:border-emerald-600/50',
    link: 'text-emerald-400 hover:text-emerald-300',
  },
  blue: {
    icon: 'text-blue-400',
    bg: 'bg-blue-900/40',
    border: 'border-blue-700',
    hover: 'hover:border-blue-600/50',
    link: 'text-blue-400 hover:text-blue-300',
  },
  orange: {
    icon: 'text-orange-400',
    bg: 'bg-orange-900/40',
    border: 'border-orange-700',
    hover: 'hover:border-orange-600/50',
    link: 'text-orange-400 hover:text-orange-300',
  },
};

/**
 * Plain-language orientation for first-time visitors: what SlushFund is,
 * followed by the three pillars it tracks.
 */
export default function WhatIsSlushFund() {
  return (
    <section
      id="what-is-slushfund"
      className="scroll-mt-16 border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950"
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--slush-red)]">
            What is SlushFund?
          </span>
          <h2 className="text-white font-black text-3xl md:text-4xl mt-3 mb-4">
            Investigative infrastructure for public money.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            SlushFund.net is a free, citizen-built tool that makes federal spending searchable
            and accountable. We pull from public records like USAspending.gov, OGE filings,
            and the FEC, then connect the dots between who awards contracts, who profits, and who pays.
            Every claim is sourced. Nothing here is hidden; it&apos;s just never been put in
            one place before.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {PILLARS.map((p) => {
            const a = ACCENT[p.accent];
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                href={p.href}
                className={`group block bg-slate-900 border border-slate-800 rounded-xl p-6 transition-all ${a.hover}`}
              >
                <div
                  className={`w-11 h-11 rounded-lg ${a.bg} border ${a.border} flex items-center justify-center mb-4`}
                >
                  <Icon size={20} className={a.icon} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">{p.desc}</p>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium ${a.link} group-hover:gap-2 transition-all`}
                >
                  {p.cta} <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
