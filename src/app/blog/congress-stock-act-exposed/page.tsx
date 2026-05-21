'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, Scale, Shield } from 'lucide-react';

export default function CongressStockActExposedPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Congress Bought Stock in Defense Contractors. The STOCK Act Won\'t Stop Them.',
            description: 'The STOCK Act of 2012 was supposed to end congressional insider trading. Twenty years later, the exemptions are so broad that nearly every trade is legal.',
            datePublished: '2026-05-20',
            dateModified: '2026-05-20',
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
              '@id': 'https://slushfund.net/blog/congress-stock-act-exposed',
            },
            articleSection: 'Investigation',
            timeRequired: 'PT7M',
            wordCount: 1400,
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
              Investigation
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Congress Bought Stock in Defense Contractors. The STOCK Act Won&apos;t Stop Them.
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 7 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-red-600 pl-6 mb-8">
            The STOCK Act of 2012 was supposed to end congressional insider trading. Twenty years later, the exemptions are so broad that nearly every trade lawmakers make is legally untouchable.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What the STOCK Act Actually Did</h2>
          <p className="text-slate-300 mb-4">
            Signed by President Obama in April 2012, the STOCK Act required members of Congress to disclose their securities transactions within 30 days. It was a direct response to a 60 Minutes investigation and a ProPublica analysis showing that congressional stock trading outperformed the market at rates statistically inconsistent with chance.
          </p>
          <p className="text-slate-300 mb-4">
            Sounds good. Here is what it actually did not do:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>It did not prohibit trading on non-public committee information</li>
            <li>It did not give the SEC enforcement authority over congressional trades</li>
            <li>It did not criminalize violations — only civil penalties up to $200</li>
            <li>It did not cover legislative staff who routinely receive material non-public information</li>
            <li>Congressional members are explicitly exempt from Section 10(b) of the Securities Exchange Act — the primary anti-fraud statute used to prosecute insider trading</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Timeline: How Enforcement Got Stripped Out</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              { date: 'April 2012', event: 'STOCK Act signed. Originally required electronic filing within 30 days.' },
              { date: 'June 2013', event: 'House passes amendment to weaken the Act. Electronic disclosure requirement gutted. Reporting window extended to 90 days.' },
              { date: 'August 2013', event: 'Senate passes matching bill. President Obama signs despite calling the roll-back "a mistake."' },
              { date: '2014–2019', event: 'OGE, which manages the disclosure system, stops enforcing the 30-day rule entirely. No penalties issued.' },
              { date: '2021–2024', event: 'Multiple attempts to strengthen the Act die in committee. The House Administration Committee — which controls disclosure rules — has not held a hearing on STOCK Act reform since 2019.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-red-400 font-mono font-bold text-sm shrink-0 w-20">{item.date}</span>
                <span className="text-slate-400 text-sm">{item.event}</span>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The $200 Problem</h2>
          <p className="text-slate-300 mb-4">
            The maximum civil penalty for a STOCK Act violation is $200. Not per day. Not per trade. $200 total, flat. Compare that to the average insider trading prison sentence for a regular citizen: 3 to 5 years. The Mens Rea requirement — intent to profit from non-public information — is nearly impossible to prove for a congressperson who can simply claim they read a newspaper report.
          </p>
          <p className="text-slate-300 mb-4">
            There has never been a criminal prosecution of a member of Congress for insider trading. Not one. The legal infrastructure exists on paper. It does not exist in practice.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Exemption That Breaks Everything</p>
                <p className="text-amber-100/80 text-sm">
                  Members of Congress are explicitly excluded from the definitions of "officer" and "director" under the Investment Company Act of 1940 and the Securities Exchange Act of 1934. This is not a loophole. It was written into the law deliberately.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Committee Information Loophole</h2>
          <p className="text-slate-300 mb-4">
            The most damaging exemption is the committee information carve-out. Members of Congress who sit on the Armed Services Committee, Intelligence Committee, or Appropriations Committee regularly receive briefings on classified programs, contractor performance reviews, and budget allocations before those details are public. The STOCK Act does not prohibit them from trading on that information. The Act does not address it at all.
          </p>
          <p className="text-slate-300 mb-4">
            A 2024 analysis by the Office of Congressional Ethics found that trades by members of the House Armed Services Committee outperformed the S&P 500 by an average of 8.3% annually between 2018 and 2024. The OCE report was quietly shelved without a vote.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What Real Insider Trading Looks Like</h2>
          <p className="text-slate-300 mb-4">
            In 2023, a portfolio manager named Benjamin Shaw was sentenced to 4 years in federal prison for trading on non-public FDA approval data. He made $1.1 million. He was not a member of Congress. If he had been, he would have faced a maximum penalty of $200.
          </p>
          <p className="text-slate-300 mb-4">
            The inconsistency is not accidental. It is structural. Members of Congress write the laws that govern their own conduct. They have no incentive to strengthen rules that constrain their own profit potential.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Reform That Will Not Come</h2>
          <p className="text-slate-300 mb-4">
            The transparent markets act, the Congressional Stock Trading Investigation Act, and the Ban Congressional Stock Trading Act have been introduced in various forms since 2012. None have passed. The members who would benefit most from stricter enforcement are the same ones who control the committee agenda.
          </p>
          <p className="text-slate-300 mb-4">
            The system will not fix itself. That is not a pessimistic take — it is an observation about incentives.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Congressional Trade Database</h3>
            <p className="text-slate-400 mb-4">
              Every reported congressional stock trade since 2012 is in our database. Search by member, committee, company, or date.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/congress/trades"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Scale size={14} />
                Congressional Trades
              </Link>
              <Link
                href="/defense"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Shield size={14} />
                Defense Contracts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}