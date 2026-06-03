/**
 * Connection Map — used by sync-awards.ts to match award recipients
 * against known political connections (Trump allies, DOGE, Mar-a-Lago, etc.)
 * Extracted from seed.ts entities.
 */

export interface ConnectionEntry {
  connection_type: string;
  description: string;
  confidence: string;
  aliases: string[];
  sources: string[];
}

export const CONNECTION_MAP: Record<string, ConnectionEntry> = {
  // ── Elon Musk / DOGE ────────────────────────────────────────────────────────
  'SpaceX': {
    connection_type: 'elon_musk',
    description: 'Elon Musk — DOGE co-lead, close Trump ally. SpaceX is primary beneficiary of DOGE-era federal contracts.',
    confidence: 'high',
    aliases: ['Space Exploration Technologies', 'Spacex', 'Starlink Internet Services', 'SpaceX Starlink'],
    sources: ['https://en.wikipedia.org/wiki/Elon_Musk'],
  },
  'Tesla': {
    connection_type: 'elon_musk',
    description: 'Elon Musk — DOGE co-lead, Tesla CEO. Tesla is federal EV fleet contractor.',
    confidence: 'high',
    aliases: ['Tesla Inc.', 'Tesla Government Services', 'Tesla Federal Solutions', 'Tesla Energy'],
    sources: ['https://en.wikipedia.org/wiki/Elon_Musk'],
  },
  'xAI': {
    connection_type: 'elon_musk',
    description: 'Elon Musk — xAI founder, DOGE co-lead.',
    confidence: 'high',
    aliases: ['xAI Corp.', 'xAI Holdings'],
    sources: ['https://en.wikipedia.org/wiki/XAI_(company)'],
  },
  'Starlink': {
    connection_type: 'elon_musk',
    description: 'Elon Musk — Starlink subsidiary of SpaceX, DOGE co-lead.',
    confidence: 'high',
    aliases: ['Starlink Internet Services', 'SpaceX Starlink', 'Starlink Holdings'],
    sources: ['https://en.wikipedia.org/wiki/Starlink'],
  },
  'CoreWeave': {
    connection_type: 'elon_musk',
    description: 'Elon Musk connection — CoreWeave GPU cloud linked to xAI compute sharing.',
    confidence: 'medium',
    aliases: ['Coreweave'],
    sources: ['https://en.wikipedia.org/wiki/CoreWeave'],
  },

  // ── Trump Family ────────────────────────────────────────────────────────────
  'Trump': {
    connection_type: 'trump_family',
    description: 'Trump Family — direct ownership via Donald Trump, Eric Trump, or Donald Trump Jr.',
    confidence: 'high',
    aliases: ['Trump Organization', 'Trump Hotel', 'Trump Winery', 'Eric Trump', 'Donald Trump Jr'],
    sources: ['https://en.wikipedia.org/wiki/Trump_Winery'],
  },

  // ── Trump Allies ────────────────────────────────────────────────────────────
  'Palantir': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Peter Thiel co-founded. Palantir CEO has Trump admin ties. Major federal data contracts.',
    confidence: 'high',
    aliases: ['Palantir Technologies', 'Palantir Government', 'Palantir USG'],
    sources: ['https://en.wikipedia.org/wiki/Palantir_Technologies'],
  },
  'Anduril': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Peter Thiel co-founded, Thiel Founders Fund backed.',
    confidence: 'high',
    aliases: ['Anduril Industries', 'Anduril Defense Inc.'],
    sources: ['https://en.wikipedia.org/wiki/Anduril_(company)'],
  },
  'OpenAI': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Sam Altman is a Trump donor and Mar-a-Lago attendee.',
    confidence: 'high',
    aliases: ['OpenAI LP', 'OpenAI Government'],
    sources: ['https://en.wikipedia.org/wiki/Sam_Altman'],
  },
  'Oracle': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Larry Ellison hosted Trump fundraiser at his home. Major federal cloud contractor.',
    confidence: 'high',
    aliases: ['Oracle Corporation', 'Oracle Cerner', 'Oracle America'],
    sources: ['https://en.wikipedia.org/wiki/Larry_Ellison'],
  },
  'Boeing': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Boeing PAC donor. CEO testified to Trump admin. Major defense contractor.',
    confidence: 'high',
    aliases: ['Boeing Company', 'Boeing Defense'],
    sources: ['https://en.wikipedia.org/wiki/Boeing'],
  },
  'Lockheed': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Lockheed Martin has long-standing Trump admin ties. F-35 sole source.',
    confidence: 'high',
    aliases: ['Lockheed Martin', 'Lockheed Martin Corporation', 'Lockheed'],
    sources: ['https://en.wikipedia.org/wiki/Lockheed_Martin'],
  },
  'Raytheon': {
    connection_type: 'trump_ally',
    description: 'Trump ally — RTX (Raytheon parent) CEO has Trump admin ties. Raytheon PAC donated heavily.',
    confidence: 'high',
    aliases: ['RTX Corporation', 'RTX', 'Raytheon', 'Raytheon Missiles & Defense'],
    sources: ['https://en.wikipedia.org/wiki/Raytheon'],
  },
  'Northrop': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Northrop Grumman PAC donated to Trump inaugural. Major space/defense contractor.',
    confidence: 'high',
    aliases: ['Northrop Grumman', 'Northrop Grumman Corporation'],
    sources: ['https://en.wikipedia.org/wiki/Northrop_Grumman'],
  },
  'General Dynamics': {
    connection_type: 'trump_ally',
    description: 'Trump ally — GD PAC donated heavily to Trump. Major ground systems contractor.',
    confidence: 'high',
    aliases: ['General Dynamics Corporation', 'GDIT', 'General Dynamics Information Technology'],
    sources: ['https://en.wikipedia.org/wiki/General_Dynamics'],
  },
  'Huntington Ingalls': {
    connection_type: 'trump_ally',
    description: 'Trump ally — HII PAC donated to Trump. Only US nuclear aircraft carrier builder.',
    confidence: 'high',
    aliases: ['Huntington Ingalls Industries', 'HII', 'Newport News Shipbuilding'],
    sources: ['https://en.wikipedia.org/wiki/Huntington_Ingalls_Industries'],
  },
  'L3Harris': {
    connection_type: 'trump_ally',
    description: 'Trump ally — L3Harris PAC donated to Trump. CEO active in Trump circles.',
    confidence: 'high',
    aliases: ['L3Harris Technologies', 'L3Harris Technologies Inc.', 'L3'],
    sources: ['https://en.wikipedia.org/wiki/L3Harris_Technologies'],
  },
  'Leidos': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Leidos has federal IT/security contracts. CEO has admin ties.',
    confidence: 'medium',
    aliases: ['Leidos Holdings', 'Leidos Holdings Inc.'],
    sources: ['https://en.wikipedia.org/wiki/Leidos'],
  },
  'Booz Allen': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Booz Allen CEO has Trump admin ties. PAC donations to Trump.',
    confidence: 'high',
    aliases: ['Booz Allen Hamilton', 'Booz Allen Hamilton Holding Corp.', 'BAH'],
    sources: ['https://en.wikipedia.org/wiki/Booz_Allen_Hamilton'],
  },
  'CACI': {
    connection_type: 'trump_ally',
    description: 'Trump ally — CACI has deep defense/intelligence lobbyist ties to Trump admin.',
    confidence: 'high',
    aliases: ['CACI Premier Technology', 'CACI International', 'CACI International Inc.'],
    sources: ['https://en.wikipedia.org/wiki/CACI_International'],
  },
  'Amazon': {
    connection_type: 'trump_ally',
    description: 'Trump ally — AWS $1M Trump inaugural donation. Palantir partnership noted.',
    confidence: 'high',
    aliases: ['Amazon.com Inc.', 'Amazon.com', 'Amazon Web Services', 'AWS'],
    sources: ['https://en.wikipedia.org/wiki/Amazon_(company)'],
  },
  'Microsoft': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Microsoft federal lobbyist ties to Trump admin.',
    confidence: 'medium',
    aliases: ['Microsoft Corporation', 'Microsoft Federal', 'MSFT'],
    sources: ['https://en.wikipedia.org/wiki/Microsoft'],
  },
  'Google': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Google has federal AI contracts. CEO met with Trump.',
    confidence: 'medium',
    aliases: ['Alphabet', 'Google LLC', 'Alphabet Inc.'],
    sources: ['https://en.wikipedia.org/wiki/Google'],
  },
  'IBM': {
    connection_type: 'trump_ally',
    description: 'Trump ally — IBM CEO has Trump admin ties.',
    confidence: 'medium',
    aliases: ['International Business Machines', 'IBM Corporation'],
    sources: ['https://en.wikipedia.org/wiki/IBM'],
  },
  'Palo Alto Networks': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Palo Alto Networks CEO has Trump admin ties. Federal cyber contracts.',
    confidence: 'high',
    aliases: ['Palo Alto Networks Inc.', 'Palo Alto'],
    sources: ['https://en.wikipedia.org/wiki/Palo_Alto_Networks'],
  },
  'CrowdStrike': {
    connection_type: 'trump_ally',
    description: 'Trump ally — CrowdStrike has federal cyber contracts and Trump admin lobbying ties.',
    confidence: 'high',
    aliases: ['CrowdStrike Holdings Inc.', 'CrowdStrike'],
    sources: ['https://en.wikipedia.org/wiki/CrowdStrike'],
  },
  'TransDigm': {
    connection_type: 'related_party',
    description: 'Related party — TransDigm has history of sole-source parts procurement controversy.',
    confidence: 'high',
    aliases: ['TransDigm Inc.', 'TransDigm Group'],
    sources: ['https://en.wikipedia.org/wiki/TransDigm'],
  },
  'Scale AI': {
    connection_type: 'elon_musk',
    description: 'Elon Musk connection — Scale AI board has DOGE-related investors.',
    confidence: 'medium',
    aliases: ['Scale AI Inc.', 'Scale AI'],
    sources: ['https://en.wikipedia.org/wiki/Scale_AI'],
  },

  // ── Additional defense / intelligence contractors ──────────────────────────
  'Apex Predator': {
    connection_type: 'trump_ally',
    description: 'Trump ally — defense/intelligence contractor.',
    confidence: 'medium',
    aliases: ['Apex Defense', 'Apex Systems'],
    sources: [],
  },
  'Parsons': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Parsons Corporation is a major federal construction/IT contractor.',
    confidence: 'medium',
    aliases: ['Parsons Corporation'],
    sources: ['https://en.wikipedia.org/wiki/Parsons_Corporation'],
  },
  'Peraton': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Peraton is a major federal IT and intelligence contractor.',
    confidence: 'medium',
    aliases: ['Peraton Inc.', 'Peraton Systems'],
    sources: ['https://en.wikipedia.org/wiki/Peraton'],
  },
  'Science Applications': {
    connection_type: 'trump_ally',
    description: 'Trump ally — SAIC is a major defense/IT contractor.',
    confidence: 'medium',
    aliases: ['SAIC', 'Science Applications International'],
    sources: ['https://en.wikipedia.org/wiki/SAIC'],
  },
  'ExxonMobil': {
    connection_type: 'trump_ally',
    description: 'Trump ally — ExxonMobil received federal energy contracts and is a major GOP donor.',
    confidence: 'medium',
    aliases: ['Exxon', 'Exxon Mobil', 'ExxonMobil Corporation'],
    sources: ['https://en.wikipedia.org/wiki/ExxonMobil'],
  },
  'Chevron': {
    connection_type: 'trump_ally',
    description: 'Trump ally — Chevron federal oil/gas leases; GOP donor.',
    confidence: 'high',
    aliases: ['Chevron Corporation', 'Chevron USA'],
    sources: ['https://en.wikipedia.org/wiki/Chevron_Corporation'],
  },
  'BlackRock': {
    connection_type: 'trump_ally',
    description: 'Trump ally — BlackRock federal pension management; CEO Larry Fink GOP ties.',
    confidence: 'medium',
    aliases: ['BlackRock Inc.', 'BlackRock Advisors'],
    sources: ['https://en.wikipedia.org/wiki/BlackRock'],
  },
};
