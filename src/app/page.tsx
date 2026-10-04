import Link from 'next/link';
import BigSearch from '@/components/v2/BigSearch';
import DataStatusPanel from '@/components/v2/DataStatus';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile, { TileSpark } from '@/components/v2/KpiTile';
import { FlagChip, MoneyLegend } from '@/components/v2/MoneyChip';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import TradesTable from '@/components/v2/TradesTable';
import { worstState } from '@/components/v2/SourceBarView';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtUsdCompact } from '@/lib/v2/format';
import { getContractTotals, getLatestTrades } from '@/lib/v2/queries';

// Interim v2 homepage (D1). D6 builds the full Direction C homepage on top.
// Every figure comes from the database with its source and as-of date; a
// dataset that is missing shows "Unavailable", never a stand-in number.
export const revalidate = 600;

export default async function Home() {
  const [statuses, totals, latest] = await Promise.all([
    getDatasetStatuses(),
    getContractTotals(),
    getLatestTrades(8),
  ]);
  const st = Object.fromEntries(statuses.map((s) => [s.key, s]));

  // Contracts: all-agency prime contract obligations, latest fiscal year.
  const ct = st.contract_totals;
  const fy = totals?.length ? totals[totals.length - 1] : null;
  const contractsValue = ct.state === 'fresh' || ct.state === 'stale' ? fmtUsdCompact(fy?.total_obligations) : null;

  // Trades: House + Senate rows in the database.
  const house = st.house_trades;
  const senate = st.senate_trades;
  const tradesState = worstState([house, senate]);
  const tradesTotal = house.rowCount != null && senate.rowCount != null && tradesState !== 'unavailable' ? house.rowCount + senate.rowCount : null;
  const tradesAsOf = [house.lastUpdated, senate.lastUpdated].filter(Boolean).sort()[0] ?? null;

  return (
    <div data-v2>
      <PageBand overlap>
        <h1 className="mb-3.5 mt-[46px] max-w-[880px] font-display text-[56px] font-extrabold leading-[1.04] tracking-[-1.2px] max-md:mt-6 max-md:text-[36px]">
          See where public money goes, and{' '}
          <em className="bg-[linear-gradient(transparent_62%,rgba(255,90,110,.55)_62%)] not-italic">who&rsquo;s on both ends</em> of it.
        </h1>
        <p className="mb-[26px] max-w-[720px] text-[19px] text-on-deep max-md:text-base">
          Contracts, congressional stock trades, campaign money and lobbying, linked together. Every number shows its source and when it was last updated.
        </p>
        <BigSearch />
      </PageBand>

      <Wrap>
        <div className="-mt-20 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:mt-4 max-md:gap-2.5">
          <KpiTile
            type="contracts"
            value={contractsValue}
            caption={fy ? `prime contract obligations, all agencies, FY${fy.fiscal_year}` : 'prime contract obligations'}
            source="USAspending"
            sourceHref="https://www.usaspending.gov/agency"
            asOf={ct.lastUpdated}
            state={ct.state}
            chart={totals && totals.length > 1 ? (
              <TileSpark
                points={totals.map((r) => ({ label: `FY${String(r.fiscal_year).slice(2)}`, value: r.total_obligations }))}
                caption="by fiscal year"
              />
            ) : undefined}
            note={fy && fy.reporting_lag_days > 0 ? `FY${fy.fiscal_year} is incomplete: DoD reports ${fy.reporting_lag_days} days late.` : undefined}
          />
          <KpiTile
            type="trades"
            value={fmtCount(tradesTotal)}
            caption="stock trades disclosed by members of Congress, in our database"
            source="House Clerk + Senate eFD"
            asOf={tradesAsOf}
            state={tradesState}
            note={tradesTotal != null ? `Filings: House ${house.coverage ?? '?'} · Senate ${senate.coverage ?? '?'}` : undefined}
          />
          <KpiTile
            type="campaign"
            value={null}
            caption="PAC money to sitting members"
            source="FEC"
            sourceHref="https://www.fec.gov/data/"
            asOf={null}
            state={st.campaign.state}
            unavailableReason="Not loaded yet. FEC campaign data is next on the data plan."
          />
          <KpiTile
            type="lobbying"
            value={null}
            caption="reported lobbying spend"
            source="Senate LDA"
            sourceHref="https://lda.senate.gov/"
            asOf={null}
            state={st.lobbying.state}
            unavailableReason="Not loaded yet. Lobbying filings come after campaign data."
          />
        </div>

        <section className="pt-10">
          <Card>
            <SectionHead
              title={<span className="text-[24px] max-md:text-[22px]">Latest disclosed trades</span>}
              sub="The newest stock-trade reports filed with the House Clerk and the Senate, newest filing first."
            />
            {latest && latest.length > 0 ? (
              <TradesTable trades={latest} caption="The 8 most recently filed trades" csvName="latest-trades" />
            ) : (
              <EmptyState title="Trades are unavailable right now" statuses={[house, senate]}>
                The trade database did not answer, so no trades are shown.
              </EmptyState>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-4 pt-10 max-lg:grid-cols-1">
          <Card>
            <h2 className="mb-1.5 font-display text-[24px] font-extrabold">How to read the colors</h2>
            <p className="mb-3.5 text-[13.5px] text-muted">Four kinds of money, one color each, used the same way on every page and chart.</p>
            <MoneyLegend />
            <p className="mt-3.5 text-[13.5px] text-muted">
              <FlagChip /> marks a pattern in the records. It is never an accusation, and a sequence of events is not proof of wrongdoing.
            </p>
          </Card>
          <div className="flex min-w-0 flex-col">
            <h2 className="mb-3 font-display text-[24px] font-extrabold max-lg:mt-2">Investigations</h2>
            <EmptyState className="flex-1" title="Stories are being re-checked" icon="✎" tone="warning" action={{ href: '/about/corrections', label: 'Read the corrections log' }}>
              An independent audit is checking every figure in our earlier stories against the official filings. Each story is listed here again only after it passes.
            </EmptyState>
          </div>
        </section>

        <section className="pb-10 pt-10">
          <DataStatusPanel datasets={['contracts', 'house_trades', 'senate_trades', 'campaign', 'lobbying']} />
          <p className="mt-3 text-[13px] text-muted">
            Want the details? <Link href="/about/data-status" className="font-semibold text-trades-ink hover:underline">See every dataset&rsquo;s source, coverage and last load</Link>.
          </p>
        </section>
      </Wrap>
    </div>
  );
}
