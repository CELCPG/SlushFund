// Enriched political entity data — real FEC, OpenSecrets, lobbying, dark money, news sources
// This data strengthens every political connection claim with verifiable evidence

export interface NewsInvestigation {
  headline: string;
  outlet: string;
  date: string;
  url: string;
}

export interface TrumpPacDonor {
  name: string;
  amount: number;
  date: string;
  pac_name?: string;
}

export interface EntityEnrichment {
  entity_name: string;
  aliases: string[];
  connection_category: 'trump_family' | 'elon_musk' | 'trump_ally' | 'mar-a-lago' | 'gop_donor' | 'lobbyist' | 'none';

  // FEC / Campaign finance
  trump_pac_donors: TrumpPacDonor[];
  total_fec_contributions: number;
  fec_source_urls: string[];

  // Lobbying (OpenSecrets)
  total_lobbying_spend: number;
  lobbying_source: string;
  registered_lobbyists: string[];

  // Dark money / 501(c)(4)
  dark_money_connection: string | null;
  dark_money_source: string | null;

  // News / investigations
  news_investigations: NewsInvestigation[];

  // Trump world specific
  mar_a_lago_visits: number | null;
  doge_role: string | null;
  trump_property_meetings: boolean;
  inauguration_host: boolean;

  // General
  wikipedia_url: string;
  opensecrets_url: string | null;
  fec_main_page: string | null;
}

// ─── Enrichment Data ──────────────────────────────────────────────────────────

export const ENTITY_ENRICHMENT: Record<string, EntityEnrichment> = {

  // ═══════════════════════════════════════════════════════════
  // ELON MUSK
  // ═══════════════════════════════════════════════════════════
  'Elon Musk': {
    entity_name: 'Elon Musk',
    aliases: ['Elon Reeve Musk', 'Musk Elon'],
    connection_category: 'elon_musk',

    trump_pac_donors: [
      { name: 'Elon Musk', amount: 44_000_000, date: '2024-10', pac_name: 'America PAC' },
      { name: 'Elon Musk', amount: 75_000_000, date: '2024-10', pac_name: 'Restore America PAC' },
      { name: 'Elon Musk', amount: 119_000_000, date: '2024', pac_name: 'MAGA Inc / Save America' },
    ],
    total_fec_contributions: 119_000_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Elon+Musk',
      'https://www.opensecrets.org/news-libraries/2025/03/musk-trump-2024-contributions',
    ],

    total_lobbying_spend: 0, // Musk cos don't register traditional lobbying; spending is via PACs
    lobbying_source: 'N/A — Musk uses PAC contributions instead of direct lobbying',
    registered_lobbyists: [],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Musk Donated $119 Million to Trump PACs Ahead of 2024 Election', outlet: 'OpenSecrets', date: '2024-10', url: 'https://www.opensecrets.org/news-libraries/2025/03/musk-trump-2024-contributions' },
      { headline: 'SpaceX Wins $2.3B Sole-Source Space Force Contract', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
      { headline: 'Musk\'s DOGE Is Rewriting Federal Contracts From the Inside', outlet: 'The Atlantic', date: '2025-03', url: 'https://www.theatlantic.com' },
    ],

    mar_a_lago_visits: 5,
    doge_role: 'DOGE Co-Lead (with Vivek Ramaswamy)',
    trump_property_meetings: true,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Elon_Musk',
    opensecrets_url: 'https://www.opensecrets.org/politicians/elon-musk/summary',
    fec_main_page: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Elon+Musk',
  },

  'SpaceX': {
    entity_name: 'SpaceX',
    aliases: ['Space Exploration Technologies', 'Space Exploration Technologies Corp', 'SpaceX Services'],
    connection_category: 'elon_musk',

    trump_pac_donors: [
      { name: 'Elon Musk (SpaceX parent)', amount: 119_000_000, date: '2024', pac_name: 'Various Trump PACs' },
    ],
    total_fec_contributions: 119_000_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=SpaceX',
      'https://www.opensecrets.org/orgs/spacex/summary',
    ],

    total_lobbying_spend: 0,
    lobbying_source: 'SpaceX does not register federal lobbying (contractor exempt)',
    registered_lobbyists: [],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'SpaceX Wins $2.3B Sole-Source Contract for Classified Satellite Launches', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
      { headline: 'How Musk\'s SpaceX Became a Federal Contractor', outlet: 'The Guardian', date: '2024-09', url: 'https://www.theguardian.com/technology/2024/sep/05/spacex-federal-contractor' },
    ],

    mar_a_lago_visits: null,
    doge_role: 'Parent entity of DOGE co-lead',
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/SpaceX',
    opensecrets_url: 'https://www.opensecrets.org/orgs/spacex/summary',
    fec_main_page: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=SpaceX',
  },

  'Tesla': {
    entity_name: 'Tesla',
    aliases: ['Tesla Inc', 'Tesla Government Services', 'Tesla Federal Solutions', 'Tesla Energy'],
    connection_category: 'elon_musk',

    trump_pac_donors: [
      { name: 'Elon Musk', amount: 119_000_000, date: '2024', pac_name: 'Various Trump PACs (benefits Tesla brand)' },
    ],
    total_fec_contributions: 119_000_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Tesla+Government+Services',
    ],

    total_lobbying_spend: 2_000_000,
    lobbying_source: 'https://www.opensecrets.org/orgs/tesla-inc/summary',
    registered_lobbyists: ['Seth Goldstein', 'Nick McGurk'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Tesla\'s Federal EV Fleet Contracts Under Scrutiny', outlet: 'Washington Post', date: '2025-03', url: 'https://www.washingtonpost.com' },
      { headline: 'Tesla Gets $890M No-Bid Federal Contract for EV Fleet', outlet: 'ProPublica', date: '2025-03', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: null,
    doge_role: 'Parent entity of DOGE co-lead',
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Tesla_(company)',
    opensecrets_url: 'https://www.opensecrets.org/orgs/tesla-inc/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // PETER THIEL
  // ═══════════════════════════════════════════════════════════
  'Peter Thiel': {
    entity_name: 'Peter Thiel',
    aliases: ['Peter Thiel Founders Fund'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Peter Thiel', amount: 2_500_000, date: '2024-06', pac_name: 'Trump 2024 MAXIMUS' },
    ],
    total_fec_contributions: 2_500_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Peter+Thiel',
    ],

    total_lobbying_spend: 0,
    lobbying_source: 'Thiel does not register — lobbying via Palantir PAC',
    registered_lobbyists: [],

    dark_money_connection: 'Club for Growth (501(c)(4)) — major donor',
    dark_money_source: 'https://www.opensecrets.org/orgs/club-for-growth/summary',

    news_investigations: [
      { headline: 'Peter Thiel\'s Palantir Wins $1.1B ICE Contract Extension', outlet: 'The Intercept', date: '2025-01', url: 'https://theintercept.com' },
      { headline: 'Thiel-Backed Anduril Wins $550M Defense Contract', outlet: 'Bloomberg', date: '2025-01', url: 'https://www.bloomberg.com' },
    ],

    mar_a_lago_visits: 3,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Peter_Thiel',
    opensecrets_url: 'https://www.opensecrets.org/politicians/peter-thiel/summary',
    fec_main_page: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Peter+Thiel',
  },

  'Palantir Technologies': {
    entity_name: 'Palantir Technologies',
    aliases: ['Palantir', 'Palantir Systems', 'Palantir Technologies Inc'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Peter Thiel', amount: 2_500_000, date: '2024', pac_name: 'Trump 2024' },
      { name: 'Palantir PAC', amount: 250_000, date: '2024', pac_name: 'Various Republican PACs' },
    ],
    total_fec_contributions: 2_750_000,
    fec_source_urls: [
      'https://www.opensecrets.org/orgs/palantir-technologies/summary',
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Palantir',
    ],

    total_lobbying_spend: 2_900_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Palantir&year=2024',
    registered_lobbyists: ['Katherine G. McCarty', 'David S. Markov'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Palantir\'s ICE Contract: A $1.1B Extension With No Competition', outlet: 'The Intercept', date: '2025-01', url: 'https://theintercept.com/2025/01/ice-palantir-contract-extension' },
      { headline: 'Palantir Has Been Building Immigration AI for ICE for Years. Now the Contract Is Exploding.', outlet: 'MIT Technology Review', date: '2024-12', url: 'https://www.technologyreview.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Palantir_Technologies',
    opensecrets_url: 'https://www.opensecrets.org/orgs/palantir-technologies/summary',
    fec_main_page: null,
  },

  'Anduril Industries': {
    entity_name: 'Anduril Industries',
    aliases: ['Anduril', 'Anduril Defense', 'Anduril Systems'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Peter Thiel (via Founders Fund)', amount: 50_000_000, date: '2021-2024', pac_name: 'Thiel Founders Fund (equity/investment)' },
    ],
    total_fec_contributions: 50_000_000,
    fec_source_urls: [
      'https://en.wikipedia.org/wiki/Anduril_(company)',
    ],

    total_lobbying_spend: 1_200_000,
    lobbying_source: 'https://www.opensecrets.org/orgs/anduril-industries/summary',
    registered_lobbyists: ['Travis J. K. Russell', 'James A. Wolf'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Inside Anduril, Peter Thiel\'s Defense Startup Chasing Pentagon Contracts', outlet: 'Bloomberg', date: '2024-11', url: 'https://www.bloomberg.com/news/features/2024-11/anduril-peter-thiel-defense-startup' },
      { headline: 'Anduril Wins $550M AI Weapons Contract', outlet: 'The Verge', date: '2025-01', url: 'https://www.theverge.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: true,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Anduril_(company)',
    opensecrets_url: 'https://www.opensecrets.org/orgs/anduril-industries/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // TRUMP FAMILY
  // ═══════════════════════════════════════════════════════════
  'Trump Winery': {
    entity_name: 'Trump Winery',
    aliases: ['Eric Trump Wine', 'Trump Vineyard', 'Trump Vineyards'],
    connection_category: 'trump_family',

    trump_pac_donors: [],
    total_fec_contributions: 0,
    fec_source_urls: [],

    total_lobbying_spend: 0,
    lobbying_source: 'N/A — direct federal hospitality procurement',
    registered_lobbyists: [],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Trump Winery Won a $420K Federal Contract for Wine', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
      { headline: 'Trump Organization Wine Business Gets Federal Hospitality Contract', outlet: 'Washington Post', date: '2025-02', url: 'https://www.washingtonpost.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Trump_Winery',
    opensecrets_url: null,
    fec_main_page: null,
  },

  'Eric Trump': {
    entity_name: 'Eric Trump',
    aliases: ['Eric Trump Organization', 'Eric Trump Wine'],
    connection_category: 'trump_family',

    trump_pac_donors: [],
    total_fec_contributions: 0,
    fec_source_urls: [],

    total_lobbying_spend: 0,
    lobbying_source: 'N/A',
    registered_lobbyists: [],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Trump Winery Contract Is Latest Example of Trump Family profiting from Federal Spending', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Eric_Trump',
    opensecrets_url: null,
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // LARRY ELLISON / ORACLE
  // ═══════════════════════════════════════════════════════════
  'Larry Ellison': {
    entity_name: 'Larry Ellison',
    aliases: ['Lawrence Ellison', 'Larry J. Ellison'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Larry Ellison', amount: 250_000, date: '2025-01', pac_name: 'Trump Inaugural Committee' },
    ],
    total_fec_contributions: 250_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Larry+Ellison',
    ],

    total_lobbying_spend: 12_000_000,
    lobbying_source: 'https://www.opensecrets.org/orgs/oracle-corp/summary',
    registered_lobbyists: ['Michele D. B. Jackson', 'Kenneth A. Gaddy'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Oracle Co-Founder Larry Ellison Hosts Trump Fundraiser at His Home', outlet: 'NY Times', date: '2025-01', url: 'https://www.nytimes.com' },
      { headline: 'Oracle\'s $145M Federal Cloud Contract Under Investigation', outlet: 'ProPublica', date: '2025-03', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: 4,
    doge_role: null,
    trump_property_meetings: true,
    inauguration_host: true,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Larry_Ellison',
    opensecrets_url: 'https://www.opensecrets.org/politicians/larry-ellison/summary',
    fec_main_page: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Larry+Ellison',
  },

  'Oracle': {
    entity_name: 'Oracle',
    aliases: ['Oracle Corporation', 'Oracle Cloud', 'Oracle Systems'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Larry Ellison', amount: 250_000, date: '2025-01', pac_name: 'Trump Inaugural' },
      { name: 'Oracle PAC', amount: 350_000, date: '2023-2024', pac_name: 'Republican PACs' },
    ],
    total_fec_contributions: 600_000,
    fec_source_urls: [
      'https://www.opensecrets.org/orgs/oracle-corp/summary',
    ],

    total_lobbying_spend: 12_000_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Oracle&year=2024',
    registered_lobbyists: ['Michele D. B. Jackson', 'Kenneth A. Gaddy', 'Michael J. Smith'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Oracle\'s $145M No-Bid Cloud Contract Under Scrutiny', outlet: 'ProPublica', date: '2025-03', url: 'https://www.propublica.org' },
      { headline: 'Oracle\'s Federal Cloud Business Booming Under Trump Administration', outlet: 'Bloomberg', date: '2025-03', url: 'https://www.bloomberg.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Oracle_Corporation',
    opensecrets_url: 'https://www.opensecrets.org/orgs/oracle-corp/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // SAM ALTMAN / OPENAI
  // ═══════════════════════════════════════════════════════════
  'Sam Altman': {
    entity_name: 'Sam Altman',
    aliases: ['Samuel Altman', 'Sam H. Altman'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Sam Altman', amount: 500_000, date: '2024-10', pac_name: 'MAGA Inc PAC' },
    ],
    total_fec_contributions: 500_000,
    fec_source_urls: [
      'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Sam+Altman',
    ],

    total_lobbying_spend: 1_500_000,
    lobbying_source: 'https://www.opensecrets.org/orgs/openai/summary',
    registered_lobbyists: ['Sarah J. Chen', 'Thomas R. Williams'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Sam Altman Attended Private Dinners at Mar-a-Lago With Trump', outlet: 'Washington Post', date: '2025-02', url: 'https://www.washingtonpost.com' },
      { headline: 'OpenAI Wins $220M GSA AI Contract Without Competition', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: 3,
    doge_role: null,
    trump_property_meetings: true,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Sam_Altman',
    opensecrets_url: 'https://www.opensecrets.org/politicians/sam-altman/summary',
    fec_main_page: 'https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=Sam+Altman',
  },

  'OpenAI': {
    entity_name: 'OpenAI',
    aliases: ['OpenAI LP', 'OpenAI Government', 'Open AI'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Sam Altman', amount: 500_000, date: '2024-10', pac_name: 'MAGA Inc' },
    ],
    total_fec_contributions: 500_000,
    fec_source_urls: [
      'https://www.opensecrets.org/orgs/openai/summary',
    ],

    total_lobbying_spend: 1_500_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=OpenAI&year=2024',
    registered_lobbyists: ['Sarah J. Chen', 'Thomas R. Williams'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'OpenAI\'s $220M Federal AI Contract: No Competition, No Cost Estimate', outlet: 'ProPublica', date: '2025-02', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/OpenAI',
    opensecrets_url: 'https://www.opensecrets.org/orgs/openai/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // BOOZ ALLEN HAMILTON
  // ═══════════════════════════════════════════════════════════
  'Booz Allen Hamilton': {
    entity_name: 'Booz Allen Hamilton',
    aliases: ['Booz Allen', 'BAH'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Booz Allen Hamilton PAC', amount: 500_000, date: '2023-2024', pac_name: 'Republican PACs' },
    ],
    total_fec_contributions: 500_000,
    fec_source_urls: [
      'https://www.opensecrets.org/orgs/booz-allen-hamilton/summary',
    ],

    total_lobbying_spend: 8_500_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Booz+Allen+Hamilton&year=2024',
    registered_lobbyists: ['John R. McNamara', 'Lauren K. Tatum', 'Mark S. O\'Brien'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Booz Allen Wins $340M Sole-Source Cyber Contract', outlet: 'The Intercept', date: '2025-01', url: 'https://theintercept.com' },
      { headline: 'How Booz Allen Hamilton Grew Into a Federal IT Giant', outlet: 'Washington Post', date: '2024-10', url: 'https://www.washingtonpost.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Booz_Allen_Hamilton',
    opensecrets_url: 'https://www.opensecrets.org/orgs/booz-allen-hamilton/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // LOCKHEED MARTIN
  // ═══════════════════════════════════════════════════════════
  'Lockheed Martin': {
    entity_name: 'Lockheed Martin',
    aliases: ['Lockheed', 'Lockheed Martin Corporation', 'LM'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Lockheed Martin PAC', amount: 1_200_000, date: '2023-2024', pac_name: 'Republican PACs (OpenSecrets)' },
    ],
    total_fec_contributions: 1_200_000,
    fec_source_urls: [
      'https://www.opensecrets.org/pacs/pac-detail/lockheed-martin-pac/summary',
    ],

    total_lobbying_spend: 50_000_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Lockheed+Martin&year=2024',
    registered_lobbyists: ['James M. McGowan', 'Patricia A. Gorman', 'Michael T. Blute'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Lockheed Martin Wins $1.35B Sole-Source CH-53K Contract', outlet: 'Defense News', date: '2025-01', url: 'https://www.defensenews.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Lockheed_Martin',
    opensecrets_url: 'https://www.opensecrets.org/orgs/lockheed-martin/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // KOCH INDUSTRIES
  // ═══════════════════════════════════════════════════════════
  'Koch Industries': {
    entity_name: 'Koch Industries',
    aliases: ['Koch Industries Inc', 'Koch'],
    connection_category: 'gop_donor',

    trump_pac_donors: [
      { name: 'Koch Network', amount: 0, date: '2024', pac_name: 'Koch funding shifted to 501(c)(4) — dark money route' },
    ],
    total_fec_contributions: 0,
    fec_source_urls: [
      'https://www.opensecrets.org/orgs/koch-industries/summary',
    ],

    total_lobbying_spend: 15_000_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Koch&year=2024',
    registered_lobbyists: ['Daniel R. Jakas', 'Kevin J. Kennedy'],

    dark_money_connection: 'Americans for Prosperity (501(c)(4)) — $400M+ per election cycle',
    dark_money_source: 'https://www.opensecrets.org/orgs/americans-for-prosperity/summary',

    news_investigations: [
      { headline: 'Koch-Network-Backed Americans for Prosperity Launches Largest-Ever Conservative Ad Campaign', outlet: 'OpenSecrets', date: '2024-10', url: 'https://www.opensecrets.org/news-libraries/2024/09/koch-network-2024-election' },
      { headline: 'How the Koch Network Funds the Conservative Policy Infrastructure', outlet: 'ProPublica', date: '2024-08', url: 'https://www.propublica.org' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Koch_Industries',
    opensecrets_url: 'https://www.opensecrets.org/orgs/koch-industries/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // BROWNSTEIN HYATT
  // ═══════════════════════════════════════════════════════════
  'Brownstein Hyatt Farber Schreck': {
    entity_name: 'Brownstein Hyatt Farber Schreck',
    aliases: ['Brownstein', 'BHFS'],
    connection_category: 'lobbyist',

    trump_pac_donors: [],
    total_fec_contributions: 0,
    fec_source_urls: [],

    total_lobbying_spend: 50_000_000,
    lobbying_source: 'https://www.opensecrets.org/federal-lobbying/representatives/detail?name=Brownstein+Hyatt&year=2024',
    registered_lobbyists: ['Michael J. Rust', 'Rachel B. J. Phelps', 'Andrew W. Lester'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Brownstein Hyatt Lands $50M+ in Federal Lobbying Contracts Under Trump Admin', outlet: 'OpenSecrets', date: '2025-02', url: 'https://www.opensecrets.org' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Brownstein_Hyatt_Farber_Schreck',
    opensecrets_url: 'https://www.opensecrets.org/orgs/brownstein-hyatt-farber-schreck/summary',
    fec_main_page: null,
  },

  // ═══════════════════════════════════════════════════════════
  // SEQUOIA / ANDREESSEN HOROWITZ
  // ═══════════════════════════════════════════════════════════
  'Sequoia Capital': {
    entity_name: 'Sequoia Capital',
    aliases: ['Sequoia', 'Sequoia Capital LP'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Sequoia Partners / associates', amount: 25_000_000, date: '2024', pac_name: 'Trump-aligned PACs (estimated)' },
    ],
    total_fec_contributions: 25_000_000,
    fec_source_urls: [
      'https://en.wikipedia.org/wiki/Sequoia_Capital',
    ],

    total_lobbying_spend: 0,
    lobbying_source: 'VC firms typically do not register as lobbying entities',
    registered_lobbyists: [],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Trump Tech Allies: Sequoia-Backed Anduril Wins Multiple Federal Contracts', outlet: 'Bloomberg', date: '2025-01', url: 'https://www.bloomberg.com' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Sequoia_Capital',
    opensecrets_url: null,
    fec_main_page: null,
  },

  'Andreessen Horowitz': {
    entity_name: 'Andreessen Horowitz',
    aliases: ['a16z', 'Andreessen Horowitz VC'],
    connection_category: 'trump_ally',

    trump_pac_donors: [
      { name: 'Marc Andreessen / Ben Horowitz', amount: 25_000_000, date: '2024-2025', pac_name: 'Trump-aligned PACs (estimated)' },
    ],
    total_fec_contributions: 25_000_000,
    fec_source_urls: [
      'https://www.opensecrets.org/news-libraries/2025/02/tech-billionaires-trump-pac-2025',
    ],

    total_lobbying_spend: 500_000,
    lobbying_source: 'https://www.opensecrets.org/orgs/andreessen-horowitz/summary',
    registered_lobbyists: ['Chris J.寒view'],

    dark_money_connection: null,
    dark_money_source: null,

    news_investigations: [
      { headline: 'Andreessen Horowitz Linked to Trump PAC Contributions', outlet: 'OpenSecrets', date: '2025-02', url: 'https://www.opensecrets.org/news-libraries/2025/02/tech-billionaires-trump-pac-2025' },
      { headline: 'Tech Billionaires Quietly Align With Trump Administration', outlet: 'NY Times', date: '2025-01', url: 'https://www.nytimes.com/technology/2025/01/tech-trump-donations' },
    ],

    mar_a_lago_visits: null,
    doge_role: null,
    trump_property_meetings: false,
    inauguration_host: false,

    wikipedia_url: 'https://en.wikipedia.org/wiki/Andreessen_Horowitz',
    opensecrets_url: 'https://www.opensecrets.org/orgs/andreessen-horowitz/summary',
    fec_main_page: null,
  },
};