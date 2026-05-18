// Political entity database — maps known entities to connection types
// Sources: OpenSecrets, Wikipedia, news investigations, FEC filings

import { ENTITY_ENRICHMENT, type EntityEnrichment } from './political-entities-v2';
import { SOURCES, ENTITY_SOURCES } from './sources';

export type { EntityEnrichment };
export { ENTITY_ENRICHMENT };
export { SOURCES, ENTITY_SOURCES };

export interface PoliticalEntity {
  name: string;
  entity_type: 'person' | 'company' | 'org';
  connection_category: ConnectionCategory;
  aliases: string[];
  description: string;
  sources: string[];
}

export type ConnectionCategory =
  | 'trump_family'
  | 'elon_musk'
  | 'trump_ally'
  | 'mar-a-lago'
  | 'gop_donor'
  | 'lobbyist'
  | 'none';

export const CONNECTION_LABELS: Record<ConnectionCategory, string> = {
  trump_family: 'Trump Family',
  elon_musk: 'Elon Musk',
  trump_ally: 'Trump Ally / Donor',
  'mar-a-lago': 'Mar-a-Lago Adjacent',
  gop_donor: 'GOP Donor',
  lobbyist: 'Lobbyist / Consultant',
  none: 'No Known Connection',
};

// ─── The Database ─────────────────────────────────────────────────────────────
export const POLITICAL_ENTITIES: PoliticalEntity[] = [
  // ── Elon Musk ──────────────────────────────────────────────────────────────
  {
    name: 'SpaceX',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['Space Exploration Technologies', 'Space Exploration Technologies Corp', 'SpaceX Services'],
    description: 'Space Exploration Technologies Corp — Elon Musk CEO. Close Trump ally. DOGE co-lead.',
    sources: ['https://en.wikipedia.org/wiki/SpaceX', 'https://www.opensecrets.org'],
  },
  {
    name: 'Tesla',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['Tesla Inc', 'Tesla Government Services', 'Tesla Federal Solutions', 'Tesla Energy'],
    description: 'Tesla Inc — Elon Musk CEO. Federal EV contracts, charging infrastructure. DOGE co-lead.',
    sources: ['https://en.wikipedia.org/wiki/Tesla_(company)'],
  },
  {
    name: 'Starlink',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['Starlink Internet Services', 'SpaceX Starlink', 'Starlink Holdings'],
    description: 'Starlink (SpaceX subsidiary) — satellite internet for DOD, border, rural connectivity.',
    sources: ['https://en.wikipedia.org/wiki/Starlink'],
  },
  {
    name: 'xAI',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['xAI Holdings', 'xAI Corp', 'X AI'],
    description: 'xAI Corp — Elon Musk AI company. DOGE-initiated federal AI compute contracts.',
    sources: ['https://en.wikipedia.org/wiki/XAI_(company)'],
  },
  {
    name: 'The Boring Company',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['Boring Company', 'TBC'],
    description: 'Elon Musk tunnel construction company. Federal infrastructure contracts.',
    sources: ['https://en.wikipedia.org/wiki/The_Boring_Company'],
  },
  {
    name: 'Neuralink',
    entity_type: 'company',
    connection_category: 'elon_musk',
    aliases: ['Neuralink Corp'],
    description: 'Elon Musk brain-computer interface company. Federal research grants.',
    sources: ['https://en.wikipedia.org/wiki/Neuralink'],
  },
  {
    name: 'Elon Musk',
    entity_type: 'person',
    connection_category: 'elon_musk',
    aliases: ['Elon Reeve Musk', 'Musk Elon'],
    description: 'CEO of SpaceX, Tesla, xAI, Neuralink, The Boring Company. Trump DOGE co-lead.',
    sources: ['https://en.wikipedia.org/wiki/Elon_Musk'],
  },

  // ── Trump Family ─────────────────────────────────────────────────────────────
  {
    name: 'Trump Organization',
    entity_type: 'org',
    connection_category: 'trump_family',
    aliases: ['Trump Organization Inc', 'The Trump Organization', 'DJT Holdings'],
    description: 'The Trump Organization — Donald J. Trump\'s umbrella entity. Directly connected to federal contracts via Eric Trump.',
    sources: ['https://en.wikipedia.org/wiki/Trump_Organization'],
  },
  {
    name: 'Eric Trump',
    entity_type: 'person',
    connection_category: 'trump_family',
    aliases: ['Eric Trump Organization', 'Eric Trump Wine'],
    description: 'Trump son, runs Trump Organization day-to-day. Wine-related federal hospitality contracts.',
    sources: ['https://en.wikipedia.org/wiki/Eric_Trump'],
  },
  {
    name: 'Donald Trump Jr',
    entity_type: 'person',
    connection_category: 'trump_family',
    aliases: ['Don Trump Jr', 'Donald John Trump Jr', 'Trump Jr'],
    description: 'Trump\'s eldest son, Trump Organization executive.',
    sources: ['https://en.wikipedia.org/wiki/Donald_Trump_Jr.'],
  },
  {
    name: 'Trump Winery',
    entity_type: 'company',
    connection_category: 'trump_family',
    aliases: ['Eric Trump Wine', 'Trump Vineyard', 'Trump Vineyards'],
    description: 'Virginia winery owned by Eric Trump. Federal hospitality/wine procurement contracts.',
    sources: ['https://en.wikipedia.org/wiki/Trump_Winery'],
  },
  {
    name: 'Trump Hotels',
    entity_type: 'company',
    connection_category: 'trump_family',
    aliases: ['Trump Hotel Collection', 'Trump International Hotels'],
    description: 'Trump hotel brand. Secret Service spending at Trump properties while in office.',
    sources: ['https://en.wikipedia.org/wiki/Trump_Hotels'],
  },
  {
    name: 'Donald J Trump',
    entity_type: 'person',
    connection_category: 'trump_family',
    aliases: ['Donald Trump', 'President Trump', 'DJT'],
    description: '45th and 47th President. Trump Organization founder.',
    sources: ['https://en.wikipedia.org/wiki/Donald_Trump'],
  },

  // ── Trump Allies / Donors ────────────────────────────────────────────────────
  {
    name: 'Palantir Technologies',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Palantir', 'Palantir Systems', 'Palantir Technologies Inc'],
    description: 'Peter Thiel co-founded. ICE data platform contracts. Major Trump donor.',
    sources: ['https://en.wikipedia.org/wiki/Palantir_Technologies', 'https://www.opensecrets.org'],
  },
  {
    name: 'Anduril Industries',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Anduril', 'Anduril Defense', 'Anduril Systems'],
    description: 'Defense tech company backed by Peter Thiel. VC funding from Thiel Founders Fund. Trump-aligned.',
    sources: ['https://en.wikipedia.org/wiki/Anduril_(company)'],
  },
  {
    name: 'Peter Thiel',
    entity_type: 'person',
    connection_category: 'trump_ally',
    aliases: ['Peter Thiel', 'Thiel Peter', 'Peter Thiel Founders Fund'],
    description: 'PayPal co-founder, Palantir co-founder, early Trump supporter. Major donor.',
    sources: ['https://en.wikipedia.org/wiki/Peter_Thiel'],
  },
  {
    name: 'OpenAI',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['OpenAI LP', 'OpenAI Government', 'Open AI'],
    description: 'Sam Altman is Trump donor and Mar-a-Lago attendee. Federal AI contracts.',
    sources: ['https://en.wikipedia.org/wiki/OpenAI'],
  },
  {
    name: 'Sam Altman',
    entity_type: 'person',
    connection_category: 'trump_ally',
    aliases: ['Samuel Altman', 'Sam H. Altman'],
    description: 'OpenAI CEO. Attended Mar-a-Lago. Trump donor. Federal AI contract recipient.',
    sources: ['https://en.wikipedia.org/wiki/Sam_Altman'],
  },
  {
    name: 'Sequoia Capital',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Sequoia', 'Sequoia Capital LP'],
    description: 'VC firm with heavy Trump tech ally investments (Anduril, more).',
    sources: ['https://en.wikipedia.org/wiki/Sequoia_Capital'],
  },
  {
    name: 'Andreessen Horowitz',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['a16z', 'Andreessen Horowitz VC'],
    description: 'VC firm with Trump-aligned crypto/doge connections.',
    sources: ['https://en.wikipedia.org/wiki/Andreessen_Horowitz'],
  },
  {
    name: 'Oracle',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Oracle Corporation', 'Oracle Cloud', 'Oracle Systems'],
    description: 'Larry Ellison — major Trump donor. Oracle federal cloud/Tech contracts.',
    sources: ['https://en.wikipedia.org/wiki/Oracle_Corporation'],
  },
  {
    name: 'Larry Ellison',
    entity_type: 'person',
    connection_category: 'trump_ally',
    aliases: ['Lawrence Ellison', 'Larry J. Ellison'],
    description: 'Oracle co-founder. Held fundraiser for Trump. Federal Oracle contracts.',
    sources: ['https://en.wikipedia.org/wiki/Larry_Ellison'],
  },
  {
    name: 'Amazon',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Amazon Web Services', 'AWS', 'Amazon.com Inc'],
    description: 'AWS — major federal cloud contracts. Donated $1M to Trump inaugural.',
    sources: ['https://en.wikipedia.org/wiki/Amazon_(company)'],
  },
  {
    name: 'Microsoft',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Microsoft Corporation', 'MSFT'],
    description: 'Federal software/AI contracts. Significant lobbying.',
    sources: ['https://en.wikipedia.org/wiki/Microsoft'],
  },
  {
    name: 'Google',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Alphabet Inc', 'Alphabet', 'Google LLC'],
    description: 'Federal AI/cloud/workspace contracts. Donated to Trump inaugural.',
    sources: ['https://en.wikipedia.org/wiki/Google'],
  },
  {
    name: 'Meta Platforms',
    entity_type: 'company',
    connection_category: 'trump_ally',
    aliases: ['Meta', 'Facebook', 'Meta Inc'],
    description: 'Mark Zuckerberg Trump donor. Federal advertising/AI contracts.',
    sources: ['https://en.wikipedia.org/wiki/Meta_Platforms'],
  },
  {
    name: 'Mark Zuckerberg',
    entity_type: 'person',
    connection_category: 'trump_ally',
    aliases: ['Mark Elliot Zuckerberg'],
    description: 'Meta CEO. Federal contracts, Trump donor.',
    sources: ['https://en.wikipedia.org/wiki/Mark_Zuckerberg'],
  },
  {
    name: 'DOGE',
    entity_type: 'org',
    connection_category: 'trump_ally',
    aliases: ['Dept of Government Efficiency', 'Dogecoin'],
    description: 'Trump advisory body co-led by Elon Musk. Initiates federal contracts.',
    sources: ['https://en.wikipedia.org/wiki/Department_of_Government_Efficiency'],
  },
  {
    name: 'OpenSecrets',
    entity_type: 'org',
    connection_category: 'none',
    aliases: ['OpenSecrets.org', 'CRP'],
    description: 'Nonpartisan tracker of money in politics.',
    sources: [],
  },

  // ── Mar-a-Lago Adjacent ─────────────────────────────────────────────────────
  {
    name: 'MAGA Inc',
    entity_type: 'org',
    connection_category: 'mar-a-lago',
    aliases: ['MAGA', 'Make America Great Again Inc'],
    description: 'Trump-aligned Super PAC.',
    sources: [],
  },
  {
    name: 'America PAC',
    entity_type: 'org',
    connection_category: 'mar-a-lago',
    aliases: ['America PAC', 'America First PAC'],
    description: 'Trump-aligned political action committee.',
    sources: [],
  },

  // ── Lobbyists / Consultants ─────────────────────────────────────────────────
  {
    name: 'Brownstein Hyatt Farber Schreck',
    entity_type: 'company',
    connection_category: 'lobbyist',
    aliases: ['Brownstein', 'BHFS'],
    description: 'K Street lobbying firm with Trump admin connections. Federal contracts.',
    sources: ['https://en.wikipedia.org/wiki/Brownstein_Hyatt_Farber_Schreck'],
  },
  {
    name: 'Koch Industries',
    entity_type: 'company',
    connection_category: 'gop_donor',
    aliases: ['Koch Industries Inc', 'Koch'],
    description: 'Conservative mega-donor network. Federal contracts.',
    sources: ['https://en.wikipedia.org/wiki/Koch_Industries'],
  },
];

// ─── Lookup Engine ────────────────────────────────────────────────────────────
export function detectEntity(vendorName: string): PoliticalEntity | undefined {
  const lower = vendorName.toLowerCase().trim();

  // Direct match first
  for (const entity of POLITICAL_ENTITIES) {
    if (lower === entity.name.toLowerCase()) return entity;
  }

  // Alias match
  for (const entity of POLITICAL_ENTITIES) {
    for (const alias of entity.aliases) {
      if (lower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lower)) {
        return entity;
      }
    }
  }

  // Substring match for common variants
  for (const entity of POLITICAL_ENTITIES) {
    const entityLower = entity.name.toLowerCase();
    if (lower.includes(entityLower) || entityLower.includes(lower)) {
      return entity;
    }
  }

  return undefined;
}

export function getConnectionInfo(vendorName: string): {
  connection_type: ConnectionCategory;
  political_connection: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const entity = detectEntity(vendorName);

  if (!entity) {
    return { connection_type: 'none', political_connection: '', confidence: 'low' };
  }

  return {
    connection_type: entity.connection_category,
    political_connection: entity.description,
    confidence: 'high',
  };
}

// Connection strength multiplier for risk scoring
export function connectionMultiplier(cat: ConnectionCategory): number {
  switch (cat) {
    case 'trump_family': return 1.0;
    case 'elon_musk': return 0.95;
    case 'trump_ally': return 0.7;
    case 'mar-a-lago': return 0.6;
    case 'gop_donor': return 0.5;
    case 'lobbyist': return 0.4;
    case 'none': return 0;
    default: return 0;
  }
}

// ─── Enrichment lookup ────────────────────────────────────────────────────────
export function getEnrichment(entityName: string): EntityEnrichment | null {
  const lower = entityName.toLowerCase().trim();

  // Try direct name match first
  for (const [key, enrichment] of Object.entries(ENTITY_ENRICHMENT)) {
    if (key.toLowerCase() === lower) return enrichment;
  }


  // Try alias match
  for (const [key, enrichment] of Object.entries(ENTITY_ENRICHMENT)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return enrichment;
    }
    for (const alias of enrichment.aliases) {
      if (lower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lower)) {
        return enrichment;
      }
    }
  }

  // Try matching against POLITICAL_ENTITIES aliases too
  for (const entity of POLITICAL_ENTITIES) {
    if (lower === entity.name.toLowerCase() || entity.aliases.some(a => lower === a.toLowerCase())) {
      return ENTITY_ENRICHMENT[entity.name] ?? null;
    }
  }

  return null;
}

// ─── Convenience: all enrichment data for display ─────────────────────────────
export function getEntityEnrichmentSummary() {
  return Object.values(ENTITY_ENRICHMENT).map(e => ({
    name: e.entity_name,
    category: e.connection_category,
    fecTotal: e.total_fec_contributions,
    lobbyTotal: e.total_lobbying_spend,
    fecSources: e.fec_source_urls,
    opensecretsUrl: e.opensecrets_url,
    wikipediaUrl: e.wikipedia_url,
    news: e.news_investigations,
    darkMoney: e.dark_money_connection,
    dogeRole: e.doge_role,
    marALagoVisits: e.mar_a_lago_visits,
    inaugurationHost: e.inauguration_host,
  }));
}