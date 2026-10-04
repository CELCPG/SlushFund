import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import AwardsTable from '@/components/v2/AwardsTable';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { worstState } from '@/components/v2/SourceBarView';
import TradesTable, { partyLetter } from '@/components/v2/TradesTable';
import {
  FISCAL_YEARS, companySlug, getCompanyAwards, getLinksForCompany, getSiblingGroups, getTradesForTickers, parseCompanySlug,
  type AwardRow, type TickerLink,
} from '@/lib/v2/companies';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtUsd, fmtUsdCompact } from '@/lib/v2/format';
import type { TradeRow } from '@/lib/v2/queries';
import { instrumentKind } from '@/lib/v2/instruments';

export const revalidate = 1800;

const AWARDS_SHOWN = 50;
const AWARDS_SHOWN_ALL = 1000;
const TRADES_SHOWN = 100;
const MEMBERS_SHOWN = 50;

function groupName(awards: AwardRow[]): string {
  const a = awards[0];
  return (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name || 'Company';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const key = parseCompanySlug((await params).slug);
  const awards = key ? await getCompanyAwards(key) : null;
  if (!awards?.length) return { title: 'Company' };
  const name = groupName(awards);
  return pageMetadata({
    path: `/companies/${companySlug(key!, name)}`,
    card: 'own',
    title: `${name}: federal contracts and member trades`,
    description: `Federal contract awards to ${name} (USAspending, FY2024–26) and the stock trades members of Congress reported in its ticker.`,
  });
}

const METHOD_TEXT: Record<string, string> = {
  exact_normalized: 'same name as the SEC registrant',
  parent_chain: 'subsidiary of the registrant (name match or SEC subsidiary list)',
};

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const key = parseCompanySlug(slug);
  if (!key) notFound();

  const awards = await getCompanyAwards(key);
  if (awards === null) {
    const statuses = await getDatasetStatuses(['contracts']);
    return (
      <div data-v2>
        <PageBand><h1 className="mt-8 font-display text-[40px] font-extrabold max-md:mt-5 max-md:text-[30px]">Company</h1></PageBand>
        <Wrap className="pb-12 pt-6">
          <EmptyState title="This company's data is unavailable right now" tone="warning" statuses={statuses}>
            The contracts database did not answer, so no figures are shown. Try again in a few minutes.
          </EmptyState>
        </Wrap>
      </div>
    );
  }
  if (awards.length === 0) notFound();

  const name = groupName(awards);
  const canonical = companySlug(key, name);
  if (decodeURIComponent(slug) !== canonical) permanentRedirect(`/companies/${canonical}`);

  const fyRaw = Number(Array.isArray(sp.fy) ? sp.fy[0] : sp.fy);
  const fyFilter = (FISCAL_YEARS as readonly number[]).includes(fyRaw) ? fyRaw : null;

  const links = await getLinksForCompany(key);
  const tickers = links ? [...new Set(links.map((l) => l.ticker))].sort() : [];
  const [trades, siblings, statuses] = await Promise.all([
    tickers.length ? getTradesForTickers(tickers.join(',')) : Promise.resolve<TradeRow[]>([]),
    links && links.length ? getSiblingGroups(key, links) : Promise.resolve([]),
    getDatasetStatuses(['contracts', 'company_tickers', 'house_trades', 'senate_trades']),
  ]);
  const st = Object.fromEntries(statuses.map((s) => [s.key, s]));

  // --- award aggregates (obligated to date on awards signed in the FY)
  const isNc = (a: AwardRow) => a.competition_status === 'not_competed';
  const ncAwards = awards.filter(isNc);
  const otherAwards = awards.filter((a) => !isNc(a));
  const sumObl = (xs: AwardRow[]) => xs.reduce((n, a) => n + (a.obligated_amount ?? 0), 0);
  const byFy = FISCAL_YEARS.map((y) => {
    const nc = ncAwards.filter((a) => a.fiscal_year === y);
    const ot = otherAwards.filter((a) => a.fiscal_year === y);
    return { y, nc: nc.length, ncObl: sumObl(nc), other: ot.length, otherObl: sumObl(ot) };
  });
  const largest = awards[0];
  const recipients = new Map<string, { name: string; awards: number; nc: number; ncObl: number }>();
  for (const a of awards) {
    const k = a.recipient_uei ?? a.recipient_name ?? '?';
    const r = recipients.get(k) ?? { name: a.recipient_name ?? 'Unnamed recipient', awards: 0, nc: 0, ncObl: 0 };
    r.awards += 1;
    if (isNc(a)) {
      r.nc += 1;
      r.ncObl += a.obligated_amount ?? 0;
    }
    recipients.set(k, r);
  }
  const linkedUeis = new Set((links ?? []).map((l) => l.recipient_uei).filter(Boolean));

  const showAll = (Array.isArray(sp.show) ? sp.show[0] : sp.show) === 'all';
  const filtered = fyFilter ? awards.filter((a) => a.fiscal_year === fyFilter) : awards;
  const shown = filtered.slice(0, showAll ? AWARDS_SHOWN_ALL : AWARDS_SHOWN);
  const inFilter = filtered.length;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (fyFilter && !('fy' in extra)) p.set('fy', String(fyFilter));
    const s = p.toString();
    return s ? `/companies/${canonical}?${s}` : `/companies/${canonical}`;
  };

  // --- trades
  const tradeList = trades ?? [];
  const members = new Map<string, { name: string; party: string; state: string; chamber: string; trades: number; buys: number; sells: number; exchanges: number; other: number; latest: string | null }>();
  for (const t of tradeList) {
    const k = t.bio_guide_id ?? t.member_name;
    const m = members.get(k) ?? { name: t.member_name, party: partyLetter(t.member_party), state: t.member_state, chamber: t.member_chamber, trades: 0, buys: 0, sells: 0, exchanges: 0, other: 0, latest: null };
    m.trades += 1;
    // Options and non-stock assets are never counted as a purchase or sale of the stock (A7 S1).
    if (instrumentKind(t) !== 'stock') m.other += 1;
    else if (t.transaction_type === 'BUY') m.buys += 1;
    else if (t.transaction_type.startsWith('SELL')) m.sells += 1;
    else m.exchanges += 1;
    if (t.filed_date && (!m.latest || t.filed_date > m.latest)) m.latest = t.filed_date;
    members.set(k, m);
  }
  const house = st.house_trades;
  const senate = st.senate_trades;
  const tradesState = worstState([house, senate]);
  const tradesAsOf = [house.lastUpdated, senate.lastUpdated].filter(Boolean).sort()[0] ?? null;
  const contracts = st.contracts;
  const contractsOk = contracts.state === 'fresh' || contracts.state === 'stale';

  const memberRows: DataTableRow[] = [...members.entries()]
    .sort((a, b) => b[1].trades - a[1].trades || a[1].name.localeCompare(b[1].name))
    .slice(0, showAll ? undefined : MEMBERS_SHOWN)
    .map(([k, m]) => ({
      id: k,
      values: { member: m.name, who: `${m.party} · ${m.state} · ${m.chamber}`, trades: m.trades, buys: m.buys, sells: m.sells, exchanges: m.exchanges, other: m.other, latest: m.latest },
      cells: {
        member: k.length === 7 && /^[A-Z]\d{6}$/.test(k) ? <Link href={`/people/${k}`} className="font-semibold hover:underline">{m.name}</Link> : <b className="font-semibold">{m.name}</b>,
        who: <span>{m.party} · {m.state} · {m.chamber}</span>,
        latest: <span>{fmtDate(m.latest) ?? '—'}</span>,
      },
    }));
  const memberCols: DataTableColumn[] = [
    { key: 'member', header: 'Member', mobile: 'title' },
    { key: 'who', header: 'Party · State · Chamber', mobile: 'subtitle' },
    { key: 'trades', header: 'Reported trades', numeric: true },
    { key: 'buys', header: 'Purchases', numeric: true },
    { key: 'sells', header: 'Sales', numeric: true },
    { key: 'exchanges', header: 'Exchanges', numeric: true },
    { key: 'other', header: 'Options and other', numeric: true },
    { key: 'latest', header: 'Latest filing', numeric: true, sortKey: 'latest' },
  ];

  const tickerLine = tickers.length ? tickers.join(' · ') : null;
  const noTickerReason = links === null
    ? 'The ticker link data did not load.'
    : 'No confirmed stock ticker: this may be a private company, a subsidiary awaiting review, or not matched to an SEC registrant.';

  return (
    <div data-v2>
      <PageBand overlap>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">
          <Link href="/companies" className="hover:underline">Companies</Link> · USAspending parent record
        </p>
        <h1 className="mt-1 max-w-[900px] font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{name}</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          {tickerLine ? <>Stock ticker{tickers.length > 1 ? 's' : ''}: <b className="font-mono">{tickerLine}</b>. </> : <>No confirmed stock ticker. </>}
          {recipients.size} recipient record{recipients.size === 1 ? '' : 's'} grouped under this USAspending parent (UEI <span className="font-mono">{key}</span>).
        </p>
      </PageBand>

      <Wrap className="pb-12">
        <div className="-mt-20 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:mt-4 max-md:gap-2.5">
          <KpiTile
            type="contracts"
            label="Non-competed awards"
            value={contractsOk ? (ncAwards.length ? fmtUsdCompact(sumObl(ncAwards)) : 'None') : null}
            caption={ncAwards.length
              ? `obligated to date on ${fmtCount(ncAwards.length)} non-competed award${ncAwards.length === 1 ? '' : 's'} of $1M+ signed FY2024–26`
              : 'no non-competed award of $1M+ signed FY2024–26 in our records'}
            source="USAspending"
            sourceHref="https://www.usaspending.gov/search"
            asOf={contracts.lastUpdated}
            state={contracts.state}
            note="Obligated to date, not spending in a year. Selected awards only (rule r5-v1): not this company's not-competed share."
          />
          <KpiTile
            label="Awards in our records"
            value={contractsOk ? fmtCount(awards.length) : null}
            caption={`${fmtCount(ncAwards.length)} non-competed ($1M+) · ${fmtCount(otherAwards.length)} other ($10M+)`}
            source="USAspending"
            sourceHref="https://www.usaspending.gov/search"
            asOf={contracts.lastUpdated}
            state={contracts.state}
          />
          <KpiTile
            type="contracts"
            label="Largest award"
            value={contractsOk ? fmtUsdCompact(largest.obligated_amount) : null}
            caption={`obligated to date: ${largest.award_id ?? 'award'}${largest.awarding_agency ? `, ${largest.awarding_agency}` : ''}${largest.fiscal_year ? `, signed FY${largest.fiscal_year}` : ''}`}
            source="USAspending"
            sourceHref={largest.usaspending_url ?? undefined}
            asOf={contracts.lastUpdated}
            state={contracts.state}
          />
          <KpiTile
            type="trades"
            label="Member trades"
            value={!tickers.length ? (links === null ? null : 'No ticker') : trades ? fmtCount(tradeList.length) : null}
            caption={tickers.length ? `reported in ${tickers.join(', ')} by ${fmtCount(members.size)} member${members.size === 1 ? '' : 's'} of Congress` : 'No confirmed stock ticker, so no member trades are matched to this company.'}
            source="House Clerk + Senate eFD"
            asOf={tradesAsOf}
            state={tickers.length ? tradesState : 'fresh'}
            unavailableReason={!tickers.length ? noTickerReason : trades === null ? 'The trade database did not answer.' : undefined}
            note={tickers.length && trades ? `Filings: House ${house.coverage ?? '?'} · Senate ${senate.coverage ?? '?'}` : undefined}
          />
        </div>

        <SourceBar datasets={['contracts', 'company_tickers', 'house_trades', 'senate_trades']} className="mt-6" />

        {/* ---------------------------------------------------------------- contracts */}
        <section className="pt-8" aria-labelledby="co-contracts">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="co-contracts" className="text-[24px] max-md:text-[22px]">Federal contract awards in our records</span>}
              sub="Each row is one prime contract award on USAspending.gov; “USAspending” opens its official page."
            />
            <p className="mb-4 max-w-[860px] rounded-2xl bg-neutral-tint px-4 py-3 text-[13.5px] text-muted">
              <b className="text-ink">What this table covers:</b>{' '}every award signed in FY2024–26 that the agency coded “not competed” and that is $1 million or more, plus any award of
              $10 million or more (rule r5-v1). Smaller competed awards are not in it, so it is not this company&rsquo;s total federal business and it cannot show a not-competed
              share. “Obligated to date” is the total committed on the award so far, including later modifications (USAspending, as of {fmtDate(contracts.lastUpdated) ?? 'the last load'}), not the amount at any earlier date.
            </p>

            <div className="mb-5 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[14.5px]">
                <caption className="pb-2 text-left text-[13px] text-muted">Awards by fiscal year signed (obligated to date, not spending in the year)</caption>
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted">
                    <th scope="col" className="border-b border-line px-2.5 py-2">Signed in</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Non-competed awards</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Obligated to date</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Other awards $10M+</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Obligated to date</th>
                  </tr>
                </thead>
                <tbody>
                  {byFy.map((r) => (
                    <tr key={r.y}>
                      <th scope="row" className="border-b border-line px-2.5 py-2.5 text-left font-semibold">
                        FY{r.y}{r.y === 2026 && <span className="ml-2 rounded-md bg-stale-tint px-1.5 py-0.5 text-[11.5px] font-semibold text-stale-ink">incomplete</span>}
                      </th>
                      <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]">{r.nc ? fmtCount(r.nc) : <span className="font-sans text-muted">None in this set</span>}</td>
                      <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]" title={r.nc ? fmtUsd(r.ncObl) ?? undefined : undefined}>{r.nc ? fmtUsdCompact(r.ncObl) : <span className="font-sans text-muted">—</span>}</td>
                      <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]">{r.other ? fmtCount(r.other) : <span className="font-sans text-muted">None in this set</span>}</td>
                      <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]" title={r.other ? fmtUsd(r.otherObl) ?? undefined : undefined}>{r.other ? fmtUsdCompact(r.otherObl) : <span className="font-sans text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[12.5px] text-muted">
                FY2026 is incomplete: the Department of Defense reports contract actions 90 days late, and older awards keep growing through modifications, so these amounts will rise.
                Source: <a href="https://www.usaspending.gov/search" target="_blank" rel="noopener noreferrer" className="underline">USAspending.gov</a>, as of {fmtDate(contracts.lastUpdated) ?? 'an unknown date'}.
              </p>
            </div>

            <nav aria-label="Filter awards by fiscal year signed" className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] font-semibold text-muted">Show awards signed in</span>
              {[null, ...FISCAL_YEARS].map((y) => {
                const active = y === fyFilter;
                return (
                  <Link
                    key={y ?? 'all'}
                    href={y ? `/companies/${canonical}?fy=${y}${showAll ? '&show=all' : ''}` : showAll ? `/companies/${canonical}?show=all` : `/companies/${canonical}`}
                    scroll={false}
                    aria-current={active ? 'true' : undefined}
                    className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${active ? 'bg-ink text-white' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint'}`}
                  >
                    {y ? `FY${y}` : 'FY2024–26'}
                  </Link>
                );
              })}
            </nav>
            <AwardsTable
              awards={shown}
              mode="company"
              groupName={name}
              caption={`${fyFilter ? `FY${fyFilter}` : 'FY2024–26'} awards to ${name}, largest first (obligated to date)`}
              csvName={`awards-${canonical}${fyFilter ? `-fy${fyFilter}` : ''}`}
              footer={
                <span>
                  {inFilter > shown.length ? (
                    <>Showing the {shown.length} largest of {fmtCount(inFilter)} awards. <Link href={qs({ show: 'all' })} scroll={false} className="font-semibold text-contracts-ink hover:underline">Show {inFilter > AWARDS_SHOWN_ALL ? `the ${fmtCount(AWARDS_SHOWN_ALL)} largest` : 'all'}</Link>. </>
                  ) : showAll && inFilter > AWARDS_SHOWN ? (
                    <>Showing all {fmtCount(inFilter)} awards. <Link href={qs({})} scroll={false} className="font-semibold text-contracts-ink hover:underline">Show fewer</Link>. </>
                  ) : (
                    `${fmtCount(inFilter)} award${inFilter === 1 ? '' : 's'}. `
                  )}
                  Source: USAspending.gov award records.
                </span>
              }
            />

            <details className="mt-5 rounded-2xl bg-page px-4 py-3 text-[14px]">
              <summary className="cursor-pointer font-semibold">Recipient records grouped under this company ({recipients.size})</summary>
              <p className="mt-2 text-[13px] text-muted">
                USAspending groups recipients by its parent-company field, which has known errors. Check that the recipients below belong to {name}; the stock link below is made per recipient.
              </p>
              <ul className="mt-2 divide-y divide-line">
                {[...recipients.values()].sort((a, b) => b.ncObl - a.ncObl || b.awards - a.awards).slice(0, 40).map((r) => (
                  <li key={r.name + r.awards} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-[13px] text-muted">
                      {fmtCount(r.awards)} award{r.awards === 1 ? '' : 's'}{r.nc ? ` · ${fmtCount(r.nc)} non-competed, ${fmtUsdCompact(r.ncObl)} obligated to date` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {recipients.size > 40 && <p className="mt-2 text-[12.5px] text-muted">Showing 40 of {recipients.size} recipient records.</p>}
            </details>
          </Card>
        </section>

        {/* ---------------------------------------------------------------- ticker */}
        <section className="pt-8" aria-labelledby="co-ticker">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="co-ticker" className="text-[24px] max-md:text-[22px]">Stock ticker</span>}
              sub="Links between a federal contract recipient and an SEC-registered company, made by a written rule from SEC filings and USAspending records. Only confirmed links are shown."
            />
            {tickers.length === 0 || !links ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">{noTickerReason}</p>
            ) : (
              <div className="grid gap-4">
                {tickers.map((t) => {
                  const rows = links.filter((l) => l.ticker === t);
                  const first = rows[0];
                  return <TickerBlock key={t} ticker={t} rows={rows} first={first} />;
                })}
                <p className="text-[13px] text-muted">
                  A link says USAspending and SEC records tie this recipient to this registrant. It does not say a member&rsquo;s trade or a company&rsquo;s award means anything.
                </p>
              </div>
            )}
            {siblings && siblings.length > 0 && (
              <div className="mt-5 rounded-2xl bg-page px-4 py-3 text-[14px]">
                <b>Same stock, other USAspending parent records.</b>{' '}USAspending files some companies under more than one parent record. These are linked to the same SEC registrant:
                <ul className="mt-2 divide-y divide-line">
                  {siblings.slice(0, 12).map((s) => (
                    <li key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5">
                      <Link href={`/companies/${s.slug}`} className="font-semibold text-contracts-ink hover:underline">{s.name}</Link>
                      <span className="text-[13px] text-muted">{s.ticker} · {fmtCount(s.awards)} award{s.awards === 1 ? '' : 's'}{s.ncObl > 0 ? ` · ${fmtUsdCompact(s.ncObl)} non-competed, obligated to date` : ''}</span>
                    </li>
                  ))}
                </ul>
                {siblings.length > 12 && <p className="mt-1 text-[12.5px] text-muted">And {siblings.length - 12} more.</p>}
                <p className="mt-2 text-[12.5px] text-muted">Totals on this page cover this parent record only.</p>
              </div>
            )}
            {linkedUeis.size > 0 && recipients.size > linkedUeis.size && (
              <p className="mt-3 text-[12.5px] text-muted">The ticker link covers {fmtCount([...recipients.keys()].filter((k) => linkedUeis.has(k)).length)} of the {recipients.size} recipient records above; the rest are not linked to a stock.</p>
            )}
          </Card>
        </section>

        {/* ---------------------------------------------------------------- trades */}
        <section className="pt-8" aria-labelledby="co-trades">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="co-trades" className="text-[24px] max-md:text-[22px]">Members of Congress who reported trading this stock</span>}
              sub={tickers.length ? `Trades in ${tickers.join(', ')} from STOCK Act disclosures, newest filing first.` : undefined}
            />
            {tickers.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">{noTickerReason} Without a confirmed ticker, no trades are matched to this company.</p>
            ) : trades === null ? (
              <EmptyState title="Trades are unavailable right now" tone="warning" statuses={[house, senate]}>The trade database did not answer, so no trades are shown.</EmptyState>
            ) : tradeList.length === 0 ? (
              <EmptyState title={`No reported trades in ${tickers.join(', ')} in our records`} icon="∅" statuses={[house, senate]}>
                No disclosure in the filings we hold mentions this ticker. Our filings cover House {house.coverage ?? 'unknown years'} and Senate {senate.coverage ?? 'unknown years'}.
              </EmptyState>
            ) : (
              <>
                <p className="mb-4 max-w-[860px] rounded-2xl bg-highlight/40 px-4 py-3 text-[13.5px] text-ink">
                  <b>Two public records, side by side.</b>{' '}The company holds federal contracts, and members reported trades in its stock. That is a pattern in the records, not an accusation:
                  trades can be routine, made by a spouse or a managed account, and a sequence of events is not proof of wrongdoing. Amounts are the ranges members disclosed; they are never added up
                  into a single figure, and “2 ×” means two same-day lots, each in that range.
                </p>
                <h3 className="mb-2 font-display text-[18px] font-extrabold">{fmtCount(members.size)} member{members.size === 1 ? '' : 's'} · {fmtCount(tradeList.length)} reported trade{tradeList.length === 1 ? '' : 's'}</h3>
                <DataTable
                  columns={memberCols}
                  rows={memberRows}
                  caption="Members who reported trades in this stock, by number of reported trades"
                  captionHidden
                  initialSort={{ key: 'trades', dir: 'desc' }}
                  csv={{ filename: `members-trading-${canonical}` }}
                />
                <h3 className="mb-2 mt-7 font-display text-[18px] font-extrabold">Every reported trade, with its filing</h3>
                <TradesTable
                  trades={showAll ? tradeList : tradeList.slice(0, TRADES_SHOWN)}
                  caption={`Reported trades in ${tickers.join(', ')}, newest filing first`}
                  csvName={`trades-${canonical}`}
                />
                {!showAll && (tradeList.length > TRADES_SHOWN || members.size > MEMBERS_SHOWN) && (
                  <p className="mt-3 text-[13px] text-muted">
                    Showing the {Math.min(TRADES_SHOWN, tradeList.length)} most recently filed of {fmtCount(tradeList.length)} trades and the top {Math.min(MEMBERS_SHOWN, members.size)} of {fmtCount(members.size)} members.{' '}
                    <Link href={qs({ show: 'all' })} scroll={false} className="font-semibold text-contracts-ink hover:underline">Show every trade and member</Link>.
                  </p>
                )}
              </>
            )}
          </Card>
        </section>

        <p className="pt-6 text-[13px] text-muted">
          Looking for agency-level shares? See <Link href="/agencies" className="font-semibold text-contracts-ink hover:underline">non-competed share by agency</Link>.
        </p>
      </Wrap>
    </div>
  );
}

function TickerBlock({ ticker, rows, first }: { ticker: string; rows: TickerLink[]; first: TickerLink }) {
  const recips = [...new Map(rows.map((r) => [r.recipient_uei ?? r.recipient_name, r])).values()];
  return (
    <div className="rounded-2xl bg-page px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-md bg-trades-tint px-2 py-0.5 font-mono text-[15px] font-semibold text-trades-ink">{ticker}</span>
        <b className="text-[16px]">{first.sec_name}</b>
        {first.exchange && <span className="text-[13px] text-muted">{first.exchange}</span>}
        {first.evidence_url && (
          <a href={first.evidence_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[13.5px] font-semibold text-trades-ink hover:underline">
            SEC filings ↗
          </a>
        )}
      </div>
      <details className="mt-2 text-[13.5px]">
        <summary className="cursor-pointer font-semibold text-muted">How these recipients were linked ({recips.length})</summary>
        <ul className="mt-2 divide-y divide-line">
          {recips.slice(0, 12).map((r) => (
            <li key={r.id} className="py-1.5">
              <span className="font-semibold">{r.recipient_name}</span>
              <span className="block text-[12.5px] text-muted">{METHOD_TEXT[r.match_method] ?? r.match_method}{r.notes ? ` · ${r.notes}` : ''} · rule {`r7-v1`}</span>
            </li>
          ))}
        </ul>
        {recips.length > 12 && <p className="mt-1 text-[12.5px] text-muted">And {recips.length - 12} more recipient records.</p>}
      </details>
    </div>
  );
}
