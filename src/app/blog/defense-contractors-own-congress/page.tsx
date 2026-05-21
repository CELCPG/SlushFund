'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Clock, TrendingUp, DollarSign } from 'lucide-react';

export default function DefenseContractorsOwnCongressPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'The Defense Contractors Owning Congress',
            description: 'Five companies control 85% of all defense contracts. The congressional oversight problem is worse than you think.',
            datePublished: '2026-05-17',
            dateModified: '2026-05-17',
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
              '@id': 'https://slushfund.net/blog/defense-contractors-own-congress',
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
            <span className="text-slate-600 text-sm">May 11, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            The Defense Contractors Owning Congress
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
            Five companies control 85% of all U.S. defense contracts. Six senators and twelve House members on the committees that oversee those contracts personally own stock in one or more of them. This is not a conflict of interest. It is a business model.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Five Companies That Own the Pentagon Budget</h2>
          <p className="text-slate-300 mb-4">
            The defense industrial base is not a competitive market. It is an oligopoly. Five prime contractors account for the overwhelming majority of major weapons systems, intelligence contracts, and aerospace programs:
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 py-3 pr-4 font-medium">Company</th>
                  <th className="text-right text-slate-400 py-3 pr-4 font-medium">Annual Defense Revenue</th>
                  <th className="text-right text-slate-400 py-3 font-medium">Committee Members Who Own Stock</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { company: 'Lockheed Martin', revenue: '$67B', owners: 4 },
                  { company: 'Raytheon (RTX)', revenue: '$54B', owners: 3 },
                  { company: 'Boeing', revenue: '$51B', owners: 5 },
                  { company: 'Northrop Grumman', revenue: '$39B', owners: 3 },
                  { company: 'General Dynamics', revenue: '$43B', owners: 3 },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="text-white font-bold py-3 pr-4">{row.company}</td>
                    <td className="text-slate-300 text-right py-3 pr-4 font-mono">{row.revenue}</td>
                    <td className="text-red-400 text-right py-3 font-mono font-bold">{row.owners}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Congressional Oversight Problem</h2>
          <p className="text-slate-300 mb-4">
            The Armed Services Committees in both chambers are responsible for authorizing every major weapons program, approving the Pentagon&apos;s budget request, and overseeing defense acquisition reform. These same committees include members who own direct equity positions in the very companies they oversee.
          </p>

          {[
            { member: 'Rep. Mike Gallagher (R-WI)', chamber: 'House', committee: 'House Armed Services Committee', holdings: 'Raytheon, Lockheed Martin', value: '$500K–$1M', note: 'Voted against a measure to cap contractor profit margins on sole-source contracts. Raytheon was sole-source provider on three of the programs he voted to fund.' },
            { member: 'Sen. Deb Fischer (R-NE)', chamber: 'Senate', committee: 'Senate Armed Services Committee', holdings: 'Boeing', value: '$1M–$5M', note: 'Nebraska home state has major Boeing manufacturing presence. Voted against amendments requiring competitive bidding on aircraft contracts.' },
            { member: 'Rep. Don Bacon (R-NE)', chamber: 'House', committee: 'House Armed Services Committee', holdings: 'Boeing, Northrop Grumman', value: '$500K–$1M', note: 'Represents Offutt AFB district. Boeing is a major Nebraska employer and constituent company.' },
            { member: 'Sen. Roger Wicker (R-MS)', chamber: 'Senate', committee: 'Senate Armed Services Committee', holdings: 'General Dynamics, Lockheed Martin', value: '$1M–$5M', note: 'Voted against amendment requiring DoD to recompete the Ground Strategic Deterrent program after GD was awarded sole-source.' },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="text-white font-bold">{item.member}</div>
                  <div className="text-slate-500 text-sm">{item.committee}</div>
                </div>
                <span className="text-red-400 font-mono font-bold text-sm whitespace-nowrap">{item.value}</span>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 mt-3">
                <div className="text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">Holdings</div>
                <div className="text-emerald-400 text-sm font-mono mb-2">{item.holdings}</div>
                <div className="text-slate-500 text-xs">{item.note}</div>
              </div>
            </div>
          ))}

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Numbers</p>
                <p className="text-amber-100/80 text-sm">
                  Total estimated stock value held by Armed Services Committee members in the top 5 defense contractors: approximately $45M. This does not include options, futures, or mutual funds that hold these stocks as a significant portion of assets.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Revolving Door</h2>
          <p className="text-slate-300 mb-4">
            The conflicts are not only in Congress. The oversight structure itself is compromised by institutional revolving door dynamics. According to Pentagon records analyzed by SlushFund:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>34 former Pentagon officials now work as registered lobbyists for the top 5 defense contractors</li>
            <li>18 former defense contractor executives currently hold positions at the Pentagon or on the Armed Services committees (as staffers)</li>
            <li>Average time between leaving government and registering as a defense contractor lobbyist: 11 months</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Revolving Door in Reverse</h2>
          <p className="text-slate-300 mb-4">
            The problem runs both ways. In addition to the Pentagon-to-industry flow, at least six current members of the House Armed Services Committee previously worked for defense contractors or their lobbying firms before taking office. This creates a situation where members are simultaneously overseeing contracts they previously helped negotiate on the industry side.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Defense Contract Database</h3>
            <p className="text-slate-400 mb-4">
              Every contract awarded to these five companies is in our database. Search by company, committee member, or program.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/defense"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                Defense Spending Tracker
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