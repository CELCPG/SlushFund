// SlushFund — Congressional Roster
// Canonical list of every member who served 2016-2026, for backfill targeting.
//
// DO NOT hand-edit the member data. It is generated from the authoritative
// unitedstates/congress-legislators dataset. To refresh:
//   python3 src/scripts/gen_congress_roster.py
// which rewrites src/data/congress_roster.json (the single source of truth,
// also consumed by the Python backfill scrapers).

import roster from '@/data/congress_roster.json';

export interface CongressMember {
  name: string;        // Full name as it appears in official disclosures
  bioguide_id: string; // Stable Bioguide identity key
  chamber: 'House' | 'Senate';
  state: string;       // 2-letter code
  district?: string;   // House only
  party: 'Republican' | 'Democrat' | 'Independent';
}

const ALL_MEMBERS = roster.members as unknown as CongressMember[];

export const SENATORS: CongressMember[] = ALL_MEMBERS.filter((m) => m.chamber === 'Senate');
export const REPRESENTATIVES: CongressMember[] = ALL_MEMBERS.filter((m) => m.chamber === 'House');

export function getAllMembers(): CongressMember[] {
  return ALL_MEMBERS;
}

// Years to backfill (2016 = 10 years back from 2026)
export const BACKFILL_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
