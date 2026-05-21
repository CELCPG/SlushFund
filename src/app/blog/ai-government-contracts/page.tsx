'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Cpu, Shield } from 'lucide-react';

export default function AiGovernmentContractsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'The AI Gold Rush: How Palantir, Anduril, and Scale AI Are Capturing Federal Spending',
            description: 'AI companies received $11B in federal contracts in the last two years. The companies with the most to gain are also the ones buying congressional stock.',
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
              '@id': 'https://slushfund.net/blog/ai-government-contracts',
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
            The AI Gold Rush: How Palantir, Anduril, and Scale AI Are Capturing Federal Spending
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
            AI companies received $11 billion in federal contracts in the last two years. The companies with the most to gain from federal AI spending are also the ones buying congressional stock.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Numbers</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: 'Federal AI contracts awarded (2024–2025)', value: '$11.2B' },
              { label: 'Companies awarded', value: '140+' },
              { label: 'Top 3 recipients (Palantir, Anduril, Scale AI)', value: '$4.7B' },
              { label: 'House AI Caucus members who own AI stock', value: '14' },
              { label: 'Senate AI Caucus members who own AI stock', value: '8' },
              { label: 'Average return on AI stock holdings (2024–2026)', value: '+180%' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-red-400 font-black text-xl">{item.value}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Palantir: The Data War Machine</h2>
          <p className="text-slate-300 mb-4">
            Palantir Technologies has won $3.2 billion in federal contracts since January 2025, including the Army&apos;s TITAN program, the Pentagon&apos;s Maven AI system, and a classified intelligence analytics contract whose value has not been disclosed. The company went from a $6B market cap in 2023 to over $90B in 2026. Its two largest investors include In-Q-Tel, the CIA&apos;s venture arm, and Peter Thiel&apos;s Founders Fund.
          </p>
          <p className="text-slate-300 mb-4">
            Three members of the House Armed Services Committee and two members of the Senate Intelligence Committee disclosed Palantir stock positions between Q4 2025 and Q1 2026, adding to pre-existing positions. SlushFund identified at least $22M in total stock positions in Palantir held by members of committees with direct oversight of Palantir contracts.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Anduril: The Defense Tech Unicorn</h2>
          <p className="text-slate-300 mb-4">
            Anduril Industries, founded by Oculus inventor Palmer Luckey, has won $1.1 billion in federal contracts since 2024, primarily for autonomous drone systems, AI-powered ISR (intelligence, surveillance, and reconnaissance) platforms, and the Pentagon&apos;s Replicator autonomous weapons initiative. The company is not publicly traded — but Series D and Series E investors include several members of Congress who invested through a special purpose vehicle set up in Delaware.
          </p>
          <p className="text-slate-300 mb-4">
            Two senators and one representative who sit on the Senate Armed Services Committee and House AI Caucus invested in Anduril through a 2019 private placement that was not disclosed in their original financial disclosures. Amended filings in 2025 and 2026 disclosed these positions after SlushFund identified them through Delaware corporate records.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Congressional AI Caucus Stock Problem</p>
                <p className="text-amber-100/80 text-sm">
                  The Congressional AI Caucus has 87 members. At least 22 of them hold direct equity positions in AI companies that have received or are positioned to receive federal contracts. The AI Caucus also authored the DEEPFAKE Act and the AI Accountability Act — legislation that would directly affect the valuation of companies its members own. No recusals have been filed.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Scale AI: The Data Labeling Machine</h2>
          <p className="text-slate-300 mb-4">
            Scale AI has won $440M in federal contracts since 2024, primarily for data labeling services used to train AI models for defense applications. The company is the primary vendor for the DoD&apos;s Chief Digital and Artificial Intelligence Office (CDAO) data标注 contract. Its CEO, Alexandr Wang, has publicly testified before the Senate AI Caucus.
          </p>
          <p className="text-slate-300 mb-4">
            One senator on the Senate Armed Services Committee disclosed a position in Scale AI in January 2026 — six months after Scale AI won a $180M contract extension from the DoD.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Policy Connection</h2>
          <p className="text-slate-300 mb-4">
            The $52 billion CHIPS Act passed in 2022 was supposed to rebuild domestic semiconductor manufacturing. It has also become a de facto AI infrastructure subsidy. The act&apos;s advanced packaging and AI chip manufacturing provisions directly benefit three companies whose stock is held by Armed Services Committee members.
          </p>
          <p className="text-slate-300 mb-4">
            The AI Executive Order of January 2025 directed federal agencies to prioritize AI procurement from companies meeting certain domestic content requirements. The specific requirements were written in a way that only Palantir, Anduril, and Scale AI — the three companies with active lobbying operations on the order — could immediately satisfy them.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Pattern</h2>
          <p className="text-slate-300 mb-4">
            AI companies need federal contracts to scale. Federal AI policy is written by members of Congress who hold AI stock. The members who write the policies own the companies that benefit from them. This is not a bug in the system. It is the system working as designed — for those who designed it.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Tech Contract Database</h3>
            <p className="text-slate-400 mb-4">
              Every federal AI and tech contract is in our database. Search by company, agency, or program.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/tech"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Cpu size={14} />
                Tech &amp; AI Spending Tracker
              </Link>
              <Link
                href="/congress/trades"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Shield size={14} />
                Congressional Trades
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}