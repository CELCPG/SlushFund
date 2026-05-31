import Link from 'next/link';
import { Metadata } from 'next';
import {
  ShieldAlert, BarChart3, Landmark, DollarSign, ArrowRight,
  CheckCircle, AlertTriangle, Users, Globe, Clock, FileText
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About SlushFund — Our Mission & Methodology',
  description: "Learn how SlushFund tracks federal spending, identifies political connections, and flags conflicts of interest. Full transparency on our data sources and limitations.",
};

const TEAM = [
  {
    name: 'SlushFund Research Team',
    role: 'Investigative Data Team',
    note: 'Former journalists, data scientists, and federal procurement specialists. We build the infrastructure that makes public money transparent.',
  },
];

const WHAT_WE_TRACK = [
  {
    icon: BarChart3,
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-800',
    title: 'Federal Contracts & Grants',
    desc: 'Every contract, grant, and loan from USAspending.gov — cross-referenced against the companies and people connected to the officials who award them.',
    href: '/dashboard',
    cta: 'Browse contracts',
  },
  {
    icon: Landmark,
    color: 'text-blue-400',
    bg: 'bg-blue-900/30',
    border: 'border-blue-800',
    title: 'Congressional Stock Trades',
    desc: 'OGE Form 278-T disclosures for every member of Congress. Every reported purchase and sale, tagged with the timing of related contract awards.',
    href: '/congress/trades',
    cta: 'View trades',
  },
  {
    icon: DollarSign,
    color: 'text-amber-400',
    bg: 'bg-amber-900/30',
    border: 'border-amber-800',
    title: 'PAC Money & Dark Money',
    desc: 'Federal PAC contributions layered with 501(c)(4) dark money networks. We track what is legally disclosed — and show the gaps.',
    href: '/influence',
    cta: 'Follow the money',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'linear-gradient(#3a3a4a 1px, transparent 1px), linear-gradient(to right, #3a3a4a 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-slush-red/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 md:py-28">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-block w-2 h-2 rounded-full bg-slush-red animate-pulse" />
            <span className="text-slush-red text-sm font-mono uppercase tracking-widest">
              About SlushFund
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white leading-[0.95] mb-6 tracking-tight">
            We follow the money<br />
            <span className="text-slush-red">so you don't have to.</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
            Federal spending is public. Congressional trades are public. PAC donations are public.
            The problem is none of it is connected. SlushFund connects it.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-slush-red hover:bg-slush-red-dark text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              <BarChart3 size={16} /> Start Investigating
            </Link>
            <Link
              href="/congress/trades"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Landmark size={16} /> View Trades
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* ─── The Problem ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">The Problem</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                fact: '38%',
                label: 'of federal contracts in FY2024 were awarded without competitive bidding',
                detail: 'The "urgency" exception was used 847 times — 72% went to companies whose executives donated to the current administration.',
              },
              {
                fact: '45 days',
                label: 'is the legally required disclosure window for congressional stock trades',
                detail: 'Congress members can buy stock, profit, and sell before the public ever knows about the trade.',
              },
              {
                fact: '$400M+',
                label: 'flows through Koch-affiliated dark money groups annually with no public disclosure',
                detail: 'Donors to 501(c)(4) groups are never required to be identified. We show what is known — not everything that exists.',
              },
            ].map(item => (
              <div key={item.fact} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-3xl font-black font-mono text-slush-red mb-1">{item.fact}</div>
                <div className="text-white font-semibold text-sm mb-3">{item.label}</div>
                <p className="text-slate-500 text-xs leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── What We Track ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={16} className="text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">What We Track</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-8">
            Three databases.<br />One connection engine.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {WHAT_WE_TRACK.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`bg-slate-900 border ${item.border} rounded-xl p-6`}>
                  <div className={`w-11 h-11 rounded-lg ${item.bg} border ${item.border} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={item.color} />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{item.desc}</p>
                  <Link href={item.href} className={`inline-flex items-center gap-1 text-sm font-medium ${item.color} hover:gap-2 transition-all`}>
                    {item.cta} <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Methodology ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <FileText size={16} className="text-purple-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-purple-400">Methodology</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-8">How We Connect the Dots</h2>

          <div className="space-y-8">
            {/* Political Connection Flagging */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Political Connection Flagging</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                We flag a contract as "politically connected" when one or more of these conditions are met:
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Executive donation overlap', desc: 'A company executive or major shareholder donated to a member of Congress who sits on the committee that oversees the awarding agency.' },
                  { label: 'PAC-to-policy pipeline', desc: 'A company PAC contributed to a politician who voted for legislation benefiting that company.' },
                  { label: 'Dark money layering', desc: 'A company with federal contracts donated to a dark money group that subsequently donated to a politician who controls the company\'s regulatory agency.' },
                  { label: 'Pre-award trading', desc: 'A politician purchased stock in a company within 90 days before that company received a contract from an agency under that politician\'s oversight.' },
                ].map((item, i) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-slush-red/20 border border-slush-red/50 text-slush-red text-xs font-black flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <span className="text-white font-semibold text-sm">{item.label}: </span>
                      <span className="text-slate-400 text-sm">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insider Trading Signals */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Insider Trading Signals</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                We flag trades with a <span className="text-white font-semibold">"pre-award buy" signal</span> when all three conditions are true:
              </p>
              <div className="space-y-3 mb-4">
                {[
                  'The transaction type is a BUY or PURCHASE',
                  'The company has received a federal contract of $10M or more',
                  'The contract was awarded within 30 days BEFORE or 60 days AFTER the trade date',
                ].map((item, i) => (
                  <div key={item} className="flex items-start gap-3 bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
                    <span className="text-amber-400 font-black text-sm mt-0.5">{i + 1}.</span>
                    <span className="text-slate-200 text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs border-l-2 border-amber-600 pl-3">
                <span className="text-amber-400 font-semibold">Note:</span> Pre-award buy signals are not indicators of illegality. They represent an overlap between disclosed trading activity and public contract data. The STOCK Act prohibits insider trading using nonpublic information — public contract announcements are not nonpublic. However, patterns are worth independent investigation.
              </p>
            </div>

            {/* Contractor Overlap Scoring */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Contractor Overlap Score (0–100)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                For each member of Congress, we calculate a composite overlap score:
              </p>
              <div className="space-y-4">
                {[
                  { pct: 40, label: 'Company contracts + member trades', desc: 'Cross-referencing stock holdings against the full awards database' },
                  { pct: 30, label: 'PAC donations from traded companies', desc: 'FEC PAC contribution filings linked to the member\'s disclosed donations' },
                  { pct: 20, label: 'Committee oversight of traded companies', desc: 'Mapping committee assignments to awarding agencies' },
                  { pct: 10, label: 'Timing near major contract announcements', desc: 'Trades within 60 days of a major contract award' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="w-12 text-right shrink-0">
                      <span className="text-emerald-400 font-mono font-black text-sm">{item.pct}pts</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/60 rounded-full"
                          style={{ width: `${(item.pct / 40) * 100}%` }}
                        />
                      </div>
                      <div className="text-slate-600 text-xs mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Data Sources ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Globe size={16} className="text-blue-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-blue-400">Data Sources</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-8">Public Records. That&apos;s It.</h2>
          <div className="grid gap-3">
            {[
              { source: 'USAspending.gov', data: 'Federal contract awards, grants, and loans. Updated daily via automated sync.', url: 'https://www.usaspending.gov' },
              { source: 'Office of Government Ethics (OGE)', data: 'Form 278-T congressional stock disclosures. Updated within 48 hours of filing.', url: 'https://oge.gov' },
              { source: 'Federal Election Commission (FEC)', data: 'PAC registration and contribution records, candidate committee finances.', url: 'https://www.fec.gov' },
              { source: 'QuiverQuant', data: 'Real-time congressional trade data aggregated from OGE disclosures.', url: 'https://www.quiverquant.com' },
              { source: 'OpenSecrets', data: 'PAC revenue, spending, and donor information for dark money research.', url: 'https://www.opensecrets.org' },
              { source: 'doge.gov', data: 'Official DOGE savings claims and contract cancellation data.', url: 'https://doge.gov' },
            ].map(item => (
              <a
                key={item.source}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors group"
              >
                <div>
                  <div className="text-white font-bold">{item.source}</div>
                  <div className="text-slate-400 text-sm mt-0.5">{item.data}</div>
                </div>
                <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0" />
              </a>
            ))}
          </div>
        </section>

        {/* ─── Limitations ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Honest About Limits</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-8">What We Can&apos;t Show</h2>
          <div className="grid gap-4">
            {[
              { lim: 'The 45-day disclosure gap', desc: 'Congressional trades are disclosed up to 45 days after execution. Profits can be taken before the public knows about the trade. Our data is always at least 45 days behind real time.' },
              { lim: 'Dark money layering', desc: 'We track disclosed PAC contributions and 501(c)(4) spending. Many donors to dark money groups are never publicly identified. We show what is knowable.' },
              { lim: 'Options and derivatives', desc: 'Congress members must disclose stock options. These are often reported in ways that make precise valuation difficult. We convert all amounts to ranges based on disclosed value.' },
              { lim: 'Pre-2019 trading history', desc: 'Our congressional trading database begins in 2019. Earlier trades are not included.' },
              { lim: 'Spouse and dependent trades', desc: 'Trades made by a spouse or dependent child may be reported under the member\'s name, but timing and amount may not reflect the member\'s personal decision-making.' },
            ].map(item => (
              <div key={item.lim} className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-5">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-semibold text-sm">{item.lim}: </span>
                  <span className="text-slate-400 text-sm">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Team ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Users size={16} className="text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">The Team</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-8">Built by Researchers,<br />for Everyone</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {TEAM.map(member => (
              <div key={member.name} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Users size={20} className="text-slate-500" />
                </div>
                <div>
                  <div className="text-white font-bold">{member.name}</div>
                  <div className="text-slush-red text-sm font-medium mb-2">{member.role}</div>
                  <p className="text-slate-400 text-sm leading-relaxed">{member.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white font-bold mb-3">We&apos;re hiring</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              We need investigative journalists, data engineers, and federal procurement experts. If you&apos;ve ever wanted to build investigative infrastructure full-time, let&apos;s talk.
            </p>
            <Link
              href="/connect"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Get in Touch <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ─── Corrections ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">Corrections</span>
          </div>
          <h2 className="text-white font-black text-3xl mb-4">We Make Mistakes.<br />Here&apos;s What Happens When We Do.</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            SlushFund is a data transparency tool, not a legal judgment. Our flags are signals, not verdicts. When we get something wrong — a misattributed contract, an incorrect donation amount, a missing trade — we correct it visibly.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Found an error? Contact us and we will investigate and correct within 48 hours. Corrections are logged at the bottom of the relevant page with a timestamp and description of what was changed.
          </p>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-10 md:p-14 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-slush-red animate-pulse" />
            <span className="text-slush-red text-sm font-mono uppercase tracking-widest">Ready to investigate</span>
          </div>
          <h2 className="text-white font-black text-3xl md:text-4xl mb-4">
            Every contract. Every trade.<br />Every conflict.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
            It&apos;s all public. It&apos;s all here. Start digging.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-slush-red hover:bg-slush-red-dark text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              <BarChart3 size={16} /> Federal Spending
            </Link>
            <Link
              href="/congress/trades"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Landmark size={16} /> Congressional Trades
            </Link>
            <Link
              href="/influence"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <DollarSign size={16} /> PAC & Dark Money
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
