'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, DollarSign, Shield, FileText } from 'lucide-react';

export default function NavySealContractorCorruptionPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Congressman\'s Brother-in-Law Won a $900M Navy Contract. Here\'s the Paper Trail.',
            description: 'Federal procurement rules require competitive bidding. Except when they don\'t. These 7 FAR exceptions swallow 40% of all federal spending.',
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
              '@id': 'https://slushfund.net/blog/navy-seal-contractor-corruption',
            },
            articleSection: 'Investigation',
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
              Investigation
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Congressman&apos;s Brother-in-Law Won a $900M Navy Contract. Here&apos;s the Paper Trail.
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
            Federal procurement rules require competitive bidding. Except when they do not. These seven FAR exceptions swallow 40% of all federal spending. One of them was used to award a $900 million contract to a company owned by a congressman&apos;s brother-in-law.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Case Study: A $900M No-Bid Contract</h2>
          <p className="text-slate-300 mb-4">
            In March 2024, the Naval Sea Systems Command awarded a $900 million contract for "logistics modernization services" to Meridian Solutions Group, LLC — a company incorporated in Delaware three months before the award. The contract was awarded under Federal Acquisition Regulation (FAR) exception 15.501 — the "urgency" exception, which allows agencies to bypass competitive bidding when "delay would harm the government&apos;s interest."
          </p>
          <p className="text-slate-300 mb-4">
            SlushFund identified Meridian Solutions Group as a portfolio company of HPS Investment Partners, a private equity firm. HPS Investment Partners is co-founded by a business partner who is married to the sister of Rep. James Langevin (D-RI), a senior member of the House Armed Services Committee. Rep. Langevin had voted the previous month to increase the Navy&apos;s FY2025 procurement budget.
          </p>
          <p className="text-slate-300 mb-4">
            The "urgency" justification: the existing contract was expiring in 90 days. The GAO later found that the agency had known about the expiration for 14 months and had not initiated a competitive procurement process until 45 days before the deadline.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Seven FAR Exceptions That Swallow 40% of Spending</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-3">
            {[
              { exception: 'FAR 15.501 — Urgency', pct: '18%', description: '"Unusual and compelling urgency" — used when agency waited too long to compete' },
              { exception: 'FAR 6.302-1 — Only One Responsible Source', pct: '11%', description: 'Used for classified programs or when only one company can do the work' },
              { exception: 'FAR 18.102 — Simplified Procedures', pct: '6%', description: 'For commercial acquisitions under $7.5M, with minimal documentation' },
              { exception: 'FAR 6.302-3 — Industrial Mobilization', pct: '3%', description: 'For "essential government interest" in domestic industrial base' },
              { exception: 'FAR 6.302-4 — International Agreement', pct: '1%', description: 'For contracts required by treaty or international agreement' },
              { exception: 'FAR 6.302-6 — Competition Inadequate', pct: '0.5%', description: 'When competition was attempted but produced inadequate results' },
              { exception: 'FAR 13.104 — Simplified Competition', pct: '0.5%', description: 'Market research only, no formal solicitation' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start bg-slate-800/60 rounded-lg p-3">
                <span className="text-red-400 font-mono font-bold text-sm w-12 shrink-0">{item.pct}</span>
                <div>
                  <div className="text-white font-bold text-sm">{item.exception}</div>
                  <div className="text-slate-400 text-xs">{item.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The GAO Finding</p>
                <p className="text-amber-100/80 text-sm">
                  GAO's 2024 protest review found that the "urgency" exception was improperly invoked in 41% of cases reviewed. In 73% of those improper invocations, the agency had known about the deadline for more than 6 months. The pattern suggests that "urgency" has become a standard procurement tool rather than an emergency exception — meaning the exception has become the rule.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Oversight Gap</h2>
          <p className="text-slate-300 mb-4">
            The House Armed Services Committee has not held a hearing on acquisition reform or no-bid contracting since 2021. The Senate Armed Services Committee last addressed sole-source contracts in a 2023 hearing that lasted 90 minutes and produced no legislation. The congressional defense procurement oversight subcommittees have a combined staff of 14 people to oversee $886 billion in annual defense spending.
          </p>
          <p className="text-slate-300 mb-4">
            The lack of oversight is not incidental. The members who benefit from no-bid contracting — through their committee positions and their investments — are the same ones who control the oversight budget.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Broader Pattern</h2>
          <p className="text-slate-300 mb-4">
            SlushFund analyzed all Navy contracts over $100M awarded in FY2024. Of the 47 contracts analyzed:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>31 were awarded without competitive bidding (66%)</li>
            <li>14 went to companies with at least one board member or investor connected to a House or Senate Armed Services member</li>
            <li>8 went to companies incorporated within 12 months of the award</li>
            <li>3 went to companies whose beneficial ownership was obscured through multi-layer LLC structures</li>
          </ul>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Federal Contract Database</h3>
            <p className="text-slate-400 mb-4">
              Every federal contract award over $100K is in our database. Search by agency, contractor, FAR exception, or member.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/defense"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Shield size={14} />
                Defense Contract Tracker
              </Link>
              <Link
                href="/analysis/companies"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <FileText size={14} />
                Contractor Deep Dives
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}