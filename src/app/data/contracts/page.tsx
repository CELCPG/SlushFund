import type { Metadata } from 'next';
import Link from 'next/link';
import AwardsTable from '@/components/v2/AwardsTable';
import DataSubNav from '@/components/v2/DataSubNav';
import EmptyState from '@/components/v2/EmptyState';
import ExplorerForm from '@/components/v2/ExplorerForm';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import Pager from '@/components/v2/Pager';
import SourceBar from '@/components/v2/SourceBar';
import { companySlug, FISCAL_YEARS } from '@/lib/v2/companies';
import {
  AMOUNT_BANDS, CONTRACT_PARAMS, CONTRACT_SORTS, getAgencyOptions, getContractPage, getParentName,
  parseContractFilters, contractParams,
} from '@/lib/v2/contracts-explorer';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { EXPORT_ROW_CAP, PAGE_SIZE, buildHref, hasAny, type SP } from '@/lib/v2/explorer';
import { fmtCount } from '@/lib/v2/format';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: 'Non-competed federal contracts explorer',
    description: 'Federal contracts the agency coded "not competed", $1 million and up, FY2024–26: filter by year, agency, company and amount, with a link to the USAspending award page on every row and a CSV export.',
    alternates: { canonical: '/data/contracts' },
    robots: hasAny(sp, CONTRACT_PARAMS) ? { index: false, follow: true } : undefined,
  };
}

const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink placeholder:text-muted focus:border-contracts focus:outline-none';
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

export default async function ContractsExplorerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = parseContractFilters(sp);
  const [result, statuses, agencies, parentName] = await Promise.all([
    getContractPage(f, sp.page),
    getDatasetStatuses(['contracts']),
    getAgencyOptions(),
    f.parent ? getParentName(f.parent) : Promise.resolve(null),
  ]);
  const params = contractParams(f);
  const filtered = Object.values(params).some(Boolean);
  const href = (page: number) => buildHref('/data/contracts', { ...params, page: page > 1 ? String(page) : undefined });
  const fyText = f.fy ? `FY${f.fy}` : 'FY2024–26';
  const agencyName = agencies.find((a) => a.code === f.agency)?.name;

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Data</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">Non-competed federal contracts</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          Prime contracts the awarding agency itself coded &ldquo;not competed&rdquo; with $1 million or more obligated, signed in fiscal years 2024 to 2026.
          Each row links to its USAspending award page.
        </p>
        <DataSubNav current="/data/contracts" />
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={['contracts']} className="mt-6" />

        <section className="pt-6" aria-labelledby="ct-filters">
          <Card>
            <h2 id="ct-filters" className="sr-only">Filters</h2>
            <ExplorerForm action="/data/contracts" defaults={{ sort: 'obl' }} className="grid grid-cols-4 gap-x-3 gap-y-3 max-lg:grid-cols-2">
              <div>
                <label htmlFor="c-fy" className={label}>Fiscal year signed</label>
                <select id="c-fy" name="fy" defaultValue={f.fy} className={field}>
                  <option value="">FY2024–26</option>
                  {FISCAL_YEARS.map((y) => <option key={y} value={y}>FY{y}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-amt" className={label}>Obligated to date</label>
                <select id="c-amt" name="amt" defaultValue={f.amt} className={field}>
                  <option value="">Any amount</option>
                  {AMOUNT_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
              </div>
              <div className="max-sm:col-span-2">
                <label htmlFor="c-agency" className={label}>Awarding agency</label>
                <select id="c-agency" name="agency" defaultValue={f.agency} className={field}>
                  <option value="">Every agency</option>
                  {f.agency && !agencyName && <option value={f.agency}>Agency code {f.agency}</option>}
                  {agencies.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </div>
              <div className="max-sm:col-span-2">
                <label htmlFor="c-q" className={label}>Company or recipient</label>
                <input id="c-q" name="q" type="search" defaultValue={f.q} placeholder="Part of a company name" className={field} />
              </div>
              {f.parent && <input type="hidden" name="parent" value={f.parent} />}
              <div className="col-span-2">
                <label htmlFor="c-sort" className={label}>Sort</label>
                <select id="c-sort" name="sort" defaultValue={f.sort} className={field}>
                  {CONTRACT_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-end gap-2">
                <button type="submit" className="h-11 flex-1 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:bg-deep">Apply filters</button>
                {filtered && <Link href="/data/contracts" className="grid h-11 place-items-center rounded-xl px-4 text-sm font-semibold text-contracts-ink hover:underline">Clear</Link>}
              </div>
            </ExplorerForm>
            {f.parent && (
              <p className="mt-3 text-[13.5px] text-muted">
                Only awards to the company group{' '}
                <Link href={`/companies/${companySlug(f.parent, parentName ?? f.parent)}`} className="font-semibold text-contracts-ink hover:underline">{parentName ?? f.parent}</Link>
                {' '}(every recipient record under that parent).{' '}
                <Link href={buildHref('/data/contracts', { ...params, parent: undefined })} className="font-semibold text-contracts-ink hover:underline">Remove</Link>
              </p>
            )}
          </Card>
        </section>

        <section className="pt-6" aria-labelledby="ct-results">
          {result === null ? (
            <EmptyState title="The contracts are unavailable right now" tone="warning" statuses={statuses}>
              The database did not answer, so nothing is shown rather than a stand-in. Try again in a few minutes.
            </EmptyState>
          ) : (
            <Card>
              <h2 id="ct-results" className="font-display text-[24px] font-extrabold max-md:text-[22px]">
                {result.total === 0 ? 'No contracts match' : <>{fmtCount(result.total)} {result.total === 1 ? 'contract' : 'contracts'}{filtered ? ' match' : ''}</>}
              </h2>
              <p className="mb-3 mt-1 text-[13.5px] text-muted" aria-live="polite">
                Contracts signed in {fyText}{agencyName ? ` by ${agencyName}` : ''} that meet our listing rule:{' '}
                <Link href="/about/methodology/contracts" className="font-semibold text-contracts-ink hover:underline">not competed and at least $1 million</Link>.
                {result.total > 0 && <> Showing {fmtCount((result.page - 1) * PAGE_SIZE + 1)}–{fmtCount((result.page - 1) * PAGE_SIZE + result.rows.length)}{result.pages > 1 ? ` · page ${fmtCount(result.page)} of ${fmtCount(result.pages)}` : ''}.</>}
              </p>
              {(!f.fy || f.fy === '2026') && (
                <p className="mb-3 rounded-2xl bg-stale-tint px-4 py-2.5 text-[13.5px] text-stale-ink">
                  Incomplete: Defense Department contract data is published about 90 days late, so FY2026 totals will grow.
                </p>
              )}
              {result.total === 0 ? (
                <p className="rounded-2xl bg-page px-4 py-6 text-center text-[14.5px] text-muted">
                  No contract in this set matches these filters. <Link href="/data/contracts" className="font-semibold text-contracts-ink hover:underline">Clear the filters</Link> or widen the amount.
                </p>
              ) : (
                <AwardsTable
                  awards={result.rows}
                  mode="explorer"
                  ordered
                  captionHidden
                  caption="Non-competed federal contracts of $1 million or more, in the chosen order"
                  csvName="non-competed-contracts"
                  footer={
                    <span>
                      Source: USAspending.gov. &ldquo;Obligated to date&rdquo; is the total obligated on the contract so far, as of the last load; it can grow with later modifications and is not spending in a year.
                      &ldquo;Not competed&rdquo; is the agency&rsquo;s own coding. A PIID is not unique, so an order&rsquo;s parent IDV is shown beside it.
                    </span>
                  }
                />
              )}
              <Pager page={result.page} pages={result.pages} href={href} />
              {result.total > 0 && (
                <div className="mt-5 rounded-2xl bg-page px-4 py-3 text-[13.5px] text-muted">
                  <a
                    href={buildHref('/data/contracts/export', params)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-deep"
                  >
                    Download CSV <span aria-hidden>⇩</span>
                  </a>
                  <span className="ml-3 align-middle">
                    {result.total > EXPORT_ROW_CAP
                      ? <>The CSV holds the first {fmtCount(EXPORT_ROW_CAP)} of {fmtCount(result.total)} matching rows in the order shown. Narrow the year or agency to export the rest in parts.</>
                      : <>All {fmtCount(result.total)} matching {result.total === 1 ? 'row' : 'rows'}, in the order shown (at most {fmtCount(EXPORT_ROW_CAP)}).</>}
                    {' '}Every row has its USAspending award address.
                  </span>
                </div>
              )}
            </Card>
          )}
        </section>

        <p className="mt-6 max-w-[860px] text-[13px] text-muted">
          What is and is not here: this is a selection under rule r5-v1, not all federal contracting, and no share of an agency&rsquo;s spending can be read from it.
          Percentages of contract dollars that were not competed come from agency totals on the{' '}
          <Link href="/agencies" className="font-semibold text-contracts-ink hover:underline">agency pages</Link>.
          Competed contracts of $10 million or more are in the same database and show on each company page.
          Amounts are grouped by the fiscal year a contract was signed. A contract with no competition is not by itself a finding about anyone.
        </p>
      </Wrap>
    </div>
  );
}
