'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, TrendingUp, AlertTriangle, FileText } from 'lucide-react';

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  author: string;
  tags: string[];
}

const POSTS: Post[] = [
  {
    slug: 'congress-stock-act-exposed',
    title: 'Congress Bought Stock in Defense Contractors. The STOCK Act Won\'t Stop Them.',
    excerpt: 'The STOCK Act of 2012 was supposed to end congressional insider trading. Twenty years later, the exemptions are so broad that nearly every trade is legal.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['STOCK Act', 'Congress', 'Insider Trading', 'Ethics', 'Conflicts'],
  },
  {
    slug: 'koch-dark-money-machine',
    title: 'The Koch Network\'s $400M Dark Money Pipeline',
    excerpt: 'Americans for Prosperity, the JDavis Fund, and a web of LLCs form the largest donor network in American politics. Here\'s exactly where the money goes.',
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Koch', 'Dark Money', 'Americans for Prosperity', '501(c)(4)', 'FEC'],
  },
  {
    slug: 'military-contractors-dod-budget',
    title: 'Five Companies Own the Entire Defense Budget',
    excerpt: 'Lockheed Martin, Raytheon, Northrop Grumman, Boeing, and General Dynamics control 85% of all defense contracts. The congressional oversight problem is structural.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Defense', 'Pentagon', 'Lockheed', 'Raytheon', 'Congress'],
  },
  {
    slug: 'trump-govt-crypto-holdings',
    title: 'Trump\'s Officials Hold $4B in Government-Adjacent Crypto',
    excerpt: 'From the MSTR trade to stablecoin holdings to NFT royalties, Trump-era officials have found a new asset class that blurs the line between government and personal finance.',
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Trump Trades',
    author: 'SlushFund Research',
    tags: ['Trump', 'Crypto', 'Bitcoin', 'Stablecoin', 'MSTR', 'SEC'],
  },
  {
    slug: 'pac-fec-loopholes',
    title: 'How PACs Donate Without Disclosing Donors',
    excerpt: 'The FEC allows unlimited contributions to \'dark money\' groups that don\'t have to disclose their donors. These seven vehicles make it happen.',
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['PAC', 'Dark Money', 'FEC', '501(c)(4)', 'LLC', 'DISCLOSE Act'],
  },
  {
    slug: 'ai-government-contracts',
    title: 'The AI Gold Rush: How Palantir, Anduril, and Scale AI Are Capturing Federal Spending',
    excerpt: 'AI companies received $11B in federal contracts in the last two years. The companies with the most to gain are also the ones buying congressional stock.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['AI', 'Palantir', 'Anduril', 'Scale AI', 'Federal Contracts', 'CHIPS Act'],
  },
  {
    slug: 'congress-members-ai-stocks',
    title: 'Meet the 12 Congress Members Who Bought AI Stock Before the Budget Bill Passed',
    excerpt: 'When the $52B CHIPS Act came up for a vote, 12 members already held positions in the semiconductor companies that would benefit. That\'s not coincidence.',
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Insider Trading',
    author: 'SlushFund Research',
    tags: ['Congress', 'AI', 'Semiconductors', 'CHIPS Act', 'Insider Trading', 'Stock Trades'],
  },
  {
    slug: 'navy-seal-contractor-corruption',
    title: 'Congressman\'s Brother-in-Law Won a $900M Navy Contract. Here\'s the Paper Trail.',
    excerpt: 'Federal procurement rules require competitive bidding. Except when they don\'t. These 7 FAR exceptions swallow 40% of all federal spending.',
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Navy', 'FAR', 'No-Bid Contracts', 'Congress', 'Procurement', 'Corruption'],
  },
  {
    slug: 'trump-world-liberties-magazine',
    title: 'Trump World: How the MAGA Donor Class Built Its Own PAC Infrastructure',
    excerpt: 'America PAC is just the visible top of a much deeper network. Here\'s the full structure of Trump\'s political financing apparatus.',
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Trump', 'America PAC', 'Dark Money', 'MAGA', 'PAC', 'Musk'],
  },
  {
    slug: 'federal-reserve-govt-trading',
    title: 'The Federal Reserve Bank Presidents Who Traded Before Rate Decisions',
    excerpt: 'Regional Fed presidents are subject to trading restrictions. But the restrictions have so many loopholes that the average trade window contains more movement than a typical quarter on Wall Street.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Federal Reserve', 'FOMC', 'Interest Rates', 'Ethics', 'Trading'],
  },
  {
    slug: 'doge-contract-pipeline',
    title: 'The DOGE Contract Pipeline: How Musk\'s Companies Won $10B+',
    excerpt: 'While DOGE claimed to cut federal spending, SpaceX, Tesla, and Neuralink affiliates quietly secured over $10 billion in new and renewed federal contracts. Here is the full pipeline.',
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['DOGE', 'Musk', 'Contracts', 'SpaceX', 'Federal Spending'],
  },
  {
    slug: 'congress-bought-dip',
    title: 'Congress Bought the Dip: 10 Members Who Bought Before Major Contract Awards',
    excerpt: 'At least 10 congressional members purchased stock in federal contractors within 30 days before a major contract award was announced. These are not coincidences. They are patterns.',
    date: '2026-05-18',
    readTime: '6 min read',
    category: 'Insider Trading',
    author: 'SlushFund Research',
    tags: ['Congress', 'Insider Trading', 'Federal Contractors', 'Stock Trades'],
  },
  {
    slug: 'arabella-dark-money',
    title: 'Follow the Dark Money: Arabella Advisors and the $1.4B Dem Donor Pipeline',
    excerpt: 'Arabella Advisors manages six dark money groups that have moved over $1.4 billion to left-leaning candidates since 2010. The layering is deliberate. The transparency is zero.',
    date: '2026-05-15',
    readTime: '10 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Dark Money', 'Arabella', 'Democrats', 'PAC', 'Elections'],
  },
  {
    slug: 'trump-stock-trades-q1-2026',
    title: 'Trump Family Stock Trades: $220M in Q1 2026 Alone',
    excerpt: 'OGE Form 278-T disclosures reveal over $220 million in stock transactions by Trump family members and administration insiders during Q1 2026. The timing of these trades is not random.',
    date: '2026-05-12',
    readTime: '7 min read',
    category: 'Trump Trades',
    author: 'SlushFund Research',
    tags: ['Trump', 'Stock Trades', 'OGE 278-T', 'Conflicts'],
  },
  {
    slug: 'koch-network-exposed',
    title: 'Inside the Koch Network: $1B+ Annual Political Spending Machine',
    excerpt: 'The Koch network is the largest unacknowledged political money operation in America. Americans for Prosperity, the network PAC, and their donor class have shaped every major Republican policy since 2004.',
    date: '2026-05-08',
    readTime: '9 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Koch', 'Dark Money', 'Republicans', 'Americans for Prosperity'],
  },
  {
    slug: 'palantir-contracts',
    title: "Palantir's Federal Winning Streek: $3.2B in 18 Months",
    excerpt: 'Palantir has won $3.2 billion in federal contracts since January 2025. Its stock is up 140%. Three members of the oversight committee personally own Palantir stock.',
    date: '2026-05-05',
    readTime: '5 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Palantir', 'Federal Contracts', 'Congress', 'Tech'],
  },
  {
    slug: 'america-pac-money-pipeline',
    title: 'America PAC: The $250M Musk-Trump Money Pipeline',
    excerpt: 'Elon Musk poured $250M into America PAC in 2024. FEC filings show most of it flowed to firms with Trump and Koch ties — and the original donor is legally undisclosed.',
    date: '2026-05-14',
    readTime: '9 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['America PAC', 'Musk', 'Dark Money', 'FEC', 'Trump'],
  },
  {
    slug: 'defense-contractors-own-congress',
    title: 'The Defense Contractors Owning Congress',
    excerpt: 'Five companies control 85% of defense contracts. Six senators and 12 House members on Armed Services committees personally own stock in them. Total value: $45M.',
    date: '2026-05-11',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Defense', 'Lockheed', 'Raytheon', 'Congress', 'Conflicts'],
  },
  {
    slug: 'arabella-dark-money-machine',
    title: "Arabella Advisors: The Democrats' Dark Money Machine",
    excerpt: "Arabella manages six dark money groups that have moved $1.47B since 2010 — including $280M in 2024 alone. The donor layering is deliberate. The transparency is zero.",
    date: '2026-05-08',
    readTime: '10 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Arabella', 'Dark Money', 'Democrats', 'c4', 'Elections'],
  },
  {
    slug: 'no-bid-contracts',
    title: 'How the Government Learned to Stop Bidding and Love the Contract',
    excerpt: "38% of federal contracts in FY2024 were awarded without competitive bidding. The 'urgency' exception was used 847 times — 72% of those went to companies whose executives donated to the current administration.",
    date: '2026-05-05',
    readTime: '6 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['No-Bid Contracts', 'Federal Spending', 'Acquisition Reform', 'FAR'],
  },
];

const CATEGORIES = ['All', 'Investigation', 'Dark Money', 'Insider Trading', 'Trump Trades'];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? POSTS
    : POSTS.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm transition-colors">
              <ArrowLeft size={14} />
              Back to Tracker
            </Link>
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Blog & Investigations</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            Original reporting and data analysis on federal spending, congressional stock trading, and political money flows. No paywall. No agenda except the truth.
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map(post => (
            <article
              key={post.slug}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-600/40 transition-all group"
            >
              {/* Category badge */}
              <div className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    post.category === 'Investigation' ? 'bg-emerald-900/60 text-emerald-400' :
                    post.category === 'Dark Money' ? 'bg-purple-900/60 text-purple-400' :
                    post.category === 'Insider Trading' ? 'bg-red-900/60 text-red-400' :
                    'bg-blue-900/60 text-blue-400'
                  }`}>
                    {post.category}
                  </span>
                  <span className="text-slate-600 text-xs">{post.date}</span>
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug mb-2">
                  {post.title}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {post.readTime}
                  </span>
                  <span>by {post.author}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Read More
                  <TrendingUp size={13} />
                </div>
              </div>

              {/* Tags */}
              <div className="px-6 pb-5 flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-500 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p>No posts in this category yet.</p>
          </div>
        )}

        {/* API callout */}
        <div className="mt-16 bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-lg mb-2">Want to do your own investigation?</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-lg mx-auto">
            Our public API lets you pull the full dataset. 60 requests/minute, JSON or CSV. Built for journalists, researchers, and data journalists.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/api/v1/trades?limit=5&format=json"
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
              target="_blank"
            >
              View API Docs
            </a>
            <a
              href="/contact"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Submit a Tip
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}