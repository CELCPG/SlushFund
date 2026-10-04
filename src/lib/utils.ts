import { Contract, ConnectionType, ContractFlag } from './types';

// Connection keyword map — used for both display and filtering
export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  trump_family: 'Trump Family',
  elon_musk: 'Elon Musk',
  trump_ally: 'Trump Ally',
  'mar-a-lago': 'Mar-a-Lago Adjacent',
  gop_donor: 'GOP Donor',
  lobbyist: 'Lobbyist/Consultant',
  none: 'No Known Connection',
  suspected: 'Suspected Connection',
};

// Check vendor name against connection keywords
export function detectConnection(vendorName: string): {
  connection: ConnectionType;
  political_connection: string;
} {
  const lower = vendorName.toLowerCase();
  if (lower.includes('spacex') || lower.includes('starlink') || lower.includes('tesla') || lower.includes('xai') || lower.includes('boring') || lower.includes('neuralink')) {
    return { connection: 'elon_musk', political_connection: 'Elon Musk — close Trump ally, DOGE co-lead' };
  }
  if (lower.includes('trump') || lower.includes('donald j trump') || lower.includes('trump organization') || lower.includes('trump old post')) {
    return { connection: 'trump_family', political_connection: 'Trump Family directly connected' };
  }
  if (lower.includes('marcus') || lower.includes('venture') || lower.includes('anduril') || lower.includes('palantir') || lower.includes('openai') || lower.includes('sequoia')) {
    return { connection: 'trump_ally', political_connection: 'Trump administration ally or donor' };
  }
  if (lower.includes('maga') || lower.includes('america') || lower.includes('conservative') || lower.includes('patriot')) {
    return { connection: 'trump_ally', political_connection: 'Pro-Trump organization' };
  }
  return { connection: 'none', political_connection: '' };
}

// Detect contract flags
export function detectFlags(contract: Partial<Contract>, connection: ConnectionType): Contract['flags'] {
  const flags: Contract['flags'] = [];
  if (contract.competition_status === 'sole_source' || contract.competition_status === 'no_bid') {
    flags.push(contract.competition_status as ContractFlag);
  }
  if (connection === 'trump_family' || connection === 'elon_musk') {
    flags.push('related_party');
  }
  if (contract.dollar_amount && contract.dollar_amount > 10_000_000 && contract.competition_status !== 'open_competition') {
    flags.push('no_compete_high_value');
  }
  return flags;
}

// Map NAICS codes to suspicious patterns
export function naicsSuspicious(code: string): boolean {
  const suspicious = ['541712', '541714', '541712', '336414', '336412', '334511'];
  return suspicious.includes(code?.substring(0, 6));
}

// Currency formatter
export const fmt = {
  dollars: (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n),
  compact: (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n}`;
  },
  number: (n: number) =>
    new Intl.NumberFormat('en-US').format(n),
  date: (s: string) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  pct: (n: number) => `${(n * 100).toFixed(1)}%`,
};

// Calculate risk score 0-100
export function riskScore(contract: Partial<Contract>, connection: ConnectionType): number {
  let score = 0;
  if (connection === 'elon_musk') score += 30;
  if (connection === 'trump_family') score += 40;
  if (connection === 'suspected') score += 20;
  if (contract.competition_status === 'no_bid' || contract.competition_status === 'sole_source') score += 25;
  if (contract.dollar_amount && contract.dollar_amount > 100_000_000) score += 15;
  if (contract.dollar_amount && contract.dollar_amount > 500_000_000) score += 20;
  if (contract.flags?.includes('inflated')) score += 15;
  return Math.min(100, score);
}