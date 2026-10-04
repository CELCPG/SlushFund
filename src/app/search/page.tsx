import type { Metadata } from 'next';
import Link from 'next/link';
import BigSearch from '@/components/v2/BigSearch';
import EmptyState from '@/components/v2/EmptyState';
import { MoneyChip } from '@/components/v2/MoneyChip';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { partyLetter } from '@/components/v2/TradesTable';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { companiesForTickers, searchAgencies, searchCompanyGroups, type AgencyHit, type CompanyHit } from '@/lib/v2/companies';
import { fmtCount, fmtPct, fmtUsdCompact } from '@/lib/v2/format';
import { cleanQuery, searchMembers, searchTraded, type Aggregated, type MemberHit, type TradedHit } from '@/lib/v2/queries';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = cleanQuery(Array.isArray(raw) ? raw[0] : raw);

  let members: MemberHit[] | null = [];
  let companyAgg: { hits: CompanyHit[]; matched: number } | null = { hits: [], matched: 0 };
  let agencyHits: AgencyHit[] | null = [];
  let tradedAgg: Aggregated<TradedHit> | null = { hits: [], matched: 0, scanned: 0 };
  if (q.length >= 2) {
    [members, companyAgg, agencyHits, tradedAgg] = await Promise.all([searchMembers(q), searchCompanyGroups(q), searchAgencies(q), searchTraded(q)]);
  }
  const failed = members === null || companyAgg === null || agencyHits === null || tradedAgg === null;
  const companies = companyAgg?.hits ?? [];
  const agencies = agencyHits ?? [];
  const traded = tradedAgg?.hits ?? [];
  // A traded stock whose ticker is confirmed to a contract recipient links to that company's page.
  const tickerCompany = traded.length ? await companiesForTickers(traded.map((t) => t.ticker)) : new Map<string, { name: string; slug: string }>();
  const total = (members?.length ?? 0) + companies.length + agencies.length + traded.length;

  return (
    <div data-v2>
      <PageBand>
        <h1 className="mb-4 mt-8 font-display text-[40px] font-extrabold leading-tight tracking-[-0.8px] max-md:mt-5 max-md:text-[30px]">
          {q ? <>Results for &ldquo;{q}&rdquo;</> : 'Search'}
        </h1>
        <BigSearch defaultValue={q} />
      </PageBand>
      <Wrap className="pb-12 pt-6">
        <SourceBar datasets={['members', 'contracts', 'contract_totals', 'house_trades', 'senate_trades']} className="mb-6" />

        {q.length < 2 ? (
          <EmptyState title="Type a name, company or ticker" icon="⌕">
            Search covers members of Congress (2016 to today), companies that won federal contracts, federal agencies, and the stocks members disclosed trading.
          </EmptyState>
        ) : failed ? (
          <EmptyState title="Search is unavailable right now" statuses={await getDatasetStatuses(['members', 'contracts', 'contract_totals', 'house_trades', 'senate_trades'])}>
            The database did not answer, so no results are shown. Try again in a few minutes.
          </EmptyState>
        ) : total === 0 ? (
          <EmptyState title={`Nothing matches “${q}”`} icon="∅">
            Try a last name (&ldquo;Warren&rdquo;), part of a company name (&ldquo;Lockheed&rdquo;) or a ticker (&ldquo;NVDA&rdquo;).
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
            <Card as="section">
              <h2 className="font-display text-xl font-extrabold">People <span className="font-mono text-sm font-medium text-muted">{members!.length}</span></h2>
              <p className="mb-3 text-[13px] text-muted">Members of Congress, 2016 to today.</p>
              {members!.length === 0 ? <p className="text-sm text-muted">No members match.</p> : (
                <ul className="divide-y divide-line">
                  {members!.map((m) => (
                    <li key={m.bioguide_id ?? m.name} className="py-2.5">
                      {m.bioguide_id ? <Link href={`/people/${m.bioguide_id}`} className="font-semibold hover:underline">{m.name}</Link> : <b className="font-semibold">{m.name}</b>}
                      <span className="block text-[13px] text-muted">
                        {partyLetter(m.party)} · {m.state}{m.district ? `-${m.district}` : ''} · {m.chamber}{m.in_office ? '' : ' · former member'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12.5px] text-muted">Member profiles arrive in the next build step.</p>
            </Card>
            <Card as="section">
              <h2 className="font-display text-xl font-extrabold">Companies <span className="font-mono text-sm font-medium text-muted">{companyAgg ? fmtCount(companyAgg.matched) : companies.length}</span></h2>
              <p className="mb-3 text-[13px] text-muted">Federal contract recipients (USAspending parent records) with awards in our database: non-competed $1M+ or any $10M+.</p>
              {companies.length === 0 ? <p className="text-sm text-muted">No contract recipients match.</p> : (
                <ul className="divide-y divide-line">
                  {companies.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                      <Link href={`/companies/${c.slug}`} className="min-w-0 break-words font-semibold text-contracts-ink hover:underline">
                        {c.name}
                        {c.tickers.length > 0 && <span className="ml-1.5 font-mono text-[12px] font-medium text-trades-ink">{c.tickers.slice(0, 3).join(' ')}</span>}
                      </Link>
                      <MoneyChip
                        type="contracts"
                        label={`${fmtCount(c.awards)} award${c.awards === 1 ? '' : 's'}`}
                        value={c.ncObl > 0 ? `${fmtUsdCompact(c.ncObl)} non-competed, obligated to date` : undefined}
                        className="flex-none max-sm:whitespace-normal"
                      />
                    </li>
                  ))}
                </ul>
              )}
              {companyAgg && companyAgg.matched > companies.length && (
                <p className="mt-3 text-[12.5px] text-muted">Showing the {fmtCount(companies.length)} largest of {fmtCount(companyAgg.matched)} matches. <Link href={`/companies?q=${encodeURIComponent(q)}`} className="font-semibold text-contracts-ink hover:underline">See all companies</Link>.</p>
              )}
            </Card>
            <Card as="section">
              <h2 className="font-display text-xl font-extrabold">Agencies <span className="font-mono text-sm font-medium text-muted">{agencies.length}</span></h2>
              <p className="mb-3 text-[13px] text-muted">Federal agencies, with the share of their contract dollars that was not competed.</p>
              {agencies.length === 0 ? <p className="text-sm text-muted">No agencies match.</p> : (
                <ul className="divide-y divide-line">
                  {agencies.map((a) => (
                    <li key={a.code} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                      <Link href={`/agencies/${a.code}`} className="min-w-0 break-words font-semibold text-contracts-ink hover:underline">
                        {a.name}{a.abbr ? <span className="ml-1.5 text-[12.5px] font-normal text-muted">{a.abbr}</span> : null}
                      </Link>
                      <span className="text-[13px] text-muted">
                        {a.share != null ? `${fmtPct(a.share)} not competed, FY${a.fy}${a.lagOpen ? ' (incomplete)' : ''}` : 'Share unavailable'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card as="section">
              <h2 className="font-display text-xl font-extrabold">Traded by members <span className="font-mono text-sm font-medium text-muted">{traded.length}</span></h2>
              <p className="mb-3 text-[13px] text-muted">Stocks named in members&rsquo; trade disclosures.</p>
              {traded.length === 0 ? <p className="text-sm text-muted">No traded stocks match.</p> : (
                <ul className="divide-y divide-line">
                  {traded.map((t) => (
                    <li key={`${t.ticker}-${t.company_name}`} className="flex items-start justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="font-mono text-[13px] font-medium">{t.ticker}</span>{' '}
                        <span className="break-words text-[13.5px]">{t.company_name}</span>
                        {tickerCompany.get(t.ticker.toUpperCase()) && (
                          <Link href={`/companies/${tickerCompany.get(t.ticker.toUpperCase())!.slug}`} className="block text-[12.5px] font-semibold text-contracts-ink hover:underline">
                            Federal contractor page: {tickerCompany.get(t.ticker.toUpperCase())!.name} →
                          </Link>
                        )}
                      </span>
                      <MoneyChip type="trades" label={`${fmtCount(t.trades)} trade${t.trades === 1 ? '' : 's'}`} className="flex-none" />
                    </li>
                  ))}
                </ul>
              )}
              {tradedAgg && tradedAgg.matched > tradedAgg.scanned && (
                <p className="mt-3 text-[12.5px] text-muted">Counts use {fmtCount(tradedAgg.scanned)} of {fmtCount(tradedAgg.matched)} matching trades. Narrow the search for exact totals.</p>
              )}
            </Card>
          </div>
        )}
      </Wrap>
    </div>
  );
}
