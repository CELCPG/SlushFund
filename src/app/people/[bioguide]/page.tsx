import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import QuarterChart from '@/components/v2/QuarterChart';
import SourceBar from '@/components/v2/SourceBar';
import { worstState } from '@/components/v2/SourceBarView';
import TradesTable from '@/components/v2/TradesTable';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtUsdCompact, fmtUsd } from '@/lib/v2/format';
import { instrumentKind, isListedApart } from '@/lib/v2/instruments';
import {
  BIOGUIDE_RE, getMember, getMemberContractors, getMemberTrades, getUnreadFilings, memberContractsEnabled, partyName, seatLabel,
  tradesByQuarter, type Member, type TradedContractor,
} from '@/lib/v2/people';

export const revalidate = 1800;

const TRADES_SHOWN = 100;
/** Quarters before this are left off the chart (dates as filed; counted in a note). */
const CHART_FROM_YEAR = 2020;
const PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function chamberWord(m: Member): string {
  return m.chamber === 'Senate' ? 'U.S. Senate' : 'U.S. House';
}

function honorific(m: Member): string {
  return m.chamber === 'Senate' ? 'Sen.' : 'Rep.';
}

/**
 * Official portrait from the unitedstates/images project (public domain, from the Government
 * Publishing Office's Congressional Pictorial Directory). Only shown when the file exists.
 */
async function photoUrl(bioguide: string): Promise<string | null> {
  const url = `${PHOTO_BASE}/${bioguide}.jpg`;
  try {
    const res = await fetch(url, { method: 'HEAD', next: { revalidate: 86_400 }, signal: AbortSignal.timeout(2500) });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ bioguide: string }> }): Promise<Metadata> {
  const id = (await params).bioguide.toUpperCase();
  const m = BIOGUIDE_RE.test(id) ? await getMember(id) : undefined;
  if (!m) return { title: 'Member of Congress' };
  return {
    title: `${m.name}: stock trades and committee seats`,
    description: `Stock trades ${m.name} (${partyName(m.party)}, ${seatLabel(m)}) disclosed under the STOCK Act, each linked to the official filing, and current committee seats.`,
    alternates: { canonical: `/people/${m.bioguide_id}` },
  };
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ bioguide: string }>; searchParams: Promise<SP> }) {
  const raw = decodeURIComponent((await params).bioguide);
  const id = raw.toUpperCase();
  if (!BIOGUIDE_RE.test(id)) notFound();
  if (raw !== id) permanentRedirect(`/people/${id}`);
  const sp = await searchParams;

  const member = await getMember(id);
  if (member === undefined) notFound();
  if (member === null) {
    const statuses = await getDatasetStatuses(['members']);
    return (
      <div data-v2>
        <PageBand><h1 className="mt-8 font-display text-[40px] font-extrabold max-md:mt-5 max-md:text-[30px]">Member of Congress</h1></PageBand>
        <Wrap className="pb-12 pt-6">
          <EmptyState title="This page's data is unavailable right now" tone="warning" statuses={statuses}>
            The members database did not answer, so nothing is shown. Try again in a few minutes.
          </EmptyState>
        </Wrap>
      </div>
    );
  }

  const [trades, statuses, photo] = await Promise.all([
    getMemberTrades(id),
    getDatasetStatuses(['house_trades', 'senate_trades', 'members']),
    photoUrl(id),
  ]);
  const st = Object.fromEntries(statuses.map((s) => [s.key, s]));
  const house = st.house_trades;
  const senate = st.senate_trades;
  const roster = st.members;
  const tradesState = worstState([house, senate]);
  const tradesAsOf = [house.lastUpdated, senate.lastUpdated].filter(Boolean).sort()[0] ?? null;
  const contractsOn = memberContractsEnabled();
  const contractors: TradedContractor[] | null = contractsOn && trades ? await getMemberContractors(trades) : null;

  // Newest first by the first report's filing date (R6a original_filed_date); flagged dates last.
  const filedKey = (t: { date_flag?: string | null; original_filed_date?: string | null; filed_date: string | null }) =>
    t.date_flag ? '' : (t.original_filed_date ?? t.filed_date ?? '');
  const all = [...(trades ?? [])].sort((x, y) => filedKey(y).localeCompare(filedKey(x)));
  const stock = all.filter((t) => !isListedApart(t));
  const apart = all.filter((t) => isListedApart(t));
  const buys = stock.filter((t) => t.transaction_type === 'BUY').length;
  const sells = stock.filter((t) => t.transaction_type.startsWith('SELL')).length;
  const options = apart.filter((t) => instrumentKind(t) === 'option').length;
  const latest = all.filter((t) => !t.date_flag && t.filed_date).map((t) => t.filed_date as string).sort().pop() ?? null;
  const unread = getUnreadFilings(id);
  const committees = member.committees ?? [];
  const inOffice = member.in_office === true;

  // One report holding most of a member's rows reads like heavy trading when it is a single filing.
  const byReport = new Map<string, { n: number; filed: string | null }>();
  for (const t of all) {
    const k = t.disclosure_url ?? '';
    if (!k) continue;
    const r = byReport.get(k) ?? { n: 0, filed: t.filed_date };
    r.n += 1;
    byReport.set(k, r);
  }
  const bigReport = [...byReport.values()].sort((a, b) => b.n - a.n)[0];
  const oneReportNote = bigReport && all.length >= 100 && bigReport.n / all.length > 0.5 ? bigReport : null;

  // Chart: quarters of the transaction date from CHART_FROM_YEAR; flagged dates are left out.
  const chartRows = all.filter((t) => Number(t.transaction_date.slice(0, 4)) >= CHART_FROM_YEAR);
  const early = all.length - chartRows.length;
  const { buckets, flagged } = tradesByQuarter(chartRows);

  // Trade list filter (?trades=buy|sell) and cap (?show=all).
  const filter = one(sp.trades);
  const showAll = one(sp.show) === 'all';
  const listed = filter === 'buy' ? stock.filter((t) => t.transaction_type === 'BUY') : filter === 'sell' ? stock.filter((t) => t.transaction_type.startsWith('SELL')) : stock;
  const shown = showAll ? listed : listed.slice(0, TRADES_SHOWN);
  const href = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const f = 'trades' in extra ? extra.trades : filter ?? null;
    if (f) p.set('trades', f);
    const s = 'show' in extra ? extra.show : showAll ? 'all' : null;
    if (s) p.set('show', s);
    const q = p.toString();
    return `/people/${id}${q ? `?${q}` : ''}#trades`;
  };

  const coverage = member.chamber === 'Senate'
    ? `Senate eFD reports ${senate.coverage ?? '2024–2026'}`
    : `House Clerk reports ${house.coverage ?? '2021–2026'}`;
  const initials = `${(member.first_name ?? member.name)[0] ?? ''}${(member.last_name ?? '')[0] ?? ''}`.toUpperCase();

  return (
    <div data-v2>
      <PageBand overlap>
        <div className="mt-8 flex flex-wrap items-start gap-6 max-md:mt-5 max-md:gap-4">
          {photo ? (
            <Image
              src={photo}
              alt={`Official portrait of ${member.name}`}
              width={112}
              height={137}
              unoptimized
              className="h-[137px] w-[112px] shrink-0 rounded-2xl object-cover shadow-tile max-md:h-[98px] max-md:w-[80px]"
            />
          ) : (
            <span aria-hidden className="grid h-[112px] w-[112px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-trades to-contracts font-display text-[38px] font-extrabold max-md:h-[80px] max-md:w-[80px] max-md:text-[28px]">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep">
              <Link href="/people" className="hover:underline">People</Link> · {chamberWord(member)}
            </p>
            <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">
              <span className="sr-only">{honorific(member)} </span>{member.name}
            </h1>
            <p className="mt-2 text-[16px] text-on-deep max-md:text-[15px]">
              {partyName(member.party)} · {seatLabel(member)}{member.state_name ? ` (${member.state_name})` : ''} ·{' '}
              {inOffice
                ? <span className="whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 font-semibold text-white">In office</span>
                : <span className="whitespace-nowrap rounded-full bg-white/10 px-2.5 py-0.5 font-semibold text-white">Former member</span>}
            </p>
            {committees.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Current committee seats">
                {committees.slice(0, 4).map((c) => (
                  <li key={c} className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white">{c.replace(/^(House|Senate|Joint) (Committee on |Permanent Select Committee on |Select Committee on |Special Committee on )?(the )?/, '')}</li>
                ))}
                {committees.length > 4 && <li className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white">+{committees.length - 4} more</li>}
              </ul>
            )}
          </div>
        </div>
      </PageBand>

      <Wrap className="pb-12">
        <div className="-mt-20 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:mt-4 max-md:gap-2.5">
          <KpiTile
            type="trades"
            label="Stock trades"
            value={trades ? fmtCount(all.length) : null}
            caption={all.length
              ? `disclosed transactions: ${fmtCount(buys)} stock purchase${buys === 1 ? '' : 's'}, ${fmtCount(sells)} sale${sells === 1 ? '' : 's'}${apart.length ? `, ${fmtCount(apart.length)} options and other` : ''}`
              : unread
                ? `no disclosed transactions in the filings we have read; ${fmtCount(unread.house_scanned + unread.senate_paper)} scanned or paper reports not read yet`
                : 'no disclosed transactions in the filings we hold'}
            source={member.chamber === 'Senate' ? 'Senate eFD' : 'House Clerk'}
            asOf={tradesAsOf}
            state={tradesState}
            unavailableReason={trades === null ? 'The trade database did not answer.' : undefined}
            note={latest ? `Latest filing ${fmtDate(latest)} · ${coverage}` : coverage}
          />
          <KpiTile
            type="contracts"
            label="Related contracts"
            value={contractsOn && contractors ? fmtCount(contractors.length) : null}
            caption="companies with federal contracts whose stock this member traded"
            source="USAspending + SEC"
            asOf={null}
            state={contractsOn && contractors ? 'fresh' : 'not_loaded'}
            unavailableReason={contractsOn ? 'The contracts join did not load.' : 'Being checked: the stock-to-company links need share classes and ownership dates first.'}
          />
          <KpiTile
            type="campaign"
            label="Campaign money"
            value={null}
            caption="FEC receipts"
            source="FEC"
            asOf={null}
            state="not_loaded"
            unavailableReason="Not loaded yet (FEC)."
          />
          <KpiTile
            label="Committee seats"
            value={inOffice ? fmtCount(committees.length) : 'None'}
            caption={!inOffice ? 'not in office, so no current seats' : roster.lastUpdated ? `current seats, as of ${fmtDate(roster.lastUpdated)}` : 'current seats'}
            source="congress-legislators"
            sourceHref="https://github.com/unitedstates/congress-legislators"
            asOf={roster.lastUpdated}
            state={inOffice ? roster.state : 'fresh'}
          />
        </div>

        <SourceBar datasets={member.chamber === 'Senate' ? ['senate_trades', 'members'] : ['house_trades', 'members']} className="mt-6" />

        {(unread || oneReportNote) && (
          <div className="mt-5 rounded-2xl bg-stale-tint px-4 py-3 text-[14px] text-stale-ink shadow-[0_0_0_1px_#F0D48A]">
            <b>Read this before the numbers.</b>{' '}
            {unread?.house_scanned ? <>{fmtCount(unread.house_scanned)} of this member&rsquo;s House reports (2021–2026) are scanned images with no text, and we have not read them, so this page undercounts their trades. </> : null}
            {unread?.senate_paper ? <>{fmtCount(unread.senate_paper)} of this senator&rsquo;s Senate reports (2024–2026) were filed on paper and we have not read them, so this page undercounts their trades. </> : null}
            {oneReportNote ? <>{fmtCount(oneReportNote.n)} of the {fmtCount(all.length)} transactions come from a single report{oneReportNote.filed ? ` filed ${fmtDate(oneReportNote.filed)}` : ''}; read it before comparing this member with others. </> : null}
          </div>
        )}

        {/* ---------------------------------------------------------------- trades by quarter */}
        <section className="pt-8" aria-labelledby="p-quarters">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="p-quarters" className="text-[24px] max-md:text-[22px]">Trades by quarter</span>}
              sub="Number of disclosed transactions by the quarter of the trade date. Stock purchases above the line, sales below; options, exchanges and other assets as a count underneath."
            />
            {trades === null ? (
              <EmptyState title="Trades are unavailable right now" tone="warning" statuses={[house, senate]}>The trade database did not answer, so no trades are shown.</EmptyState>
            ) : buckets.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">
                No disclosed transactions to chart. Our filings cover House Clerk reports {house.coverage ?? '2021–2026'} and Senate eFD reports {senate.coverage ?? '2024–2026'}.
              </p>
            ) : (
              <>
                <QuarterChart
                  buckets={buckets}
                  label={`Disclosed transactions by quarter, ${buckets[0].key} to ${buckets[buckets.length - 1].key}: ${fmtCount(buckets.reduce((n, b) => n + b.buys, 0))} stock purchases, ${fmtCount(buckets.reduce((n, b) => n + b.sells, 0))} stock sales, ${fmtCount(buckets.reduce((n, b) => n + b.other, 0))} other.`}
                />
                <p className="mt-3 text-[12.5px] text-muted">
                  Source: {member.chamber === 'Senate' ? 'Senate eFD' : 'House Clerk'} periodic transaction reports, as of {fmtDate(tradesAsOf) ?? 'an unknown date'}. Counts of transactions, not money: the amounts are ranges and are never added up.
                  {early > 0 && <> {fmtCount(early)} transaction{early === 1 ? ' is' : 's are'} dated before {CHART_FROM_YEAR} as filed and {early === 1 ? 'is' : 'are'} in the list below, not on the chart.</>}
                  {flagged > 0 && <> {fmtCount(flagged)} with a date note (see the table) {flagged === 1 ? 'is' : 'are'} left off the chart.</>}
                </p>
              </>
            )}
          </Card>
        </section>

        {/* ---------------------------------------------------------------- every trade */}
        <section className="pt-8" aria-labelledby="trades" id="trades">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="p-trades" className="text-[24px] max-md:text-[22px]">Every stock trade, with its filing</span>}
              sub="Stock purchases, sales and exchanges as disclosed, newest filing first. Options and other assets are listed separately below."
            />
            {trades === null ? (
              <EmptyState title="Trades are unavailable right now" tone="warning" statuses={[house, senate]}>The trade database did not answer, so no trades are shown.</EmptyState>
            ) : all.length === 0 ? (
              <EmptyState title="No disclosed trades in our records" icon="∅" statuses={member.chamber === 'Senate' ? [senate] : [house]}>
                {member.name} has no stock transactions in the filings we hold. Our filings cover House Clerk reports {house.coverage ?? '2021–2026'} and Senate eFD reports {senate.coverage ?? '2024–2026'}, and only lines with a stock ticker.
                {unread ? ' Some of this member’s reports are scanned or paper filings we have not read (see the note above), so this is a gap in our data, not proof of no trading.' : ' No trades here is not proof of no trading outside that window.'}
              </EmptyState>
            ) : (
              <>
                <nav aria-label="Filter trades" className="mb-3 flex flex-wrap items-center gap-1.5">
                  {[
                    { k: null, label: `All ${fmtCount(stock.length)}` },
                    { k: 'buy', label: `Purchases ${fmtCount(buys)}` },
                    { k: 'sell', label: `Sales ${fmtCount(sells)}` },
                  ].map((c) => {
                    const active = (filter ?? null) === c.k;
                    return (
                      <Link
                        key={c.k ?? 'all'}
                        href={href({ trades: c.k, show: null })}
                        scroll={false}
                        aria-current={active ? 'true' : undefined}
                        className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${active ? 'bg-trades text-white' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint'}`}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                </nav>
                {shown.length ? (
                  <TradesTable trades={shown} caption={`${member.name}: disclosed stock transactions, newest filing first`} csvName={`trades-${id}`} hideMember linkMembers={false} />
                ) : (
                  <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No stock transactions of this type in our records.</p>
                )}
                {!showAll && listed.length > TRADES_SHOWN && (
                  <p className="mt-3 text-[13px] text-muted">
                    Showing the {fmtCount(TRADES_SHOWN)} most recently filed of {fmtCount(listed.length)}.{' '}
                    <Link href={href({ show: 'all' })} scroll={false} className="font-semibold text-trades-ink hover:underline">Show all {fmtCount(listed.length)}</Link>.
                  </p>
                )}
              </>
            )}
          </Card>
        </section>

        {/* ---------------------------------------------------------------- options and other */}
        {apart.length > 0 && (
          <section className="pt-8" aria-labelledby="p-other">
            <Card>
              <SectionHead
                as="h2"
                title={<span id="p-other" className="text-[24px] max-md:text-[22px]">Options and other instruments</span>}
                sub={`${fmtCount(options)} option transaction${options === 1 ? '' : 's'} and ${fmtCount(apart.length - options)} other (bonds, funds and similar), with the asset as filed.`}
              />
              <p className="mb-4 max-w-[860px] rounded-2xl bg-neutral-tint px-4 py-3 text-[13.5px] text-muted">
                An option is a bet on a stock&rsquo;s price, not a purchase or sale of the stock: buying put options gains when the price falls. We list these apart and never count
                them as stock purchases or sales. Where the filing&rsquo;s call or put, strike and expiry have not been read into our records yet, the row says so; the filing has them.
              </p>
              <TradesTable trades={apart} caption={`${member.name}: options and other instruments, newest filing first`} csvName={`options-other-${id}`} hideMember linkMembers={false} />
            </Card>
          </section>
        )}

        {/* ---------------------------------------------------------------- committees */}
        <section className="pt-8" aria-labelledby="p-committees">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="p-committees" className="text-[24px] max-md:text-[22px]">Current committee seats{roster.lastUpdated ? ` (as of ${fmtDate(roster.lastUpdated)})` : ''}</span>}
              sub="Seats held today, from the congress-legislators project. They are not the seats held at the time of past trades."
            />
            {!inOffice ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">{member.name} is not in office, so there are no current committee seats. Past seats are not in our records yet.</p>
            ) : committees.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No committee seats listed in the source for this member today (the Speaker, for example, sits on none).</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                {committees.map((c) => (
                  <li key={c} className="rounded-2xl bg-page px-4 py-3 text-[15px] font-semibold">{c}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12.5px] text-muted">
              Source: <a href="https://github.com/unitedstates/congress-legislators" target="_blank" rel="noopener noreferrer" className="underline">unitedstates/congress-legislators</a> (committee-membership-current): seats per the congress-legislators record of {fmtDate(roster.lastUpdated) ?? 'an unknown date'}.
            </p>
          </Card>
        </section>

        {/* ---------------------------------------------------------------- contracts (R6b, flag) */}
        <section className="pt-8" aria-labelledby="p-contracts">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="p-contracts" className="text-[24px] max-md:text-[22px]">Companies with federal contracts this member traded</span>}
              sub="Two public records side by side: a stock trade and a contractor's awards. A pattern worth a look, not an accusation."
            />
            {!contractsOn ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">
                Coming soon. Before we pair a member&rsquo;s trades with a company&rsquo;s contracts, every stock-to-company link needs its share class (common, ADR or preferred, never bonds or
                index notes) and the dates the company owned the contractor. Those checks are running now; this section opens when they are done and audited.
              </p>
            ) : contractors === null ? (
              <EmptyState title="This section is unavailable right now" tone="warning">The contracts join did not load, so nothing is shown.</EmptyState>
            ) : contractors.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">None of this member&rsquo;s stock trades is in a company with a checked link to federal contracts in our records.</p>
            ) : (
              <ContractorsList rows={contractors} />
            )}
          </Card>
        </section>
      </Wrap>
    </div>
  );
}

function ContractorsList({ rows }: { rows: TradedContractor[] }) {
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((c) => (
          <li key={c.key} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={`/companies/${c.slug}`} className="text-[16px] font-semibold text-contracts-ink hover:underline">{c.name}</Link>
              <span className="text-[13.5px] text-muted">
                {c.tickers.map((t) => `${t.ticker}${t.preferred ? ' (preferred shares)' : ''}`).join(', ')} · {fmtCount(c.trades)} stock trade{c.trades === 1 ? '' : 's'} by this member while the link held
              </span>
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[14px]">
              {c.fy.map((f) => (
                <li key={f.fy}>
                  <span className="font-mono" title={fmtUsd(f.obligated) ?? undefined}>{fmtUsdCompact(f.obligated)}</span> obligated to date on {fmtCount(f.count)} contract{f.count === 1 ? '' : 's'} signed in FY{f.fy} that meet{f.count === 1 ? 's' : ''} our{' '}
                  <Link href="/about/methodology/contracts" className="underline">listing rule</Link>{f.fy === 2026 ? ' (incomplete: Defense data is published about 90 days late)' : ''}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-muted">
        Listing rule: not competed and at least $1 million, or any contract of at least $10 million. “Obligated to date” is the total committed on awards signed in that fiscal year, not spending in the year.
        A sequence of trades and contracts is not proof of wrongdoing.
      </p>
    </>
  );
}

