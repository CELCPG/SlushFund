import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DataStatusPanelView, DataStatusTableView, StatePill } from '@/components/v2/DataStatus';
import EmptyState from '@/components/v2/EmptyState';
import FilingLink from '@/components/v2/FilingLink';
import KpiTile, { TileSpark } from '@/components/v2/KpiTile';
import { FlagChip, MoneyChip, MoneyIcon, MoneyLegend } from '@/components/v2/MoneyChip';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import { SourceBarView } from '@/components/v2/SourceBarView';
import TradesTable from '@/components/v2/TradesTable';
import { getDatasetStatuses, type DatasetStatus } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtUsdCompact } from '@/lib/v2/format';
import { MONEY_TYPES, MONEY_TYPE_ORDER } from '@/lib/v2/money';
import { getContractTotals, getLatestTrades, getMembersInOffice } from '@/lib/v2/queries';

// Component gallery for review (D1). Real database values wherever a
// component shows data; state previews are labeled as previews.
export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};
export const revalidate = 600;

const PALETTE: { name: string; hex: string; text: string; note: string }[] = [
  { name: 'Page', hex: '#F3F5FB', text: '#14142B', note: 'Ink 16.5:1' },
  { name: 'Card', hex: '#FFFFFF', text: '#4F5170', note: 'Muted 7.7:1' },
  { name: 'Header indigo', hex: '#1D1A4E', text: '#FFFFFF', note: 'White 16.0:1' },
  { name: 'Wordmark red', hex: '#FF5A6E', text: '#1D1A4E', note: 'On indigo 5.3:1 · never data' },
  { name: 'Brand red (buttons)', hex: '#D21F3C', text: '#FFFFFF', note: 'White on red' },
  { name: 'Worth a look', hex: '#FFE066', text: '#3A2E00', note: '10.3:1' },
];

function Block({ id, title, sub, children }: { id: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 pt-10">
      <SectionHead title={title} sub={sub} />
      {children}
    </section>
  );
}

function Preview({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
      {children}
    </div>
  );
}

/** A real status with only its state changed, for showing what a state looks like. */
function asState(s: DatasetStatus, state: DatasetStatus['state']): DatasetStatus {
  return { ...s, state, ageDays: state === 'stale' ? s.staleAfterDays + 3 : s.ageDays };
}

export default async function DesignPage() {
  const [statuses, totals, trades, inOffice] = await Promise.all([
    getDatasetStatuses(),
    getContractTotals(),
    getLatestTrades(12),
    getMembersInOffice(),
  ]);
  const st = Object.fromEntries(statuses.map((s) => [s.key, s]));
  const fy = totals?.length ? totals[totals.length - 1] : null;
  const tradeRows = (st.house_trades.rowCount ?? 0) + (st.senate_trades.rowCount ?? 0);
  const sampleFiling = trades?.find((t) => t.source_system === 'House_Clerk') ?? trades?.[0] ?? null;
  const sampleSenate = trades?.find((t) => t.source_system === 'Senate_EFD') ?? null;

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Design system · D1</p>
        <h1 className="mt-1 max-w-[880px] font-display text-[48px] font-extrabold leading-[1.05] tracking-[-1px] max-md:text-[32px]">Direction C &ldquo;Money Map&rdquo;: the parts every page is built from</h1>
        <p className="mt-3 max-w-[720px] text-[17px] text-on-deep max-md:text-[15px]">Working components with real database values. Where a state is shown that isn&rsquo;t the current one, it&rsquo;s labeled as a preview.</p>
        <nav aria-label="Gallery sections" className="mt-5 flex flex-wrap gap-2 text-[13px]">
          {['colors', 'type', 'money', 'kpi', 'source', 'status', 'table', 'empty', 'filing', 'og'].map((id) => (
            <a key={id} href={`#${id}`} className="rounded-full bg-white/12 px-3 py-1 font-semibold text-white hover:bg-white/20">{id}</a>
          ))}
        </nav>
      </PageBand>

      <Wrap className="pb-14">
        <div className="pt-6">
          <SourceBarView statuses={[st.house_trades, st.senate_trades]} />
          <p className="mt-1.5 text-[12.5px] text-muted">↑ The source bar, live, as it sits under every page title.</p>
        </div>

        <Block id="colors" title="Colors" sub="Light surfaces, one indigo, a red kept for the brand, and four money colors that mean the same thing everywhere.">
          <div className="grid grid-cols-6 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
            {PALETTE.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <div className="grid h-20 place-items-center font-display text-lg font-extrabold" style={{ background: c.hex, color: c.text }}>Aa</div>
                <div className="p-3 text-[12.5px]">
                  <b className="block text-[13.5px]">{c.name}</b>
                  <span className="font-mono">{c.hex}</span>
                  <span className="block text-muted">{c.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
            {MONEY_TYPE_ORDER.map((t) => {
              const m = MONEY_TYPES[t];
              return (
                <div key={t} className="overflow-hidden rounded-2xl bg-card shadow-card">
                  <div className="flex h-20 items-center gap-2.5 px-4 text-white" style={{ background: m.hex }}>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 font-mono">{m.letter}</span>
                    <b className="font-display text-lg font-extrabold">{m.label}</b>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 text-[12.5px]">
                    <span><span className="font-mono">{m.hex}</span> · tint <span className="font-mono">{m.tintHex}</span></span>
                    <MoneyChip type={t} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-muted">Status colors: <StatePill state="fresh" /> <StatePill state="stale" /> <StatePill state="unavailable" /> <StatePill state="not_loaded" /></p>
        </Block>

        <Block id="type" title="Type" sub="Bricolage Grotesque for headlines, Inter for reading, DM Mono for figures and dates.">
          <Card className="grid gap-4">
            <p className="font-display text-[56px] font-extrabold leading-[1.04] tracking-[-1.2px] max-md:text-[34px]">Bought 6 days before a $1.2B award</p>
            <p className="font-display text-[32px] font-extrabold leading-tight max-md:text-[24px]">Section title states the finding</p>
            <p className="max-w-[680px] text-[16px]">Body text is Inter at 16px with a 1.55 line height. Patterns are &ldquo;worth a look&rdquo;; a sequence of events is not proof of wrongdoing.</p>
            <p className="font-mono text-[15px]">$15,001–$50,000 · filed 19 days later · Oct 3, 2026</p>
          </Card>
        </Block>

        <Block id="money" title="Money chips" sub="Every money color comes with its label and letter icon, so color is never the only cue.">
          <Card className="grid gap-4">
            <Preview label="Chips"><div className="flex flex-wrap gap-2">{MONEY_TYPE_ORDER.map((t) => <MoneyChip key={t} type={t} />)}</div></Preview>
            <Preview label="Chips with real values">
              <div className="flex flex-wrap gap-2">
                <MoneyChip type="contracts" value={fy ? `${fmtUsdCompact(fy.total_obligations)} FY${fy.fiscal_year}` : 'unavailable'} />
                <MoneyChip type="trades" value={fmtCount(tradeRows) ? `${fmtCount(tradeRows)} disclosed` : 'unavailable'} />
                <MoneyChip type="campaign" value="not loaded yet" />
                <MoneyChip type="lobbying" value="not loaded yet" />
              </div>
            </Preview>
            <Preview label="Letter icons"><div className="flex gap-2">{MONEY_TYPE_ORDER.map((t) => <MoneyIcon key={t} type={t} size="lg" />)}</div></Preview>
            <Preview label="Flag"><FlagChip /></Preview>
            <Preview label="Legend"><MoneyLegend className="max-w-[560px]" /></Preview>
          </Card>
        </Block>

        <Block id="kpi" title="KPI tiles" sub="Number, label, source and as-of on every tile. Missing data says “Unavailable” and why; never $0.">
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-2.5">
            <KpiTile
              type="contracts"
              value={fmtUsdCompact(fy?.total_obligations)}
              caption={fy ? `prime contract obligations, all agencies, FY${fy.fiscal_year}` : 'prime contract obligations'}
              source="USAspending"
              sourceHref="https://www.usaspending.gov/agency"
              asOf={st.contract_totals.lastUpdated}
              state={st.contract_totals.state}
              chart={totals && totals.length > 1 ? <TileSpark points={totals.map((r) => ({ label: `FY${String(r.fiscal_year).slice(2)}`, value: r.total_obligations }))} caption="by fiscal year" /> : undefined}
            />
            <KpiTile type="trades" value={fmtCount(tradeRows || null)} caption="stock trades disclosed by members, in our database" source="House Clerk + Senate eFD" asOf={st.house_trades.lastUpdated} state={st.house_trades.state} />
            <KpiTile type="campaign" value={null} caption="PAC money to sitting members" source="FEC" asOf={null} state="not_loaded" unavailableReason="Not loaded yet (FEC)." />
            <KpiTile value={fmtCount(inOffice)} label="Members" caption="members of Congress in office" source="congress-legislators" sourceHref="https://github.com/unitedstates/congress-legislators" asOf={st.members.lastUpdated} state={st.members.state} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-2.5">
            <Preview label="Preview: stale state">
              <KpiTile type="contracts" value={fmtUsdCompact(fy?.total_obligations)} caption={fy ? `prime contract obligations, FY${fy.fiscal_year}` : ''} source="USAspending" asOf={st.contract_totals.lastUpdated} state="stale" />
            </Preview>
            <Preview label="Preview: source down">
              <KpiTile type="trades" value={null} caption="" source="House Clerk + Senate eFD" asOf={null} state="unavailable" />
            </Preview>
            <Preview label="Preview: neutral, source down">
              <KpiTile value={null} label="Members" caption="" source="congress-legislators" asOf={null} state="unavailable" />
            </Preview>
          </div>
        </Block>

        <Block id="source" title="Source bar" sub="Directly under every H1. It reads freshness from the database (the loader log, or the newest row), so it can’t claim “live”.">
          <div className="grid gap-3">
            {statuses.filter((s) => s.state !== 'not_loaded').map((s) => (
              <Preview key={s.key} label={`Current: ${s.label}`}><SourceBarView statuses={[s]} /></Preview>
            ))}
            <Preview label="Current: a dataset with no loader yet"><SourceBarView statuses={[st.campaign]} /></Preview>
            <Preview label={`Preview: stale (amber after ${st.house_trades.staleAfterDays} days without a load)`}><SourceBarView statuses={[asState(st.house_trades, 'stale')]} /></Preview>
            <Preview label="Preview: unavailable (no figures shown)"><SourceBarView statuses={[asState(st.contracts, 'unavailable')]} /></Preview>
          </div>
        </Block>

        <Block id="status" title="Data status" sub="A compact strip for hubs, and a full card per dataset for the data status page.">
          <DataStatusPanelView statuses={statuses} />
          <div className="mt-4"><DataStatusTableView statuses={[st.contracts, st.house_trades, st.campaign]} /></div>
        </Block>

        <Block id="table" title="Data table" sub="Sortable (click a header), stacked cards under 640px, CSV export of the raw values. Real rows: the 12 most recently filed trades.">
          <Card>
            {trades && trades.length > 0 ? (
              <TradesTable trades={trades} caption="The 12 most recently filed trades" csvName="latest-trades" />
            ) : (
              <EmptyState title="Trades are unavailable right now" statuses={[st.house_trades, st.senate_trades]} />
            )}
          </Card>
        </Block>

        <Block id="empty" title="Empty states" sub="Used wherever a page can’t render honestly. With a dataset involved, it shows that dataset’s real status.">
          <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
            <EmptyState title="Campaign money isn’t loaded yet" statuses={[st.campaign]}>FEC data is next on the data plan. Until it loads, no campaign figures appear anywhere.</EmptyState>
            <EmptyState title="Preview: a source that is down" tone="warning" icon="!" statuses={[asState(st.house_trades, 'unavailable')]}>The trade database did not answer, so no trades are shown.</EmptyState>
          </div>
        </Block>

        <Block id="filing" title="Filing links" sub="Every figure is one tap from the official document.">
          <Card className="grid gap-2 text-[14px]">
            {sampleFiling && (
              <p>{sampleFiling.member_name} · {sampleFiling.ticker} · filed {fmtDate(sampleFiling.filed_date)} · <FilingLink href={sampleFiling.disclosure_url} source="House Clerk PTR" /></p>
            )}
            {sampleSenate && (
              <p>{sampleSenate.member_name} · {sampleSenate.ticker} · filed {fmtDate(sampleSenate.filed_date)} · <FilingLink href={sampleSenate.disclosure_url} source="Senate eFD report" /></p>
            )}
            <p>A record without a source URL: <FilingLink href={null} /></p>
          </Card>
        </Block>

        <Block id="og" title="Share card (OG image)" sub="1200×630, rendered by /api/og. A figure only appears with its source and as-of date.">
          <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
            <Preview label="Site card (/opengraph-image)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/opengraph-image" alt="SlushFund share card" width={1200} height={630} className="h-auto w-full rounded-2xl shadow-card" />
            </Preview>
            {fy && (
              <Preview label="With a real figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/og?${new URLSearchParams({
                    title: 'Federal prime contract obligations, all agencies',
                    eyebrow: 'Contracts',
                    type: 'contracts',
                    stat: fmtUsdCompact(fy.total_obligations) ?? '',
                    statLabel: `FY${fy.fiscal_year}, incomplete (DoD 90-day lag)`,
                    source: 'USAspending.gov',
                    asof: fmtDate(fy.fetched_at) ?? '',
                  }).toString()}`}
                  alt="Share card with the FY contract total"
                  width={1200}
                  height={630}
                  className="h-auto w-full rounded-2xl shadow-card"
                />
              </Preview>
            )}
          </div>
        </Block>
      </Wrap>
    </div>
  );
}
