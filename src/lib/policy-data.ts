// SlushFund — Policy & Legislation Layer
// The connective tissue: links donor money (PACs, crypto investors) to specific
// bills, roll-call votes, and regulatory actions, and then to who profits.
//
// Curated, source-cited dataset. Live bill status/votes are layered on top via
// src/lib/congress-gov.ts + /api/policy/bills. Citations are mandatory (CLAUDE.md).

export type PolicyArea = 'crypto' | 'defense' | 'tech' | 'energy' | 'finance' | 'health';

export type BillStatus =
  | 'introduced'
  | 'in_committee'
  | 'passed_house'
  | 'passed_senate'
  | 'passed_both'
  | 'enacted'
  | 'failed'
  | 'vetoed';

export interface BillSponsor {
  name: string;
  party: 'R' | 'D' | 'I';
  chamber: 'House' | 'Senate';
  state: string;
  role: 'sponsor' | 'cosponsor';
}

export interface Bill {
  bill_id: string; // e.g. "HR-4763-118"
  short_name: string; // e.g. "FIT21"
  title: string;
  congress: number;
  chamber: 'House' | 'Senate';
  status: BillStatus;
  status_detail: string;
  policy_area: PolicyArea;
  summary: string;
  introduced_date: string;
  sponsors: BillSponsor[];
  congress_gov_url: string;
  linked_pacs: string[]; // PAC abbreviations from pac-data.ts
  linked_entities: string[]; // entity names from political-entities-v2.ts / crypto-data.ts
  beneficiaries: string[]; // who profits if this becomes law
  source_urls: string[];
}

export interface RollCallVote {
  bill_id: string;
  vote_label: string; // e.g. "House passage, May 2024"
  date: string;
  result: string; // e.g. "Passed 279–136"
  members: { name: string; party: 'R' | 'D' | 'I'; chamber: 'House' | 'Senate'; state: string; vote: 'Yea' | 'Nay' | 'Present' | 'Not Voting' }[];
  source_url: string;
}

export interface RegulatoryAction {
  id: string;
  agency: 'SEC' | 'CFTC' | 'Treasury' | 'DOJ' | 'White House' | 'Federal Reserve' | 'OCC';
  action: string;
  date: string;
  policy_area: PolicyArea;
  summary: string;
  beneficiaries: string[];
  donor_links: string[]; // PACs / entities financially connected to the beneficiaries
  source_urls: string[];
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export const BILLS: Bill[] = [
  {
    bill_id: 'HR-4763-118',
    short_name: 'FIT21',
    title: 'Financial Innovation and Technology for the 21st Century Act',
    congress: 118,
    chamber: 'House',
    status: 'passed_house',
    status_detail: 'Passed the House 279–136 on May 22, 2024; framework carried into the 119th Congress as the CLARITY Act.',
    policy_area: 'crypto',
    summary:
      'Establishes which digital assets are commodities (CFTC-regulated) vs. securities (SEC-regulated), shifting most token oversight away from the SEC. The crypto industry\'s top legislative priority.',
    introduced_date: '2023-07-20',
    sponsors: [
      { name: 'Glenn Thompson', party: 'R', chamber: 'House', state: 'PA', role: 'sponsor' },
      { name: 'French Hill', party: 'R', chamber: 'House', state: 'AR', role: 'cosponsor' },
      { name: 'Patrick McHenry', party: 'R', chamber: 'House', state: 'NC', role: 'cosponsor' },
    ],
    congress_gov_url: 'https://www.congress.gov/bill/118th-congress/house-bill/4763',
    linked_pacs: ['Fairshake', 'a16z PAC', 'SWC'],
    linked_entities: ['Coinbase', 'Andreessen Horowitz (a16z crypto)', 'Circle', 'Paradigm'],
    beneficiaries: ['Coinbase', 'Crypto VC token portfolios', 'Stablecoin issuers'],
    source_urls: [
      'https://www.congress.gov/bill/118th-congress/house-bill/4763',
      'https://clerk.house.gov/Votes/2024220',
    ],
  },
  {
    bill_id: 'HR-3633-119',
    short_name: 'CLARITY Act',
    title: 'Digital Asset Market Clarity Act',
    congress: 119,
    chamber: 'House',
    status: 'passed_house',
    status_detail: 'Passed the House in 2025; the successor market-structure bill to FIT21, pending in the Senate.',
    policy_area: 'crypto',
    summary:
      'The 119th-Congress market-structure bill. Finalizes the commodity/security split for digital assets and locks the CFTC in as primary crypto regulator.',
    introduced_date: '2025-05-29',
    sponsors: [
      { name: 'French Hill', party: 'R', chamber: 'House', state: 'AR', role: 'sponsor' },
      { name: 'Glenn Thompson', party: 'R', chamber: 'House', state: 'PA', role: 'cosponsor' },
    ],
    congress_gov_url: 'https://www.congress.gov/bill/119th-congress/house-bill/3633',
    linked_pacs: ['Fairshake', 'a16z PAC'],
    linked_entities: ['Coinbase', 'Andreessen Horowitz (a16z crypto)', 'Multicoin Capital'],
    beneficiaries: ['Crypto exchanges', 'Crypto VC funds', 'DeFi protocols'],
    source_urls: ['https://www.congress.gov/bill/119th-congress/house-bill/3633'],
  },
  {
    bill_id: 'S-1582-119',
    short_name: 'GENIUS Act',
    title: 'Guiding and Establishing National Innovation for U.S. Stablecoins Act',
    congress: 119,
    chamber: 'Senate',
    status: 'enacted',
    status_detail: 'Passed the Senate and House and signed into law in 2025 — the first major US crypto statute.',
    policy_area: 'crypto',
    summary:
      'Creates a federal regulatory framework for payment stablecoins: reserve requirements, audits, and licensing. Legitimizes USDC, Tether-style reserves, and Trump-family stablecoin USD1.',
    introduced_date: '2025-02-04',
    sponsors: [
      { name: 'Bill Hagerty', party: 'R', chamber: 'Senate', state: 'TN', role: 'sponsor' },
      { name: 'Cynthia Lummis', party: 'R', chamber: 'Senate', state: 'WY', role: 'cosponsor' },
      { name: 'Kirsten Gillibrand', party: 'D', chamber: 'Senate', state: 'NY', role: 'cosponsor' },
    ],
    congress_gov_url: 'https://www.congress.gov/bill/119th-congress/senate-bill/1582',
    linked_pacs: ['Fairshake'],
    linked_entities: ['Circle', 'Cantor Fitzgerald (Howard Lutnick)', 'Trump family + Witkoff family', 'MGX (Abu Dhabi sovereign-backed fund)'],
    beneficiaries: ['Circle (USDC)', 'Tether / Cantor Fitzgerald', 'World Liberty Financial USD1'],
    source_urls: [
      'https://www.congress.gov/bill/119th-congress/senate-bill/1582',
      'https://www.nytimes.com/2025/05/19/us/politics/senate-stablecoin-genius-act.html',
    ],
  },
  {
    bill_id: 'S-4912-118',
    short_name: 'BITCOIN Act',
    title: 'Boosting Innovation, Technology, and Competitiveness through Optimized Investment Nationwide Act',
    congress: 118,
    chamber: 'Senate',
    status: 'introduced',
    status_detail: 'Introduced by Sen. Lummis; reintroduced in the 119th Congress. Proposes a federal Strategic Bitcoin Reserve.',
    policy_area: 'crypto',
    summary:
      'Directs the federal government to acquire up to 1 million BTC over five years as a strategic reserve. Would create a permanent government bid under the Bitcoin price.',
    introduced_date: '2024-07-31',
    sponsors: [
      { name: 'Cynthia Lummis', party: 'R', chamber: 'Senate', state: 'WY', role: 'sponsor' },
    ],
    congress_gov_url: 'https://www.congress.gov/bill/118th-congress/senate-bill/4912',
    linked_pacs: ['Fairshake'],
    linked_entities: ['MicroStrategy', 'Trump family + Witkoff family', 'Peter Thiel (Founders Fund)', 'Digital Currency Group (DCG — Barry Silbert)'],
    beneficiaries: ['Bitcoin holders', 'MicroStrategy', 'Bitcoin miners'],
    source_urls: [
      'https://www.congress.gov/bill/118th-congress/senate-bill/4912',
      'https://www.opensecrets.org/politicians/cynthia-lummis/summary',
    ],
  },
];

// ─── Roll-Call Votes ─────────────────────────────────────────────────────────

export const ROLL_CALL_VOTES: RollCallVote[] = [
  {
    bill_id: 'HR-4763-118',
    vote_label: 'House passage of FIT21',
    date: '2024-05-22',
    result: 'Passed 279–136 (71 Democrats crossed over to vote Yea)',
    members: [
      { name: 'Glenn Thompson', party: 'R', chamber: 'House', state: 'PA', vote: 'Yea' },
      { name: 'French Hill', party: 'R', chamber: 'House', state: 'AR', vote: 'Yea' },
      { name: 'Patrick McHenry', party: 'R', chamber: 'House', state: 'NC', vote: 'Yea' },
      { name: 'Tom Emmer', party: 'R', chamber: 'House', state: 'MN', vote: 'Yea' },
      { name: 'Warren Davidson', party: 'R', chamber: 'House', state: 'OH', vote: 'Yea' },
      { name: 'Bryan Steil', party: 'R', chamber: 'House', state: 'WI', vote: 'Yea' },
      { name: 'Ro Khanna', party: 'D', chamber: 'House', state: 'CA', vote: 'Yea' },
      { name: 'Josh Gottheimer', party: 'D', chamber: 'House', state: 'NJ', vote: 'Yea' },
      { name: 'Ritchie Torres', party: 'D', chamber: 'House', state: 'NY', vote: 'Yea' },
      { name: 'Wiley Nickel', party: 'D', chamber: 'House', state: 'NC', vote: 'Yea' },
      { name: 'Maxine Waters', party: 'D', chamber: 'House', state: 'CA', vote: 'Nay' },
      { name: 'Brad Sherman', party: 'D', chamber: 'House', state: 'CA', vote: 'Nay' },
      { name: 'Sean Casten', party: 'D', chamber: 'House', state: 'IL', vote: 'Nay' },
      { name: 'Stephen Lynch', party: 'D', chamber: 'House', state: 'MA', vote: 'Nay' },
    ],
    source_url: 'https://clerk.house.gov/Votes/2024220',
  },
  {
    bill_id: 'S-1582-119',
    vote_label: 'Senate passage of the GENIUS Act',
    date: '2025-05-19',
    result: 'Passed 68–30 with bipartisan support',
    members: [
      { name: 'Bill Hagerty', party: 'R', chamber: 'Senate', state: 'TN', vote: 'Yea' },
      { name: 'Cynthia Lummis', party: 'R', chamber: 'Senate', state: 'WY', vote: 'Yea' },
      { name: 'Tim Scott', party: 'R', chamber: 'Senate', state: 'SC', vote: 'Yea' },
      { name: 'Bernie Moreno', party: 'R', chamber: 'Senate', state: 'OH', vote: 'Yea' },
      { name: 'Kirsten Gillibrand', party: 'D', chamber: 'Senate', state: 'NY', vote: 'Yea' },
      { name: 'Mark Warner', party: 'D', chamber: 'Senate', state: 'VA', vote: 'Yea' },
      { name: 'Ruben Gallego', party: 'D', chamber: 'Senate', state: 'AZ', vote: 'Yea' },
      { name: 'Angela Alsobrooks', party: 'D', chamber: 'Senate', state: 'MD', vote: 'Yea' },
      { name: 'Elizabeth Warren', party: 'D', chamber: 'Senate', state: 'MA', vote: 'Nay' },
      { name: 'Bernie Sanders', party: 'I', chamber: 'Senate', state: 'VT', vote: 'Nay' },
      { name: 'Jeff Merkley', party: 'D', chamber: 'Senate', state: 'OR', vote: 'Nay' },
      { name: 'Chris Van Hollen', party: 'D', chamber: 'Senate', state: 'MD', vote: 'Nay' },
    ],
    source_url: 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1.htm',
  },
];

// ─── Regulatory & Executive Actions ──────────────────────────────────────────

export const REGULATORY_ACTIONS: RegulatoryAction[] = [
  {
    id: 'sec-coinbase-dismissal-2025',
    agency: 'SEC',
    action: 'SEC dismisses its enforcement lawsuit against Coinbase',
    date: '2025-02-27',
    policy_area: 'crypto',
    summary:
      'Under new leadership, the SEC dropped its 2023 securities-violation case against Coinbase — a defendant whose donors had funneled tens of millions into the 2024 election through Fairshake.',
    beneficiaries: ['Coinbase'],
    donor_links: ['Fairshake', 'Coinbase', 'Andreessen Horowitz (a16z crypto)'],
    source_urls: ['https://www.reuters.com/legal/sec-drops-coinbase-lawsuit-2025-02-27/'],
  },
  {
    id: 'sec-tron-pause-2025',
    agency: 'SEC',
    action: 'SEC civil fraud case against Justin Sun / Tron paused',
    date: '2025-02-26',
    policy_area: 'crypto',
    summary:
      'The SEC and Justin Sun jointly asked a court to pause the agency\'s fraud case — weeks after Sun became the largest disclosed buyer of the Trump family\'s WLFI token.',
    beneficiaries: ['Justin Sun (Tron founder)', 'World Liberty Financial'],
    donor_links: ['Justin Sun (Tron founder)', 'Trump family + Witkoff family'],
    source_urls: ['https://www.bloomberg.com/news/articles/2025-02-26/sec-tron-justin-sun-case-paused'],
  },
  {
    id: 'cz-pardon-2025',
    agency: 'DOJ',
    action: 'Presidential pardon of Binance founder Changpeng Zhao',
    date: '2025-01',
    policy_area: 'crypto',
    summary:
      'President Trump pardoned Binance founder CZ after his anti-money-laundering conviction. Binance had helped settle a $2B MGX investment in the Trump-linked USD1 stablecoin.',
    beneficiaries: ['Binance', 'Changpeng Zhao'],
    donor_links: ['Binance', 'MGX (Abu Dhabi sovereign-backed fund)', 'Trump family + Witkoff family'],
    source_urls: ['https://www.nytimes.com/2025/05/01/us/politics/trump-crypto-binance-mgx.html'],
  },
  {
    id: 'strategic-bitcoin-reserve-eo-2025',
    agency: 'White House',
    action: 'Executive Order establishing a Strategic Bitcoin Reserve',
    date: '2025-03-06',
    policy_area: 'crypto',
    summary:
      'An executive order directed the Treasury to hold seized Bitcoin as a strategic reserve rather than selling it — an administrative version of Sen. Lummis\'s BITCOIN Act.',
    beneficiaries: ['Bitcoin holders', 'MicroStrategy', 'Bitcoin miners'],
    donor_links: ['Fairshake', 'MicroStrategy'],
    source_urls: ['https://www.whitehouse.gov/presidential-actions/2025/03/strategic-bitcoin-reserve/'],
  },
];

// ─── Linkage helpers ─────────────────────────────────────────────────────────

/** All bills a given PAC (by abbr) is linked to. */
export function billsForPac(pacAbbr: string): Bill[] {
  return BILLS.filter((b) => b.linked_pacs.includes(pacAbbr));
}

/** All bills a given entity is linked to. */
export function billsForEntity(entityName: string): Bill[] {
  return BILLS.filter((b) => b.linked_entities.includes(entityName));
}

/** Roll-call votes for a bill. */
export function votesForBill(billId: string): RollCallVote[] {
  return ROLL_CALL_VOTES.filter((v) => v.bill_id === billId);
}

// ─── Legislator Scorecard: money vs. votes ───────────────────────────────────
// Crypto-industry election spending tied to specific legislators, joined against
// how they voted on crypto bills. The site's core "money shapes policy" claim.

export interface LegislatorCryptoMoney {
  name: string;
  amount: number; // crypto-industry election spending supporting them
  detail: string;
  source_url: string;
}

/**
 * Documented crypto-industry election spending per legislator. Figures are
 * super-PAC independent expenditures supporting the candidate (Fairshake and
 * its affiliates Defend American Jobs / Protect Progress).
 */
export const CRYPTO_MONEY_BY_LEGISLATOR: LegislatorCryptoMoney[] = [
  {
    name: 'Bernie Moreno',
    amount: 40_000_000,
    detail: 'Defend American Jobs (a Fairshake affiliate) spent roughly $40M backing Moreno\'s 2024 Ohio Senate race against Sherrod Brown — among the largest crypto-industry bets of the cycle.',
    source_url: 'https://www.opensecrets.org/races/independent-expenditures?cycle=2024&id=OHS1',
  },
  {
    name: 'Ruben Gallego',
    amount: 10_000_000,
    detail: 'Protect Progress (Fairshake\'s Democratic-facing affiliate) spent over $10M supporting Gallego\'s 2024 Arizona Senate race.',
    source_url: 'https://www.opensecrets.org/political-action-committees-pacs/fairshake/C00835959/summary',
  },
];

export interface ScorecardRow {
  name: string;
  party: 'R' | 'D' | 'I';
  chamber: 'House' | 'Senate';
  state: string;
  votes: { bill: string; vote: string }[];
  crypto_money: number;
  money_detail?: string;
  money_source?: string;
  /** flagged = took crypto-industry money AND voted for every crypto bill they faced. */
  flagged: boolean;
}

/**
 * Builds the scorecard: every legislator with a recorded vote on a crypto bill,
 * cross-referenced against crypto-industry money supporting them.
 */
export function buildScorecard(): ScorecardRow[] {
  const cryptoBillIds = new Set(BILLS.filter((b) => b.policy_area === 'crypto').map((b) => b.bill_id));
  const billName = (id: string) => BILLS.find((b) => b.bill_id === id)?.short_name ?? id;
  const moneyOf = (name: string) => CRYPTO_MONEY_BY_LEGISLATOR.find((m) => m.name === name);

  const rows = new Map<string, ScorecardRow>();
  for (const vote of ROLL_CALL_VOTES) {
    if (!cryptoBillIds.has(vote.bill_id)) continue;
    for (const m of vote.members) {
      const existing = rows.get(m.name);
      const entry = existing ?? {
        name: m.name,
        party: m.party,
        chamber: m.chamber,
        state: m.state,
        votes: [],
        crypto_money: 0,
        flagged: false,
      };
      entry.votes.push({ bill: billName(vote.bill_id), vote: m.vote });
      rows.set(m.name, entry);
    }
  }

  for (const row of rows.values()) {
    const money = moneyOf(row.name);
    if (money) {
      row.crypto_money = money.amount;
      row.money_detail = money.detail;
      row.money_source = money.source_url;
    }
    const allYea = row.votes.length > 0 && row.votes.every((v) => v.vote === 'Yea');
    row.flagged = row.crypto_money > 0 && allYea;
  }

  // Sort: crypto-money recipients first (by amount), then the rest.
  return [...rows.values()].sort((a, b) => b.crypto_money - a.crypto_money);
}
