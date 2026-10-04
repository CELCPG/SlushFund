import type { Metadata } from 'next';
import Link from 'next/link';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { partyLetter } from '@/components/v2/TradesTable';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { getRoster, getTradeStats, partyName, seatLabel, type Member, type TradeStats } from '@/lib/v2/people';
import { cleanQuery } from '@/lib/v2/queries';
import { lookupZip, ZCTA_SOURCE, type DistrictCandidate } from '@/lib/v2/zip';

export const metadata: Metadata = {
  title: 'People: members of Congress and their stock trades',
  description: 'Every member of Congress in office, and every former member with disclosed stock trades: trades from the official filings, committee seats, and a ZIP lookup for your members.',
};
export const revalidate = 600;

const PER_PAGE = 50;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const PARTIES = ['Democrat', 'Republican', 'Independent'];

interface Row {
  m: Member;
  s: TradeStats | undefined;
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = cleanQuery(one(sp.q));
  const chamber = ['House', 'Senate'].includes(one(sp.chamber)) ? one(sp.chamber) : '';
  const party = PARTIES.includes(one(sp.party)) ? one(sp.party) : '';
  const status = ['in', 'former'].includes(one(sp.status)) ? one(sp.status) : '';
  const sort = one(sp.sort) === 'name' ? 'name' : 'trades';
  const zipRaw = one(sp.zip).trim();
  const zip = /^\d{5}$/.test(zipRaw) ? zipRaw : '';

  const [roster, stats, statuses] = await Promise.all([getRoster(), getTradeStats(), getDatasetStatuses(['members', 'house_trades', 'senate_trades'])]);
  const statesAll = roster ? [...new Set(roster.map((m) => m.state))].sort() : [];
  const state = statesAll.includes(one(sp.state).toUpperCase()) ? one(sp.state).toUpperCase() : '';

  if (!roster) {
    return (
      <div data-v2>
        <PageBand><h1 className="mt-8 font-display text-[40px] font-extrabold max-md:mt-5 max-md:text-[30px]">Members of Congress</h1></PageBand>
        <Wrap className="pb-12 pt-6">
          <EmptyState title="The member list is unavailable right now" tone="warning" statuses={statuses}>
            The members database did not answer, so nothing is shown. Try again in a few minutes.
          </EmptyState>
        </Wrap>
      </div>
    );
  }

  // In office, or any disclosed trade in our filings.
  const base: Row[] = roster
    .map((m) => ({ m, s: stats?.get(m.bioguide_id) }))
    .filter((r) => r.m.in_office === true || (r.s?.total ?? 0) > 0);
  const needle = q.toLowerCase();
  const filtered = base.filter(({ m }) =>
    (!chamber || m.chamber === chamber)
    && (!party || m.party === party)
    && (!state || m.state === state)
    && (!status || (status === 'in' ? m.in_office === true : m.in_office !== true))
    && (!needle || m.name.toLowerCase().includes(needle)),
  );
  filtered.sort((a, b) =>
    sort === 'name'
      ? (a.m.last_name ?? a.m.name).localeCompare(b.m.last_name ?? b.m.name) || a.m.name.localeCompare(b.m.name)
      : (b.s?.total ?? 0) - (a.s?.total ?? 0) || (a.m.last_name ?? a.m.name).localeCompare(b.m.last_name ?? b.m.name),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.page)) || 1));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const inOfficeCount = base.filter((r) => r.m.in_office === true).length;
  const formerWithTrades = base.length - inOfficeCount;

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { q, chamber, party, state, status, sort: sort === 'name' ? 'name' : '', zip };
    for (const [k, v] of Object.entries({ ...cur, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/people?${s}` : '/people';
  };

  const columns: DataTableColumn[] = [
    { key: 'member', header: 'Member', mobile: 'title', sortable: false },
    { key: 'seat', header: 'Party · Seat', mobile: 'subtitle', sortable: false },
    { key: 'status', header: 'Status', sortable: false },
    { key: 'trades', header: 'Disclosed trades', numeric: true, sortable: false },
    { key: 'buys', header: 'Stock purchases', numeric: true, sortable: false },
    { key: 'sells', header: 'Stock sales', numeric: true, sortable: false },
    { key: 'other', header: 'Options and other', numeric: true, sortable: false },
    { key: 'latest', header: 'Latest filing', numeric: true, sortable: false },
  ];
  const rows: DataTableRow[] = shown.map(({ m, s }) => ({
    id: m.bioguide_id,
    values: {
      member: m.name,
      seat: `${partyLetter(m.party)} · ${seatLabel(m)}`,
      status: m.in_office ? 'In office' : 'Former',
      trades: s?.total ?? 0,
      buys: s?.buys ?? 0,
      sells: s?.sells ?? 0,
      other: s?.other ?? 0,
      latest: s?.latestFiled ?? null,
    },
    cells: {
      member: <Link href={`/people/${m.bioguide_id}`} className="font-semibold text-ink hover:text-trades-ink hover:underline">{m.name}</Link>,
      seat: <span>{partyName(m.party)} · {seatLabel(m)}</span>,
      status: m.in_office ? <span className="whitespace-nowrap">In office</span> : <span className="text-muted">Former</span>,
      trades: stats ? <span>{fmtCount(s?.total ?? 0)}</span> : <span className="font-sans text-muted">Unavailable</span>,
      buys: stats ? <span>{fmtCount(s?.buys ?? 0)}</span> : <span className="font-sans text-muted">—</span>,
      sells: stats ? <span>{fmtCount(s?.sells ?? 0)}</span> : <span className="font-sans text-muted">—</span>,
      other: stats ? <span>{fmtCount(s?.other ?? 0)}</span> : <span className="font-sans text-muted">—</span>,
      latest: <span>{fmtDate(s?.latestFiled) ?? '—'}</span>,
    },
  }));

  const select = 'h-11 min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">People</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Members of Congress</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          One page per member: the stock trades they disclosed, each linked to the official filing, and their current committee seats.
          {' '}{fmtCount(inOfficeCount)} in office and {fmtCount(formerWithTrades)} former members with disclosed trades.
        </p>
        <form action="/people" method="get" role="search" className="mt-5 flex max-w-[560px] gap-2">
          <label htmlFor="zip" className="sr-only">Your ZIP code</label>
          <input
            id="zip"
            name="zip"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            defaultValue={zip || zipRaw.slice(0, 5)}
            placeholder="Your ZIP code"
            autoComplete="postal-code"
            className="h-12 w-[180px] min-w-0 rounded-xl border border-white/20 bg-white px-4 font-mono text-[16px] text-ink placeholder:font-sans placeholder:text-muted focus:outline-none max-sm:w-auto max-sm:flex-1"
          />
          <button type="submit" className="h-12 shrink-0 rounded-xl bg-brand px-5 text-[15px] font-bold text-white hover:brightness-110 max-sm:px-4">Find my members</button>
        </form>
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={['members', 'house_trades', 'senate_trades']} className="mt-6" />

        {(zip || zipRaw) && <ZipResult zip={zip} raw={zipRaw} roster={roster} stats={stats} />}

        <section className="pt-8" aria-labelledby="ppl-list">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="ppl-list" className="text-[24px] max-md:text-[22px]">{sort === 'trades' ? 'Members by number of disclosed trades' : 'Members by name'}</span>}
              sub="Counts of disclosed transactions in our filings (House 2021–2026, Senate 2024–2026), not money: the amounts are ranges and are never added up."
            />
            <form action="/people" method="get" className="mb-4 grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_auto] gap-2 max-lg:grid-cols-3 max-sm:grid-cols-2">
              {zip && <input type="hidden" name="zip" value={zip} />}
              <label className="sr-only" htmlFor="f-q">Name</label>
              <input id="f-q" name="q" type="search" defaultValue={q} placeholder="Search by name" className={`${select} max-sm:col-span-2`} />
              <label className="sr-only" htmlFor="f-chamber">Chamber</label>
              <select id="f-chamber" name="chamber" defaultValue={chamber} className={select}>
                <option value="">Any chamber</option>
                <option value="House">House</option>
                <option value="Senate">Senate</option>
              </select>
              <label className="sr-only" htmlFor="f-party">Party</label>
              <select id="f-party" name="party" defaultValue={party} className={select}>
                <option value="">Any party</option>
                {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <label className="sr-only" htmlFor="f-state">State</label>
              <select id="f-state" name="state" defaultValue={state} className={select}>
                <option value="">Any state</option>
                {statesAll.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="sr-only" htmlFor="f-status">In office or former</label>
              <select id="f-status" name="status" defaultValue={status} className={select}>
                <option value="">Any status</option>
                <option value="in">In office</option>
                <option value="former">Former</option>
              </select>
              <label className="sr-only" htmlFor="f-sort">Sort</label>
              <select id="f-sort" name="sort" defaultValue={sort} className={select}>
                <option value="trades">Most trades</option>
                <option value="name">Name</option>
              </select>
              <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:bg-deep max-sm:col-span-2">Apply</button>
            </form>

            <p className="mb-3 text-[13.5px] text-muted" aria-live="polite">
              {fmtCount(filtered.length)} member{filtered.length === 1 ? '' : 's'}{pages > 1 ? ` · page ${page} of ${pages}` : ''}
              {(q || chamber || party || state || status || sort === 'name') && <> · <Link href={zip ? `/people?zip=${zip}` : '/people'} className="font-semibold text-trades-ink hover:underline">Clear filters</Link></>}
            </p>
            {stats === null && (
              <p className="mb-3 rounded-2xl bg-stale-tint px-4 py-2.5 text-[13.5px] text-stale-ink">The trade counts did not load, so members are listed without them.</p>
            )}
            {rows.length ? (
              <DataTable columns={columns} rows={rows} caption="Members of Congress with their numbers of disclosed trades" captionHidden csv={{ filename: 'members' }} />
            ) : (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No member matches these filters.</p>
            )}
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
                {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint">← Previous</Link>}
                <span className="text-muted">Page {page} of {pages}</span>
                {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint">Next →</Link>}
              </nav>
            )}
            <p className="mt-4 text-[12.5px] text-muted">
              Some members file on paper or as scanned images that we have not read yet, so a low count can be a gap rather than little trading; each member&rsquo;s page says when that applies.
              Party is the member&rsquo;s party as listed in the roster.
            </p>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}

function ZipResult({ zip, raw, roster, stats }: { zip: string; raw: string; roster: Member[]; stats: Map<string, TradeStats> | null }) {
  const cands: DistrictCandidate[] | null = zip ? lookupZip(zip) : null;
  const current = roster.filter((m) => m.in_office === true);
  const states = cands ? [...new Set(cands.map((c) => c.state))] : [];
  const senators = current.filter((m) => m.chamber === 'Senate' && states.includes(m.state));
  const reps = (c: DistrictCandidate) =>
    current.filter((m) => m.chamber === 'House' && m.state === c.state && String(Number(m.district ?? -1)) === c.district);

  const person = (m: Member) => {
    const n = stats?.get(m.bioguide_id)?.total ?? 0;
    return (
      <li key={m.bioguide_id}>
        <Link href={`/people/${m.bioguide_id}`} className="group flex items-baseline justify-between gap-3 rounded-2xl bg-page px-4 py-3 hover:bg-trades-tint">
          <span className="min-w-0">
            <b className="font-semibold group-hover:underline">{m.name}</b>
            <span className="block text-[13px] text-muted">{partyName(m.party)} · {seatLabel(m)}</span>
          </span>
          <span className="shrink-0 font-mono text-[13px] text-trades-ink">{stats ? `${fmtCount(n)} trade${n === 1 ? '' : 's'}` : ''}</span>
        </Link>
      </li>
    );
  };

  return (
    <section className="pt-6" aria-labelledby="zip-result">
      <Card>
        <h2 id="zip-result" className="font-display text-[24px] font-extrabold max-md:text-[22px]">
          {zip ? <>Members for ZIP <span className="font-mono">{zip}</span></> : 'Enter a 5-digit ZIP code'}
        </h2>
        {!zip ? (
          <p className="mt-2 text-[14.5px] text-muted">&ldquo;{raw.slice(0, 12)}&rdquo; is not a 5-digit ZIP code.</p>
        ) : !cands || cands.length === 0 ? (
          <p className="mt-2 text-[14.5px] text-muted">
            We can&rsquo;t place this ZIP: it is not in the Census ZIP Code Tabulation Areas (PO-box-only and business ZIPs have none). Browse by state below instead.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[14.5px] text-muted">
              {cands.length > 1
                ? `This ZIP area crosses ${cands.length} congressional districts, so you may live in any of them. Shares are of the ZIP's land area, not its people; the House's "Find your representative" tool can tell from your street address.`
                : 'This ZIP area lies in one congressional district.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-5 max-md:grid-cols-1">
              <div>
                <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.05em] text-muted">House</h3>
                <ul className="space-y-2">
                  {cands.map((c) => {
                    const r = reps(c);
                    const label = c.district === '98' ? `${c.state} delegate seat` : c.district === '0' ? `${c.state} at-large` : `${c.state}-${c.district}`;
                    return (
                      <li key={`${c.state}${c.district}`}>
                        <p className="mb-1 text-[13px] font-semibold text-muted">{label}{cands.length > 1 ? ` · ${c.landPct < 1 ? 'under 1' : c.landPct}% of the ZIP's land` : ''}</p>
                        {c.district === '98' ? (
                          <p className="rounded-2xl bg-page px-4 py-3 text-[14px] text-muted">Represented by a non-voting delegate, who is not in our records yet.</p>
                        ) : r.length ? (
                          <ul className="space-y-2">{r.map(person)}</ul>
                        ) : (
                          <p className="rounded-2xl bg-page px-4 py-3 text-[14px] text-muted">No current representative in our roster for this seat (it may be vacant).</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.05em] text-muted">Senate</h3>
                {senators.length ? (
                  <ul className="space-y-2">{senators.map(person)}</ul>
                ) : (
                  <p className="rounded-2xl bg-page px-4 py-3 text-[14px] text-muted">No senators: {states.join(', ')} has no seats in the Senate.</p>
                )}
              </div>
            </div>
            <p className="mt-4 text-[12.5px] text-muted">
              Source: <a href={ZCTA_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">{ZCTA_SOURCE.name}</a> (2020 ZCTAs, districts of the 119th Congress). ZCTAs approximate ZIP codes.
              Members from the congress-legislators roster.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
