/**
 * D12 investigation posts: the four subject stories (Musk / Bloomberg, Oracle / Bezos), two matched pairs (G8).
 *
 * Every figure is computed here from the rows of `subject_award_transactions` (read live by story-data.ts), and every
 * sentence is built from those figures with the wording the Auditor allowed (A13 §5, A13b §5-7, the M1d letters).
 * AUDITED holds the same sentences as the Auditor signed them off on 2026-10-20. A page whose live sentences differ
 * from AUDITED shows a "changed since the audit" note, and scripts/verify-gates.mjs fails, so a reload that moves a
 * figure goes back to the Auditor before it reaches readers.
 *
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can rebuild every sentence from REST with the same code.
 */

export type StoryGroup = 'musk' | 'bloomberg' | 'oracle' | 'bezos';
export type AwardCategory = 'contract' | 'idv' | 'assistance';

export interface StoryTxn {
  transaction_key: string;
  subject_group: StoryGroup;
  recipient_uei: string;
  recipient_name: string | null;
  award_category: AwardCategory;
  fiscal_year: number;
  federal_action_obligation: number | string;
  awarding_agency: string | null;
  awarding_sub_agency: string | null;
  extent_competed_code: string | null;
  extent_competed: string | null;
  other_than_full_open_code: string | null;
  other_than_full_open: string | null;
  award_id: string | null;
  generated_unique_award_id: string;
  usaspending_url: string;
  psc_description: string | null;
  action_date: string;
  modification_number: string | null;
  fetched_at: string;
}

export interface StoryEntity {
  subject_group: StoryGroup;
  entity_name: string;
  uei: string | null;
  parent_uei: string | null;
  decision: 'include' | 'exclude';
  basis: string;
  evidence_url: string;
}

/** The columns the pages read (PostgREST select). */
export const TXN_COLUMNS =
  'transaction_key,subject_group,recipient_uei,recipient_name,award_category,fiscal_year,federal_action_obligation,awarding_agency,awarding_sub_agency,extent_competed_code,extent_competed,other_than_full_open_code,other_than_full_open,award_id,generated_unique_award_id,usaspending_url,psc_description,action_date,modification_number,fetched_at';
export const ENTITY_COLUMNS = 'subject_group,entity_name,uei,parent_uei,decision,basis,evidence_url';
export const SUMMARY_COLUMNS = 'subject_group,fiscal_year,award_category,net_obligations,noncompeted_obligations';

export const FISCAL_YEARS = [2024, 2025, 2026] as const;
/** FPDS "not competed" group (as r5 and the pre-registration): B, C, G, NDO. */
export const NOT_COMPETED_CODES: readonly string[] = ['B', 'C', 'G', 'NDO'];

// ---------------------------------------------------------------- arithmetic (integer cents)

export const cents = (x: number | string | null | undefined): number => Math.round(Number(x ?? 0) * 100);
export const sumCents = (rows: readonly StoryTxn[]): number => rows.reduce((a, r) => a + cents(r.federal_action_obligation), 0);
export const notCompeted = (r: StoryTxn): boolean => r.extent_competed_code != null && NOT_COMPETED_CODES.includes(r.extent_competed_code);
const contracts = (rows: readonly StoryTxn[]) => rows.filter((r) => r.award_category === 'contract');
const ofUeis = (rows: readonly StoryTxn[], ueis: readonly string[]) => rows.filter((r) => ueis.includes(r.recipient_uei));

/** "$1,234,567.89", "-$5,158.24": the amount as recorded, to the cent (G3). */
export function usdExact(c: number): string {
  const sign = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${sign}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}
/** Whole dollars, for sentences that print an exact small figure ("$10,500"). */
export const usdWhole = (c: number): string => `${c < 0 ? '-' : ''}$${Math.round(Math.abs(c) / 100).toLocaleString('en-US')}`;
const round = (x: number, places: number) => (Math.round(x * 10 ** places) / 10 ** places).toFixed(places);
/** "$9.37 billion" (places = 2) or "$11.2 billion" (places = 1). */
export const billions = (c: number, places = 2): string => `$${round(c / 1e11, places)} billion`;
/** "$72.9 million" (places = 1) or "$210 million" (places = 0). */
export const millions = (c: number, places = 1): string => `$${round(c / 1e8, places)} million`;
/** "0.8" (places = 1) or "96" (places = 0); the caller adds " percent". */
export const percent = (part: number, whole: number, places = 0): string => (whole === 0 ? 'n/a' : round((100 * part) / whole, places));

/** The retrieval date as the date line prints it ("20 Oct 2026"), from the newest `fetched_at`, in Eastern time. */
export function retrievedOf(rows: readonly StoryTxn[]): string | null {
  const latest = rows.reduce<string | null>((m, r) => (m === null || r.fetched_at > m ? r.fetched_at : m), null);
  if (!latest) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' }).formatToParts(new Date(latest));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month').replace('.', '').slice(0, 3)} ${get('year')}`;
}

/** The date line every figure carries (A13 §5, A13b §5). */
export const dateLine = (retrieved: string): string =>
  `USAspending prime-award transactions, action dates 1 Oct 2023 to 30 Sep 2026 (fiscal years 2024-2026), retrieved ${retrieved}.`;

// ---------------------------------------------------------------- the stories

export interface StoryCompany {
  /** The name the response line uses ("We asked SpaceX for comment ..."). */
  name: string;
}

export interface StoryDef {
  slug: string;
  group: StoryGroup;
  pair: string;
  /** Short label for the index ("Companies tied to Michael Bloomberg"). */
  label: string;
  /** The same, inside a sentence ("companies tied to Michael Bloomberg", "Oracle"). */
  phrase: string;
  headline: string;
  /** What the page covers, in the "Why these companies" section. */
  covers: string;
  description: string;
  /** Companies that were sent a request for comment. */
  asked: StoryCompany[];
  /** The noun in the reseller caveat. */
  resold: string;
  /** Pre-registration: the date the questions, window, measures and entity rule were written down. */
  preregistered: string;
  /** What the tie is, as one sentence a cited record supports (A15 S-3); only where `covers` does not state it. */
  tie?: string;
}

export const INVESTIGATIONS_PATH = '/investigations';
export const storyPath = (slug: string): string => `${INVESTIGATIONS_PATH}/${slug}`;
export const ENTITY_CSV_PATH = `${INVESTIGATIONS_PATH}/m1-entities.csv`;

export const STORIES: readonly StoryDef[] = [
  {
    slug: 'federal-money-musk-companies-fy2024-2026',
    group: 'musk',
    pair: 'federal-money-bloomberg-companies-fy2024-2026',
    label: 'Companies tied to Elon Musk',
    phrase: 'companies tied to Elon Musk',
    headline: 'Federal contract obligations to companies tied to Elon Musk, fiscal years 2024–2026',
    covers: "companies tied to Elon Musk: SpaceX (including X Corp., formerly Twitter, Inc., and X.AI LLC, which SpaceX's SEC Exhibit 21.1 lists as subsidiaries), Tesla, Inc., and name searches for xAI, The Boring Company and Neuralink, which found no prime-award recipient with activity in the window",
    tie: 'Elon Musk is chief executive of SpaceX and Tesla, Inc., according to their SEC filings.',
    description: 'What USAspending prime-award records show about federal contract obligations to companies tied to Elon Musk in fiscal years 2024 through 2026, with the records, the method and what the records do not show.',
    asked: [{ name: 'SpaceX' }, { name: 'Tesla, Inc.' }],
    resold: 'Starlink services bought through a reseller are not counted here',
    preregistered: 'Oct 19, 2026',
  },
  {
    slug: 'federal-money-bloomberg-companies-fy2024-2026',
    group: 'bloomberg',
    pair: 'federal-money-musk-companies-fy2024-2026',
    label: 'Companies tied to Michael Bloomberg',
    phrase: 'companies tied to Michael Bloomberg',
    headline: 'Federal contract obligations to companies tied to Michael Bloomberg, fiscal years 2024–2026',
    covers: 'companies tied to Michael Bloomberg: Bloomberg L.P. entities (Bloomberg L.P. is the company co-founded by Michael Bloomberg), plus a name search for Bloomberg Philanthropies',
    description: 'What USAspending prime-award records show about federal contract obligations to companies tied to Michael Bloomberg in fiscal years 2024 through 2026, with the records, the method and what the records do not show.',
    asked: [{ name: 'Bloomberg L.P.' }],
    resold: 'Bloomberg subscriptions bought through a reseller are not counted here',
    preregistered: 'Oct 19, 2026',
  },
  {
    slug: 'federal-money-oracle-fy2024-2026',
    group: 'oracle',
    pair: 'federal-money-amazon-blue-origin-fy2024-2026',
    label: 'Oracle',
    phrase: 'Oracle',
    headline: 'Federal contract obligations to Oracle, fiscal years 2024–2026',
    covers: 'Oracle, the company co-founded by Larry Ellison, including Oracle Health Government Services and the Cerner entities',
    description: 'What USAspending prime-award records show about federal contract obligations to Oracle entities in fiscal years 2024 through 2026, with the records, the method and what the records do not show.',
    asked: [{ name: 'Oracle' }],
    resold: 'Oracle software bought through a reseller is not counted here',
    preregistered: 'Oct 19, 2026',
  },
  {
    slug: 'federal-money-amazon-blue-origin-fy2024-2026',
    group: 'bezos',
    pair: 'federal-money-oracle-fy2024-2026',
    label: 'Amazon and Blue Origin',
    phrase: 'Amazon and Blue Origin',
    headline: 'Federal contract obligations to Amazon and Blue Origin, fiscal years 2024–2026',
    covers: 'Amazon and Blue Origin, both founded by Jeff Bezos',
    description: 'What USAspending prime-award records show about federal contract obligations to Amazon and Blue Origin entities in fiscal years 2024 through 2026, with the records, the method and what the records do not show.',
    asked: [{ name: 'Amazon' }, { name: 'Blue Origin' }],
    resold: 'AWS services bought through a reseller are not counted here',
    preregistered: 'Oct 20, 2026',
  },
];

export const storyBySlug = (slug: string): StoryDef | undefined => STORIES.find((s) => s.slug === slug);
/** The two matched pairs, in release order (G8: each pair ships in the same release). */
export const STORY_PAIRS: readonly (readonly [string, string])[] = [
  ['federal-money-musk-companies-fy2024-2026', 'federal-money-bloomberg-companies-fy2024-2026'],
  ['federal-money-oracle-fy2024-2026', 'federal-money-amazon-blue-origin-fy2024-2026'],
];

// ---------------------------------------------------------------- fixed text (identical on all four pages, G8)

export const STORY_KICKER = 'Investigation · Federal contract records';
export const STORY_BYLINE = 'SlushFund';
/**
 * The go-live day. Apex sets it once, here or with the INVESTIGATIONS_V2_DATE environment variable, on the day
 * SHOW_INVESTIGATIONS_V2=1 goes on (and the letters are sent): the byline, the index cards and every
 * "We asked [Company] for comment on [date]" line all read this one value.
 */
export const INVESTIGATIONS_V2_DATE: string = (typeof process !== 'undefined' && process.env.INVESTIGATIONS_V2_DATE?.trim()) || 'Oct 21, 2026';
/** The byline and index-card date. */
export const STORY_PUBLISHED = INVESTIGATIONS_V2_DATE;
/** The date in "We asked [Company] for comment on ...". */
export const ASKED_ON = INVESTIGATIONS_V2_DATE;
/** The day the Auditor re-checked the figures (A13b). */
export const FIGURES_AUDITED = 'Oct 20, 2026';

export const askedLine = (company: string): string => `We asked ${company} for comment on ${ASKED_ON} and will add any response here.`;

export const CAVEAT_OBLIGATIONS = 'Obligations are amounts agencies committed in the period, net of reductions; they are not contract values or payments.';
export const caveats = (s: StoryDef): string[] => [
  CAVEAT_OBLIGATIONS,
  'Classified awards are not in USAspending, so these totals leave out any classified work.',
  `Sales through resellers are recorded under the reseller's name, so ${s.resold}.`,
  'Defense Department actions are published with a delay of about 90 days, so fiscal 2026 totals may still grow.',
  "'Not competed' is the awarding agency's own coding on each contract action.",
  'Prime awards only; subcontracts are not counted.',
  'Contract ceilings are potential maximums, often shared by several companies, and are not money awarded.',
];
/** A13b §6: one context line, identical in every letter and on every page. */
export const CONTEXT_LINE =
  "Context: these are federal prime-award obligation records matched to each company by its unique entity ID. They do not show contract values, payments, profits, subcontracts, classified work or sales through resellers, and they say nothing about why any award was made. The same 'coded not competed' measure is used for every company on this page.";
export const NOT_CAUSE_LINE = 'Dates are not used to suggest cause: these are records, not a claim about why any money went anywhere.';

/**
 * G6: why this subject, the same lines on every page (the counterpart's phrase is a link on the page). Line 1 is the
 * letters' "Who we are" sentence (M1d letters 01-06); the rest describe our own selection and pre-registration records.
 * SELECTION_LINE: Apex 10/20 revision of the D12c text (no donor/party language per G10, no 'controlled' per A15, no unsourced 'most often named' claim); Colin approved 10/20 with the Oct. 4 request date removed.
 */
export const SELECTION_LINE =
  "SlushFund's founder asked for these stories, covering federal money to companies tied to Elon Musk and to Larry Ellison. To hold every subject to the same standard, each story runs beside a matched story about another founder-led company with federal contracts, built the same way: Bloomberg L.P., founded by Michael Bloomberg, beside the Musk story; and Amazon and Blue Origin, founded by Jeff Bezos, beside the Oracle story.";
export const whyLines = (s: StoryDef, pair: StoryDef): string[] => [
  'We use the same method, time window and wording for every company and person we cover, whatever their politics.',
  SELECTION_LINE,
  `This page covers ${s.covers}.`,
  `It runs in the same release as its matched counterpart, on ${pair.phrase}, which uses identical measures, window, wording and caveats.`,
];

// ---------------------------------------------------------------- entity families (by UEI; the rule is in m1-entities.csv)

export const SPACEX_UEIS = ['C6M7C2FLKER5', 'H5JUPMRB3KX6', 'F7SJGCR9K7M5', 'M888MTTQ8GU5'] as const;
export const TESLA_SINGAPORE_UEI = 'SXKNMH59DLX4';
export const TESLA_INC_UEI = 'TBTHGLM2G9D3';
export const TWITTER_UEI = 'JCPMAN4SN7R6';
export const ORACLE_HEALTH_UEI = 'DT2KS3HH5FP5';
export const ORACLE_AMERICA_UEIS = ['FKUCYGRK1EQ3', 'HE98WLUBNW88', 'GXVTBBQ6VZS1'] as const;
export const CERNER_UEIS = ['DMHXTXRARC74', 'GK8DE694A1N1', 'JGEEDD9R15F1', 'GCSLJPHVK9K4'] as const;
export const AMAZON_UEIS = ['G5F2C46HBCM3', 'Q8G2AUUQQNM4', 'NQEWN6C1LSU5', 'H6S2VKM5U6C5', 'TMKBFBRHFKH3', 'NZNRBF41ZEF4'] as const;
export const BLUE_ORIGIN_UEIS = ['SH2ER4W6LH13', 'SFKWJAYSTL95', 'L13KLVUYDGX4', 'SR7UCNN6CBN5'] as const;
export const HLS_BLUE_ORIGIN = '80MSFC23CA014';

/**
 * Not linked by ID, so not in the database and outside every total (Apex 2026-10-20, A13b F2): the two separate lines on
 * the Amazon and Blue Origin page. These are the only figures on the four pages not read from the database; they come
 * from the M1c download (m1-subject-money.md §6, figures/J_not_linked_by_id.md) and A13b's live check of 2026-10-20.
 */
export const NOT_LINKED = {
  manufacturingContracts: 50_506_030_615, // Blue Origin Manufacturing, LLC RAR2RMTVZYX3: $505,060,306.15, all on 80MSFC23CA014 after the novation
  honeybeeContracts: 5_197_667_342, // Honeybee Robotics, 3 UEIs: $51,976,673.42
  honeybeeAssistance: 855_592_083, // $8,555,920.83
  manufacturingUrl: 'https://www.usaspending.gov/award/CONT_AWD_80MSFC23CA014_8000_-NONE-_-NONE-/',
  honeybeeUeis: ['Q66XJ43E51L7', 'U44JFDHPWGL8', 'F7UHKQTEYHW8'],
  /** USAspending recipient profiles for the three UEIs (ids from A13b's recipient search, raw\rsearch_HONEYBEE_ROBOTICS.json). */
  honeybeeUrls: [
    ['HONEYBEE ROBOTICS LLC (Q66XJ43E51L7)', 'https://www.usaspending.gov/recipient/df406c85-4912-7a44-73d3-52a179d53a10-P/latest'],
    ['HONEYBEE ROBOTICS LLC (U44JFDHPWGL8)', 'https://www.usaspending.gov/recipient/167ba444-1b92-f70a-c490-0bb4686f73a2-P/latest'],
    ['HONEYBEE ROBOTICS, LTD. (F7UHKQTEYHW8)', 'https://www.usaspending.gov/recipient/b5247fd3-9125-67ef-151a-ead454257097-P/latest'],
  ],
} as const;

// ---------------------------------------------------------------- sentences, built from the rows

export type Sentences = Record<string, string>;

const awardSum = (rows: readonly StoryTxn[], awardId: string) => sumCents(rows.filter((r) => r.award_id === awardId));
const agencySum = (rows: readonly StoryTxn[], agency: string) => sumCents(rows.filter((r) => r.awarding_agency === agency));
const subSum = (rows: readonly StoryTxn[], sub: string) => sumCents(rows.filter((r) => r.awarding_sub_agency === sub));

/** The award IDs with the largest window obligations, contracts and IDVs together. */
export function largestAwardIds(rows: readonly StoryTxn[], n: number): string[] {
  const m = new Map<string, number>();
  for (const r of rows) if (r.award_category !== 'assistance' && r.award_id) m.set(r.award_id, (m.get(r.award_id) ?? 0) + cents(r.federal_action_obligation));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
}

export function storySentences(group: StoryGroup, rows: readonly StoryTxn[]): Sentences {
  const K = contracts(rows);
  const ncK = sumCents(K.filter(notCompeted));
  if (group === 'musk') {
    const sx = ofUeis(rows, SPACEX_UEIS);
    const sxK = contracts(sx);
    const sxI = sx.filter((r) => r.award_category === 'idv');
    const both = sx.filter((r) => r.award_category !== 'assistance');
    const sxNc = sumCents(sxK.filter(notCompeted));
    const ia = sumCents(sxK.filter((r) => r.extent_competed_code === 'B' && r.other_than_full_open_code === 'IA'));
    const dod = agencySum(both, 'Department of Defense');
    const nasa = agencySum(both, 'National Aeronautics and Space Administration');
    const sing = rows.filter((r) => r.recipient_uei === TESLA_SINGAPORE_UEI);
    const singAwards = new Set(sing.map((r) => r.award_id));
    return {
      m1: `Federal agencies obligated a net ${billions(sumCents(sxK))} to SpaceX on contracts in fiscal years 2024 through 2026, according to USAspending prime-award records matched by SpaceX's UEIs.`,
      m2: `Agencies also obligated ${billions(sumCents(sxI))} directly on SpaceX's indefinite-delivery contracts, such as NASA's space station resupply contract, over the same period.`,
      m2b: `Added together, that is ${billions(sumCents(both), 1)} in contract and IDV obligations over three fiscal years.`,
      m3: `Of the ${billions(sumCents(both), 1)} in contract and IDV obligations, the Defense Department (${billions(dod)}, mostly the Air Force) and NASA (${billions(nasa)}) accounted for nearly all.`,
      m4: `Of the contract obligations, ${millions(sxNc)} (${percent(sxNc, sumCents(sxK), 1)} percent) was coded by the awarding agencies as not competed; most of that (${millions(ia)}) is coded 'not available for competition' under an international-agreement authority.`,
      m5: `The largest awards in the period were NASA's Commercial Crew transportation contract (${billions(awardSum(sx, 'NNK17MA01T'))} obligated in the window), the Human Landing System contract (${billions(awardSum(sx, '80MSFC20C0034'))}) and the station resupply contract (${billions(awardSum(sx, 'NNJ16GX08B'))}).`,
      m6: 'For xAI, The Boring Company and Neuralink, a name search of USAspending found no prime-award recipient with activity in fiscal 2024-2026, as of 20 Oct 2026.',
      m7: rows.some((r) => r.recipient_uei === TWITTER_UEI)
        ? 'CHANGED: Twitter, Inc. now has transactions in the window.'
        : "For Twitter, Inc. (now X Corp.), none found in USAspending prime-award transactions for Twitter, Inc.'s UEI in the same period.",
      m8: `Federal agencies obligated ${usdExact(sumCents(sing))} in fiscal 2024-2026 to Tesla Motors Singapore Private Limited, a subsidiary listed in Tesla, Inc.'s annual report (${singAwards.size === 1 && sing.every((r) => r.awarding_agency === 'Department of State') ? 'one State Department purchase of an electric vehicle' : 'CHANGED: more than one award'}). USAspending's record for Tesla, Inc. itself (UEI ${TESLA_INC_UEI}) shows ${rows.some((r) => r.recipient_uei === TESLA_INC_UEI && cents(r.federal_action_obligation) !== 0) ? 'CHANGED: obligations' : 'no obligations'} in the period.`,
      // The three named awards must be the three largest (contracts and IDVs together).
      m5check: largestAwardIds(sx, 3).sort().join(' '),
    };
  }
  if (group === 'bloomberg') {
    const byCode = new Map<string, number>();
    for (const r of K.filter(notCompeted)) byCode.set(r.other_than_full_open_code ?? '', (byCode.get(r.other_than_full_open_code ?? '') ?? 0) + cents(r.federal_action_obligation));
    const topCode = [...byCode.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const it = sumCents(K.filter((r) => /^(IT AND TELECOM|INFORMATION TECHNOLOGY)/.test(r.psc_description ?? '')));
    const news = sumCents(K.filter((r) => r.psc_description === 'NEWSPAPERS AND PERIODICALS'));
    const total = sumCents(K);
    const idvNet = sumCents(rows.filter((r) => r.award_category === 'idv'));
    const idvAny = rows.some((r) => r.award_category === 'idv' && cents(r.federal_action_obligation) !== 0);
    const assist = rows.filter((r) => r.award_category === 'assistance').length;
    return {
      b1: `Federal agencies obligated a net ${millions(total)} to Bloomberg L.P. entities on contracts in fiscal years 2024 through 2026, matched by UEI.`,
      b2: `About ${percent(ncK, total)} percent of those obligations (${millions(ncK)}) were coded by the awarding agencies as not competed, most often citing ${topCode === 'ONE' ? "'only one source' (FAR 6.302-1)" : `CHANGED: ${topCode}`}.`,
      b3: `The largest buyers were the IRS (${millions(subSum(K, 'Internal Revenue Service'))}), the SEC (${millions(agencySum(K, 'Securities and Exchange Commission'))}) and the Commerce Department (${millions(agencySum(K, 'Department of Commerce'))}).`,
      b4: `${idvNet === 0 && !idvAny && assist === 0 ? 'No Bloomberg IDV obligations and no assistance awards were found in the period.' : 'CHANGED: Bloomberg IDV or assistance rows.'} A name search found no USAspending recipient for Bloomberg Philanthropies, as of 20 Oct 2026.`,
      b5: `About three-quarters of these obligations (${percent(it, total)} percent) are coded by the agencies as information-technology software or IT services, and about a tenth as newspapers and periodicals.${news * 100 >= total * 5 && news * 100 < total * 15 ? '' : ' CHANGED: newspapers share.'}`,
    };
  }
  if (group === 'oracle') {
    const ohgs = contracts(ofUeis(rows, [ORACLE_HEALTH_UEI]));
    const va = K.filter((r) => r.awarding_agency === 'Department of Veterans Affairs');
    const pi = sumCents(va.filter((r) => notCompeted(r) && r.other_than_full_open_code === 'PI'));
    const ohgsVa = sumCents(ohgs.filter((r) => r.awarding_agency === 'Department of Veterans Affairs'));
    const total = sumCents(K);
    const idvNet = sumCents(rows.filter((r) => r.award_category === 'idv'));
    const assistRows = rows.filter((r) => r.award_category === 'assistance');
    const assistCerner = assistRows.every((r) => r.recipient_uei === 'DMHXTXRARC74');
    return {
      o1: `Federal agencies obligated a net ${billions(total)} to Oracle entities on contracts in fiscal years 2024 through 2026, matched by UEI.`,
      o2: `${billions(sumCents(ohgs))} of it went to Oracle Health Government Services (formerly Cerner Government Services), ${ohgsVa * 100 >= sumCents(ohgs) * 95 ? 'almost all' : 'CHANGED: not almost all'} on Veterans Affairs task orders for its electronic health record modernization.`,
      o3: `Of Oracle's contract obligations, ${percent(ncK, total)} percent (${billions(ncK)}) was coded by the awarding agencies as not competed. VA coded its EHRM task orders not competed, citing the 'public interest' exception (FAR 6.302-7), on ${billions(pi)}.`,
      o4: `Oracle America received ${millions(sumCents(contracts(ofUeis(rows, ORACLE_AMERICA_UEIS))), 0)} over the same period, and Cerner entities about ${millions(sumCents(contracts(ofUeis(rows, CERNER_UEIS))), 0)}.`,
      // A15 P-1 (G8 parity with m2, b4, z4): a separate line, never added to o1.
      o5: `Agencies also obligated a net ${usdExact(idvNet)} on Oracle indefinite-delivery contracts and a net ${millions(sumCents(assistRows))} in assistance awards to ${assistCerner ? 'Cerner Corporation' : 'CHANGED: not only Cerner Corporation'} over the same period.`,
    };
  }
  // bezos
  const az = contracts(ofUeis(rows, AMAZON_UEIS));
  const bo = contracts(ofUeis(rows, BLUE_ORIGIN_UEIS));
  const total = sumCents(K);
  const azNc = sumCents(az.filter(notCompeted));
  const boNc = sumCents(bo.filter(notCompeted));
  const idv = sumCents(rows.filter((r) => r.award_category === 'idv'));
  const assistRows = rows.filter((r) => r.award_category === 'assistance');
  const assistBo = assistRows.every((r) => (BLUE_ORIGIN_UEIS as readonly string[]).includes(r.recipient_uei));
  const hls = sumCents(rows.filter((r) => r.award_id === HLS_BLUE_ORIGIN));
  return {
    z1: `Federal agencies obligated a net ${billions(total)} to Amazon and Blue Origin entities on contracts in fiscal years 2024 through 2026, matched by UEI: ${billions(sumCents(az))} to Amazon entities and ${billions(sumCents(bo))} to Blue Origin entities.`,
    z2: `Of those obligations, ${millions(ncK)} (${percent(ncK, total, 1)} percent) was coded by the awarding agencies as not competed: ${millions(azNc)} of Amazon's (${percent(azNc, sumCents(az))} percent) and ${millions(boNc)} of Blue Origin's (${percent(boNc, sumCents(bo), 1)} percent).`,
    z3: `NASA (${billions(agencySum(K, 'National Aeronautics and Space Administration'))}) and the Defense Department (${billions(agencySum(K, 'Department of Defense'))}) were the largest buyers.`,
    z4: `Agencies also obligated ${usdWhole(idv)} on Amazon and Blue Origin indefinite-delivery contracts and a net ${millions(sumCents(assistRows))} in assistance awards to ${assistBo ? 'Blue Origin' : 'CHANGED: not only Blue Origin'} over the same period.`,
    z5: `Blue Origin's largest award in the period, NASA's Human Landing System contract (${HLS_BLUE_ORIGIN}), was transferred by NASA in a December 2025 novation from Blue Origin Washington, LLC to Blue Origin Manufacturing, LLC. The ${billions(hls)} obligated before the transfer is counted above; the ${millions(NOT_LINKED.manufacturingContracts)} obligated after it, recorded under Blue Origin Manufacturing, is not, because USAspending does not link Blue Origin Manufacturing to another Blue Origin entity by parent UEI and Blue Origin files no SEC subsidiary list.`,
    z6: `Honeybee Robotics (three UEIs), which USAspending lists under a parent other than Blue Origin, received ${millions(NOT_LINKED.honeybeeContracts)} in contract and ${millions(NOT_LINKED.honeybeeAssistance)} in assistance obligations over the same period; it is not counted in the Blue Origin figures.`,
    z7: 'For Kuiper, Zoox, Twitch, Audible, One Medical, Whole Foods Market, Annapurna, Amazon Data Services, Amazon Technologies and Amazon.com Sales, none found in USAspending prime-award transactions, matched by UEI where one exists and by name search otherwise, as of 20 Oct 2026.',
    // Blue Origin's largest award must be the novated HLS contract.
    z5check: largestAwardIds(rows.filter((r) => (BLUE_ORIGIN_UEIS as readonly string[]).includes(r.recipient_uei)), 1).join(' '),
  };
}

/** The sentences as the Auditor signed them off (A13 §5, A13b §5, letters 01-06 of 2026-10-20). */
export const AUDITED: Record<StoryGroup, Sentences> = {
  musk: {
    m1: "Federal agencies obligated a net $9.37 billion to SpaceX on contracts in fiscal years 2024 through 2026, according to USAspending prime-award records matched by SpaceX's UEIs.",
    m2: "Agencies also obligated $1.83 billion directly on SpaceX's indefinite-delivery contracts, such as NASA's space station resupply contract, over the same period.",
    m2b: 'Added together, that is $11.2 billion in contract and IDV obligations over three fiscal years.',
    m3: 'Of the $11.2 billion in contract and IDV obligations, the Defense Department ($5.69 billion, mostly the Air Force) and NASA ($5.49 billion) accounted for nearly all.',
    m4: "Of the contract obligations, $72.9 million (0.8 percent) was coded by the awarding agencies as not competed; most of that ($44.7 million) is coded 'not available for competition' under an international-agreement authority.",
    m5: "The largest awards in the period were NASA's Commercial Crew transportation contract ($1.96 billion obligated in the window), the Human Landing System contract ($1.06 billion) and the station resupply contract ($1.09 billion).",
    m6: 'For xAI, The Boring Company and Neuralink, a name search of USAspending found no prime-award recipient with activity in fiscal 2024-2026, as of 20 Oct 2026.',
    m7: "For Twitter, Inc. (now X Corp.), none found in USAspending prime-award transactions for Twitter, Inc.'s UEI in the same period.",
    m8: "Federal agencies obligated $41,678.59 in fiscal 2024-2026 to Tesla Motors Singapore Private Limited, a subsidiary listed in Tesla, Inc.'s annual report (one State Department purchase of an electric vehicle). USAspending's record for Tesla, Inc. itself (UEI TBTHGLM2G9D3) shows no obligations in the period.",
    m5check: '80MSFC20C0034 NNJ16GX08B NNK17MA01T',
  },
  bloomberg: {
    b1: 'Federal agencies obligated a net $100.4 million to Bloomberg L.P. entities on contracts in fiscal years 2024 through 2026, matched by UEI.',
    b2: "About 83 percent of those obligations ($83.5 million) were coded by the awarding agencies as not competed, most often citing 'only one source' (FAR 6.302-1).",
    b3: 'The largest buyers were the IRS ($30.8 million), the SEC ($10.4 million) and the Commerce Department ($10.3 million).',
    b4: 'No Bloomberg IDV obligations and no assistance awards were found in the period. A name search found no USAspending recipient for Bloomberg Philanthropies, as of 20 Oct 2026.',
    b5: 'About three-quarters of these obligations (74 percent) are coded by the agencies as information-technology software or IT services, and about a tenth as newspapers and periodicals.',
  },
  oracle: {
    o1: 'Federal agencies obligated a net $4.19 billion to Oracle entities on contracts in fiscal years 2024 through 2026, matched by UEI.',
    o2: '$3.96 billion of it went to Oracle Health Government Services (formerly Cerner Government Services), almost all on Veterans Affairs task orders for its electronic health record modernization.',
    o3: "Of Oracle's contract obligations, 96 percent ($4.03 billion) was coded by the awarding agencies as not competed. VA coded its EHRM task orders not competed, citing the 'public interest' exception (FAR 6.302-7), on $3.95 billion.",
    o4: 'Oracle America received $210 million over the same period, and Cerner entities about $20 million.',
    o5: 'Agencies also obligated a net -$16,464.50 on Oracle indefinite-delivery contracts and a net $0.9 million in assistance awards to Cerner Corporation over the same period.',
  },
  bezos: {
    z1: 'Federal agencies obligated a net $3.81 billion to Amazon and Blue Origin entities on contracts in fiscal years 2024 through 2026, matched by UEI: $1.26 billion to Amazon entities and $2.55 billion to Blue Origin entities.',
    z2: "Of those obligations, $261.9 million (6.9 percent) was coded by the awarding agencies as not competed: $256.1 million of Amazon's (20 percent) and $5.8 million of Blue Origin's (0.2 percent).",
    z3: 'NASA ($2.15 billion) and the Defense Department ($1.30 billion) were the largest buyers.',
    z4: 'Agencies also obligated $10,500 on Amazon and Blue Origin indefinite-delivery contracts and a net $2.0 million in assistance awards to Blue Origin over the same period.',
    z5: "Blue Origin's largest award in the period, NASA's Human Landing System contract (80MSFC23CA014), was transferred by NASA in a December 2025 novation from Blue Origin Washington, LLC to Blue Origin Manufacturing, LLC. The $1.26 billion obligated before the transfer is counted above; the $505.1 million obligated after it, recorded under Blue Origin Manufacturing, is not, because USAspending does not link Blue Origin Manufacturing to another Blue Origin entity by parent UEI and Blue Origin files no SEC subsidiary list.",
    z6: 'Honeybee Robotics (three UEIs), which USAspending lists under a parent other than Blue Origin, received $52.0 million in contract and $8.6 million in assistance obligations over the same period; it is not counted in the Blue Origin figures.',
    z7: 'For Kuiper, Zoox, Twitch, Audible, One Medical, Whole Foods Market, Annapurna, Amazon Data Services, Amazon Technologies and Amazon.com Sales, none found in USAspending prime-award transactions, matched by UEI where one exists and by name search otherwise, as of 20 Oct 2026.',
    z5check: '80MSFC23CA014',
  },
};
export const AUDITED_RETRIEVED = '20 Oct 2026';

/** Keys whose live sentence differs from the audited one (a `*check` key is a test, never printed). */
export function driftOf(group: StoryGroup, live: Sentences): string[] {
  const want = AUDITED[group];
  return [...new Set([...Object.keys(want), ...Object.keys(live)])].filter((k) => live[k] !== want[k]);
}

/**
 * The order the sentences print in "The numbers" (the dek and the note under it are printed apart). A13b B5: the novation
 * sentence (z5) sits next to every Blue Origin figure, so it follows the dek (z1) and the not-competed split (z2).
 */
export const NUMBERS_ORDER: Record<StoryGroup, { dek: string; underDek: string[]; body: string[]; nulls: string[] }> = {
  musk: { dek: 'm1', underDek: [], body: ['m2', 'm2b', 'm3', 'm4', 'm5'], nulls: ['m8', 'm6', 'm7'] },
  bloomberg: { dek: 'b1', underDek: [], body: ['b2', 'b3', 'b5'], nulls: ['b4'] },
  oracle: { dek: 'o1', underDek: [], body: ['o2', 'o3', 'o4', 'o5'], nulls: [] },
  bezos: { dek: 'z1', underDek: ['z5'], body: ['z2', 'z5', 'z3', 'z4', 'z6'], nulls: ['z7'] },
};

/** "How we got these numbers": the entity rule and the pre-registration line, identical on every page (G8). */
export const ENTITY_RULE_LINE =
  'a recipient counts only if a USAspending parent UEI or an SEC filing ties it to the company; a matching name alone does not count.';
/** m1-preregistration.md: the Musk/Bloomberg/Oracle file records the S1 scoping look (2026-10-05) as its prior; the Bezos addendum came before any Bezos query. */
export const preregLine = (s: StoryDef): string =>
  `the questions, the time window, the measures and the entity rule were written down on ${s.preregistered}, ${
    s.group === 'bezos'
      ? 'before the first query for this group.'
      : s.group === 'bloomberg'
        ? 'before the data for this page was downloaded; it records no earlier figure for Bloomberg.'
        : 'before the data for this page was downloaded; the one earlier look at these figures, a scoping check on Oct 5, 2026, is recorded in it as the prior.'
  } Changes made after that are dated amendments; the ones that changed which recipients count are described under "How we built the list".`;

/**
 * "How we built the list", per page: the letters' audited paragraphs (M1d letters 01-06, A13b §7), with the live figures filled
 * in where the database holds them. Bloomberg Index Services and the Bezos pre-alignment total are not in the database (taken
 * out by the entity rule), so they are fixed figures from m1-subject-money.md §1 and §7.1.
 */
export interface HowPara {
  text: string;
  /** Records the paragraph cites; printed after the text. */
  links?: StoryNoteLink[];
}

export function howBuilt(group: StoryGroup, rows: readonly StoryTxn[]): HowPara[] {
  return howBuiltText(group, rows).map((p) => (typeof p === 'string' ? { text: p } : p));
}

function howBuiltText(group: StoryGroup, rows: readonly StoryTxn[]): (string | HowPara)[] {
  if (group === 'musk') {
    const pioneer = sumCents(rows.filter((r) => r.recipient_uei === 'M888MTTQ8GU5'));
    return [
      `SpaceX is counted by USAspending parent UEI C6M7C2FLKER5 and its USAspending children, including Pioneer Aerospace Corp (M888MTTQ8GU5), added on 20 Oct 2026 as a dated amendment to our pre-registered rules after a completeness check (net ${usdExact(pioneer)}, fiscal 2026).`,
      // A15 S-4 (G4): SpaceX's own subsidiary exhibit, checked against USAspending.
      { text: "SpaceX's Exhibit 21.1 to its Form S-1 (filed with the SEC on 20 May 2026) lists X Corp., X.AI LLC, CTC Property LLC and SpaceX Services Inc. as significant subsidiaries; a USAspending recipient search on 20 Oct 2026 found none of them as a recipient with activity in fiscal 2024-2026.", links: [{ label: 'SpaceX Exhibit 21.1 (SEC)', href: SPACEX_EX21 }] },
      `Tesla Motors Singapore Private Limited (${TESLA_SINGAPORE_UEI}) is counted because its exact legal name is listed in Tesla, Inc.'s Exhibit 21.1 subsidiary list, filed with the SEC; it was added on 20 Oct 2026 as a dated amendment. Tesla, Inc. (${TESLA_INC_UEI}) and Twitter, Inc. (${TWITTER_UEI}) are on the list and have no transactions in the period.`,
      'Not counted, because no parent UEI or SEC subsidiary exhibit links them to SpaceX: SPACE EXPLORATION TECHNOLOGIES CORP. (Washington, DC) (UWSJVJQGB2X5) and STARLINK TECHNOLOGIES LLC (Hazleton, PA) (NMSEZBYT6N85). We do not present Starlink Technologies LLC (Hazleton, Pa.) as a SpaceX entity.',
      "Also not counted, because none appears under that name in Tesla, Inc.'s Exhibit 21.1 subsidiary list and USAspending shows each with its own parent: Tesla Industries Inc., Tesla Laboratories Inc., Tesla Nanocoatings Inc., Tesla Energy Solutions LLC, Tesla Government Inc. (Falls Church, Va.) and Tesla Motors Sales and Service (Beijing) Co., Ltd.",
    ];
  }
  if (group === 'bloomberg') {
    return [
      'Bloomberg L.P. is counted by UEI (Bloomberg LP J9DJN2M6J9J3 and WS3JMF5PJX96, Bloomberg Finance LP, and Bloomberg Industry Group, formerly BNA, which USAspending lists as a child of Bloomberg LP). Bloomberg is private, so there is no SEC subsidiary exhibit.',
      'Not counted, because no parent UEI links it: Bloomberg Index Services Limited (JVLED4RHJ3L5), which carried $203,361.31 of obligations in the window, all coded not competed. It was taken out on 20 Oct 2026, as a dated amendment applying that rule.',
      "Also not counted: Johns Hopkins Bloomberg School of Public Health and other recipients with 'Bloomberg' in the name.",
    ];
  }
  if (group === 'oracle') {
    const pf = sumCents(rows.filter((r) => r.recipient_uei === 'WSV5VN575Y58' || r.recipient_uei === 'L3GVTW5AS273'));
    return [
      `Oracle is counted by USAspending parent links (Oracle Corp ZFKQZW16QPU3, Oracle Corporation J3TKCN6S76D6 and their children, including Phase Forward Inc and Lincoln Technologies Inc, added 20 Oct 2026 as a dated amendment; their only activity is one indefinite-delivery action of ${usdExact(pf)}, which is not in the contract figures above), plus Cerner Corporation, counted on Oracle's Form 8-K of 2022-06-08 reporting the completed acquisition.`,
      'Not counted, because no parent UEI or SEC subsidiary exhibit links them to Oracle: ORACLE CORPORATION (Washington, DC) (HA1ZN3TDHMC8), ORACLE CORPORATION (Bethesda, MD) (KSCMBF8HW5P5), ORACLE ELEVATOR HOLDCO, INC. (Tampa, FL) (NVM3KTJCLC28), ORACLE INSURANCE BROKERS LIMITED (Abuja) (DQK8EU3L28G4) and ORACLE HEALTHCARE ADVISORS INC (OHC Advisors) (EYTCHQ7ZVBX5).',
    ];
  }
  return [
    'Amazon is counted by USAspending parent UEI Amazon.com, Inc. (G5F2C46HBCM3; second UEI Q8G2AUUQQNM4) and its children, including Wickr LLC, added on 20 Oct 2026 as a dated amendment after the group\'s totals were first read, and by Amazon\'s Form 10-K Exhibit 21 for Amazon Web Services, Inc. and Amazon.com Services LLC.',
    'Blue Origin is counted by USAspending parent UEIs (Blue Origin Washington, LLC SH2ER4W6LH13 and its children Blue Origin, LLC and Blue Origin Texas, LLC; roll-up SR7UCNN6CBN5). Blue Origin is private, so there is no SEC subsidiary exhibit. Blue Origin Federation, LLC (NBVAJ2FT6CK5, one $0 transaction) is not counted because no parent UEI links it.',
    "Blue Origin Manufacturing and Honeybee Robotics are shown on separate lines only. NASA's award record for 80MSFC23CA014 shows a novation agreement (modification P00036, 8 Dec 2025) transferring the contract from Blue Origin Washington, LLC to Blue Origin Manufacturing, LLC.",
    "Not counted, because no parent UEI or SEC subsidiary exhibit links them to Amazon: Amazon Hose & Rubber Co of Miami, Amazon Sheds and Gazebos, AMAZONTC LLC, grant recipients in the Amazon region, and individuals and marketplace sellers with 'Amazon' in the name.",
    `Disclosure: on 20 Oct 2026, after the Amazon and Blue Origin totals had first been read, the entity rule for this group was narrowed to the rule used for the Musk, Bloomberg and Oracle pages: a USAspending parent UEI or an SEC subsidiary exhibit. The same rule was applied to every group (it also took Bloomberg Index Services out). Contract obligations to the group were ${billions(sumCents(contracts(rows)) + NOT_LINKED.manufacturingContracts + NOT_LINKED.honeybeeContracts)} under the earlier rule and are ${billions(sumCents(contracts(rows)))} under the aligned rule; the difference is Blue Origin Manufacturing and Honeybee Robotics, shown on separate lines above.`,
  ];
}

// ---------------------------------------------------------------- footnotes (G1: every figure links to an official record)

export interface StoryNoteLink {
  label: string;
  href: string;
}
export interface StoryNote {
  n: number;
  /** The sentence keys this note backs; each printed sentence carries its note's number. */
  keys: string[];
  text: string;
  links: StoryNoteLink[];
}

export const RECIPIENT_SEARCH = 'https://www.usaspending.gov/recipient';
export const TESLA_EX21 = 'https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-2025x12x31xex211.htm';
/** Tesla, Inc.'s Form 10-K for fiscal 2025 (names Elon Musk as its Chief Executive Officer). */
export const TESLA_10K = 'https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm';
/** SpaceX's Form S-1 of 20 May 2026 (names Elon Musk as founder, Chief Executive Officer, Chief Technical Officer and Chairman) and its Exhibit 21.1 (A15 S-4). */
export const SPACEX_S1 = 'https://www.sec.gov/Archives/edgar/data/1181412/000162828026036936/spaceexplorationtechnologi.htm';
export const SPACEX_EX21 = 'https://www.sec.gov/Archives/edgar/data/1181412/000162828026036936/exhibit211-sx1.htm';

const childrenOf = (parentUei: string): string => `https://api.usaspending.gov/api/v2/recipient/children/${parentUei}/`;
/**
 * A15 L-1 to L-3: the stored evidence link of these UEIs does not show the tie (a profile that names itself as parent,
 * a profile naming another parent, or text that is not a URL). The tie is in the parent's USAspending children list,
 * checked live on 20 Oct 2026. subject_entities.evidence_url still holds the old value (no DB writes in D12c); this map
 * replaces it wherever a page prints an entity link, and public/investigations/m1-entities.csv carries the same links.
 */
export const EVIDENCE_URL_FIX: Readonly<Record<string, string>> = {
  M888MTTQ8GU5: childrenOf('C6M7C2FLKER5'), // Pioneer Aerospace Corp: profile opens with Safran Power USA as parent (L-2)
  NZNRBF41ZEF4: childrenOf('G5F2C46HBCM3'), // Wickr LLC: stored value was not a URL (L-1)
  SFKWJAYSTL95: childrenOf('SH2ER4W6LH13'), // Blue Origin, LLC
  L13KLVUYDGX4: childrenOf('SH2ER4W6LH13'), // Blue Origin Texas, LLC
  DT2KS3HH5FP5: childrenOf('ZFKQZW16QPU3'), // Oracle Health Government Services
  GK8DE694A1N1: childrenOf('ZFKQZW16QPU3'), // Cerner Federal Solutions
  PFDZJZ15N3R1: childrenOf('J9DJN2M6J9J3'), // Bloomberg Finance
  KG5PWYBKVCA5: childrenOf('J9DJN2M6J9J3'), // Bloomberg Industry Group
  PD3DCPCM3NB6: childrenOf('J3TKCN6S76D6'), // Oracle Corporation (Reston): Ex. 21.01 does not tie this UEI
};
/** The entity rows with the corrected evidence links. */
export const withEvidenceFixes = (entities: readonly StoryEntity[]): StoryEntity[] =>
  entities.map((e) => (e.uei && EVIDENCE_URL_FIX[e.uei] ? { ...e, evidence_url: EVIDENCE_URL_FIX[e.uei] } : e));
/** Hosts a story may link as a record (G1: USAspending and SEC EDGAR). */
export const OFFICIAL_HOSTS: readonly string[] = ['www.usaspending.gov', 'api.usaspending.gov', 'www.sec.gov', 'data.sec.gov'];

export function storyNotes(group: StoryGroup, rows: readonly StoryTxn[], entities: readonly StoryEntity[]): StoryNote[] {
  const active = new Set(rows.map((r) => r.recipient_uei));
  const entityLinks = (ueis?: readonly string[]): StoryNoteLink[] =>
    entities
      .filter((e) => e.decision === 'include' && e.uei && active.has(e.uei) && (!ueis || ueis.includes(e.uei)))
      .map((e) => ({ label: `${e.entity_name} (${e.uei})`, href: e.evidence_url }));
  const award = (id: string): StoryNoteLink[] => {
    const r = rows.find((x) => x.award_id === id);
    return r ? [{ label: `Award ${id}`, href: r.usaspending_url }] : [];
  };
  const totals = 'Our sums of the USAspending prime-award transactions for these UEIs, action dates 1 Oct 2023 to 30 Sep 2026. Each link opens the record that ties the UEI to the company (a USAspending recipient profile or children list, or an SEC filing).';
  const search = { label: 'USAspending recipient search', href: RECIPIENT_SEARCH };
  const notes: Omit<StoryNote, 'n'>[] =
    group === 'musk'
      ? [
          // The tie sentence prints first on the page (A15 S-3), so its note is number 1.
          {
            keys: ['tie'],
            text: "Elon Musk's title at SpaceX (Form S-1, filed 20 May 2026) and at Tesla, Inc. (Form 10-K for fiscal 2025), and the subsidiaries SpaceX lists (Exhibit 21.1 to the S-1).",
            links: [
              { label: 'SpaceX Form S-1 (SEC)', href: SPACEX_S1 },
              { label: 'SpaceX Exhibit 21.1 (SEC)', href: SPACEX_EX21 },
              { label: 'Tesla, Inc. Form 10-K for fiscal 2025 (SEC)', href: TESLA_10K },
            ],
          },
          { keys: ['m1', 'm2', 'm2b', 'm3', 'm4'], text: totals, links: entityLinks(SPACEX_UEIS) },
          { keys: ['m5'], text: 'The three award records named, with every transaction in the period.', links: [...award('NNK17MA01T'), ...award('80MSFC20C0034'), ...award('NNJ16GX08B')] },
          { keys: ['m8'], text: "Tesla, Inc.'s Exhibit 21.1 subsidiary list (Form 10-K for fiscal 2025) and the State Department purchase order.", links: [{ label: 'Tesla, Inc. Exhibit 21.1 (SEC)', href: TESLA_EX21 }, ...award('19SN1024P0747')] },
          { keys: ['m6', 'm7'], text: 'Name searches in the USAspending recipient search, run 20 Oct 2026; Twitter, Inc. by its UEI.', links: [search, ...entities.filter((e) => e.uei === TWITTER_UEI).map((e) => ({ label: `${e.entity_name} (${e.uei})`, href: e.evidence_url }))] },
        ]
      : group === 'bloomberg'
        ? [
            { keys: ['b1', 'b2', 'b3', 'b5'], text: totals, links: entityLinks() },
            { keys: ['b4'], text: 'Name search in the USAspending recipient search, run 20 Oct 2026.', links: [search] },
          ]
        : group === 'oracle'
          ? [
              { keys: ['o1', 'o3', 'o5'], text: totals, links: entityLinks() },
              { keys: ['o2'], text: "Oracle Health Government Services' record and the three largest VA task orders.", links: [...entityLinks([ORACLE_HEALTH_UEI]), ...largestAwardIds(rows, 3).flatMap(award)] },
              { keys: ['o4'], text: 'The records that tie the Oracle America and Cerner UEIs to Oracle.', links: entityLinks([...ORACLE_AMERICA_UEIS, ...CERNER_UEIS]) },
            ]
          : [
              { keys: ['z1', 'z2', 'z3', 'z4'], text: totals, links: entityLinks() },
              {
                keys: ['z5'],
                text: "NASA's award record for 80MSFC23CA014, whose transaction list shows modification P00036 (action type: novation agreement) and the later actions under Blue Origin Manufacturing, LLC (UEI RAR2RMTVZYX3).",
                links: [...award(HLS_BLUE_ORIGIN), ...entities.filter((e) => e.uei === 'RAR2RMTVZYX3' && /usaspending\.gov/.test(e.evidence_url)).map((e) => ({ label: `${e.entity_name} (${e.uei})`, href: e.evidence_url }))],
              },
              { keys: ['z6'], text: `The USAspending recipient profiles of Honeybee Robotics' three UEIs (${NOT_LINKED.honeybeeUeis.join(', ')}), each with its own parent record.`, links: NOT_LINKED.honeybeeUrls.map(([label, href]) => ({ label, href })) },
              { keys: ['z7'], text: 'Name searches in the USAspending recipient search, run 20 Oct 2026.', links: [search] },
            ];
  return notes.map((x, i) => ({ ...x, n: i + 1 }));
}

/**
 * The note under the award-type table. A15 S-1: on the Musk page the $11.2 billion sentence (m2b) adds contracts and
 * IDV obligations, so the note names that one exception; on the other three pages nothing adds them.
 */
export function typeTableNote(group: StoryGroup, rows: readonly StoryTxn[]): string {
  if (group === 'musk') {
    const both = billions(sumCents(ofUeis(rows, SPACEX_UEIS).filter((r) => r.award_category !== 'assistance')), 1);
    return `Contracts and indefinite-delivery vehicles are separate lines; the only figure that adds them is the ${both} above, which says so. Assistance has no competition coding.`;
  }
  return 'Contracts and indefinite-delivery vehicles are separate lines and are not added together in any total on this page. Assistance has no competition coding.';
}

/** The saved query behind every table (PostgREST reads the same view and table with the anon key). */
export const savedQuery = (group: StoryGroup): string =>
  `-- Totals by award type and fiscal year (the view this page reads)
select award_category, fiscal_year,
       sum(net_obligations)         as net_obligations,
       sum(noncompeted_obligations) as coded_not_competed
from subject_money_summary
where subject_group = '${group}'
group by award_category, fiscal_year
order by award_category, fiscal_year;

-- Every transaction behind the tables (one row per USAspending transaction)
select * from subject_award_transactions
where subject_group = '${group}'
order by action_date, award_id;`;

// ---------------------------------------------------------------- tables

export interface FyRow {
  label: string;
  fy: Record<number, number>;
  total: number;
  /** Coded not competed over obligations with a competition code; null where not applicable or not meaningful. */
  ncShare: number | null;
  nc: number | null;
  sub?: boolean;
}

function fyRow(label: string, rows: readonly StoryTxn[], withShare: boolean, sub = false): FyRow {
  const fy: Record<number, number> = {};
  for (const y of FISCAL_YEARS) fy[y] = sumCents(rows.filter((r) => r.fiscal_year === y));
  const total = sumCents(rows);
  const coded = rows.filter((r) => r.extent_competed_code != null);
  const codedSum = sumCents(coded);
  const nc = sumCents(coded.filter(notCompeted));
  // Shares print only on rows of $1 million or more with a share between 0 and 100 percent (m1-subject-money.md §2).
  const meaningful = withShare && codedSum >= 100_000_000 && nc >= 0 && nc <= codedSum;
  return { label, fy, total, nc: withShare ? nc : null, ncShare: meaningful ? nc / codedSum : null, sub };
}

const CATEGORY_LABEL: Record<AwardCategory, string> = {
  contract: 'Contracts (definitive contracts, orders, purchase orders)',
  idv: 'Indefinite-delivery vehicles (obligations on the vehicle itself)',
  assistance: 'Assistance (grants and other assistance)',
};

/** Net obligations by award type and fiscal year. */
export function categoryTable(rows: readonly StoryTxn[]): FyRow[] {
  return (['contract', 'idv', 'assistance'] as const).map((c) => fyRow(CATEGORY_LABEL[c], rows.filter((r) => r.award_category === c), c === 'contract'));
}

/** Contract obligations by awarding agency, each agency followed by its sub-agencies (as recorded on each transaction). */
export function agencyTable(rows: readonly StoryTxn[], topAgencies = 8, subsPerAgency = 4): FyRow[] {
  const K = contracts(rows);
  const byAgency = new Map<string, StoryTxn[]>();
  for (const r of K) byAgency.set(r.awarding_agency ?? 'Agency not recorded', [...(byAgency.get(r.awarding_agency ?? 'Agency not recorded') ?? []), r]);
  const ranked = [...byAgency.entries()].sort((a, b) => sumCents(b[1]) - sumCents(a[1]));
  const out: FyRow[] = [];
  for (const [agency, list] of ranked.slice(0, topAgencies)) {
    out.push(fyRow(agency, list, true));
    const bySub = new Map<string, StoryTxn[]>();
    for (const r of list) bySub.set(r.awarding_sub_agency ?? 'Sub-agency not recorded', [...(bySub.get(r.awarding_sub_agency ?? 'Sub-agency not recorded') ?? []), r]);
    if (bySub.size < 2) continue;
    const subs = [...bySub.entries()].sort((a, b) => sumCents(b[1]) - sumCents(a[1]));
    for (const [sub, sl] of subs.slice(0, subsPerAgency)) out.push(fyRow(sub, sl, true, true));
    const rest = subs.slice(subsPerAgency).flatMap(([, sl]) => sl);
    if (rest.length) out.push(fyRow(`Other ${agency} offices (${subs.length - subsPerAgency})`, rest, true, true));
  }
  const others = ranked.slice(topAgencies);
  if (others.length) out.push(fyRow(`All other agencies (${others.length})`, others.flatMap(([, l]) => l), true));
  out.push(fyRow('Total, contracts', K, true));
  return out;
}

export interface RecipientRow {
  uei: string;
  name: string;
  total: number;
  nc: number;
}

/** Contract obligations by recipient UEI, as recorded. */
export function recipientTable(rows: readonly StoryTxn[]): RecipientRow[] {
  const m = new Map<string, StoryTxn[]>();
  for (const r of contracts(rows)) m.set(r.recipient_uei, [...(m.get(r.recipient_uei) ?? []), r]);
  return [...m.entries()]
    .map(([uei, list]) => ({ uei, name: list[list.length - 1].recipient_name ?? uei, total: sumCents(list), nc: sumCents(list.filter(notCompeted)) }))
    .sort((a, b) => b.total - a.total);
}

export interface AwardRow {
  awardId: string;
  category: AwardCategory;
  url: string;
  agency: string;
  recipient: string;
  uei: string;
  total: number;
  /** Extent competed and the FAR justification as recorded on the award's latest transaction in the window. */
  competition: string;
}

/** The largest awards by window obligations (contracts and IDVs). */
export function largestAwards(rows: readonly StoryTxn[], n = 5): AwardRow[] {
  return largestAwardIds(rows, n).map((id) => {
    const list = rows.filter((r) => r.award_id === id && r.award_category !== 'assistance');
    const last = [...list].sort((a, b) => (a.action_date + (a.modification_number ?? '')).localeCompare(b.action_date + (b.modification_number ?? ''))).at(-1)!;
    const agency = last.awarding_sub_agency && last.awarding_sub_agency !== last.awarding_agency ? `${last.awarding_agency}: ${last.awarding_sub_agency}` : (last.awarding_agency ?? '');
    const competition = [last.extent_competed, last.other_than_full_open].filter(Boolean).join('; ') || 'Not recorded';
    return { awardId: id, category: last.award_category, url: last.usaspending_url, agency, recipient: last.recipient_name ?? last.recipient_uei, uei: last.recipient_uei, total: sumCents(list), competition };
  });
}

/** The summary view's category totals equal the transaction rows (cents), per category and fiscal year. */
export function viewMatches(rows: readonly StoryTxn[], summary: readonly { fiscal_year: number; award_category: string; net_obligations: number | string | null }[]): boolean {
  const key = (c: string, y: number) => `${c}|${y}`;
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  for (const r of rows) a.set(key(r.award_category, r.fiscal_year), (a.get(key(r.award_category, r.fiscal_year)) ?? 0) + cents(r.federal_action_obligation));
  for (const s of summary) b.set(key(s.award_category, s.fiscal_year), (b.get(key(s.award_category, s.fiscal_year)) ?? 0) + cents(s.net_obligations));
  return a.size === b.size && [...a.entries()].every(([k, v]) => b.get(k) === v);
}
