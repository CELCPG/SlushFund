// Entity slug map — the single source of truth for /entity/[slug] pages.
// One row per entity. Each entity declares how to find itself in the
// spending, trading, and influence databases.
//
// Keep this list curated and small (~15) for Phase 1. Add more as we
// get a chance to verify the data shape for each.

export type EntityKind = 'company' | 'person' | 'org';

export interface EntityConfig {
  /** URL slug. Stable. */
  slug: string;
  /** Display name */
  name: string;
  /** Kind of entity — affects what databases we hit and how we render */
  kind: EntityKind;
  /** Connection badge text (e.g. "Musk", "Trump Family", "Trump Ally") */
  connection: string;
  /** One-line description for the page header */
  blurb: string;
  /** Short paragraph for the page (1-2 sentences) */
  summary: string;
  /**
   * Spending DB lookup. Use this for company/politician contracts/grants.
   * For people/companies with a `connection_type` set in the awards table,
   * the API filters by that and then narrows by recipient_name pattern.
   */
  spending: {
    /** connection_type from awards.connection_type column */
    connectionType?: 'trump_family' | 'elon_musk' | 'trump_ally' | 'gop_donor' | 'mar-a-lago' | 'related_party';
    /** Names / substrings to match against awards.recipient_name */
    recipientPatterns: string[];
  };
  /**
   * Trading DB lookup. Companies are matched by ticker symbol; people
   * are matched by member_name on congress_trades.
   */
  trading: {
    /** Ticker symbol(s) for company lookups */
    tickers?: string[];
    /** Member name pattern (case-insensitive) for politician lookups */
    memberName?: string;
  };
  /**
   * Influence / PAC data lookup. Static file (src/lib/pac-data.ts) — match
   * by company name, source org, or donor name.
   */
  influence: {
    /** Names to match in pac-data.ts: source_org, affiliated_entities, etc. */
    namePatterns: string[];
  };
}

/**
 * Phase 1 entity list. Curated for high-traffic / high-profile lookups.
 * Each slug is permanent; do not rename without a 301.
 */
export const ENTITIES: EntityConfig[] = [
  {
    slug: 'spacex',
    name: 'SpaceX',
    kind: 'company',
    connection: 'Musk',
    blurb: 'Rocket launches, Starlink, and federal launch contracts.',
    summary: 'SpaceX holds federal contracts across launch services, Starlink military and civilian deployments, and DOD range support. Elon Musk sat as DOGE co-lead during the 2025-2026 contracting wave.',
    spending: {
      connectionType: 'elon_musk',
      recipientPatterns: ['SpaceX', 'Starlink', 'Space Exploration Technologies'],
    },
    trading: { tickers: ['SPACE', /* private */] },
    influence: { namePatterns: ['SpaceX', 'Starlink', 'Musk', 'xAI'] },
  },
  {
    slug: 'palantir',
    name: 'Palantir Technologies',
    kind: 'company',
    connection: 'Trump Ally',
    blurb: 'Data platforms for ICE, DOD, IRS. Federal AI work.',
    summary: 'Palantir has won sole-source and limited-competition contracts across DOD, ICE, IRS, and the intelligence community. Peter Thiel co-founded the company; its federal footprint expanded sharply under the second Trump administration.',
    spending: {
      connectionType: 'trump_ally',
      recipientPatterns: ['Palantir'],
    },
    trading: { tickers: ['PLTR'] },
    influence: { namePatterns: ['Palantir', 'Thiel'] },
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    kind: 'company',
    connection: 'Musk',
    blurb: 'Federal EV charging, GSA fleet, energy storage.',
    summary: 'Tesla holds federal contracts for EV charging infrastructure, GSA vehicle leases, and energy storage projects at military installations. The Musk DOGE role accelerated the conversion of GSA fleet orders.',
    spending: {
      connectionType: 'elon_musk',
      recipientPatterns: ['Tesla'],
    },
    trading: { tickers: ['TSLA'] },
    influence: { namePatterns: ['Tesla', 'Musk'] },
  },
  {
    slug: 'anduril',
    name: 'Anduril Industries',
    kind: 'company',
    connection: 'Trump Ally',
    blurb: 'Defense tech. Lattice, autonomous systems, counter-drone.',
    summary: 'Anduril builds AI-driven autonomous systems, counter-drone platforms, and the Lattice command-and-control product. It has expanded into programs that historically went to Lockheed, Northrop, and Raytheon.',
    spending: {
      connectionType: 'trump_ally',
      recipientPatterns: ['Anduril'],
    },
    trading: { /* private */ },
    influence: { namePatterns: ['Anduril'] },
  },
  {
    slug: 'oracle',
    name: 'Oracle',
    kind: 'company',
    connection: 'Trump Ally',
    blurb: 'Federal cloud, Cerner health IT, election systems.',
    summary: 'Oracle owns Cerner and the federal health IT contract. Its Cerner deployment at the VA has been a sustained cost overrun. Larry Ellison donated $250K+ to the 2025 inauguration and hosts conservative fundraisers.',
    spending: {
      connectionType: 'trump_ally',
      recipientPatterns: ['Oracle', 'Cerner'],
    },
    trading: { tickers: ['ORCL'] },
    influence: { namePatterns: ['Oracle', 'Ellison'] },
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    kind: 'company',
    connection: 'Trump Ally',
    blurb: 'Federal AI pilots, GSA chatbot, defense contracts.',
    summary: 'OpenAI has signed federal pilot agreements for AI assistants in civilian and defense contexts since 2024. Its partnership structure with Microsoft and the rise of competing xAI/DOGE contracts make it a key signal in the federal AI spending wave.',
    spending: {
      connectionType: 'trump_ally',
      recipientPatterns: ['OpenAI'],
    },
    trading: { /* private (parent: MSFT exposure) */ },
    influence: { namePatterns: ['OpenAI', 'Altman'] },
  },
  {
    slug: 'xai',
    name: 'xAI',
    kind: 'company',
    connection: 'Musk',
    blurb: 'Grok in federal AI compute. DOGE-aligned.',
    summary: 'xAI Corp received a DOGE-initiated federal AI compute contract in 2025. Federal awards are tagged elon_musk connection; xAI is one of the most direct examples of the DOGE-vendor pipeline.',
    spending: {
      connectionType: 'elon_musk',
      recipientPatterns: ['xAI'],
    },
    trading: { /* private */ },
    influence: { namePatterns: ['xAI', 'Musk'] },
  },
  {
    slug: 'trump-organization',
    name: 'Trump Organization',
    kind: 'org',
    connection: 'Trump Family',
    blurb: 'Federal leases, GSA properties, Old Post Office.',
    summary: 'The Trump Organization holds the Old Post Office lease in DC and other federal property arrangements. Direct awards are limited; the broader financial picture requires the OGE 278-T disclosure side.',
    spending: {
      connectionType: 'trump_family',
      recipientPatterns: ['Trump Organization', 'Trump', 'Trump Hotel', 'Trump Tower'],
    },
    trading: { /* 278-T covered separately */ },
    influence: { namePatterns: ['Trump', 'Trump Family'] },
  },
  {
    slug: 'donald-trump',
    name: 'Donald J. Trump',
    kind: 'person',
    connection: 'Trump Family',
    blurb: 'President. OGE 278-T filer. 3,700+ disclosed trades.',
    summary: 'President Trump\'s OGE 278-T disclosures show thousands of transactions across NVDA, PLTR, ORCL, COIN, and others. The disclosure window overlaps with executive decisions on chip exports, federal contracting, and Treasury policy.',
    spending: {
      connectionType: 'trump_family',
      recipientPatterns: [],
    },
    trading: { /* covered by /congress/trades/trump */ },
    influence: { namePatterns: ['Trump', 'Donald Trump'] },
  },
  {
    slug: 'elon-musk',
    name: 'Elon Musk',
    kind: 'person',
    connection: 'Musk',
    blurb: 'DOGE co-lead. SpaceX, Tesla, xAI, Boring, Neuralink.',
    summary: 'Elon Musk ran DOGE during the 2025-2026 contracting wave. His companies won sole-source and limited-competition awards during that window. He has divested from advisory positions but retains material ownership in the named entities.',
    spending: {
      connectionType: 'elon_musk',
      recipientPatterns: [],
    },
    trading: { tickers: ['TSLA'] },
    influence: { namePatterns: ['Musk', 'xAI', 'SpaceX'] },
  },
  {
    slug: 'kushner-affinity',
    name: 'Jared Kushner / Affinity Partners',
    kind: 'person',
    connection: 'Trump Family',
    blurb: 'Saudi-backed fund. Post-admin windfall.',
    summary: 'Jared Kushner\'s Affinity Partners received a $2B investment from the Saudi sovereign wealth fund shortly after leaving the White House. Affinity has been linked to deals with federal housing and infrastructure counterparts.',
    spending: {
      connectionType: 'trump_family',
      recipientPatterns: ['Affinity', 'Kushner'],
    },
    trading: { /* private */ },
    influence: { namePatterns: ['Kushner', 'Affinity'] },
  },
  {
    slug: 'nvda',
    name: 'NVIDIA',
    kind: 'company',
    connection: 'Publicly traded',
    blurb: 'GPU vendor. Federal AI compute. Top traded ticker.',
    summary: 'NVIDIA is the most-traded ticker in congressional disclosures and the primary federal AI compute vendor. Trump 278-T shows 9 NVDA buys overlapping with Beijing chip-export talks.',
    spending: {
      recipientPatterns: ['NVIDIA', 'Nvidia'],
    },
    trading: { tickers: ['NVDA'] },
    influence: { namePatterns: ['NVIDIA', 'Nvidia'] },
  },
  {
    slug: 'coin',
    name: 'Coinbase',
    kind: 'company',
    connection: 'Trump Ally',
    blurb: 'Crypto exchange. Won US Marshals custody.',
    summary: 'Coinbase was awarded the US Marshals Service crypto custody contract. The exchange and its executives have donated to pro-crypto PACs and inaugural events.',
    spending: {
      connectionType: 'trump_ally',
      recipientPatterns: ['Coinbase', 'COIN'],
    },
    trading: { tickers: ['COIN'] },
    influence: { namePatterns: ['Coinbase', 'Crypto'] },
  },
  {
    slug: 'koch-industries',
    name: 'Koch Industries',
    kind: 'company',
    connection: 'GOP Donor',
    blurb: 'Refining, chemicals, paper, defense subsidiaries.',
    summary: 'Koch Industries and the Koch network fund federal lobbying at scale. Its subsidiaries hold federal contracts in defense, refining, and chemicals. The Koch donor network supports both major parties\' corporate wings.',
    spending: {
      connectionType: 'gop_donor',
      recipientPatterns: ['Koch'],
    },
    trading: { tickers: ['KHC', 'KMI'] },
    influence: { namePatterns: ['Koch'] },
  },
  {
    slug: 'america-pac',
    name: 'America PAC',
    kind: 'org',
    connection: 'Musk',
    blurb: 'Musk-funded super PAC. Election operation.',
    summary: 'America PAC was the primary Musk-funded super PAC in the 2024 cycle. It ran voter turnout operations in swing states and is a key node in the Musk political money flow.',
    spending: {
      recipientPatterns: [],
    },
    trading: { /* not a publicly traded entity */ },
    influence: { namePatterns: ['America PAC', 'Musk'] },
  },
];

/** Lookup by slug. */
export function getEntityBySlug(slug: string): EntityConfig | undefined {
  return ENTITIES.find(e => e.slug === slug);
}

/** All entity slugs (for generateStaticParams). */
export function getAllEntitySlugs(): string[] {
  return ENTITIES.map(e => e.slug);
}

/** Resolve a ticker to the matching entity slug, if any. */
export function getEntitySlugByTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const t = ticker.toUpperCase();
  for (const e of ENTITIES) {
    if (e.trading.tickers?.some(tk => tk.toUpperCase() === t)) {
      return e.slug;
    }
  }
  return null;
}
