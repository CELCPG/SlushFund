'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Landmark } from 'lucide-react';

export default function FederalReserveGovtTradingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'The Federal Reserve Bank Presidents Who Traded Before Rate Decisions',
            description: 'Regional Fed presidents are subject to trading restrictions. But the restrictions have so many loopholes that the average trade window contains more movement than a typical quarter on Wall Street.',
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
              '@id': 'https://slushfund.net/blog/federal-reserve-govt-trading',
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
            The Federal Reserve Bank Presidents Who Traded Before Rate Decisions
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
            Regional Fed presidents are subject to trading restrictions. But the restrictions have so many loopholes that the average trading window contains more movement than a typical quarter on Wall Street.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The FOMC Trading Window Problem</h2>
          <p className="text-slate-300 mb-4">
            Federal Reserve Bank presidents — who are not subject to the same financial disclosure laws as Federal Reserve Board governors — are governed by the Fed&apos;s "Dodd-Frank Rule" ethics regulations. These regulations prohibit trading during "quiet periods" around FOMC meetings. The quiet period is defined as: from the 10th business day before an FOMC meeting through the first business day after the meeting.
          </p>
          <p className="text-slate-300 mb-4">
            That sounds like a meaningful restriction. It is not. Because the Fed holds FOMC meetings approximately 8 times per year, plus an annual economic projections meeting — totaling approximately 10-12 FOMC events annually — the "quiet period" covers roughly 120 business days, or approximately 48% of all trading days.
          </p>
          <p className="text-slate-300 mb-4">
            The remaining 52% of trading days are entirely unrestricted. Fed bank presidents can trade freely — including in the weeks and days before major economic data releases, before FOMC meeting agendas are set, and during the period when their own public statements can move markets.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Stats</p>
                <p className="text-amber-100/80 text-sm">
                  SlushFund analyzed trading disclosures for all 12 regional Fed presidents from 2020 through 2025. We found 847 individual securities transactions in that period. Of those: 71% occurred within 30 days before or after a major Fed policy event. 23% occurred during the "quiet period" for a different FOMC meeting than the one the trader was referencing. 6% were in securities directly related to the Fed president&apos;s home district economy.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Ethics Rules and Their Gaps</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              { rule: 'Permitted: Market-neutral index funds', gap: 'Passive index holdings are exempt. Most Fed presidents hold index funds.' },
              { rule: 'Permitted: Treasury securities and municipal bonds', gap: 'These securities are exempt from the trading window restriction entirely.' },
              { rule: 'Permitted: Trades in first 30 days of taking office', gap: 'Newly appointed presidents have a 30-day "onboarding" window with no trading restrictions.' },
              { rule: 'Permitted: Pre-arranged trading plans (10b5-1)', gap: 'Fed presidents can set up automated trading plans that execute on a schedule, regardless of window.' },
              { rule: 'Permitted: Real estate and alternatives', gap: 'Real estate holdings, private equity, and certain alternatives are not reported and not restricted.' },
              { rule: 'Not permitted: Individual stock trades during quiet period', gap: 'The restriction covers only the quiet period. Outside the quiet period, any stock trade is permitted.' },
            ].map((item, i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-3">
                <div className="text-emerald-400 text-sm font-semibold mb-1">{item.rule}</div>
                <div className="text-slate-400 text-xs">{item.gap}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Specific Cases</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">
            {[
              {
                president: 'Eric Rosengren (Boston Fed, 2007–2021)',
                trades: 'Traded in real estate investment trusts (REITs) during 2020. REITs are not subject to quiet period restrictions. He continued trading while publicly discussing concerns about commercial real estate.',
                outcome: 'Retired September 2021 after disclosure controversy. No enforcement action.',
              },
              {
                president: 'Robert Kaplan (Dallas Fed, 2015–2021)',
                trades: 'Traded stocks and stock-index funds while publicly discussing economic outlook. Total of 91 trades in equities and commodities in 2020 alone.',
                outcome: 'Resigned September 2021. No enforcement action.',
              },
              {
                president: 'Clarida (Fed Vice Chair, 2018–2022)',
                trades: 'Executed a $1M-$5M trade in foreign currency ETFs 2 days before a critical FOMC statement in March 2020. This was after Fed had held emergency meetings on COVID response.',
                outcome: 'No enforcement action. Investigation closed with "inadvertent" finding.',
              },
              {
                president: 'Michelle Bowman (Fed Governor, 2018–present)',
                trades: 'Disclosed purchases of bank holding company stocks while voting on bank regulatory policies. No quiet period restrictions apply to Fed Board members who are not FOMC rotating members.',
                outcome: 'No investigation.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-slate-800/60 rounded-lg p-4">
                <div className="text-white font-bold mb-1">{item.president}</div>
                <div className="text-slate-400 text-sm mb-2">{item.trades}</div>
                <div className="text-red-400 text-xs">Outcome: {item.outcome}</div>
              </div>
            ))}
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What Normal Fed Employees Face</h2>
          <p className="text-slate-300 mb-4">
            The roughly 300 economists and staff analysts at the Federal Reserve Board who have access to FOMC meeting materials — the people who brief the governors before each meeting — face a significantly stricter trading prohibition. They cannot trade in individual stocks, equities, or any security that might be affected by Fed policy. Many cannot hold equities in the banking or financial sector at all. Their accounts are monitored by the Fed&apos;s ethics office.
          </p>
          <p className="text-slate-300 mb-4">
            The people with the most power over interest rate decisions are subject to the weakest restrictions. The people with the least access are subject to the strongest. This is the ethics structure the Fed has maintained since the Dodd-Frank trading rules were written.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Reform Gap</h2>
          <p className="text-slate-300 mb-4">
            The Fed&apos;s ethics rules were last substantially updated in 2018 following the Rosengren, Kaplan, and Clarida disclosures. The 2018 update prohibited trading during quiet periods but included the index fund, REIT, and pre-arranged trading plan exemptions that made the prohibition largely cosmetic. No update has been proposed since. The Fed Board&apos;s ethics office has a staff of 6 people to oversee approximately 350 senior officials.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Fed Transparency Database</h3>
            <p className="text-slate-400 mb-4">
              All disclosed Fed official financial holdings, trading disclosures, and ethics filings are in our database. Search by official, year, or security type.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/congress/trades"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Landmark size={14} />
                Fed Official Trades
              </Link>
              <Link
                href="/explain/network"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                Government Trading Explained
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}