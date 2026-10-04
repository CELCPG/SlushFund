import Link from 'next/link';
import BigSearch from '@/components/v2/BigSearch';
import { DataStatusPanelView } from '@/components/v2/DataStatus';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import LatestFilings from '@/components/v2/home/LatestFilings';
import { MoneyChip } from '@/components/v2/MoneyChip';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { SourceBarView, worstState } from '@/components/v2/SourceBarView';
import { fmtCount } from '@/lib/v2/format';
import { getHomeFigures, getLatestFilings } from '@/lib/v2/home';
import { HOME_HEADLINE, MEMBERS_TILE_COPY, MEMBERS_TILE_LEAD } from '@/lib/v2/home-copy';
import { MONEY_TYPE_ORDER } from '@/lib/v2/money';

// Homepage (D6a, Direction C): what SlushFund tracks, what's new, and three ways in. Every figure is
// a live count from the database with its source, coverage and as-of date; a dataset that did not
// load shows "Unavailable", never a stand-in number. No late-filers module and no verdict words:
// that board stays preview-only until the Auditor's GO.
export const revalidate = 600;

const ENTRY_CARDS = [
  {
    title: 'People',
    text: 'Every member of Congress since 2016: the stock trades each one disclosed, with the filing behind every row, and their committee seats.',
    links: [
      { href: '/people', label: 'Browse members' },
      { href: '/people?chamber=Senate', label: 'Senators' },
    ],
    zip: true,
  },
  {
    title: 'Companies',
    text: 'Federal contractors: the contracts agencies coded not competed, which members reported trading the company’s stock, and each agency’s share of contracts not competed.',
    links: [
      { href: '/companies', label: 'Contract recipients' },
      { href: '/agencies', label: 'Agencies' },
    ],
  },
  {
    title: 'Data',
    text: 'The full tables behind every page. Filter every trade and contract, share the view as a link, download CSV, and check how fresh each dataset is.',
    links: [
      { href: '/data/trades', label: 'Stock trades explorer' },
      { href: '/data/contracts', label: 'Contracts explorer' },
      { href: '/data/status', label: 'Data status' },
    ],
  },
] as const;

export default async function Home() {
  const [fig, filings] = await Promise.all([getHomeFigures(), getLatestFilings(6, 2)]);
  const { members: mStatus, house_trades: house, senate_trades: senate, contracts, campaign, lobbying } = fig.statuses;

  const tradesState = worstState([house, senate]);
  const tradesAsOf = [house.lastUpdated, senate.lastUpdated].filter(Boolean).sort()[0] ?? null;
  const nc = fig.noncompeted;
  const fyLo = nc?.byFy[0]?.fy;
  const fyHi = nc?.byFy[nc.byFy.length - 1]?.fy;
  const fySpan = fyLo == null ? '' : fyLo === fyHi ? `FY${fyLo}` : `FY${fyLo}–FY${fyHi}`;

  // The lead number and the headline live in lib/v2/home-copy.ts (D8a); the note carries the other counts.
  const memberLead = fig.members ? fig.members[MEMBERS_TILE_LEAD] : null;
  const memberNote = fig.members
    ? [
        MEMBERS_TILE_LEAD !== 'total' ? `${fmtCount(fig.members.total)} served from 2016 to today.` : null,
        MEMBERS_TILE_LEAD !== 'inOffice' && fig.members.inOffice != null ? `${fmtCount(fig.members.inOffice)} in office now.` : null,
        MEMBERS_TILE_LEAD !== 'withTrades' && fig.members.withTrades != null ? `${fmtCount(fig.members.withTrades)} have stock trades on file.` : null,
      ].filter(Boolean).join(' ') || undefined
    : undefined;

  return (
    <div data-v2>
      <PageBand overlap>
        <h1 className="mb-3.5 mt-[46px] max-w-[880px] font-display text-[56px] font-extrabold leading-[1.04] tracking-[-1.2px] max-md:mt-6 max-md:text-[34px]">
          {HOME_HEADLINE.lead}{' '}
          <em className="bg-[linear-gradient(transparent_62%,rgba(255,90,110,.55)_62%)] not-italic">{HOME_HEADLINE.emphasis}</em>{HOME_HEADLINE.tail}
        </h1>
        <p className="mb-[26px] max-w-[720px] text-[19px] text-on-deep max-md:mb-5 max-md:text-base">
          The stock trades members of Congress disclose and the federal contracts agencies award, from the official filings. Every number shows its source and when it was last updated.
        </p>
        <BigSearch />
        <div className="mt-6 flex flex-wrap items-center gap-2 max-md:mt-5" aria-label="Color key">
          <span className="mr-1 text-sm font-semibold text-white">One color per kind of money, on every page:</span>
          {MONEY_TYPE_ORDER.map((t) => {
            const st = t === 'campaign' ? campaign : t === 'lobbying' ? lobbying : null;
            return <MoneyChip key={t} type={t} value={st && st.state === 'not_loaded' ? 'coming later' : undefined} />;
          })}
        </div>
      </PageBand>

      <Wrap>
        <div className="-mt-20 grid grid-cols-3 gap-4 max-lg:gap-3 max-md:mt-4 max-md:grid-cols-1 max-md:gap-2.5">
          <KpiTile
            label={MEMBERS_TILE_COPY[MEMBERS_TILE_LEAD].label}
            value={fmtCount(memberLead)}
            caption={MEMBERS_TILE_COPY[MEMBERS_TILE_LEAD].caption}
            source={mStatus.source.name}
            sourceHref={mStatus.source.url}
            asOf={mStatus.lastUpdated}
            state={memberLead == null ? 'unavailable' : mStatus.state}
            note={memberNote}
          />
          <KpiTile
            type="trades"
            value={fmtCount(fig.trades?.total)}
            caption="stock trades disclosed by members of Congress, on file"
            source="House Clerk + Senate eFD"
            sourceHref="/about/methodology/trades"
            asOf={tradesAsOf}
            state={fig.trades ? tradesState : 'unavailable'}
            note={fig.trades ? `House ${fmtCount(fig.trades.house)} (filed ${house.coverage ?? 'dates unknown'}) · Senate ${fmtCount(fig.trades.senate)} (filed ${senate.coverage ?? 'dates unknown'})` : undefined}
          />
          <KpiTile
            type="contracts"
            label="Non-competed contracts"
            value={fmtCount(nc?.total)}
            caption={`contracts the agency coded not competed, $1 million or more, signed ${fySpan}`}
            source={contracts.source.name}
            sourceHref={contracts.source.url}
            asOf={contracts.lastUpdated}
            state={nc ? contracts.state : 'unavailable'}
            note={nc ? `${nc.byFy.map((r) => `FY${r.fy} ${fmtCount(r.count)}`).join(' · ')}.${nc.lagDays > 0 ? ` FY${fyHi} is incomplete: Defense Department contract data is published about ${nc.lagDays} days late, so this count will grow.` : ''}` : undefined}
          />
        </div>
        <SourceBarView statuses={[mStatus, house, senate, contracts]} methodologyHref="/about/methodology" className="mt-4" />

        <section className="pt-10">
          <Card>
            <SectionHead
              title={<span className="text-[28px] max-md:text-[23px]">Latest filings</span>}
              sub="The newest stock-trade reports from members of Congress, by the date each report was first filed. Every entry links to the member and to the filing."
              action={<Link href="/data/trades" className="whitespace-nowrap text-sm font-semibold text-trades-ink hover:underline">All trades, newest report first →</Link>}
            />
            {filings && filings.length > 0 ? (
              <LatestFilings filings={filings} />
            ) : (
              <EmptyState title="The latest filings are unavailable right now" statuses={[house, senate]}>
                The trade database did not answer, so no filings are shown.
              </EmptyState>
            )}
          </Card>
        </section>

        <section className="pt-10" aria-labelledby="ways-in">
          <SectionHead
            title={<span id="ways-in">Three ways in</span>}
            sub="Start from a person, a company, or the full tables. Search above finds all three."
          />
          <ul className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
            {ENTRY_CARDS.map((c) => (
              <li key={c.title} className="min-w-0">
                <Card className="flex h-full flex-col">
                  <h3 className="font-display text-[24px] font-extrabold leading-tight">
                    <Link href={c.links[0].href} className="hover:text-trades-ink hover:underline">{c.title}</Link>
                  </h3>
                  <p className="mt-2 text-[14.5px] text-muted">{c.text}</p>
                  {'zip' in c && c.zip && (
                    <form action="/people" method="get" className="mt-4 flex max-w-[340px] gap-2">
                      <label htmlFor="home-zip" className="sr-only">Your ZIP code</label>
                      <input
                        id="home-zip"
                        name="zip"
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        placeholder="Your ZIP code"
                        autoComplete="postal-code"
                        className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[15px] text-ink placeholder:text-muted focus:border-trades focus:outline-none"
                      />
                      <button type="submit" className="whitespace-nowrap rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-white hover:bg-deep">Find your members</button>
                    </form>
                  )}
                  <ul className="mt-auto flex flex-wrap gap-2 pt-4">
                    {c.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="inline-flex rounded-full bg-neutral-tint px-3.5 py-1.5 text-[13.5px] font-semibold text-ink hover:bg-trades-tint hover:text-trades-ink">
                          {l.label} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-dashed border-line bg-card/60 px-[22px] py-4 max-md:rounded-2xl max-md:px-[18px]">
            <h3 className="font-display text-[20px] font-extrabold">Investigations</h3>
            <span className="rounded-full bg-stale-tint px-3 py-1 text-[13px] font-semibold text-stale-ink">Rebuilding: stories return after audit</span>
            <p className="basis-full text-[14px] text-muted">
              We took our earlier stories down to check every figure against the official records again. Each story comes back only after it passes. The data pages stay open in the meantime.
            </p>
            <Link href="/investigations" className="text-sm font-semibold text-trades-ink hover:underline">How stories come back →</Link>
          </div>
        </section>

        {/* D7 (growth plumbing): the newsletter signup and "Watch this member/company" alerts go here.
            Nothing renders until Buttondown is wired, so no form can appear to work when it doesn't. */}

        <section className="pb-10 pt-10">
          <DataStatusPanelView statuses={[contracts, house, senate, mStatus, campaign, lobbying]} />
        </section>
      </Wrap>
    </div>
  );
}
