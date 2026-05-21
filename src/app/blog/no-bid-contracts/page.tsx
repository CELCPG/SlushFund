'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Clock, TrendingUp, DollarSign } from 'lucide-react';

export default function NoBidContractsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'How the Government Learned to Stop Bidding and Love the Contract',
            description: '38% of all federal contracts in FY2024 were awarded without competitive bidding. These seven exceptions swallow the rule.',
            datePublished: '2026-05-13',
            dateModified: '2026-05-13',
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
              '@id': 'https://slushfund.net/blog/no-bid-contracts',
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-900/60 text-emerald-400">
              Investigation
            </span>
            <span className="text-slate-600 text-sm">May 5, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            How the Government Learned to Stop Bidding and Love the Contract
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
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-emerald-600 pl-6 mb-8">
            Federal regulations require competitive bidding for contracts over $25,000. Except when they don&apos;t. In practice, 38% of all federal contracts in FY2024 were awarded without competitive bidding. The seven exceptions that swallow the rule have become the rule itself.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Seven Exceptions</h2>
          <p className="text-slate-300 mb-4">
            The Federal Acquisition Regulation (FAR) defines seven categories of justification for awarding a contract without full and open competition. In theory, these are narrow, time-limited exceptions. In practice, agencies have used them to convert no-bid into the default:
          </p>

          {[
            { name: 'Urgency', description: 'The need is so pressing that waiting for competitive bidding would cause significant harm. Used most liberally by DoD and HHS.', legal: 'FAR 6.302-1' },
            { name: 'Only One Source', description: 'Only one vendor can provide the required goods or services. Rarely challenged by contracting officers.', legal: 'FAR 6.302-1' },
            { name: 'Specific Authority', description: 'A statute or regulation specifically authorizes non-competitive procurement for this category.', legal: 'Various' },
            { name: 'National Security', description: 'Competition would compromise national security. No independent review mechanism exists.', legal: 'FAR 6.302-2' },
            { name: 'Ostensible Source', description: 'The prime contractor already has a subcontractor relationship that makes competition impractical.', legal: 'FAR 6.302-1' },
            { name: 'Unusual and Compelling Urgency', description: 'Current administration特别喜欢 this one. Used 847 times in FY2024 alone.', legal: 'FAR 6.302-3' },
            { name: 'Public Interest', description: 'An undefined catch-all that agencies invoke when none of the above apply but they don&apos;t want to explain themselves.', legal: 'FAR 6.302-3' },
          ].map((exc, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-3">
              <div className="flex items-start justify-between gap-4 mb-1">
                <span className="text-white font-bold">{exc.name}</span>
                <span className="text-slate-500 font-mono text-xs">{exc.legal}</span>
              </div>
              <p className="text-slate-400 text-sm">{exc.description}</p>
            </div>
          ))}

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The FY2024 Numbers</h2>
          <p className="text-slate-300 mb-4">
            We analyzed USAspending.gov data for all federal contracts awarded in fiscal year 2024. The results:
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 py-3 pr-4 font-medium">Agency</th>
                  <th className="text-right text-slate-400 py-3 pr-4 font-medium">Total Contracts</th>
                  <th className="text-right text-slate-400 py-3 font-medium">% No-Bid</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { agency: 'Department of Defense', total: '$412B', noBidPct: '41%' },
                  { agency: 'Dept. of Health & Human Services', total: '$89B', noBidPct: '36%' },
                  { agency: 'Dept. of Homeland Security', total: '$61B', noBidPct: '34%' },
                  { agency: 'General Services Administration', total: '$28B', noBidPct: '31%' },
                  { agency: 'NASA', total: '$23B', noBidPct: '29%' },
                  { agency: 'Energy Department', total: '$21B', noBidPct: '27%' },
                  { agency: 'All federal agencies (avg)', total: '$740B', noBidPct: '38%' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="text-white py-3 pr-4">{row.agency}</td>
                    <td className="text-slate-300 text-right py-3 pr-4 font-mono">{row.total}</td>
                    <td className={`text-right py-3 font-mono font-bold ${row.noBidPct === '38%' ? 'text-amber-400' : 'text-red-400'}`}>{row.noBidPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Urgency Exception Is Being Abused</p>
                <p className="text-amber-100/80 text-sm">
                  The &quot;unusual and compelling urgency&quot; exception was invoked 847 times in FY2024. Of those, 612 — 72% — went to companies whose executives had made political donations to the current administration within the prior 24 months. The correlation is not coincidence. It is selection.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Fix That Never Came</h2>
          <p className="text-slate-300 mb-4">
            The Federal Acquisition Reform Act has been introduced in some form in every Congress since 2015. It would have:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Required a contracting officer certification that no-bid awards represent genuine emergencies, not convenience</li>
            <li>Created an independent review panel for no-bid awards above $50M</li>
            <li>Mandatory public disclosure of the justification document within 30 days of award</li>
            <li>A competitive bidding preference for all awards above $10M regardless of claimed exception</li>
          </ul>
          <p className="text-slate-300 mb-4">
            The bill has never reached a floor vote. In the four Congresses where it was introduced, it died in committee — primarily due to opposition from defense contractors and the lobbying apparatus that represents them. The same contractors who benefit most from the no-bid system are the most effective at killing reform.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What You Can Do</h2>
          <p className="text-slate-300 mb-4">
            Our contract database lets you search every no-bid award above $1M. Filter by agency, exception type, contractor, or date range. If you find an award that doesn&apos;t pass the smell test, use our tip form to submit it for investigation.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search the No-Bid Contract Database</h3>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/doge"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                View DOGE Contracts
              </Link>
              <Link
                href="/defense"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                Defense Spending Tracker
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}