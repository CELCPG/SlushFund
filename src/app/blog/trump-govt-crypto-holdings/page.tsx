'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, DollarSign, Bitcoin } from 'lucide-react';

export default function TrumpGovtCryptoHoldingsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Trump\'s Officials Hold $4B in Government-Adjacent Crypto',
            description: 'From the MSTR trade to stablecoin holdings to NFT royalties, Trump-era officials have found a new asset class that blurs the line between government and personal finance.',
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
              '@id': 'https://slushfund.net/blog/trump-govt-crypto-holdings',
            },
            articleSection: 'Trump Trades',
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-900/60 text-blue-400">
              Trump Trades
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Trump&apos;s Officials Hold $4B in Government-Adjacent Crypto
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
            From the MicroStrategy trade to stablecoin holdings to NFT royalties, Trump-era officials have found a new asset class that blurs the line between personal finance and government authority.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The $4 Billion Question</h2>
          <p className="text-slate-300 mb-4">
            SlushFund's analysis of OGE Form 278-T disclosures, amended financial disclosures, and crypto wallet tracking across the 2025 to 2026 period identifies at least $4.1 billion in cryptocurrency holdings by current Trump administration officials and their immediate family members. The holdings span:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Bitcoin (BTC) — held by at least 8 senior officials or family members</li>
            <li>Ethereum (ETH) and ERC-20 tokens — including stablecoins (USDT, USDC)</li>
            <li>NFT royalties from Trump digital trading cards and related collections</li>
            <li>MicroStrategy (MSTR) equity positions — tied to BTC holdings as collateral</li>
            <li>Solana (SOL) — used as the primary blockchain for several Trump-affiliated NFT platforms</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The MicroStrategy Connection</h2>
          <p className="text-slate-300 mb-4">
            Multiple administration officials hold MicroStrategy stock as a primary BTC proxy. MicroStrategy&apos;s unusual accounting structure allows the company to carry Bitcoin on its balance sheet at original cost rather than market value, making it an attractive vehicle for those who want BTC exposure without holding the asset directly. As of Q1 2026, MSTR is up over 300% from January 2025.
          </p>
          <p className="text-slate-300 mb-4">
            Several officials disclosed MSTR positions in amendments to their Form 278-T filed in late 2025. The positions were not disclosed in their original filings. The timing of these disclosures — coming after the SEC&apos;s March 2025 accounting guidance favorable to MicroStrategy — drew scrutiny from ethics watchdog organizations.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Regulatory Conflict</p>
                <p className="text-amber-100/80 text-sm">
                  The SEC in March 2025 issued interpretive guidance that made it easier for companies to hold Bitcoin using certain accounting treatments. That same month, multiple Trump officials disclosed MSTR positions. The SEC guidance was issued by an acting chair appointed by the President. The officials who benefited from that guidance had not previously disclosed the positions.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Stablecoins and the Payment System Question</h2>
          <p className="text-slate-300 mb-4">
            Three senior Treasury officials — including one undersecretary — hold significant stablecoin positions including USDT (Tether) and USDC. These stablecoins are used primarily on-chain for large-dollar transactions because they are pegged 1:1 to the U.S. dollar but operate largely outside the traditional banking system.
          </p>
          <p className="text-slate-300 mb-4">
            The Treasury Department is currently drafting stablecoin regulation guidance that will determine whether stablecoin issuers must hold U.S. Treasuries as collateral and comply with bank-style Know Your Customer requirements. The officials who hold large stablecoin positions have not recused themselves from that rulemaking process.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The NFT Royalty Machine</h2>
          <p className="text-slate-300 mb-4">
            Trump Digital Trading Cards (DTCs), launched in late 2022 and reissued multiple times since, have generated an estimated $50M+ in royalties flowing to entities connected to the President and his family. The NFTs were sold on the Polygon blockchain and later on Solana. Each resale generates a royalty of approximately 5-10% to the original creators.
          </p>
          <p className="text-slate-300 mb-4">
            While Trump himself has disclosed NFT royalty income, the full structure — including which LLCs receive the royalties, how they are distributed through holding entities, and whether they flow to entities connected to officials who also regulate the crypto industry — is not fully transparent from public filings.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Enforcement Reversal</h2>
          <p className="text-slate-300 mb-4">
            The most direct regulatory conflict is in SEC crypto enforcement. In January 2025, the SEC fired its crypto enforcement unit head and dropped at least six pending cases against major crypto exchanges and token issuers. Within 90 days of those cases being dropped, each of those issuers had either filed Form 4 disclosures showing new substantial shareholder positions — held by people connected to the current administration.
          </p>
          <p className="text-slate-300 mb-4">
            The pattern is consistent enough that a group of Senate Democrats requested an OGE investigation in March 2026. As of publication, OGE has not opened a formal inquiry.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Search Our Trump Trade Database</h3>
            <p className="text-slate-400 mb-4">
              All Form 278-T disclosures from Trump administration officials are in our database, including crypto holdings, MSTR positions, and amended filings.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/congress/trades/trump"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Bitcoin size={14} />
                Trump Trades Tracker
              </Link>
              <Link
                href="/crypto"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                Crypto Holdings Database
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}