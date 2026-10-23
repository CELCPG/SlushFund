/**
 * W2: every sentence on "The President's securities transactions during the Iran war" (/investigations/president-iran-war), as
 * templates with live figure slots. Plain TypeScript with no runtime imports, so scripts/verify-gates.mjs can rebuild every sentence
 * from its own DB dump with the same code and compare it with the rendered page.
 *
 * DRAFT_UNTIL_AW1 was the guard for the copy written from the pre-registration answers before the audits. AW1 (independent
 * data + page audit, 2026-10-23) returned GO-WITH-FIXES: its allowed sentences R1-R6 replaced the drafts in this file
 * character for character (R5/R6 approved by Colin at 16:02 EDT), the D1 issuer corrections were applied, and the chronology
 * was re-frozen with amendment A4 (401 rows). AW1-R (short re-audit) returned GO-WITH-FIXES with one fix, F1 (meta
 * description), applied in 1eee049 and re-gated at 1,418 requests / 0 failed. Flip discipline: the page refuses to render
 * on production while this is true (page.tsx, the index card, the sitemap and the day route all follow
 * iranWarStoryLive(DRAFT_UNTIL_AW1) in flags.ts); scripts/verify-gates.mjs has rows proving whichever state holds.
 * Set false with the AW2 GO - after the reply letters go out (pre-registration: letters before deploy; IRAN_WAR_STORY_DATE
 * must then be the send date, set via the environment at deploy build time).
 */
import type { CongressGroup, Disclosure, FeeCover, GroupTable, IranWarFigures, M3Result, PostingMonth } from './iran-war-core';

export const DRAFT_UNTIL_AW1 = false;

// ---------------------------------------------------------------- small formatters (same output as iran-war-core.ts)

const int = (n: number): string => Math.round(n).toLocaleString('en-US');
const usd = (n: number): string => `$${int(n)}`;
const dateOf = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
const monthOf = (m: string): string => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', year: 'numeric' });
const percentOf = (part: number, whole: number, places = 1): string => (whole ? (Math.round((100 * part) / whole * 10 ** places) / 10 ** places).toFixed(places) : 'n/a');
/** "p = 0.029", and "p < 0.001" (never "p = less than 0.001"). */
const pEq = (p: number): string => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
/** A sum of band bottoms and band tops, printed as a range that always contains the true range. */
const rangeOf = (min: number, max: number): string => `between ${usd(min)} and ${usd(max)}`;

// ---------------------------------------------------------------- fixed text

export const IRAN_WAR_HEADLINE = "The President's securities transactions during the Iran war";
export const IRAN_WAR_KICKER = 'Investigation · OGE financial disclosure records';
export const IRAN_WAR_BYLINE = 'SlushFund';
export const IRAN_WAR_DESCRIPTION =
  "What the President's financial disclosure reports list for the months of the 2026 Iran war, when the public could see them, and a dated chronology of the war from official sources, one date at a time.";
/**
 * The "Why this story" line: AW1's allowed sentence R5 (audit-2026-10-23-slushfund-aw1.md), verbatim, approved by Colin on 2026-10-23 at
 * 16:02 EDT (option a, w3-colin-rulings.txt). The earlier text (editorial draft section 1) said "of both parties"; AW1's R5 says "of every party"
 * (the member table holds an Independent).
 */
export const IRAN_WAR_SELECTION_LINE =
  "SlushFund's founder asked for this story because the President's own disclosure reports list thousands of securities transactions in an account in his name while he was making decisions on war, oil and tariffs that move markets. We lay out what those reports list, day by day, beside what the government did and said, and apply the same yardstick to every member of Congress, of every party, who reported trades in these months.";

/**
 * The "Our view" box: AW1's allowed sentence R6 (audit-2026-10-23-slushfund-aw1.md), verbatim, approved by Colin on 2026-10-23 at 16:02 EDT
 * (option a, w3-colin-rulings.txt). It replaces the earlier approved box, which printed "insider" (pre-registration section 7) and an
 * unsupported "in minutes" claim. The box label carries the "Our view" marker; the first printed sentence is the one after it. The last
 * sentence prints "Our report card" as a link to GRADE_METHOD_PATH. Opinion about policy only: no sentence here states or implies that
 * any named person committed a crime.
 */
export const IRAN_WAR_OUR_VIEW_LABEL = 'Our view';
export const IRAN_WAR_OUR_VIEW_SENTENCES = [
  "The people who decide on war, tariffs and sanctions should not be trading individual stocks.",
  "When an official's own decisions can move markets, the public has no way to know whether that official's trades use information no one else has.",
  "On the other side of every trade are ordinary investors, including the retirement savings of millions of Americans.",
  "That is why we support a ban on individual stock trading by the President, the Vice President, members of Congress and senior officials, whatever their party.",
];
export const IRAN_WAR_OUR_VIEW_CARD_LEAD = "Our report card";
export const IRAN_WAR_OUR_VIEW_CARD_TAIL = " grades each member of Congress's own reported trading over the last 24 months against such a ban: an A means no individual-stock trades were reported.";
/** Pre-registration section 4: printed on every page that shows the chronology, above the chart and again in the day panel. */
export const IRAN_WAR_FIXED_LINE = 'A sequence of dates is not evidence that one event caused the other.';
export const DRAFT_BANNER = 'Draft: not audited';
export const DRAFT_BANNER_NOTE = 'The sentences on this page are drafts and have not been audited. The figures are read live from our database. This page is not public.';

/**
 * The date in "We asked ... for comment on <date>". Apex sets it with the IRAN_WAR_STORY_DATE environment variable, on the day the
 * letters are sent and SHOW_IRAN_WAR_STORY=1 goes on. It is its own constant: it does not read INVESTIGATIONS_V2_DATE.
 */
export const IRAN_WAR_STORY_DATE: string = (typeof process !== 'undefined' && process.env.IRAN_WAR_STORY_DATE?.trim()) || '[send date not set]';
export const iranWarAskedLine = (who: string): string => `We asked ${who} for comment on ${IRAN_WAR_STORY_DATE} and will add any response here.`;
export const IRAN_WAR_ASKED: readonly string[] = ["the White House Counsel's office", 'the Trump Organization'];

/** The D15 constants (president-hub-core.ts / president.ts); verify-gates asserts these equal the originals. */
export const COMPLIANCE_SENTENCE = 'Every report also carries the agency ethics official’s signed opinion that the filer is in compliance with applicable laws and regulations.';
export const FORM_RULE_SENTENCE = 'The form asks for each transaction to be reported within 30 days of the filer learning of it, and no later than 45 days after it.';
export const NOT_REQUIRED_SENTENCE = 'Not computed: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.';

/** Pre-registration section 6, verbatim. */
export const NULL_RESULT_PHRASE = "the share of energy and defense purchases in the war's first month was not different from the two months before";

// ---------------------------------------------------------------- the dek and section 1: the account

export function dek(f: IranWarFigures): string {
  const p = f.president;
  return `The President's reports list ${int(p.total)} securities transactions with trade dates from ${dateOf(p.firstTrade ?? '')} to ${dateOf(p.lastTrade ?? '')}. This page sets out what they list, when the public could see them, and a dated chronology of the war from official sources for Dec 1, 2025 to Jul 31, 2026.`;
}

export function accountLines(f: IranWarFigures): string[] {
  const p = f.president;
  return [
    `Officials who must file a financial disclosure report list their securities transactions on the Office of Government Ethics (OGE) Form 278-T. The ${int(p.reports)} reports the President signed list ${int(p.total)} securities transactions.`,
    'Each line gives a trade date, the asset, whether it was a purchase or a sale, and an amount band. The form asks for no price, no cost basis and no holdings, so none of those can be read from it.',
    'An amount band is a range, such as $1,001 to $15,000. Where this page adds amounts, it adds the bottom of every band and the top of every band, and prints the result as a range.',
    `${FORM_RULE_SENTENCE} This page says "reported more than 45 days after the trade" when the date the President signed the report is more than 45 days after the trade date, and draws no other conclusion from that count.`,
  ];
}

export const QUALIFIED_TRUST_TITLE = "What OGE's rules say about a qualified blind trust";
export const QUALIFIED_TRUST_LEAD =
  'Federal rules set out how a qualified trust works (5 CFR part 2634, subpart D). The lines below are quoted from the regulation as published on eCFR on Oct 20, 2026. We do not say whether any of them applies to the transactions on this page.';
export interface RuleQuote { cite: string; text: string }
export const QUALIFIED_TRUST_QUOTES: readonly RuleQuote[] = [
  {
    cite: '5 CFR 2634.401(a)',
    text: 'The primary purpose of an executive branch qualified trust is to confer on an independent trustee and any other designated fiduciary the sole responsibility to administer the trust and to manage trust assets without participation by, or the knowledge of, any interested party or any representative of an interested party.',
  },
  { cite: '5 CFR 2634.402(d)', text: 'Interested party means the President, the Vice President, an employee, a nominee or candidate as described in § 2634.201, and the spouse and any minor or dependent child of the President, ...' },
  { cite: '5 CFR 2634.407(a)', text: 'No trust will be considered qualified for purposes of the Act until the Office of Government Ethics certifies the trust prior to execution.' },
  {
    cite: '5 CFR 2634.408(a)(1)',
    text: "There must be no direct or indirect communications with respect to the qualified trust between an interested party or the party's representative and the independent trustee or any other designated fiduciary with respect to the trust unless:",
  },
  { cite: '5 CFR 2634.411(a)', text: 'If the employee files a public financial disclosure report, the employee must report the trust as an asset, including the overall category of value of the trust.' },
  {
    cite: '5 CFR 2634.413(a)(1)',
    text: 'The executed trust instrument and any amendments (other than those provisions which relate to the testamentary disposition of the trust assets), and a list of the assets which were transferred to the trust, categorized as to the value of each asset.',
  },
];
export const QUALIFIED_TRUST_FOUND = [
  'In the OGE pages we retrieved (as of Oct 20, 2026) we found model documents and procedures, and no certification of a qualified blind or diversified trust for the President. Those pages do not publish individual certifications, so this is the absence of a finding in what we retrieved, not a finding that none exists.',
  'Nothing we hold states who decides the trades. If a reply to our questions states it, we print the reply word for word under "Responses".',
];

// ---------------------------------------------------------------- sections 2 and 3: the windows

export const WINDOW_KICKER = { P1: 'Jan 2 to Feb 27, 2026', P2: 'Feb 28 to Mar 31, 2026', P3: 'Apr 1 to Jul 31, 2026' } as const;
export const STRIKES_LINE = 'CRS report R48887 gives February 28, 2026 as the date U.S. and Israeli strikes on Iran began.';

/** The counts, the band range, the kinds of asset and the groups for one window. */
export function windowLines(t: GroupTable, lead: string): string[] {
  const other = t.all.n - t.all.purchases - t.all.sales;
  const kinds = t.byInstrument;
  const unmapped = kinds.unmapped.n;
  return [
    `${lead}, the reports list ${int(t.all.n)} securities transactions: ${int(t.all.purchases)} purchases and ${int(t.all.sales)} sales${other ? `, and ${int(other)} of another type` : ''}.`,
    `Added up, the amount bands run ${rangeOf(t.all.minSum, t.all.maxSum)}. That is the sum of the bottoms and the sum of the tops of the bands, not a total.`,
    `By kind of asset: ${int(kinds.stock.n)} stocks, ${int(kinds.bond.n)} bonds and ${int(kinds['fund/ETF'].n)} funds${unmapped ? `, and ${int(unmapped)} we could not place` : ''}.`,
    `${int(t.ED.n)} of the ${int(t.all.n)} are in issuers in our energy or defense groups. ${int(t.other.n)} are in other issuers, and ${int(t.unclassified.n)} are in issuers we could not classify; we do not guess.`,
  ];
}
export const beforeLines = (f: IranWarFigures): string[] => windowLines(f.president.windows.P1, 'In the two months before the strikes (Jan 2 to Feb 27, 2026)');
export const firstMonthLines = (f: IranWarFigures): string[] => windowLines(f.president.windows.P2, "In the war's first month (Feb 28 to Mar 31, 2026)");

export const SIC_CAPTION = (win: string): string => `Stock transactions by industry (SEC industry code, two-digit major group), ${win}.`;
export const FUNDS_SUMMARY = (win: string): string => `Every fund and ETF line, ${win}, by printed name`;
export const VOLUME_CAPTION = 'Securities transactions the reports list, by trade month.';
export function volumeLine(f: IranWarFigures): string {
  const p0 = f.president.windows.P0;
  return `In 2025 (from January 21), the reports list ${int(p0.all.n)} securities transactions, ${int(p0.byInstrument.bond.n)} of them bonds. The table shows every month.`;
}
export const WINDOWS_CAPTION = 'The three windows side by side. Counts of securities transactions by trade date; amounts are ranges of band bottoms and tops.';

// ---------------------------------------------------------------- section 4: the timeline

export const TIMELINE_INTRO = 'Each tick is an entry in our chronology of the war; each bar is the number of securities transactions the reports list with that trade date. Select a day to open its records.';
export function chronologyLines(f: IranWarFigures): string[] {
  const c = f.chronology;
  const out = f.outsideAxis;
  return [
    `The chronology holds ${int(c.total)} dated entries: ${int(c.byLane.government ?? 0)} government entries (acts and statements), ${int(c.byLane.president_post ?? 0)} posts by the President on Truth Social that match a word list fixed before any transaction was joined to the chronology, and ${int(c.byLane.oversight ?? 0)} letters and statements from members of Congress. ${int(c.labelled)} are labelled on the chart; the rest open when you select their day. It does not include spoken remarks.`,
    ...(out.length ? [`${int(out.length)} later ${out.length === 1 ? 'entry' : 'entries'} (${out.map((o) => dateOf(o.date)).join(', ')}) fall${out.length === 1 ? 's' : ''} outside the chart's dates and ${out.length === 1 ? 'is' : 'are'} in the table and the download.`] : []),
    'The government entries are the acts and statements we collected from the sources listed under Method; they are not every act that meets our rule. An independent audit listed 36 more, including the June 17, 2026 signing of the U.S.-Iran memorandum of understanding, and they will be added in a dated amendment. The test does not use the chronology.',
  ];
}
export const BRENT_LINE = 'The line is the Brent crude oil spot price in dollars a barrel, daily, from the U.S. Energy Information Administration. It is market context only: we compute no return, gain or loss for any transaction.';
export const TIMELINE_LEGEND_WIDE =
  'Bars above the line are purchases and bars below are sales, split by group: energy or defense, other, and unclassified. Bar height is the square root of the count so that small days stay visible; the dotted lines mark 10, 50, 100 and 200 transactions.';
export const TIMELINE_LEGEND_NARROW =
  'Bars to the right of the line are purchases and bars to the left are sales, split by group: energy or defense, other, and unclassified. Bar length is the square root of the count so that small days stay visible.';
export const TIMELINE_KEYBOARD = 'Keyboard: focus the chart, then use the arrow keys to move a day (with Shift, a week), Page Up and Page Down to move a month, and Enter to open the day.';
export const TABLE_TOGGLE_ON = 'As a table';
export const TABLE_TOGGLE_OFF = 'As a chart';
export const labelledShow = (n: number): string => `Show the ${int(n)} labelled entries`;
export const LABELLED_HIDE = 'Hide the labelled entries';
export const DAY_NO_CHRON = 'No chronology entry has this date.';
export const DAY_NO_TX = 'The reports list no securities transaction with this trade date.';
export const DAY_NONE_ED = 'None reported on this date';
export const DAY_LOADING = 'Loading the records for this day...';
export const DAY_ERROR = 'Figures unavailable: the records for this day could not be loaded. Try again in a few minutes.';
export const DAY_BRENT = 'Brent crude oil spot price (EIA): ${brent} a barrel.';
export const DAY_BRENT_NONE = 'The EIA lists no Brent price for this date.';
export const DAY_COUNT = '{n} securities transactions are listed with this trade date, {ed} of them in issuers in our energy or defense groups.';

// ---------------------------------------------------------------- section 5: the test

export const TEST_QUESTION =
  "One test was written down before we queried the transactions for this story: among purchases of stocks, is the share in energy or defense issuers different in the war's first month from the two months before?";
/** The first count carries the label ("stock purchases in issuers we could classify"); the second reads "33 of 734 (4.5 percent)" (allowed sentences R2 and R4). */
const share = (s: { ed: number; other: number }, label: boolean): string => `${int(s.ed)} of ${int(s.ed + s.other)}${label ? ' stock purchases in issuers we could classify' : ''} (${percentOf(s.ed, s.ed + s.other)} percent)`;
const verdict = (bound: boolean, primary: boolean): string => `${bound === primary ? 'still ' : ''}${bound ? 'significant' : 'not significant'}`;

/**
 * The one-sentence result with both A2 bounds in the same sentence, always (allowed sentences R2 for the President, R4 for Congress).
 * Congress (who non-empty): the p-value of a not-significant primary test carries no verdict clause, and an upper bound that would
 * make the difference significant says how many of the unclassified purchases sit in one member's report.
 */
export function m3Result(m: M3Result, who: string): string {
  const head = m.significant
    ? `By our pre-registered test, the share of energy and defense purchases${who} in the war's first month was ${m.direction} than in the two months before`
    : `By our pre-registered test, ${NULL_RESULT_PHRASE.replace('the share of energy and defense purchases', `the share of energy and defense purchases${who}`)}`;
  const body = `${share(m.b, true)} against ${share(m.a, false)} (two-sided Fisher exact test, ${pEq(m.p)}${m.significant ? ', significant at the 0.05 level' : who ? '' : ', not significant at the 0.05 level'})`;
  const n = m.a.unclassified + m.b.unclassified;
  if (n === 0) return `${head}: ${body}; no stock purchases in issuers we could not classify were left out of the test.`;
  const lower = `if all of them are counted as not energy or defense, ${pEq(m.lowerBound.p)} and the result is ${verdict(m.lowerBound.significant, m.significant)}`;
  const upper =
    who && m.upperBound.significant && !m.significant
      ? `if all are counted as energy or defense, ${pEq(m.upperBound.p)} and the difference would be significant at the 0.05 level, but ${int(m.topUnclassified)} of those ${int(n)} are in one member's report (see the table)`
      : `if all are counted as energy or defense, ${pEq(m.upperBound.p)} and the result is ${verdict(m.upperBound.significant, m.significant)}`;
  return `${head}: ${body}; ${int(n)} stock purchases in issuers we could not classify sit out of the test, and ${lower}, while ${upper}.`;
}
/** Allowed sentences A7 (the President) and A13 (Congress, descriptive). */
export function m3Sales(m: M3Result, who: string): string {
  const sh = (s: { ed: number; other: number }, label: boolean) => `${int(s.ed)} of ${int(s.ed + s.other)}${label ? ' sales of stock in issuers we could classify' : ''} (${percentOf(s.ed, s.ed + s.other)} percent)`;
  const tail = who ? `(${pEq(m.p)}; descriptive, not a test result)` : `(${pEq(m.p)}, ${m.significant ? 'significant' : 'not significant'} at the 0.05 level)`;
  return `The same test on sales${who || ', reported as a secondary result'}: ${sh(m.b, true)} in the first month against ${sh(m.a, false)} in the two months before ${tail}.`;
}
export const TEST_SCOPE = 'The test counts reported transactions in one account. It says nothing about why: not intent, not who decided, and not profit.';
export const TEST_ONLY =
  "This is the one primary test the pre-registration names. The same test on the President's sales, and on members of Congress below, was registered too; those results are reported for comparison, and their p-values are descriptive. The windows, the groups and the test were written down before we queried the transactions for this story and were not changed afterwards (see Method for the issuer corrections made after the independent audit).";

// ---------------------------------------------------------------- section 6: the oil-futures questions

export const OIL_KICKER = 'Oversight, not attribution';
export function oilLines(f: IranWarFigures): string[] {
  const n = f.chronology.byLane.oversight ?? 0;
  return [
    `The chronology holds ${int(n)} letters and statements from members of Congress about trading in oil futures, and in one case on a prediction market, around announcements by the Administration and by Iran. Each is listed here with its date and its source.`,
    "No document on this page says who placed those trades, and nothing here links them to the President's account or to any person.",
  ];
}

// ---------------------------------------------------------------- section 7: when the public saw it

export const PUBLIC_INTRO = 'OGE posts each report on its website after the President signs it. For each trade month, the bars show how many of that month\'s transactions became public on each OGE posting date.';
export function postingLine(m: PostingMonth): string {
  return m.firstPosted ? `OGE first posted a transaction from ${monthOf(m.month)} on ${dateOf(m.firstPosted)}.` : `No transaction from ${monthOf(m.month)} has an OGE posting date in our data.`;
}
const OVER45_LEAD = { P1: 'In the two months before the strikes', P2: "In the war's first month", P3: 'From Apr 1 to Jul 31, 2026' } as const;
/** Allowed sentence A8 (the war's first month); the other two windows follow the same form. */
export function over45Line(d: Disclosure, win: 'P1' | 'P2' | 'P3'): string {
  return `${OVER45_LEAD[win]}, ${int(d.over45)} of the ${int(d.computed)} transactions with a computed gap were reported more than 45 days after the trade. ${int(d.notComputed)} are not computed. ${NOT_REQUIRED_SENTENCE}`;
}
export const BINS_CAPTION = 'Days from the trade to the date the President signed the report, in bins that carry no verdict. Bins over 45 days are the transactions reported more than 45 days after the trade.';
export const POST_BINS_CAPTION = "Days from the trade to the date OGE posted the report on its website.";
export function feeIntro(fees: readonly FeeCover[], reportsInWindows: number): string {
  return `On ${int(fees.length)} of the ${int(reportsInWindows)} reports that hold transactions from these windows, the reviewing official wrote a late-fee note in the comments box. Each note is quoted below exactly as printed.`;
}
export const FEE_LABEL = 'Comments of Reviewing Officials box, verbatim: ';
export const feeOpinion = (date: string | null): string => (date ? ` This report's opinion is dated ${dateOf(date)}.` : '');
export function feeRows(c: FeeCover): string {
  const part = (n: number, label: string) => (n ? `${int(n)} in ${label}` : '');
  const parts = [part(c.rows.P1, 'the two months before the strikes'), part(c.rows.P2, "the war's first month"), part(c.rows.P3, 'months two to five')].filter(Boolean);
  return `${c.label}: holds ${parts.join(', ')}.`;
}

// ---------------------------------------------------------------- section 8: the same yardstick

export const CONGRESS_KICKER = 'Every member, every party';
export function congressLines(f: IranWarFigures): string[] {
  const c = f.congress;
  const w = c.pooled.windows;
  return [
    `The same windows, groups and measures are applied to every member of Congress who reported securities transactions with trade dates from Jan 2, 2026 to ${dateOf(c.dataThrough ?? '')}. All ${int(c.members.length)} are listed, in alphabetical order by last name, whatever their party. We run no test by party, and a party is shown only as a text label.`,
    `Together they reported ${int(w.P1.all.n)} securities transactions in the two months before the strikes, ${int(w.P2.all.n)} in the war's first month and ${int(w.P3.all.n)} from Apr 1 to ${dateOf(c.dataThrough ?? '')}.`,
  ];
}
export function congressTestLines(g: CongressGroup): string[] {
  const who = g.label === 'All members' ? ' by members of Congress' : ` by ${g.label} members`;
  return [m3Result(g.m3, who), m3Sales(g.m3Sales, who)];
}
export const CONGRESS_TABLE_CAPTION = 'Every member who reported securities transactions with trade dates in the three windows, in alphabetical order by last name. Party is the label in the member\'s record.';
export const CONGRESS_LATENESS_LABEL = 'Lateness not computed (see note)';
export const CONGRESS_LATENESS_NOTE =
  "Lateness not computed: in Jan 2 to Feb 27, one line is below the $1,000 reporting threshold; in Feb 28 to Mar 31, the earliest filing for one line is not known; in Apr 1 to Jul 31, one line's trade date as filed is after the filing date.";
export const CONGRESS_NOTE = "These are the transactions in the members' own reports, as the site's trades pages already show them. They are not a ranking.";

// ---------------------------------------------------------------- section 9: what these records don't show

export const LIMITS: readonly string[] = [
  'No prices. The 278-T gives an amount band, not what was paid or received.',
  'No gain or loss. With no prices, no cost basis and no holdings, nothing here can say whether any transaction made or lost money, and this page computes no return for any of them.',
  'No holdings. The reports list transactions, not what the account held before or after them.',
  'No decision-maker. The reports list transactions in the President\'s reports; they do not say who gave the instruction for any of them.',
  'Only what the form requires. A transaction that the 278-T does not require to be listed is not here.',
  'No transactions after the last trade date in our data. A later 278-T for the President, posted by OGE on Oct 8, 2026, is not yet in our data.',
  "No spoken remarks. The chronology holds government acts, the President's posts on Truth Social and letters from members of Congress; interviews and press remarks are out of scope except where a government source quotes them.",
  'Not every government act. The government entries are those we collected; an audit found more that meet our rule, listed in the audit file.',
  'Groups are ours. An issuer is placed in a group by its SEC industry code or by federal money from the Department of Defense; an issuer we could not place stays unclassified.',
  IRAN_WAR_FIXED_LINE,
];

// ---------------------------------------------------------------- section 10: method and downloads

export const PREREG_LINE =
  'The questions, the windows, the groups, the measures and the wording rules were written down on Oct 22, 2026 at 6:00 pm ET, before any query of the trade tables for this story. Three amendments dated Oct 23, 2026 were made before any transaction was joined to the chronology or to the groups; they are listed in the file. Before writing it we had seen the 12 largest transactions on our own President pages, our published totals, and news reports describing some of the March trades, including energy and defense names; the file lists these prior looks.';
export const CHRONOLOGY_LINES = [
  "The chronology is built from official sources (whitehouse.gov, the Federal Register, and releases from the Departments of War, State, Treasury and Energy, CENTCOM, the EPA and CBP), from letters and statements by members of Congress, and from the President's own posts. Every original post by @realDonaldTrump from Dec 1, 2025 to Jul 31, 2026 that matches a fixed list of words is included, except where the word is used in another sense; re-shares are out, and each exclusion is written down with its reason. CRS report R48887 gives the start of the war. A post is labelled on the chart only when CRS report R48887 or one of the congressional documents cites it.",
  'It was frozen on Oct 23, 2026 at 8:55 am ET, before any transaction was joined to it, and re-frozen the same day after the independent audit (amendment A4: two posts added, three summaries reworded). Every entry carries its source link and an archive copy.',
];
export const GROUPS_LINES = [
  'Energy (E): the issuer\'s SEC industry code is 1311, 1381, 1382, 1389, 2911, 3533, 4610, 4612, 4613, 4922, 4923, 4924, 5171, 5172 or 6792; a fund counts as energy only when its printed name contains energy, oil, gas or petroleum.',
  'Defense by industry (D-SIC): the SEC industry code is 3480 to 3489, 3720, 3721, 3724, 3728, 3730, 3731, 3760, 3761, 3764, 3769, 3795 or 3812.',
  "Defense by federal money (D-DoD): a company in the issuer's group (by parent UEI or the issuer's SEC Exhibit 21) is among the Department of Defense's top 50 prime contract recipients by fiscal 2025 obligations, as USAspending lists each recipient; the link from that recipient to the issuer is an ID match, never a name alone.",
  'An issuer that is a registered investment company, ETF or commodity trust on EDGAR is counted as a fund, whatever the report prints. An issuer we cannot place stays unclassified and is never guessed; unclassified issuers sit out of the test.',
  "The President's reports print no ticker or CUSIP, so each asset name was matched to an SEC registrant by its name under fixed rules (exact name, then abbreviation and word-set matches). An independent audit checked 163 of these matches against EDGAR; it corrected three issuers before publication (AECOM, GE Aerospace and Loar Holdings), and three bond issuers. Names the rules could not match stay unclassified and sit out of the test. Before these corrections the test gave p = 0.031.",
];
export const MEASURES_LINES = [
  'Counts and band ranges by window, month, purchase or sale, and group. The test is Fisher\'s exact test, two-sided, on counts of stock purchases, with α = 0.05.',
  'Disclosure: days from the trade to the date the President signed, days from the trade to the OGE posting date, and the cover notes, quoted word for word.',
  "Market context: EIA daily Brent (RBRTE) and WTI (RWTC) spot prices, shown as a chart. No return is computed for any transaction.",
];
export const DOWNLOADS = {
  prereg: 'The pre-registration, with its dated amendments (Markdown)',
  chronology: 'The frozen chronology, 401 rows (CSV)',
  issuers: 'The issuer map: every issuer, its group and the evidence for it (CSV)',
};
export const chronologyShaLine = (sha: string): string => `sha256 of the chronology file: ${sha}`;
export const RESPONSES_INTRO = 'We asked for comment before publishing. Replies are printed word for word.';
