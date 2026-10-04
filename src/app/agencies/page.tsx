import type { Metadata } from 'next';
import Link from 'next/link';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import SourceBar from '@/components/v2/SourceBar';
import { getAgencies, FISCAL_YEARS, type AgencyFy } from '@/lib/v2/companies';
import { getDatasetStatus, getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtDate, fmtPct, fmtUsdCompact } from '@/lib/v2/format';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Non-competed contract share by agency',
  description: 'The share of each federal agency’s contract dollars that was not competed, by fiscal year, from USAspending’s agency totals.',
};

const NOTE_LAG = 'Incomplete: the Department of Defense reports contract actions 90 days late, so this year’s totals will rise.';

function shareCell(f: AgencyFy | undefined) {
  if (!f || f.share == null) return <span className="font-sans text-muted">Unavailable</span>;
  return (
    <span className="block">
      <span title={`${fmtUsdCompact(f.nc)} of ${fmtUsdCompact(f.total)}`}>{fmtPct(f.share)}</span>
      {f.lagOpen && <span className="mt-0.5 block font-sans text-[11.5px] text-stale-ink">incomplete</span>}
    </span>
  );
}

export default async function AgenciesPage() {
  const data = await getAgencies();
  const sourceBar = <SourceBar datasets={['contract_totals']} />;
  const head = {
    eyebrow: 'Agencies',
    title: 'How much agency contract money goes without competition',
    dek: 'For each federal agency and fiscal year: the share of its prime contract dollars that the agency coded “not competed”, from USAspending’s own agency totals.',
  };

  if (!data || !data.all) {
    return (
      <SimplePage {...head} sourceBar={sourceBar}>
        <EmptyState title="Agency totals are unavailable right now" tone="warning" statuses={await getDatasetStatuses(['contract_totals'])}>
          The totals did not load, so no shares are shown.
        </EmptyState>
      </SimplePage>
    );
  }

  const { all, agencies } = data;
  const totals = await getDatasetStatus('contract_totals');
  const sorted = [...agencies].sort((a, b) => (b.fy[2026]?.total ?? b.fy[2025]?.total ?? 0) - (a.fy[2026]?.total ?? a.fy[2025]?.total ?? 0));

  const columns: DataTableColumn[] = [
    { key: 'agency', header: 'Agency', mobile: 'title', sortKey: 'name' },
    ...FISCAL_YEARS.map((y) => ({ key: `s${y}`, header: `FY${y} non-competed share`, numeric: true, mobile: 'field' as const })),
    { key: 'total26', header: 'FY2026 contract obligations', numeric: true, mobile: 'field' },
    { key: 'name', header: 'Agency name', csvOnly: true },
    { key: 'code', header: 'Agency code', csvOnly: true },
    ...FISCAL_YEARS.flatMap((y) => [
      { key: `t${y}`, header: `FY${y} total contract obligations (USD)`, csvOnly: true },
      { key: `n${y}`, header: `FY${y} non-competed obligations (USD)`, csvOnly: true },
    ]),
  ];
  const rows: DataTableRow[] = sorted.map((a) => {
    const values: DataTableRow['values'] = { name: a.name, code: a.code, total26: a.fy[2026]?.total ?? null };
    const cells: NonNullable<DataTableRow['cells']> = {
      agency: (
        <span className="block min-w-0">
          <Link href={`/agencies/${a.code}`} className="font-semibold text-contracts-ink hover:underline">{a.name}</Link>
          {a.abbr && <span className="ml-1.5 text-[12.5px] text-muted">{a.abbr}</span>}
        </span>
      ),
      total26: a.fy[2026] ? <span>{fmtUsdCompact(a.fy[2026].total)}</span> : <span className="font-sans text-muted">Unavailable</span>,
    };
    for (const y of FISCAL_YEARS) {
      const f = a.fy[y];
      values[`s${y}`] = f?.share ?? null;
      values[`t${y}`] = f?.total ?? null;
      values[`n${y}`] = f?.nc ?? null;
      cells[`s${y}`] = shareCell(f);
    }
    return { id: a.code, values, cells };
  });

  return (
    <SimplePage {...head} sourceBar={sourceBar}>
      <div className="mb-6 grid grid-cols-3 gap-4 max-md:grid-cols-1 max-md:gap-2.5">
        {FISCAL_YEARS.map((y) => {
          const f = all.fy[y];
          return (
            <KpiTile
              key={y}
              type="contracts"
              label={`All agencies, FY${y}`}
              value={f ? fmtPct(f.share) : null}
              caption={f ? `of contract dollars were not competed: ${fmtUsdCompact(f.nc)} of ${fmtUsdCompact(f.total)}` : ''}
              source="USAspending"
              sourceHref="https://www.usaspending.gov/agency"
              asOf={f?.fetchedAt ?? null}
              state={totals.state}
              note={f?.lagOpen ? NOTE_LAG : undefined}
              unavailableReason={f ? undefined : 'No total stored for this fiscal year.'}
            />
          );
        })}
      </div>

      <Card as="section" className="mb-6">
        <h2 className="font-display text-[19px] font-extrabold">How the share is computed</h2>
        <p className="mt-1.5 max-w-[860px] text-[14.5px] text-muted">
          Share = contract dollars the agency coded “not competed” ÷ all of its prime contract dollars, both from USAspending&rsquo;s agency totals for the fiscal year
          (every contract action dated in the year, by awarding agency). “Not competed” means the agency&rsquo;s extent-competed code was
          “not available for competition”, “not competed”, “not competed under simplified acquisition” or “non-competitive delivery order”: the grouping the
          government uses in its own competition reports. It is not computed from our list of awards. An order placed under a competed contract keeps that contract&rsquo;s code
          even when it went to one company, so those orders count as competed here. Small agencies&rsquo; shares swing on a few contracts; the dollars are shown on hover and on each agency page.
        </p>
        <p className="mt-2 max-w-[860px] text-[13.5px] text-stale-ink">
          FY2026 is incomplete. The Department of Defense reports contract actions 90 days late, so its FY2026 totals, and the all-agency totals, cover roughly October through June and will rise.
        </p>
      </Card>

      <Card as="section">
        <DataTable
          columns={columns}
          rows={rows}
          caption="Share of contract dollars not competed, by agency and fiscal year"
          captionHidden
          initialSort={{ key: 'total26', dir: 'desc' }}
          csv={{ filename: 'agencies-non-competed-share' }}
          footer={
            <span>
              Source: <a href="https://www.usaspending.gov/agency" target="_blank" rel="noopener noreferrer" className="underline">USAspending.gov</a>{' '}agency totals (prime contract types A–D),
              fetched {fmtDate(totals.lastUpdated) ?? 'on an unknown date'}.
              A small amount with no awarding agency reported is not shown.
            </span>
          }
        />
        <p className="mt-4 text-[13.5px] text-muted">
          Looking at one company instead? See <Link href="/companies" className="font-semibold text-contracts-ink hover:underline">companies with non-competed contracts</Link>.
        </p>
      </Card>
    </SimplePage>
  );
}
