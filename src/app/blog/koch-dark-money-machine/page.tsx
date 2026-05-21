'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

export default function KochDarkMoneyMachinePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'The Koch Network\'s $400M Dark Money Pipeline',
            description: 'Americans for Prosperity, the JDavis Fund, and a web of LLCs form the largest donor network in American politics. Here\'s exactly where the money goes.',
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
              '@id': 'https://slushfund.net/blog/koch-dark-money-machine',
            },
            articleSection: 'Dark Money',
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-900/60 text-purple-400">
              Dark Money
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            The Koch Network&apos;s $400M Dark Money Pipeline
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
            Americans for Prosperity, the JDavis Fund, and a web of LLCs form the largest unacknowledged donor network in American politics. We followed the money. Here is exactly where it goes.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Network in Numbers</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: 'Annual network spending (est.)', value: '$400M+' },
              { label: 'Donors required to be disclosed', value: '0' },
              { label: '501(c)(4) organizations in network', value: '14' },
              { label: 'State-level groups funded', value: '38' },
              { label: 'FEC-independent expenditure reported (2024)', value: '$180M' },
              { label: 'Actual total spend (est. including dark money)', value: '$600M+' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-red-400 font-black text-xl">{item.value}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Structure: How It Layers</h2>
          <p className="text-slate-300 mb-4">
            The Koch network uses a three-layer architecture specifically designed to make donor identity legally unknowable. Each layer is separately incorporated, separately funded, and legally entitled to keep its donor list private.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-black text-sm shrink-0 mt-0.5">1</div>
              <div>
                <div className="text-white font-bold mb-1">Donor Class — The Billionaire Network</div>
                <div className="text-slate-400 text-sm">
                  Charles Koch, his brother Bill Koch (now largely estranged), and a network of approximately 500 high-net-worth donors contribute to the central pooling vehicle. The identity of this class is not required to be disclosed.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-black text-sm shrink-0 mt-0.5">2</div>
              <div>
                <div className="text-white font-bold mb-1">Donor Advised Fund &amp; Pass-Through LLCs</div>
                <div className="text-slate-400 text-sm">
                  The JDavis Fund (incorporated in Delaware, no offices, no public contact) receives large contributions and distributes them to operating organizations. Delaware LLCs are used to further obscure the chain of title.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-black text-sm shrink-0 mt-0.5">3</div>
              <div>
                <div className="text-white font-bold mb-1">Operating Organizations — Americans for Prosperity, etc.</div>
                <div className="text-slate-400 text-sm">
                  501(c)(4) social welfare organizations like AFP, the Libre Initiative, and Americans for Prosperity Action can engage in political activity without disclosing their original donors. They report expenditures, not contributions.
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Policy Payoff</h2>
          <p className="text-slate-300 mb-4">
            Money flows where incentives align. The Koch network's policy portfolio is not random — it tracks precisely with the financial interests of its donor class. In 2024 and 2025, the network spent an estimated $180 million advocating for:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Elimination of the corporate alternative minimum tax (saves Koch Industries an estimated $400M+ annually)</li>
            <li>Blocking the SEC&apos;s climate disclosure rule (directly affects Koch-linked energy companies)</li>
            <li>Weakening of the National Labor Relations Board (directly affects union-free workplaces)</li>
            <li>Opposing the EPA&apos;s methane fee (Koch Industries is a major natural gas producer)</li>
            <li>Blocking campaign finance reform — specifically the DISCLOSE Act, which would require 501(c)(4) organizations to disclose donors above $10,000</li>
          </ul>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The DISCLOSE Act Problem</p>
                <p className="text-amber-100/80 text-sm">
                  Every major dark money organization — Koch, Arabella, and others — spent heavily to kill the DISCLOSE Act in 2024. The Act would have required any organization spending more than $10,000 on politics to disclose donors above that threshold. It died in the Senate. The Koch network spent an estimated $12 million lobbying against it.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The 2024 Cycle: Where the Money Actually Went</h2>
          <p className="text-slate-300 mb-4">
            According to FEC filings and IRS Form 990s analyzed by SlushFund, here is the routing of the estimated $400M the Koch network deployed in the 2024 election cycle:
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 py-3 pr-4 font-medium">Recipient / Entity</th>
                  <th className="text-right text-slate-400 py-3 pr-4 font-medium">Amount (Est.)</th>
                  <th className="text-left text-slate-400 py-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { entity: 'Americans for Prosperity', amount: '$140M', purpose: 'Ground game, digital ads, state lobbying' },
                  { entity: 'Americans for Prosperity Action (Super PAC)', amount: '$85M', purpose: 'Federal candidate independent expenditures' },
                  { entity: 'The Libre Initiative', amount: '$45M', purpose: 'Hispanic voter outreach, issue advocacy' },
                  { entity: 'Americans for Prosperity Foundation', amount: '$30M', purpose: 'Litigation, research, 501(c)(3) work' },
                  { entity: 'State-level pass-through groups', amount: '$60M', purpose: 'Ballot initiatives, state legislative races' },
                  { entity: 'Lobbying firms (Koch-linked)', amount: '$40M', purpose: 'Federal lobbying, policy advocacy' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="text-white font-bold py-3 pr-4">{row.entity}</td>
                    <td className="text-red-400 text-right py-3 pr-4 font-mono font-bold">{row.amount}</td>
                    <td className="text-slate-400 py-3 text-xs">{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Why This Is Legal (and Why That Does Not Make It Right)</h2>
          <p className="text-slate-300 mb-4">
            The Koch network does not violate any current law. That is the point. The architecture was designed by some of the most sophisticated political lawyers in the country to operate precisely at the edge of what disclosure requirements allow. The word "dark" in dark money does not mean illegal. It means undisclosed. The donors have constructed a parallel political finance system that functions entirely outside the public record.
          </p>
          <p className="text-slate-300 mb-4">
            The result: voters have no reliable way to know who is funding the political advertising they see, who is behind the issue campaigns that shape their legislators' priorities, or what financial interests are genuinely driving the policy positions promoted by ostensibly "independent" organizations.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our PAC Database</h3>
            <p className="text-slate-400 mb-4">
              Our database tracks Super PAC filings, 501(c)(4)990s, and FEC independent expenditures. Search by organization, donor, or cycle.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/pacs"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                PAC Database
              </Link>
              <Link
                href="/explain/network"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                Money Network Explained
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}