import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PARTS, CYCLE } from '@/components/v2/FundingPanel';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { RankBars } from '@/components/v2/RankChart';
import SourceBar from '@/components/v2/SourceBar';
import TradesTable, { partyLetter } from '@/components/v2/TradesTable';
import { getDatasetStatuses, type DatasetKey } from '@/lib/v2/datasets';
import { LETTERS, averageLetter, type LetterOrNG } from '@/lib/v2/election-calc';
import {
  getCountdown, getGradedMembers, getMoneyTotals, getPresidentCount, getTopTraders, getTrades24, getWhatsNewAll,
} from '@/lib/v2/election';
import { buildHref, one, type SP } from '@/lib/v2/explorer';
import {
  ELECTION_PATH, GRADE_METHOD_PATH, MOST_ACTIVE_PATH, PRESIDENT_PATH, VOTER_PATH,
  campaignMoneyEnabled, electionCenterEnabled, gradesEnabled, mostActiveEnabled, presidentPageEnabled, voterPagesEnabled,
} from '@/lib/v2/flags';
import { fmtCount, fmtDate, fmtUsd, fmtUsdCompact } from '@/lib/v2/format';
import { GRADE_FIXED_LINE, NOT_GRADED_GROUP_LINE } from '@/lib/v2/grade-method';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';
import { getVoterStates, stateSlug, WHATS_NEW_DAYS, WHATS_NEW_SHOWN } from '@/lib/v2/voter';

export const revalidate = 1800;

// D17 Election Center. Behind electionCenterEnabled() (off on production unless SHOW_ELECTION_CENTER=1). Every section follows the
// flag of the data it shows (grades, campaign money, leaderboard, voter pages, President) and is left out, with no link to a page
// that answers 404, while that flag is off. Records only: ranked or grouped by a named measure, no endorsements, party is a text label.

export const ELECTION_TITLE = 'Election 2026: the records';

export function generateMetadata(): Metadata {
  if (!electionCenterEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: ELECTION_PATH,
    title: ELECTION_TITLE,
    description: 'Before the November 3 election: the Stock Trading Grade spread for every sitting member of Congress, campaign money from the FEC, the stock trades members reported, a page for every state, and the President’s reported securities transactions.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const PARTY_TABS = [
  { value: '', label: 'All members' },
  { value: 'Democrat', label: 'Democrat' },
  { value: 'Republican', label: 'Republican' },
] as const;

// One violet hue for every letter (strongest = A, fading to F), grey for Not graded: never a partisan or traffic-light coding. Not #1D1A4E:
// the T1 theme remaps that value (globals.css), which would break the ramp. A thin outline keeps the pale steps visible on any card.
const LETTER_FILL: Record<LetterOrNG, string> = { A: '#6A44F0', B: '#8A6CF3', C: '#A790F6', D: '#C2B2F9', F: '#DDD3FC', NG: '#7A7A8C' };
const SWATCH_EDGE = 'shadow-[inset_0_0_0_1px_rgba(128,128,128,.6)]';
const LETTER_NAME: Record<LetterOrNG, string> = { A: 'A', B: 'B', C: 'C', D: 'D', F: 'F', NG: 'Not graded' };

const pct1 = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%');
const pill = 'rounded-full px-3.5 py-1.5 text-[14px] font-semibold shadow-[0_0_0_1px_var(--color-line)]';

function Unavailable({ what }: { what: string }) {
  return <p className="rounded-2xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink" data-unavailable>Unavailable right now: {what} did not answer, so no figure is shown.</p>;
}

export default async function ElectionCenterPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!electionCenterEnabled()) notFound();
  const sp = await searchParams;
  const gradesOn = gradesEnabled();
  const moneyOn = campaignMoneyEnabled();
  const activeOn = mostActiveEnabled();
  const voterOn = voterPagesEnabled();
  const presOn = presidentPageEnabled();
  const party = PARTY_TABS.find((t) => t.value && t.value === one(sp.party))?.value ?? '';

  const [graded, money, top, trades24, presCount, news, states] = await Promise.all([
    gradesOn ? getGradedMembers() : Promise.resolve(null),
    moneyOn ? getMoneyTotals() : Promise.resolve(null),
    activeOn ? getTopTraders() : Promise.resolve(null),
    getTrades24(),
    presOn ? getPresidentCount() : Promise.resolve(null),
    getWhatsNewAll(),
    getVoterStates(),
  ]);
  const cd = getCountdown();

  const sourceKeys: DatasetKey[] = ['members', 'house_trades', 'senate_trades', ...(moneyOn ? (['campaign'] as DatasetKey[]) : [])];
  const statuses = await getDatasetStatuses(['members', 'house_trades', 'senate_trades']);

  const letters = graded?.members ?? [];
  const gradedCount = letters.filter((m) => m.letter !== 'NG').length;
  const notGradedCount = letters.length - gradedCount;
  const inParty = letters.filter((m) => !party || m.party === party);
  const spread = Object.fromEntries(LETTERS.map((l) => [l, inParty.filter((m) => m.letter === l).length])) as Record<LetterOrNG, number>;
  const moneyOk = money && money.state === 'ok' ? money : null;
  const t = moneyOk?.totals;

  const countdownText = cd.days > 1 ? `${fmtCount(cd.days)} days` : cd.days === 1 ? '1 day' : null;
  const countdownLine = cd.days > 1 || cd.days === 1
    ? <>until Election Day, Tuesday, November 3, 2026</>
    : cd.days === 0 ? <>Election Day is today, Tuesday, November 3, 2026</> : <>Election Day was Tuesday, November 3, 2026, {fmtCount(-cd.days)} {-cd.days === 1 ? 'day' : 'days'} ago</>;

  return (
    <div data-v2 data-election-center>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Congress · President · Money</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{ELECTION_TITLE}</h1>
        <p className="mt-3 max-w-[860px] text-[16px] text-on-deep max-md:text-[15px]">
          One page for the final stretch: what every sitting member of Congress reported trading, who funds their campaigns, a page for each state, and the President’s reported securities transactions. Every figure is read from public filings; each links onward to its source.
        </p>
        <p className="mt-2 max-w-[860px] font-semibold text-white" data-field="scope">
          This page lists the records of current members and the President. It is not a voter guide: it does not tell you how to vote, and it makes no claim about who is on your ballot.
        </p>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" data-field="countdown">
          {countdownText && <span className="font-display text-[56px] font-extrabold leading-none text-highlight max-md:text-[40px]">{countdownText}</span>}
          <span className="text-[18px] font-bold text-white max-md:text-[16px]">{countdownLine}</span>
        </p>
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={sourceKeys} className="mt-6" />

        {/* 1. Header KPIs */}
        <section className="pt-6" aria-labelledby="kpis" data-section="kpis">
          <h2 id="kpis" className="sr-only">Key figures</h2>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {gradesOn && (
              <KpiTile
                label="Members graded"
                value={graded ? fmtCount(gradedCount) : null}
                caption={graded ? `of ${fmtCount(letters.length)} sitting members have a letter grade; ${fmtCount(notGradedCount)} are not graded` : ''}
                source="Stock Trading Grade method"
                sourceHref={GRADE_METHOD_PATH}
                asOf={graded?.win.end ?? null}
                state={graded ? 'fresh' : 'unavailable'}
                unavailableReason="The trade database did not answer."
              />
            )}
            {moneyOn && (
              <KpiTile
                label="Campaign receipts"
                value={t ? fmtUsdCompact(t.raised) : null}
                caption={t ? `${fmtUsd(t.raised)} in total receipts reported by ${fmtCount(t.members)} members’ campaign committees, ${CYCLE}` : ''}
                source="FEC bulk data"
                sourceHref="https://www.fec.gov/data/"
                asOf={money && money.state === 'ok' ? money.coverageEnd ?? null : null}
                state={t ? 'fresh' : 'unavailable'}
                unavailableReason={money && money.state === 'missing' ? 'Campaign finance data: coming soon.' : 'The campaign finance data did not answer.'}
              />
            )}
            <KpiTile
              label="Disclosed trades"
              value={trades24 ? fmtCount(trades24.count) : null}
              caption={trades24 ? `transactions of every kind that members reported, dated ${fmtDate(trades24.start)} to ${fmtDate(trades24.end)}` : ''}
              source="House Clerk and Senate eFD"
              sourceHref="/data/trades"
              asOf={trades24?.end ?? null}
              state={trades24 ? 'fresh' : 'unavailable'}
              unavailableReason="The trade database did not answer."
            />
          </div>
        </section>

        {/* 2. Grade distribution */}
        {gradesOn && (
          <section id="grades" className="scroll-mt-24 pt-8" aria-labelledby="h-grades" data-section="grade-spread">
            <Card>
              <SectionHead
                as="h2"
                title={<span id="h-grades" className="text-[24px] max-md:text-[22px]">The Stock Trading Grade, across Congress</span>}
                sub={graded ? `How the ${fmtCount(inParty.length)} sitting ${party ? `${party}s` : 'members'} fall across the grades. Trades dated ${fmtDate(graded.win.start)} to ${fmtDate(graded.win.end)}.` : undefined}
              />
              {!graded ? (
                <Unavailable what="the trade database" />
              ) : (
                <>
                  <nav aria-label="Show members by party" className="mb-4 flex flex-wrap gap-2">
                    {PARTY_TABS.map((tab) => (
                      <Link
                        key={tab.value || 'all'}
                        href={`${buildHref(ELECTION_PATH, { party: tab.value || undefined })}#grades`}
                        aria-current={party === tab.value ? 'true' : undefined}
                        scroll={false}
                        className={`${pill} ${party === tab.value ? 'bg-deep text-white' : 'bg-card hover:bg-neutral-tint'}`}
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="flex h-12 w-full overflow-hidden rounded-lg bg-neutral-tint max-md:h-9" role="img" aria-label={`Members by grade: ${LETTERS.map((l) => `${LETTER_NAME[l]} ${spread[l]}`).join('; ')}.`} data-spread={LETTERS.map((l) => `${l}:${spread[l]}`).join(',')}>
                    {LETTERS.map((l) => (spread[l] > 0 ? <span key={l} title={`${LETTER_NAME[l]}: ${spread[l]}`} className={SWATCH_EDGE} style={{ width: `${(spread[l] / Math.max(1, inParty.length)) * 100}%`, background: LETTER_FILL[l] }} /> : null))}
                  </div>
                  <ul className="mt-4 grid grid-cols-6 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2" data-field="grade-legend">
                    {LETTERS.map((l) => (
                      <li key={l} className="min-w-0 rounded-2xl bg-page px-3.5 py-2.5" data-letter-count={l}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={`inline-block h-3 w-3 shrink-0 rounded-sm ${SWATCH_EDGE}`} style={{ background: LETTER_FILL[l] }} />
                          <span className="font-display text-[20px] font-extrabold leading-none">{LETTER_NAME[l]}</span>
                        </span>
                        <span className="mt-1 block font-mono text-[18px]">{fmtCount(spread[l])}</span>
                        <span className="block font-mono text-[12px] text-muted">{pct1(spread[l], inParty.length)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 space-y-2 text-[13.5px]">
                    <p data-field="not-graded-caveat">{NOT_GRADED_GROUP_LINE}</p>
                    <p className="font-semibold text-ink">{GRADE_FIXED_LINE} <Link href={GRADE_METHOD_PATH} className="font-normal underline">Method</Link></p>
                    {!party && <p className="text-muted">Members of every party are counted in “All members”; the party buttons show Democrats and Republicans only.</p>}
                  </div>
                </>
              )}
            </Card>
          </section>
        )}

        {/* 3. Money chart */}
        {moneyOn && (
          <section id="money" className="scroll-mt-24 pt-8" aria-labelledby="h-money" data-section="money">
            <Card>
              <SectionHead
                as="h2"
                title={<span id="h-money" className="text-[24px] max-md:text-[22px]">Where members’ campaign receipts came from</span>}
                sub={t ? `${CYCLE}, all members with a confirmed FEC record, through ${fmtDate(money && money.state === 'ok' ? money.coverageEnd : null) ?? 'the latest reports'}.` : undefined}
              />
              {!money ? (
                <Unavailable what="the campaign finance data" />
              ) : money.state === 'missing' ? (
                <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">Campaign finance data: coming soon</p>
              ) : money.state === 'error' || !t ? (
                <Unavailable what="the campaign finance data" />
              ) : t.sharesRaised > 0 ? (
                <>
                  <p className="text-[15.5px]">
                    Members’ campaign committees reported {fmtUsd(t.raised)} in total receipts in the {CYCLE}. The bar splits the {fmtUsd(t.sharesRaised)} reported by {fmtCount(t.sharesMembers)} of {fmtCount(t.members)} members whose shares can be printed, using each member’s own shares of receipts.
                  </p>
                  <div className="mt-4 flex h-9 w-full overflow-hidden rounded-lg bg-neutral-tint max-md:h-7" role="img" aria-label={`Shares of total receipts: ${PARTS.map((p) => `${p.label} ${pct1(t.byKey[p.key], t.sharesRaised)}`).join('; ')}.`} data-money-bar>
                    {PARTS.map((p) => (t.byKey[p.key] > 0 ? <span key={p.key} style={{ width: `${Math.min(100, (t.byKey[p.key] / t.sharesRaised) * 100)}%`, background: p.color }} /> : null))}
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[14px] max-md:grid-cols-1" data-field="money-legend">
                    {PARTS.map((p) => (
                      <li key={p.key} className="flex items-center gap-2" data-money-part={p.key}>
                        <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
                        <span>{p.label}: <b className="font-mono">{pct1(t.byKey[p.key], t.sharesRaised)}</b> <span className="font-mono text-muted">({fmtUsdCompact(t.byKey[p.key])})</span></span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[14.5px]" data-field="outside-spending">
                    Outside spending (independent expenditures, FEC Schedule E), not part of the receipts above: {fmtUsd(t.outsideSupport)} for these members, {fmtUsd(t.outsideOppose)} against.
                  </p>
                </>
              ) : (
                <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No member has printable shares in this period. See each member’s FEC record.</p>
              )}
              {t && (
                <p className="mt-3 text-[12.5px] text-muted">
                  Source: Federal Election Commission bulk data, {CYCLE}. Each member’s shares are of that campaign’s total receipts and do not add to 100: loans, transfers and other receipts are in no group; they are the same shares as the “Who funds them” panel on the member’s page, here multiplied by that member’s receipts and added up.
                  Members whose shares do not line up with their total receipts in this period are left out of the bar, not of the receipts total. Taking legal PAC money is not misconduct; this chart carries no grade.
                </p>
              )}
            </Card>
          </section>
        )}

        {/* 4. Trading leaderboard teaser */}
        {activeOn && (
          <section id="traders" className="scroll-mt-24 pt-8" aria-labelledby="h-traders" data-section="traders">
            <Card>
              <SectionHead
                as="h2"
                title={<span id="h-traders" className="text-[24px] max-md:text-[22px]">Most active stock traders in Congress</span>}
                sub={top ? `The ten members with the most individual-stock transactions reported for trades dated ${fmtDate(top.start)} to ${fmtDate(top.end)}. Ranked by transaction count only; party is a label.` : undefined}
                action={<Link href={MOST_ACTIVE_PATH} className="text-[14px] font-semibold text-trades-ink hover:underline">Full leaderboard</Link>}
              />
              {!top ? (
                <Unavailable what="the trade database" />
              ) : top.rows.length === 0 ? (
                <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No member has an individual-stock transaction in the window.</p>
              ) : (
                <>
                  <RankBars
                    rows={top.rows.map((r) => ({ key: r.bioguide, name: r.member.name, tag: `${partyLetter(r.member.party)}-${r.member.state}`, value: r.transactions, display: `${fmtCount(r.transactions)}${r.member.in_office ? '' : ' (former member)'}` }))}
                    label="Top 10 members by individual-stock transactions"
                    unit="Transactions"
                  />
                  <p className="mt-3 text-[12.5px] text-muted">
                    Counts of transactions in public filings: how much a member reported, not why. Not counted: funds, ETFs, Treasuries, municipal securities and other assets a stock-trading ban would allow. Reported value, reports filed more than 45 days after the trade, and the grade are on the <Link href={MOST_ACTIVE_PATH} className="underline">full leaderboard</Link>.
                  </p>
                </>
              )}
            </Card>
          </section>
        )}

        {/* 5. State grid */}
        <section id="states" className="scroll-mt-24 pt-8" aria-labelledby="h-states" data-section="states">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="h-states" className="text-[24px] max-md:text-[22px]">Find your state</span>}
              sub={`${voterOn ? 'Each tile opens that state’s page: its current senators and House members, each with the same panels. ' : ''}States, DC and territories, alphabetical.${gradesOn ? ' The letter is the average of the state’s graded members (A = 4, B = 3, C = 2, D = 1, F = 0, rounded to the nearest letter; Not graded members left out).' : ''}`}
            />
            {!states ? (
              <EmptyState title="The member list is unavailable right now" tone="warning" statuses={statuses}>
                The members database did not answer, so nothing is shown. Try again in a few minutes.
              </EmptyState>
            ) : (
              <ul className="grid grid-cols-7 gap-2 max-xl:grid-cols-6 max-lg:grid-cols-4 max-md:grid-cols-2" data-field="state-grid" data-state-count={states.length}>
                {states.map((s) => {
                  const total = s.senators + s.house;
                  const avg = gradesOn && graded ? averageLetter(letters.filter((m) => m.state === s.code).map((m) => m.letter)) : null;
                  const inner = (
                    <>
                      <span className="block font-semibold leading-tight">{s.name}</span>
                      <span className="mt-0.5 block text-[12.5px] text-muted">{fmtCount(total)} {total === 1 ? 'member' : 'members'}</span>
                      {gradesOn && (
                        <span className="mt-1 block text-[12.5px]" data-avg-letter={avg?.letter ?? 'none'}>
                          {!graded ? <span className="text-muted">grade unavailable</span> : avg ? <>Average grade <b className="font-display text-[16px] font-extrabold">{avg.letter}</b></> : <span className="text-muted">No member graded</span>}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={s.code} data-state={s.code}>
                      {voterOn
                        ? <Link href={`${VOTER_PATH}/${stateSlug(s.code)}`} className="block h-full rounded-2xl bg-page px-3 py-2.5 hover:bg-trades-tint">{inner}</Link>
                        : <div className="h-full rounded-2xl bg-page px-3 py-2.5">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
            {voterOn && <p className="mt-3 text-[13.5px]"><Link href={VOTER_PATH} className="font-semibold text-trades-ink hover:underline">Look up by ZIP code</Link></p>}
          </Card>
        </section>

        {/* 6. Presidential band */}
        {presOn && (
          <section id="president" className="scroll-mt-24 pt-8" aria-labelledby="h-president" data-section="president">
            <Link href={PRESIDENT_PATH} className="block rounded-card bg-card p-[22px] shadow-card hover:bg-neutral-tint max-md:rounded-2xl max-md:p-[18px]" data-link="president">
              <span className="block text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Executive branch</span>
              <h2 id="h-president" className="mt-0.5 font-display text-[24px] font-extrabold max-md:text-[22px]">President Trump: securities transactions</h2>
              <p className="mt-1.5 text-[15.5px]">
                {presCount != null
                  ? <><b className="font-mono text-[20px]" data-field="president-count">{fmtCount(presCount)}</b> securities transactions reported on OGE Form 278-T, each linked to the report it came from.</>
                  : <>Every securities transaction reported on his OGE Form 278-T reports, each linked to the report it came from. <span className="text-stale-ink">The count is unavailable right now: the database did not answer.</span></>}
              </p>
              <span className="mt-2 block text-[14px] font-semibold text-trades-ink">Open the President’s page</span>
            </Link>
          </section>
        )}

        {/* 7. What's new */}
        <section id="whats-new" className="scroll-mt-24 pt-8" aria-labelledby="h-new" data-section="whats-new">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="h-new" className="text-[24px] max-md:text-[22px]">What’s new: trades reported in the last {WHATS_NEW_DAYS} days</span>}
              sub={news ? `Disclosed transactions by current members of Congress whose first report is dated ${fmtDate(news.since)} to ${fmtDate(news.until)}, newest report first. Each row links to the official filing.` : undefined}
            />
            {!news ? (
              <Unavailable what="the trade database" />
            ) : news.rows.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted" data-whats-new="0">
                No new trade reports from current members in the filings we have read for {fmtDate(news.since)} to {fmtDate(news.until)}.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[14px]" data-whats-new={news.rows.length}>
                  {fmtCount(news.rows.length)} disclosed {news.rows.length === 1 ? 'transaction' : 'transactions'} by {fmtCount(news.members)} {news.members === 1 ? 'member' : 'members'}.
                  {news.rows.length > WHATS_NEW_SHOWN ? ` The newest ${WHATS_NEW_SHOWN} are listed.` : ''}
                </p>
                <TradesTable trades={news.rows.slice(0, WHATS_NEW_SHOWN)} caption={`Trades by current members reported in the last ${WHATS_NEW_DAYS} days`} captionHidden ordered />
                <p className="mt-3 text-[13.5px]">
                  <Link href={buildHref('/data/trades', { by: 'filed', from: news.since })} className="font-semibold text-trades-ink hover:underline">All trades by report date in the trades explorer</Link>
                </p>
              </>
            )}
            <p className="mt-3 text-[12.5px] text-muted">
              Reports are posted by the House Clerk and the Senate up to 45 days after a trade, and some later, so this list fills in over time.
              Scanned and paper reports we have not read are not included.
            </p>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
