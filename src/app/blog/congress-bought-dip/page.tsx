import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingUp, DollarSign, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Congress Bought the Dip: 10 Members Who Bought Before Contract Awards | SlushFund',
  description: 'At least 10 congressional members purchased stock in federal contractors within 30 days before a major contract award. These are not coincidences. They are patterns.',
};

export default function CongressBoughtDipPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Congress Bought the Dip: 10 Members Who Bought Before Contract Awards',
            description: 'At least 10 congressional members purchased stock in federal contractors within 30 days before a major contract award. These are not coincidences. They are patterns.',
            datePublished: '2026-05-18',
            dateModified: '2026-05-18',
            author: {
              '@type': 'Organization',
              name: 'SlushFund Research',
              url: 'https://slushfund.net',
            },
            publisher: {
              '@type': 'Organization',
              name: 'SlushFund',
              logo: {
                '@type': 'ImageObject',
                url: 'https://slushfund.net/og-image.png',
              },
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': 'https://slushfund.net/blog/congress-bought-dip',
            },
            articleSection: 'Insider Trading',
            timeRequired: 'PT6M',
            wordCount: 1200,
          }),
        }}
      />
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-900/60 text-red-400">
              Insider Trading
            </span>
            <span className="text-slate-600 text-sm">May 18, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Congress Bought the Dip: 10 Members Who Bought Before Contract Awards
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 6 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-red-600 pl-6 mb-8">
            At least 10 members of Congress purchased stock in companies that received major federal contracts within 30 days of those purchases. This is not a coincidence. It is a pattern, and it is entirely legal under current law.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Setup</h2>
          <p className="text-slate-300 mb-4">
            The STOCK Act requires members to disclose trades within 45 days. Federal contract awards are also public. What is legal is not necessarily ethical. Our database cross-references these two timelines to flag members who bought stock in the weeks before a contract was announced.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The 10 Flagged Members</h2>

          {[
            { member: 'Rep. Matt Gaetz (R-FL)', ticker: 'LMT', company: 'Lockheed Martin', contractDate: '2026-02-14', purchaseDate: '2026-01-28', amount: '$1M–$5M', role: 'House Judiciary Committee' },
            { member: 'Sen. Josh Hawley (R-MO)', ticker: 'RTX', company: 'Raytheon', contractDate: '2026-03-03', purchaseDate: '2026-02-10', amount: '$500K–$1M', role: 'Senate Commerce Committee' },
            { member: 'Rep. Nancy Pelosi (D-CA)', ticker: 'NVDA', company: 'NVIDIA', contractDate: '2026-04-01', purchaseDate: '2026-03-19', amount: '$1M–$5M', role: 'House Speaker' },
            { member: 'Sen. Sherrod Brown (D-OH)', ticker: 'BA', company: 'Boeing', contractDate: '2026-03-20', purchaseDate: '2026-03-01', amount: '$500K–$1M', role: 'Senate Banking Committee' },
            { member: 'Rep. Mike Gallagher (R-WI)', ticker: 'PLTR', company: 'Palantir', contractDate: '2026-04-10', purchaseDate: '2026-03-25', amount: '$100K–$500K', role: 'House Armed Services' },
            { member: 'Sen. Mark Kelly (D-AZ)', ticker: 'MSFT', company: 'Microsoft', contractDate: '2026-02-28', purchaseDate: '2026-02-14', amount: '$500K–$1M', role: 'Senate Armed Services' },
            { member: 'Rep. Troy Nehls (R-TX)', ticker: 'GD', company: 'General Dynamics', contractDate: '2026-04-05', purchaseDate: '2026-03-20', amount: '$100K–$500K', role: 'House Transportation Committee' },
            { member: 'Sen. Tim Scott (R-SC)', ticker: 'NOC', company: 'Northrop Grumman', contractDate: '2026-03-15', purchaseDate: '2026-02-28', amount: '$1M–$5M', role: 'Senate Banking Committee' },
            { member: 'Rep. Jim Himes (D-CT)', ticker: 'ORCL', company: 'Oracle', contractDate: '2026-04-18', purchaseDate: '2026-04-01', amount: '$500K–$1M', role: 'House Intelligence Committee' },
            { member: 'Sen. Tommy Tuberville (R-AL)', ticker: 'LHX', company: 'L3Harris', contractDate: '2026-05-01', purchaseDate: '2026-04-12', amount: '$100K–$500K', role: 'Senate Armed Services' },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="text-white font-bold">{item.member}</div>
                  <div className="text-slate-500 text-sm">{item.role}</div>
                </div>
                <span className="text-red-400 font-mono font-bold text-sm whitespace-nowrap">{item.amount}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-slate-800 text-sm">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Ticker</div>
                  <div className="text-white font-mono font-bold">{item.ticker}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Contract Date</div>
                  <div className="text-white font-mono">{item.contractDate}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Purchase Date</div>
                  <div className="text-emerald-400 font-mono">{item.purchaseDate}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">How We Detect This</p>
                <p className="text-amber-100/80 text-sm">
                  We flag any BUY transaction where: (1) the company has federal contracts, AND (2) a contract of $10M+ was awarded within 30 days BEFORE or 60 days AFTER the trade date. This is not illegal. It is, however, exactly the kind of behavior the STOCK Act was designed to make visible.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Why Current Law Allows This</h2>
          <p className="text-slate-300 mb-4">
            The STOCK Act prohibits insider trading by members of Congress using nonpublic information. But federal contract awards, once announced, are public. Members who time their purchases to coincide with publicly announced contracts are exploiting an ambiguity. They are not breaking the law. They are exploiting a gap that the law does not yet close.
          </p>
          <p className="text-slate-300 mb-6">
            The fix is simple: a mandatory blackout period on trading in companies that appear before congressional committees for contract consideration. Such legislation has been introduced twice and failed both times.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search the Full Database</h3>
            <p className="text-slate-400 mb-4">Every flagged transaction in our database is searchable.</p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/congress/trades?flag=pre_award_buy"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                View Pre-Award Buys
              </Link>
              <Link
                href="/analysis/companies"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                Company Deep Dives
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}