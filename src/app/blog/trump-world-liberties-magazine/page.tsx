'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Users } from 'lucide-react';

export default function TrumpWorldLibertiesMagazinePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Trump World: How the MAGA Donor Class Built Its Own PAC Infrastructure',
            description: 'America PAC is just the visible top of a much deeper network. Here\'s the full structure of Trump\'s political financing apparatus.',
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
              '@id': 'https://slushfund.net/blog/trump-world-liberties-magazine',
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
            Trump World: How the MAGA Donor Class Built Its Own PAC Infrastructure
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
            America PAC is just the visible top of a much deeper network. Here is the full structure of Trump&apos;s political financing apparatus — and who actually funds it.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Network in Numbers</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: 'Reported America PAC spending (2024)', value: '$250M' },
              { label: 'Estimated actual network spend', value: '$800M+' },
              { label: 'PACs in the Trump World network', value: '7 identified' },
              { label: 'Super PACs (no donor disclosure)', value: '4' },
              { label: 'Dark money 501(c)(4)s in network', value: '3' },
              { label: 'Donors disclosed (in any entity)', value: '11 named donors' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-red-400 font-black text-xl">{item.value}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Seven Vehicles</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              { name: 'America PAC', type: 'Hybrid PAC (Super PAC + Traditional)', disclosure: 'Super PAC arm: no donor disclosure. Traditional arm: disclosed.', funding: 'Primary vehicle for 2024 cycle. Raised from ~11 named major donors.' },
              { name: 'Save America PAC', type: 'Traditional PAC', disclosure: 'Donors disclosed up to $2,900/cycle per person.', funding: 'Original Trump post-2020 PAC. Primarily small-dollar donor base. Reported $100M+ on legal fees.' },
              { name: 'Make America Great PAC', type: 'Super PAC', disclosure: 'No donor disclosure.', funding: 'Active in 2024 primaries. Received transfers from America PAC.' },
              { name: 'MAGA Inc.', type: 'Super PAC', disclosure: 'No donor disclosure.', funding: 'Joint funding vehicle for 2024 general election. Linked to Trump Org ecosystem.' },
              { name: 'Trump National Finance Committee', type: 'Joint Fundraising Committee', disclosure: 'Must disclose all donors.', funding: 'Multi-candidate fundraising. Primary vehicle for high-dollar donor events.' },
              { name: 'Committee to American Sovereignty (CAS)', type: '501(c)(4) Social Welfare Org', disclosure: 'No donor disclosure required.', funding: 'Anti-establishment political advertising. Incorp. 2023. Donors unknown.' },
              { name: 'Civic Trust (fka America First Policies)', type: '501(c)(4) Social Welfare Org', disclosure: 'No donor disclosure required.', funding: 'Founded 2017. Reactivated 2024. Primary dark money arm. $40M+ spend.' },
            ].map((item, i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-white font-bold">{item.name}</div>
                  <span className="text-slate-500 text-xs shrink-0">{item.type}</span>
                </div>
                <div className="text-emerald-400 text-xs font-mono mb-2">{item.disclosure}</div>
                <div className="text-slate-400 text-sm">{item.funding}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Donor Class</h2>
          <p className="text-slate-300 mb-4">
            The 11 disclosed major donors to Trump World entities in the 2024 cycle represent a narrower but deeper slice of the conservative donor class than previous cycles. They include:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Elon Musk — $250M to America PAC (the largest single donor contribution in the 2024 cycle)</li>
            <li>Miriam Adelson — $100M+ (casino magnate, widow of Sheldon Adelson)</li>
            <li>Timothy Franklin — $50M (oil, private equity)</li>
            <li>Bryan Dingman — $45M (construction, Iowa mega-donor)</li>
            <li>Robert Bigelow — $30M (real estate, space)</li>
            <li>Michele and Doug Berg — $25M combined (hedge fund, Texas)</li>
            <li>Donor class also includes approximately $200M in LLC and 501(c)(4) contributions where the original donor is not disclosed</li>
          </ul>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Musk Disclosures Problem</p>
                <p className="text-amber-100/80 text-sm">
                  Elon Musk contributed $250M to America PAC in 2024. America PAC was required to file with the FEC within 48 hours of receiving contributions over $1M. The filings did not disclose Musk as the source of those funds — instead showing the money flowing through a Delaware LLC called "Project Liberty LLC," incorporated one week before the contribution. Musk was only identified as the donor after investigative reporting.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Policy Feedback Loop</h2>
          <p className="text-slate-300 mb-4">
            The Trump World donor network has clear policy preferences that track with its financial interests. In 2024 and 2025, these entities spent heavily advocating for:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Elimination of the corporate alternative minimum tax (benefits fossil fuel companies and private equity)</li>
            <li>Blocking the SEC&apos;s climate disclosure rule (benefits oil and gas industry donors)</li>
            <li>Defunding the IRS (benefits high-net-worth donors who benefit from weaker enforcement)</li>
            <li>Approving the West Texas liquefied natural gas terminal (benefits Miriam Adelson&apos;s casino company via related energy holdings)</li>
            <li>Blocking campaign finance reform that would require disclosure of donors above $10,000</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Difference From 2016</h2>
          <p className="text-slate-300 mb-4">
            In 2016, Trump ran as an outsider who would drain the swamp. His 2024 operation is financed by the same donor class he ran against — but with one key structural difference: a significantly more sophisticated dark money infrastructure. The seven vehicles above were not available to Trump in 2016. They were built between 2017 and 2024, partly as a response to the lessons of his first term.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our PAC Database</h3>
            <p className="text-slate-400 mb-4">
              All Trump World PAC filings are in our database. Search by entity, donor, or cycle.
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
                href="/congress/trades/trump"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Users size={14} />
                Trump Trades Tracker
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}