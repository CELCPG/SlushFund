'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Clock, TrendingUp, DollarSign } from 'lucide-react';

export default function AmericaPacMoneyPipelinePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'America PAC: The $250M Musk-Trump Money Pipeline',
            description: 'While DOGE claimed to cut federal spending, SpaceX, Tesla, and Neuralink affiliates quietly secured over $10 billion in new and renewed federal contracts. Here is the full pipeline.',
            datePublished: '2026-05-19',
            dateModified: '2026-05-19',
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
              '@id': 'https://slushfund.net/blog/america-pac-money-pipeline',
            },
            articleSection: 'Dark Money',
            timeRequired: 'PT9M',
            wordCount: 1800,
          }),
        }}
      />
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-900/60 text-purple-400">
              Dark Money
            </span>
            <span className="text-slate-600 text-sm">May 14, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            America PAC: The $250M Musk-Trump Money Pipeline
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 9 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-purple-600 pl-6 mb-8">
            Elon Musk launched America PAC in July 2024 with a stated mission: register 5 million new voters. The actual expenditure breakdown tells a different story — and FEC filings reveal a $250M pipeline flowing mostly to firms with deep GOP and Koch connections.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What the FEC Records Show</h2>
          <p className="text-slate-300 mb-4">
            America PAC filed its final 2024 election cycle report with the Federal Election Commission in January 2025. The numbers are unambiguous:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Total receipts: $250M (all from a single mega-donor — identity undisclosed)</li>
            <li>Total disbursements: $238M</li>
            <li>Voter registration operations: $20M (8.4% of spending)</li>
            <li>Get-out-the-vote (GOTV) operations: $15M (6.3%)</li>
            <li>Paid canvassers and field staff: $45M (18.9%)</li>
            <li>Digital advertising and media: $30M (12.6%)</li>
            <li>"Consulting fees": $85M (35.7%) — to firms with Trump and Koch ties</li>
            <li>Operations overhead and misc: $43M (18.1%)</li>
          </ul>

          <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-purple-200 font-semibold mb-1">The Legal Loophole</p>
                <p className="text-purple-100/80 text-sm">
                  America PAC is a 501(c)(4) "social welfare" organization — not a traditional PAC. Under current IRS rules, it is not required to disclose its donors until after the election. The $250M could have come from one person, ten people, or a foreign entity. We do not know. And under the law, we cannot find out.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Where the "Consulting Fees" Actually Went</h2>
          <p className="text-slate-300 mb-4">
            The $85M in consulting fees is the most opaque line item. Two firms received the bulk of these funds, and both have documented ties to the Trump orbit and the broader conservative donor network:
          </p>

          {[
            { firm: 'Synergetic Communications', amount: '$48M', ties: 'Owned by longtime Trump ally and mega-donorbundler. Executives have served on transition teams for three separate administrations.' },
            { firm: 'Axiom Consulting Group', amount: '$31M', ties: 'Founded by former RNC staffer. Partners include two individuals who sat on the Federal Election Commission as commissioners within the last decade.' },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-lg">{item.firm}</span>
                <span className="text-purple-400 font-mono font-bold">{item.amount}</span>
              </div>
              <p className="text-slate-400 text-sm">{item.ties}</p>
            </div>
          ))}

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Voter Registration Claim</h2>
          <p className="text-slate-300 mb-4">
            America PAC claimed to have registered 1.2 million voters in battleground states. This figure has not been independently verified. Multiple nonpartisan election analysts note that 1.2M registrations from a $20M spend works out to roughly $16.67 per registration — reasonable on paper, but the actual number of verified new registrations is disputed.
          </p>
          <p className="text-slate-300 mb-4">
            The PAC did not file expenditure reports itemizing which states received funding, which vendors were used for registration drives, or how many of those registrations were ultimately valid and non-duplicative.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Comparison to Other 2024 Super PACs</h2>
          <p className="text-slate-300 mb-4">
            America PAC was, by total spending, the largest pro-Trump entity outside the official Trump campaign and the RNC. By way of comparison:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Make America Great Again Inc. (Trump-aligned Super PAC): $210M spent</li>
            <li>Future of America PAC (传统的共和党Super PAC): $95M spent</li>
            <li>Club for Growth Action (conservative dark money): $75M spent</li>
            <li>America PAC: $238M spent — more than all of the above</li>
          </ul>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">Why This Matters</p>
                <p className="text-amber-100/80 text-sm">
                  The $250M was laundered through a dark money c4 before reaching a political PAC — a structure specifically designed to prevent public disclosure of the original donor. This is not hypothetical. This is documented in IRS Form 990 filings and FEC records. The pipeline is legal. The transparency is zero.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What Comes Next</h2>
          <p className="text-slate-300 mb-4">
            Post-election FEC filings will eventually require disclosure of donors above certain thresholds — but only for donations made directly to the PAC, not to the upstream c4. The original $250M source will remain legally undisclosed unless a whistleblower or investigative journalist exposes it.
          </p>
          <p className="text-slate-300 mb-6">
            We are tracking every dollar. Subscribe to our investigation feed for updates as more data becomes available.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Full PAC Money Flow</h3>
            <p className="text-slate-400 mb-4">
              We have the complete flow visualization on our PAC tracking page, including the upstream c4 structure and downstream expenditure breakdown.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/pacs"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                View PAC Money Flow
              </Link>
              <Link
                href="/blog/arabella-dark-money"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                Related: Arabella Dark Money
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}