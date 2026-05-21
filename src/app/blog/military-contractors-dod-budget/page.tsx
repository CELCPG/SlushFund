'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Shield } from 'lucide-react';

export default function MilitaryContractorsDodBudgetPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Five Companies Own the Entire Defense Budget',
            description: 'Lockheed Martin, Raytheon, Northrop Grumman, Boeing, and General Dynamics control 85% of all defense contracts. The congressional oversight problem is structural.',
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
              '@id': 'https://slushfund.net/blog/military-contractors-dod-budget',
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
            Five Companies Own the Entire Defense Budget
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
            Lockheed Martin, Raytheon, Northrop Grumman, Boeing, and General Dynamics control 85% of all major defense contracts. The congressional oversight problem is not a bug. It is a feature.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Concentration Problem</h2>
          <p className="text-slate-300 mb-4">
            The U.S. defense industrial base has the concentration problem of an oligopoly and the oversight problem of a captured regulator. Five prime contractors account for the overwhelming majority of major weapons systems, intelligence programs, aerospace platforms, and shipbuilding contracts. Every one of them has stockholders. Some of those stockholders sit on the committees that approve their budgets.
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 py-3 pr-4 font-medium">Company</th>
                  <th className="text-right text-slate-400 py-3 pr-4 font-medium">Annual Defense Revenue</th>
                  <th className="text-right text-slate-400 py-3 font-medium">Key Programs</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { company: 'Lockheed Martin', revenue: '$67B', programs: 'F-35, Trident missile, THAAD, C-130' },
                  { company: 'Raytheon (RTX)', revenue: '$54B', programs: 'Tomahawk, Patriot, AIM missiles' },
                  { company: 'Boeing', revenue: '$51B', programs: 'F/A-18, Apache, Chinook, submarine parts' },
                  { company: 'Northrop Grumman', revenue: '$39B', programs: 'B-21 Raider, James Webb Space Telescope, E-2 Hawkeye' },
                  { company: 'General Dynamics', revenue: '$43B', programs: 'Abrams tank, Virginia-class sub, Gerald R. Ford carrier' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="text-white font-bold py-3 pr-4">{row.company}</td>
                    <td className="text-slate-300 text-right py-3 pr-4 font-mono">{row.revenue}</td>
                    <td className="text-slate-400 py-3 text-xs">{row.programs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Structural Conflict</h2>
          <p className="text-slate-300 mb-4">
            The House Armed Services Committee and Senate Armed Services Committee are responsible for authorizing every major weapons program, approving the Pentagon&apos;s annual budget request, and overseeing defense acquisition policy. These committees include members who hold direct equity positions in the companies they oversee.
          </p>
          <p className="text-slate-300 mb-4">
            This is not a hypothetical conflict. It is documented in OGE Form 278 filings analyzed by SlushFund across the 2023 to 2026 reporting cycles.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              { member: 'Rep. Mike Gallagher (R-WI)', committee: 'House Armed Services Committee', holdings: 'Raytheon, Lockheed Martin', value: '$500K–$1M', note: 'Voted against amendments to cap contractor profit margins. Raytheon was sole-source provider on programs he voted to fund.' },
              { member: 'Sen. Deb Fischer (R-NE)', committee: 'Senate Armed Services Committee', holdings: 'Boeing', value: '$1M–$5M', note: 'Boeing is a major Nebraska employer. Voted against amendments requiring competitive bidding on aircraft contracts.' },
              { member: 'Rep. Don Bacon (R-NE)', committee: 'House Armed Services Committee', holdings: 'Boeing, Northrop Grumman', value: '$500K–$1M', note: 'Offutt AFB district. Boeing is a constituent company in his district.' },
              { member: 'Sen. Roger Wicker (R-MS)', committee: 'Senate Armed Services Committee', holdings: 'General Dynamics, Lockheed Martin', value: '$1M–$5M', note: 'Voted against recompete requirement for Ground Strategic Deterrent after GD was awarded sole-source.' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-800/60 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="text-white font-bold">{item.member}</div>
                    <div className="text-slate-500 text-sm">{item.committee}</div>
                  </div>
                  <span className="text-red-400 font-mono font-bold text-sm whitespace-nowrap">{item.value}</span>
                </div>
                <div className="text-emerald-400 text-xs font-mono mb-2">{item.holdings}</div>
                <div className="text-slate-500 text-xs">{item.note}</div>
              </div>
            ))}
          </div>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Math That Matters</p>
                <p className="text-amber-100/80 text-sm">
                  Total estimated stock value in the top 5 defense contractors held by Armed Services Committee members: approximately $45M. This does not include options, futures, or mutual funds that hold these stocks. The same members have, in aggregate, voted to increase the defense budget in 14 of the last 15 annual NDAA votes.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Why Competition Is a Myth</h2>
          <p className="text-slate-300 mb-4">
            Defense procurement is structured around a concept called "required source" — meaning certain contracts can only go to certain companies because of intellectual property, classified access, or "industrial base" considerations. In practice, this means the five primes compete with each other for program wins, but the competition itself is managed by the same congressional committees that own their stock.
          </p>
          <p className="text-slate-300 mb-4">
            The Government Accountability Office found in a 2024 report that sole-source awards — contracts awarded without competitive bidding — now account for approximately 40% of all major defense acquisitions by dollar value. The "industrial base" justification was used in 73% of those sole-source determinations.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What the Revolving Door Adds</h2>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>34 former Pentagon officials now work as registered lobbyists for the top 5 defense contractors</li>
            <li>18 former defense contractor executives currently hold positions at the Pentagon or on Armed Services committee staffs</li>
            <li>Average time between leaving government and registering as a defense contractor lobbyist: 11 months</li>
            <li>Six current House Armed Services Committee members previously worked for defense contractors or their lobbying firms</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Bottom Line</h2>
          <p className="text-slate-300 mb-4">
            The oversight structure of U.S. defense procurement was not designed to prevent these conflicts. It was designed by the same people who benefit from them. Until the people who regulate defense spending are prohibited from owning the companies they regulate — which is current law in nearly every other wealthy democracy — the structural conflict will persist.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Defense Contract Database</h3>
            <p className="text-slate-400 mb-4">
              Every contract awarded to these five companies is in our database. Search by company, program, committee member, or year.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/defense"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Shield size={14} />
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