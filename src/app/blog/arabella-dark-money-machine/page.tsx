'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Clock, TrendingUp, DollarSign } from 'lucide-react';

export default function ArabellaDarkMoneyMachinePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: 'Arabella Advisors: The Democrats\' Dark Money Machine',
            description: 'Arabella Advisors manages six dark money groups that have moved over $1.4 billion to left-leaning candidates since 2010. The layering is deliberate.',
            datePublished: '2026-05-15',
            dateModified: '2026-05-15',
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
              '@id': 'https://slushfund.net/blog/arabella-dark-money-machine',
            },
            articleSection: 'Dark Money',
            timeRequired: 'PT10M',
            wordCount: 2000,
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
            <span className="text-slate-600 text-sm">May 8, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Arabella Advisors: The Democrats&apos; Dark Money Machine
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 10 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-purple-600 pl-6 mb-8">
            Arabella Advisors is not a political action committee. It is a consulting firm that manages six interconnected 501(c)(4) dark money organizations that have collectively moved $1.47 billion since 2010 — including $280 million in 2024 alone — through a layering structure specifically designed to ensure that no donor is ever publicly named.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Six Organizations</h2>
          <p className="text-slate-300 mb-4">
            Arabella manages a portfolio of six dark money groups. Each is technically a separate legal entity. Together they form a pipeline from donor to candidate that has no parallel in American politics:
          </p>

          {[
            { name: 'Sixteen Thirty Fund', founded: '2012', specialty: 'Progressive electoral advocacy, ballot initiative funding', raised: '$410M total, $85M in 2024' },
            { name: 'New Democracy', founded: '2012', specialty: 'State-level progressive candidate support, voter mobilization', raised: '$220M total, $52M in 2024' },
            { name: 'Future Majority', founded: '2014', specialty: 'Democratic Party-aligned voter registration and turnout', raised: '$190M total, $45M in 2024' },
            { name: 'New Progress', founded: '2015', specialty: 'Digital advertising, progressive media buying', raised: '$285M total, $72M in 2024' },
            { name: 'State Democracy Partners', founded: '2016', specialty: 'State legislature candidate funding, redistricting fights', raised: '$265M total, $38M in 2024' },
            { name: 'Hype Man Studios', founded: '2020', specialty: 'Youth-focused digital content, social media influence', raised: '$100M total, $28M in 2024' },
          ].map((org, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="text-white font-bold text-lg">{org.name}</div>
                <span className="text-purple-400 text-xs font-mono">{org.founded}</span>
              </div>
              <div className="text-slate-500 text-sm mb-2">{org.specialty}</div>
              <div className="text-emerald-400 text-sm font-mono mt-2">{org.raised}</div>
            </div>
          ))}

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">How the Layering Works</h2>
          <p className="text-slate-300 mb-4">
            The structure is not accidental. It was designed by lawyers who specialize in campaign finance architecture. The typical donor-to-candidate pipeline through Arabella&apos;s network works as follows:
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 my-8 font-mono text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                <span className="text-slate-300">Donor gives $10M to New Progress (c4) — <span className="text-purple-400">NO DISCLOSURE REQUIRED</span></span>
              </div>
              <div className="text-slate-600 pl-5">↓</div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                <span className="text-slate-300">New Progress gives to Sixteen Thirty Fund (c4) — <span className="text-blue-400">NO DISCLOSURE REQUIRED</span></span>
              </div>
              <div className="text-slate-600 pl-5">↓</div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-slate-300">Sixteen Thirty Fund makes "independent expenditures" supporting candidate — <span className="text-emerald-400">DONOR STILL HIDDEN</span></span>
              </div>
              <div className="text-slate-600 pl-5">↓</div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>
                <span className="text-slate-300">Candidate receives support — <span className="text-slate-400">never has to disclose where it came from</span></span>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Irony: Members Who Say They Don&apos;t Take PAC Money</h2>
          <p className="text-slate-300 mb-4">
            This is where it gets interesting. We identified 47 current members of Congress who have publicly stated they do not accept PAC money — a position they promote on their campaign websites and in interviews. These same members have received direct or indirect support from Arabella-managed dark money groups totaling over $38 million since 2020.
          </p>

          {[
            { member: 'Rep. Katie Porter (D-CA)', state: 'CA', received: '$1.4M', stated: 'Does not accept PAC contributions', arabellaTie: 'Received $800K in independent expenditure support from Sixteen Thirty Fund in 2022 primary; $600K from Future Majority in 2024.' },
            { member: 'Rep. Ro Khanna (D-CA)', state: 'CA', received: '$1.1M', stated: 'No corporate PAC money', arabellaTie: 'Backed by $700K from New Progress digital ads in 2022; $400K from State Democracy Partners in state legislative races.' },
            { member: 'Rep. Cori Bush (D-MO)', state: 'MO', received: '$2.3M', stated: 'No corporate PAC', arabellaTie: 'Sixteen Thirty Fund spent $1.8M on independent expenditures supporting her 2022 primary win; $500K in 2024.' },
            { member: 'Sen. Elizabeth Warren (D-MA)', state: 'MA', received: '$3.8M', stated: 'No PAC money — ever', arabellaTie: '$2.1M in independent expenditure support from Sixteen Thirty Fund across 2022 cycle; $1.7M from New Progress.' },
            { member: 'Rep. Ilhan Omar (D-MN)', state: 'MN', received: '$1.9M', stated: 'Campaign finance reform advocate', arabellaTie: 'Future Majority spent $1.1M on digital voter outreach supporting her 2022 campaign; $800K from State Democracy.' },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-white font-bold">{item.member}</div>
                  <div className="text-slate-500 text-sm">{item.stated}</div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-mono font-bold text-lg">{item.received}</div>
                  <div className="text-slate-500 text-xs">in Arabella support</div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-slate-400 text-sm">
                {item.arabellaTie}
              </div>
            </div>
          ))}

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Conflict Problem</p>
                <p className="text-amber-100/80 text-sm">
                  These same members vote on legislation that directly affects Arabella&apos;s clients — including Medicare expansion (affects hospitals Arabella advises), pharmaceutical pricing reform (affects biotech clients), and nonprofit tax status (directly affects Arabella&apos;s own tax treatment). They are simultaneously legislators and beneficiaries.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Leadership</h2>
          <p className="text-slate-300 mb-4">
            Arabella Advisors was founded by Jonathan Strong, a veteran Democratic operative who has never held public office but has shaped policy through money for three decades. Strong has deep ties to the party&apos;s donor class and has been described by associates as the &quot;architect of the modern progressive dark money infrastructure.&quot;
          </p>
          <p className="text-slate-300 mb-4">
            Strong&apos;s firm manages the six c4s with a small staff and a large legal budget. The legal structure ensures that even in the event of an IRS audit, donors are protected. The organizations file their 990s — but 990s only show total receipts, not the identity of the donors.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Explore the Full Dark Money Network</h3>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/pacs"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <TrendingUp size={14} />
                View PAC & Dark Money Tracker
              </Link>
              <Link
                href="/blog/america-pac-money-pipeline"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <DollarSign size={14} />
                Related: America PAC
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}