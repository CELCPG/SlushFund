import type { Metadata } from 'next';
import Link from 'next/link';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import SourceBar from '@/components/v2/SourceBar';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { FISCAL_YEARS, getEntityIndex, ncTotals, otherCount, type EntitySummary } from '@/lib/v2/companies';
import { fmtCount, fmtUsd, fmtUsdCompact } from '@/lib/v2/format';
import { cleanQuery } from '@/lib/v2/queries';

export const metadata: Metadata = {
  title: 'Companies that received federal contracts',
  description: 'Federal contract recipients ranked by non-competed awards (FY2024–26), with the stocks members of Congress reported trading.',
};

const PAGE_SIZE = 50;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function href(params: { q?: string; fy?: number | null; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.fy) sp.set('fy', String(params.fy));
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const s = sp.toString();
  return s ? `/companies?${s}` : '/companies';
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = cleanQuery(one(sp.q));
  const fyRaw = Number(one(sp.fy));
  const fy = (FISCAL_YEARS as readonly number[]).includes(fyRaw) ? fyRaw : null;
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  const index = await getEntityIndex();
  const sourceBar = <SourceBar datasets={['contracts', 'company_tickers']} />;
  const head = {
    eyebrow: 'Companies',
    title: 'Companies with non-competed federal contracts',
    dek: 'Recipients of federal contract awards that the agency coded “not competed” ($1 million and up), from USAspending. Open a company to see its awards and any stock ticker, and which members of Congress reported trading that stock.',
  };

  if (!index) {
    return (
      <SimplePage {...head} sourceBar={sourceBar}>
        <EmptyState title="Company data is unavailable right now" tone="warning" statuses={await getDatasetStatuses(['contracts', 'company_tickers'])}>
          The contracts database did not answer, so no companies are shown. Try again in a few minutes.
        </EmptyState>
      </SimplePage>
    );
  }

  const needle = q.toLowerCase();
  const matches = (e: EntitySummary) =>
    !needle || e.name.toLowerCase().includes(needle) || e.tickers.some((t) => t.toLowerCase() === needle);
  // Ranked list: companies with at least one non-competed award in view. A search also
  // surfaces companies that only have large competed awards, listed after them.
  const inView = index.entities
    .filter(matches)
    .map((e) => ({ e, nc: ncTotals(e, fy), other: otherCount(e, fy) }))
    .filter((x) => (needle ? x.nc.count + x.other > 0 : x.nc.count > 0))
    .sort((a, b) => b.nc.obligated - a.nc.obligated || b.nc.count - a.nc.count || a.e.name.localeCompare(b.e.name));

  const pages = Math.max(1, Math.ceil(inView.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = inView.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const fyLabel = fy ? `FY${fy}` : 'FY2024–26';
  const totalCount = inView.reduce((n, x) => n + x.nc.count, 0);
  const totalObl = inView.reduce((n, x) => n + x.nc.obligated, 0);

  const columns: DataTableColumn[] = [
    { key: 'rank', header: '#', numeric: true, mobile: 'hidden' },
    { key: 'company', header: 'Company (USAspending parent)', mobile: 'title' },
    { key: 'ticker', header: 'Stock ticker', mobile: 'field', sortable: false },
    { key: 'nc', header: 'Non-competed awards', numeric: true, mobile: 'field' },
    { key: 'obligated', header: `Obligated to date (${fyLabel})`, numeric: true, mobile: 'field' },
    { key: 'other', header: 'Other awards $10M+', numeric: true, mobile: 'field' },
    { key: 'recipients', header: 'Recipient records', numeric: true, mobile: 'hidden' },
    { key: 'tickers_csv', header: 'Confirmed tickers', csvOnly: true },
    { key: 'uei', header: 'Parent UEI', csvOnly: true },
  ];
  const offset = (cur - 1) * PAGE_SIZE;
  const rows: DataTableRow[] = slice.map(({ e, nc, other }, i) => ({
    id: e.key,
    values: {
      rank: offset + i + 1,
      company: e.name,
      nc: nc.count,
      obligated: nc.count > 0 ? nc.obligated : null,
      other,
      recipients: e.recipients,
      tickers_csv: e.tickers.join(' '),
      uei: e.key,
    },
    cells: {
      company: (
        <Link href={`/companies/${e.slug}`} className="font-semibold text-contracts-ink hover:underline">
          {e.name}
        </Link>
      ),
      ticker: e.tickers.length ? (
        <span className="flex flex-wrap gap-1">
          {e.tickers.slice(0, 4).map((t) => (
            <span key={t} className="rounded-md bg-trades-tint px-1.5 py-0.5 font-mono text-[12px] font-medium text-trades-ink" title="Confirmed link to an SEC-registered company">{t}</span>
          ))}
          {e.tickers.length > 4 && <span className="text-[12px] text-muted">+{e.tickers.length - 4}</span>}
        </span>
      ) : <span className="text-muted">None confirmed</span>,
      nc: nc.count > 0 ? <span>{fmtCount(nc.count)}</span> : <span className="font-sans text-muted">None in this set</span>,
      obligated: nc.count > 0 ? <span title={fmtUsd(nc.obligated) ?? undefined}>{fmtUsdCompact(nc.obligated)}</span> : <span className="font-sans text-muted">—</span>,
    },
  }));

  const chip = (label: string, value: number | null) => {
    const active = value === fy;
    return (
      <Link
        key={label}
        href={href({ q, fy: value })}
        aria-current={active ? 'true' : undefined}
        className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${active ? 'bg-ink text-white' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <SimplePage {...head} sourceBar={sourceBar}>
      <Card as="section" className="mb-5">
        <h2 className="font-display text-[19px] font-extrabold">What this list covers</h2>
        <p className="mt-1.5 max-w-[860px] text-[14.5px] text-muted">
          The awards behind it are every prime contract award signed in FY2024–26 that is <b className="text-ink">non-competed and $1 million or more</b>, plus any
          award of <b className="text-ink">$10 million or more</b>{' '}(rule r5-v1). It is a selection, not a company&rsquo;s total federal business, so no
          company&rsquo;s “share” of not-competed work can be read from it. “Obligated to date” is the total the government has committed on awards signed in the
          period, including later modifications; it is not spending in that fiscal year. Agency-level shares are on the{' '}
          <Link href="/agencies" className="font-semibold text-contracts-ink hover:underline">agencies page</Link>. Companies are grouped by USAspending&rsquo;s parent-company
          field, which has errors: the same company can appear under more than one parent record.
        </p>
      </Card>

      <form method="get" action="/companies" className="mb-4 flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="co-q">Search companies</label>
        <input
          id="co-q"
          name="q"
          defaultValue={q}
          placeholder="Search a company or ticker"
          className="h-10 min-w-[220px] flex-1 rounded-full bg-card px-4 text-[15px] shadow-[0_0_0_1px_var(--color-line)] max-sm:min-w-0"
        />
        {fy && <input type="hidden" name="fy" value={fy} />}
        <button type="submit" className="h-10 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-deep">Search</button>
        <nav aria-label="Fiscal year signed" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] font-semibold text-muted">Signed in</span>
          {chip('FY2024–26', null)}
          {FISCAL_YEARS.map((y) => chip(`FY${y}`, y))}
        </nav>
      </form>

      {inView.length === 0 ? (
        <EmptyState title={q ? `No company matches “${q}”` : 'No companies in this view'} icon="∅">
          {q ? 'Try part of a company name or a ticker such as LMT.' : 'No awards matched this filter.'}
        </EmptyState>
      ) : (
        <Card as="section">
          <p className="mb-3 text-[14px] text-muted">
            {fmtCount(inView.length)} {inView.length === 1 ? 'company' : 'companies'}
            {needle ? ` matching “${q}”` : ''} · {fmtCount(totalCount)} non-competed awards signed {fyLabel} · {fmtUsdCompact(totalObl)} obligated to date on them.
            {fy === 2026 && ' FY2026 is incomplete: the Department of Defense reports contract actions 90 days late.'}
          </p>
          <DataTable
            columns={columns}
            rows={rows}
            caption={`Companies ranked by non-competed obligated to date, awards signed ${fyLabel}`}
            captionHidden
            initialSort={{ key: 'obligated', dir: 'desc' }}
            csv={{ filename: `companies-non-competed-${fy ? `fy${fy}` : 'fy2024-26'}` }}
            footer={<span>Source: USAspending.gov award records (rule r5-v1); stock tickers from SEC filings (rule r7-v1). Sorting applies to the rows on this page.</span>}
          />
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-[14px]">
              {cur > 1 ? <Link href={href({ q, fy, page: cur - 1 })} className="font-semibold text-contracts-ink hover:underline">← Previous</Link> : <span />}
              <span className="text-muted">Page {cur} of {pages}</span>
              {cur < pages ? <Link href={href({ q, fy, page: cur + 1 })} className="font-semibold text-contracts-ink hover:underline">Next →</Link> : <span />}
            </nav>
          )}
        </Card>
      )}
    </SimplePage>
  );
}
