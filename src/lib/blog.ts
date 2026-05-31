// Single source of truth for blog/investigation posts.
// Consumed by the blog index (/blog), the RSS feed (/feed.xml), and the sitemap.
//
// IMPORTANT: every slug here MUST have a matching page at
// src/app/blog/<slug>/page.tsx — entries without a real page would 404 and
// poison the feed/sitemap. Keep this list in sync when adding posts.

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO yyyy-mm-dd
  readTime: string;
  category: string;
  author: string;
  tags: string[];
}

export const POSTS: Post[] = [
  {
    slug: 'congress-stock-act-exposed',
    title: "Congress Bought Stock in Defense Contractors. The STOCK Act Won't Stop Them.",
    excerpt:
      'The STOCK Act of 2012 was supposed to end congressional insider trading. Twenty years later, the exemptions are so broad that nearly every trade is legal.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['STOCK Act', 'Congress', 'Insider Trading', 'Ethics', 'Conflicts'],
  },
  {
    slug: 'koch-dark-money-machine',
    title: "The Koch Network's $400M Dark Money Pipeline",
    excerpt:
      "Americans for Prosperity, the JDavis Fund, and a web of LLCs form the largest donor network in American politics. Here's exactly where the money goes.",
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Koch', 'Dark Money', 'Americans for Prosperity', '501(c)(4)', 'FEC'],
  },
  {
    slug: 'military-contractors-dod-budget',
    title: 'Five Companies Own the Entire Defense Budget',
    excerpt:
      'Lockheed Martin, Raytheon, Northrop Grumman, Boeing, and General Dynamics control 85% of all defense contracts. The congressional oversight problem is structural.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Defense', 'Pentagon', 'Lockheed', 'Raytheon', 'Congress'],
  },
  {
    slug: 'trump-govt-crypto-holdings',
    title: "Trump's Officials Hold $4B in Government-Adjacent Crypto",
    excerpt:
      'From the MSTR trade to stablecoin holdings to NFT royalties, Trump-era officials have found a new asset class that blurs the line between government and personal finance.',
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Trump Trades',
    author: 'SlushFund Research',
    tags: ['Trump', 'Crypto', 'Bitcoin', 'Stablecoin', 'MSTR', 'SEC'],
  },
  {
    slug: 'pac-fec-loopholes',
    title: 'How PACs Donate Without Disclosing Donors',
    excerpt:
      "The FEC allows unlimited contributions to 'dark money' groups that don't have to disclose their donors. These seven vehicles make it happen.",
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['PAC', 'Dark Money', 'FEC', '501(c)(4)', 'LLC', 'DISCLOSE Act'],
  },
  {
    slug: 'ai-government-contracts',
    title: 'The AI Gold Rush: How Palantir, Anduril, and Scale AI Are Capturing Federal Spending',
    excerpt:
      'AI companies received $11B in federal contracts in the last two years. The companies with the most to gain are also the ones buying congressional stock.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['AI', 'Palantir', 'Anduril', 'Scale AI', 'Federal Contracts', 'CHIPS Act'],
  },
  {
    slug: 'congress-members-ai-stocks',
    title: 'Meet the 12 Congress Members Who Bought AI Stock Before the Budget Bill Passed',
    excerpt:
      "When the $52B CHIPS Act came up for a vote, 12 members already held positions in the semiconductor companies that would benefit. That's not coincidence.",
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Insider Trading',
    author: 'SlushFund Research',
    tags: ['Congress', 'AI', 'Semiconductors', 'CHIPS Act', 'Insider Trading', 'Stock Trades'],
  },
  {
    slug: 'navy-seal-contractor-corruption',
    title: "Congressman's Brother-in-Law Won a $900M Navy Contract. Here's the Paper Trail.",
    excerpt:
      "Federal procurement rules require competitive bidding. Except when they don't. These 7 FAR exceptions swallow 40% of all federal spending.",
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Navy', 'FAR', 'No-Bid Contracts', 'Congress', 'Procurement', 'Corruption'],
  },
  {
    slug: 'trump-world-liberties-magazine',
    title: 'Trump World: How the MAGA Donor Class Built Its Own PAC Infrastructure',
    excerpt:
      "America PAC is just the visible top of a much deeper network. Here's the full structure of Trump's political financing apparatus.",
    date: '2026-05-20',
    readTime: '6 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Trump', 'America PAC', 'Dark Money', 'MAGA', 'PAC', 'Musk'],
  },
  {
    slug: 'federal-reserve-govt-trading',
    title: 'The Federal Reserve Bank Presidents Who Traded Before Rate Decisions',
    excerpt:
      'Regional Fed presidents are subject to trading restrictions. But the restrictions have so many loopholes that the average trade window contains more movement than a typical quarter on Wall Street.',
    date: '2026-05-20',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Federal Reserve', 'FOMC', 'Interest Rates', 'Ethics', 'Trading'],
  },
  {
    slug: 'doge-contract-pipeline',
    title: "The DOGE Contract Pipeline: How Musk's Companies Won $10B+",
    excerpt:
      'While DOGE claimed to cut federal spending, SpaceX, Tesla, and Neuralink affiliates quietly secured over $10 billion in new and renewed federal contracts. Here is the full pipeline.',
    date: '2026-05-20',
    readTime: '8 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['DOGE', 'Musk', 'Contracts', 'SpaceX', 'Federal Spending'],
  },
  {
    slug: 'congress-bought-dip',
    title: 'Congress Bought the Dip: 10 Members Who Bought Before Major Contract Awards',
    excerpt:
      'At least 10 congressional members purchased stock in federal contractors within 30 days before a major contract award was announced. These are not coincidences. They are patterns.',
    date: '2026-05-18',
    readTime: '6 min read',
    category: 'Insider Trading',
    author: 'SlushFund Research',
    tags: ['Congress', 'Insider Trading', 'Federal Contractors', 'Stock Trades'],
  },
  {
    slug: 'america-pac-money-pipeline',
    title: 'America PAC: The $250M Musk-Trump Money Pipeline',
    excerpt:
      'Elon Musk poured $250M into America PAC in 2024. FEC filings show most of it flowed to firms with Trump and Koch ties — and the original donor is legally undisclosed.',
    date: '2026-05-14',
    readTime: '9 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['America PAC', 'Musk', 'Dark Money', 'FEC', 'Trump'],
  },
  {
    slug: 'defense-contractors-own-congress',
    title: 'The Defense Contractors Owning Congress',
    excerpt:
      'Five companies control 85% of defense contracts. Six senators and 12 House members on Armed Services committees personally own stock in them. Total value: $45M.',
    date: '2026-05-11',
    readTime: '7 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['Defense', 'Lockheed', 'Raytheon', 'Congress', 'Conflicts'],
  },
  {
    slug: 'arabella-dark-money-machine',
    title: "Arabella Advisors: The Democrats' Dark Money Machine",
    excerpt:
      'Arabella manages six dark money groups that have moved $1.47B since 2010 — including $280M in 2024 alone. The donor layering is deliberate. The transparency is zero.',
    date: '2026-05-08',
    readTime: '10 min read',
    category: 'Dark Money',
    author: 'SlushFund Research',
    tags: ['Arabella', 'Dark Money', 'Democrats', 'c4', 'Elections'],
  },
  {
    slug: 'no-bid-contracts',
    title: 'How the Government Learned to Stop Bidding and Love the Contract',
    excerpt:
      "38% of federal contracts in FY2024 were awarded without competitive bidding. The 'urgency' exception was used 847 times — 72% of those went to companies whose executives donated to the current administration.",
    date: '2026-05-05',
    readTime: '6 min read',
    category: 'Investigation',
    author: 'SlushFund Research',
    tags: ['No-Bid Contracts', 'Federal Spending', 'Acquisition Reform', 'FAR'],
  },
];

/** Posts sorted newest-first. */
export const POSTS_BY_DATE = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
