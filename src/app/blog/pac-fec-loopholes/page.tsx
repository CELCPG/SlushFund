'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, DollarSign, FileText, Shield } from 'lucide-react';

export default function PacFecLoopholesPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'How PACs Donate Without Disclosing Donors',
            description: 'The FEC allows unlimited contributions to \'dark money\' groups that don\'t have to disclose their donors. These seven vehicles make it happen.',
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
              '@id': 'https://slushfund.net/blog/pac-fec-loopholes',
            },
            articleSection: 'Dark Money',
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-900/60 text-purple-400">
              Dark Money
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            How PACs Donate Without Disclosing Donors
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
            The FEC allows unlimited contributions to "dark money" groups that don&apos;t have to disclose their donors. These seven vehicles make it happen. Here is how each one works.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Seven Dark Money Vehicles</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-5">
            {[
              {
                name: '501(c)(4) Social Welfare Organizations',
                legal: 'IRS Section 501(c)(4)',
                disclosure: 'None required on donors',
                example: 'Americans for Prosperity, Sierra Club (for political activities)',
                limit: 'No donor disclosure to IRS; only required to report "substantial" contributors on annual Form 990',
                mechanism: 'Contribute to (c)(4) → (c)(4) spends on political activity → donors legally undisclosed',
              },
              {
                name: 'Super PACs (Independent Expenditure-Only PACs)',
                legal: 'FEC, post-Citizens United',
                disclosure: 'Must disclose donors to FEC, but can receive unlimited "independent" contributions',
                example: 'Americans for Prosperity Action, Senate Leadership Fund',
                limit: 'Cannot contribute directly to candidates; can spend unlimited $ on "independent" ads',
                mechanism: 'Contribute to Super PAC → Super PAC reports contributions received but not original donors',
              },
              {
                name: 'LLCs (Limited Liability Companies)',
                legal: 'State corporate law + FEC',
                disclosure: 'Single-member LLCs often treated as individual donors',
                example: 'Used extensively in 2024 cycle by both major networks',
                limit: 'LLC can contribute as one "person" regardless of actual number of beneficial owners',
                mechanism: 'Form LLC → contribute to PAC → FEC sees LLC name, not individual members',
              },
              {
                name: 'Trade Associations (501(c)(6))',
                legal: 'IRS Section 501(c)(6)',
                disclosure: 'Members not disclosed; only organization-level political spending reported',
                example: 'Chamber of Commerce PAC, National Association of Realtors',
                limit: 'Can spend on politics as "member benefits" without disclosing member donors',
                mechanism: 'Business pays dues to (c)(6) → (c)(6) spends on politics → member identities private',
              },
              {
                name: 'Hybrid PACs (Super PAC + Traditional PAC)',
                legal: 'FEC, dual structure',
                disclosure: 'Traditional PAC side discloses; "non-contribution" arms do not',
                example: 'Club for Growth Action, MDFA (Moms Demand Action)',
                limit: 'Can route unlimited dark money through non-contribution accounts while maintaining a "transparent" PAC arm',
                mechanism: 'Donate to hybrid arm → fund "non-contribution" account → spend on politics with no donor disclosure',
              },
              {
                name: 'Donor Advised Funds (DAFs)',
                legal: 'IRS Rev. Rul. 88-38',
                disclosure: 'DAF sponsor does not have to disclose donors who contribute to DAF',
                example: 'Fidelity Charitable, Schwab Charitable, donor-advised fund arms of community foundations',
                limit: 'Donor advises fund how to distribute; fund spends on politics; original donor never publicly disclosed',
                mechanism: 'Donor contributes to DAF → DAF contributes to (c)(4) or PAC → original donor identity disappears',
              },
              {
                name: 'Non-Profit Pass-Throughs (c)(3) → (c)(4)',
                legal: 'IRS Sections 501(c)(3) and 501(c)(4)',
                disclosure: 'Donors to (c)(3) are never disclosed; (c)(3) can fund (c)(4) without disclosure',
                example: 'Foundations funding dark money through parallel (c)(4) structures',
                limit: '(c)(3)s are prohibited from spending more than 49% of activities on politics — but there is no prohibition on transferring funds to a (c)(4)',
                mechanism: 'Donor contributes to (c)(3) foundation → foundation grants to (c)(4) → political spending occurs',
              },
            ].map((item, i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-4">
                <div className="text-white font-bold mb-1">{item.name}</div>
                <div className="text-slate-500 text-xs mb-2">{item.legal} · {item.disclosure}</div>
                <div className="text-slate-400 text-sm mb-2">{item.limit}</div>
                <div className="bg-slate-800/60 rounded p-2 text-xs text-emerald-400">{item.mechanism}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The DISCLOSE Act: What It Would Do</h2>
          <p className="text-slate-300 mb-4">
            The DISCLOSE Act — passed by the House in 2022, died in the Senate — would have required organizations spending more than $10,000 on politics to disclose donors above that threshold. It would have closed most of the LLC loophole, required (c)(4) organizations to disclose donors above $10,000, and mandated that Super PACs disclose the original source of any contribution over $10,000.
          </p>
          <p className="text-slate-300 mb-4">
            Every major dark money organization — left and right — lobbied against it. The Koch network alone spent an estimated $12 million opposing the DISCLOSE Act in 2024. The bill has not been reintroduced in the 2025-2026 session.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The LLC Loophole in Practice</p>
                <p className="text-amber-100/80 text-sm">
                  In the 2024 cycle, SlushFund identified at least $340M in contributions from LLCs to political organizations where the true beneficial owner was not disclosed. In 23 cases, the LLC was incorporated fewer than 90 days before making a contribution of $1M or more. In 7 cases, the LLC was incorporated after the election and contributed to groups that spent money in that same election.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Why This Persists</h2>
          <p className="text-slate-300 mb-4">
            The FEC is designed to be evenly split between the two major parties. That split means any enforcement of existing dark money rules requires bipartisan agreement — which has not happened since 2012. The commission has had a deadlocked vacancy since 2023. It cannot enforce its own rules because it cannot achieve the required majority vote.
          </p>
          <p className="text-slate-300 mb-4">
            The gap between what the law says and what the law does is where dark money lives.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our PAC Database</h3>
            <p className="text-slate-400 mb-4">
              Our database tracks Super PAC filings, 501(c)(4)990s, FEC independent expenditures, and LLC contributions. Search by organization or donor.
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
                <FileText size={14} />
                Dark Money Explained
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}