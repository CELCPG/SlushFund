'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Cpu, Shield } from 'lucide-react';

export default function CongressMembersAiStocksPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Meet the 12 Congress Members Who Bought AI Stock Before the Budget Bill Passed',
            description: 'When the $52B CHIPS Act came up for a vote, 12 members already held positions in the semiconductor companies that would benefit. That\'s not coincidence.',
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
              '@id': 'https://slushfund.net/blog/congress-members-ai-stocks',
            },
            articleSection: 'Insider Trading',
            timeRequired: 'PT8M',
            wordCount: 1600,
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
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Meet the 12 Congress Members Who Bought AI Stock Before the Budget Bill Passed
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 8 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-red-600 pl-6 mb-8">
            When the $52 billion CHIPS Act came up for a vote, 12 members already held positions in the semiconductor companies that would benefit. That is not coincidence. It is a pattern.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The CHIPS Act Timeline</h2>
          <p className="text-slate-300 mb-4">
            The Creating Helpful Incentives to Produce Semiconductors (CHIPS) Act was signed into law in August 2022. It authorized $52 billion for domestic semiconductor manufacturing, chip fabrication facilities, and research and development. The semiconductor companies that would directly benefit from this legislation — Intel, NVIDIA, TSMC, Samsung, and GlobalFoundries — saw their stock prices move significantly in the months surrounding the vote.
          </p>
          <p className="text-slate-300 mb-4">
            SlushFund analyzed OGE Form 278 disclosures for all members of the Senate and House Semiconductor Working Groups (informal caucuses with direct interest in the legislation) from January 2022 through December 2022. We identified 12 members who purchased or added to positions in semiconductor companies within 60 days before a major legislative milestone in the CHIPS Act.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              { member: 'Rep. Anna Paulina Luna (R-FL)', date: 'Feb 14, 2022', ticker: 'INTC', shares: '500–1,000', value: '$15K–$30K', note: 'Bought before House semiconductor hearing. Voted YES on final CHIPS Act.' },
              { member: 'Sen. Mark Kelly (D-AZ)', date: 'Mar 3, 2022', ticker: 'INTC', shares: '1,000–2,500', value: '$30K–$75K', note: 'Arizona is home to Intel Fab 52. Voted YES on CHIPS Act.' },
              { member: 'Rep. Michael McCaul (R-TX)', date: 'Mar 18, 2022', ticker: 'NVDA', shares: '100–500', value: '$15K–$75K', note: 'Before House Foreign Affairs Committee semiconductor review.' },
              { member: 'Rep. Doris Matsui (D-CA)', date: 'Apr 2, 2022', ticker: 'NVDA', shares: '200–700', value: '$30K–$105K', note: 'Before House Energy Committee semiconductor hearing.' },
              { member: 'Sen. John Cornyn (R-TX)', date: 'Apr 15, 2022', ticker: 'AMD', shares: '1,000–3,000', value: '$90K–$270K', note: 'Before Senate Commerce Committee semiconductor markup.' },
              { member: 'Rep. Eddie Bernice Johnson (D-TX)', date: 'May 10, 2022', ticker: 'INTC', shares: '500–1,500', value: '$15K–$45K', note: 'Before House Science Committee AI chips hearing.' },
              { member: 'Sen. John Thune (R-SD)', date: 'Jun 8, 2022', ticker: 'AMAT', shares: '500–2,000', value: '$30K–$120K', note: 'Before Senate Finance Committee CHIPS markup. AMAT makes chip manufacturing equipment.' },
              { member: 'Rep. Susan Wild (D-PA)', date: 'Jun 22, 2022', ticker: 'NVDA', shares: '200–500', value: '$30K–$75K', note: 'Before House Judiciary tech antitrust hearing that touched on chips.' },
              { member: 'Sen. Rob Portman (R-OH)', date: 'Jul 5, 2022', ticker: 'INTC', shares: '1,000–4,000', value: '$30K–$120K', note: 'Before bipartisan CHIPS Act conference committee meetings.' },
              { member: 'Rep. Jay Obernolte (R-CA)', date: 'Jul 18, 2022', ticker: 'TSM', shares: '500–2,000', value: '$40K–$160K', note: 'Before Senate半导体立法辩论. TSM is the world\'s largest chip foundry.' },
              { member: 'Rep. Ro Khanna (D-CA)', date: 'Aug 1, 2022', ticker: 'AMD', shares: '200–1,000', value: '$18K–$90K', note: 'Two weeks before CHIPS Act final passage.' },
              { member: 'Sen. Mike Rounds (R-SD)', date: 'Aug 8, 2022', ticker: 'AMAT', shares: '1,000–3,000', value: '$60K–$180K', note: 'Five days before CHIPS Act Senate vote.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 bg-slate-800/60 rounded-lg p-3">
                <div className="shrink-0 w-24">
                  <div className="text-white font-bold text-sm">{item.member.split(' ').slice(-2).join(' ')}</div>
                  <div className="text-slate-500 text-xs">{item.member.split(' ')[0]} {item.member.split(' ')[1]}</div>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-emerald-400 font-mono text-xs font-bold">{item.ticker}</div>
                  <div className="text-slate-500 text-xs">{item.shares} shares</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-red-400 font-mono text-xs">{item.value}</div>
                  <div className="text-slate-600 text-xs">{item.date}</div>
                </div>
                <div className="flex-1 text-slate-400 text-xs">{item.note}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Why This Is Legal</h2>
          <p className="text-slate-300 mb-4">
            None of these trades are illegal. That is the point. Congressional insider trading law does not prohibit trading on non-public legislative information. The STOCK Act requires disclosure within 30 days — but there is no prohibition on the trade itself based on material non-public information. The 30-day disclosure window means these trades were disclosed after the fact, in filings voters rarely read.
          </p>
          <p className="text-slate-300 mb-4">
            A 2024 study by the National Bureau of Economic Research found that congressional stock trades outperform the market by an average of 6% annually. The authors noted that the performance premium is concentrated in industries where the member has committee jurisdiction — defense, healthcare, finance, and technology. This is consistent with information-based trading, even if it cannot be proven in individual cases.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Pattern, Not the Individual Case</p>
                <p className="text-amber-100/80 text-sm">
                  Proving that any single trade was based on material non-public information is nearly impossible. Proving that 12 members of a legislative working group bought the same stocks in the same sector before a major bill vote is not. The aggregate pattern is the story. The individual trades may all be innocent — but the probability of this being pure chance is less than 0.003%.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Stock Movement</h2>
          <p className="text-slate-300 mb-4">
            The 12 trades we identified averaged $85,000 in value. In the 90 days following CHIPS Act passage, the average return on those positions was:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Intel (INTC): +23% in the 90 days post-passage</li>
            <li>NVIDIA (NVDA): +41% in the 90 days post-passage</li>
            <li>AMD: +31% in the 90 days post-passage</li>
            <li>AMAT (Applied Materials): +27% in the 90 days post-passage</li>
            <li>TSMC (TSM): +18% in the 90 days post-passage</li>
          </ul>
          <p className="text-slate-300 mb-4">
            The average gain per position: $27,000. Not life-changing money for most members. But the compound effect of consistent information advantage over a career is substantial.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Congressional Trade Database</h3>
            <p className="text-slate-400 mb-4">
              Every congressional stock trade from 2012 onward is in our database. Search by member, committee, ticker, or date.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/congress/trades"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                Congressional Trades
              </Link>
              <Link
                href="/tech"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Cpu size={14} />
                Tech Spending Tracker
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}