import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AwardsTable from '@/components/v2/AwardsTable';
import EmptyState from '@/components/v2/EmptyState';
import KpiTile from '@/components/v2/KpiTile';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { FISCAL_YEARS, getAgencies, getAgencyTopAwards } from '@/lib/v2/companies';
import { getDatasetStatus, getDatasetStatuses } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtPct, fmtUsd, fmtUsdCompact } from '@/lib/v2/format';

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const data = await getAgencies();
  const a = data?.agencies.find((x) => x.code === code);
  if (!a) return { title: 'Agency' };
  return pageMetadata({
    path: `/agencies/${a.code}`,
    card: 'own',
    title: `${a.name}: share of contract dollars not competed`,
    description: `Share of ${a.name} contract obligations coded not competed, FY2024–26, from USAspending agency totals.`,
  });
}

export default async function AgencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const data = await getAgencies();
  const totals = await getDatasetStatus('contract_totals');

  if (!data) {
    return (
      <div data-v2>
        <PageBand><h1 className="mt-8 font-display text-[40px] font-extrabold max-md:mt-5 max-md:text-[30px]">Agency</h1></PageBand>
        <Wrap className="pb-12 pt-6">
          <EmptyState title="Agency totals are unavailable right now" tone="warning" statuses={await getDatasetStatuses(['contract_totals'])}>
            The totals did not load, so no shares are shown.
          </EmptyState>
        </Wrap>
      </div>
    );
  }
  const agency = data.agencies.find((a) => a.code === code);
  if (!agency) notFound();

  const fyRaw = Number(Array.isArray(sp.fy) ? sp.fy[0] : sp.fy);
  const fyFilter = (FISCAL_YEARS as readonly number[]).includes(fyRaw) ? fyRaw : null;
  const awards = await getAgencyTopAwards(code, fyFilter, 25);
  const lagYears = FISCAL_YEARS.filter((y) => agency.fy[y]?.lagOpen);

  return (
    <div data-v2>
      <PageBand overlap>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">
          <Link href="/agencies" className="hover:underline">Agencies</Link> · awarding agency {agency.code}{agency.abbr ? ` · ${agency.abbr}` : ''}
        </p>
        <h1 className="mt-1 max-w-[900px] font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{agency.name}</h1>
        <p className="mt-3 max-w-[760px] text-[16px] text-on-deep max-md:text-[15px]">
          Share of this agency&rsquo;s prime contract dollars that it coded “not competed”, by fiscal year, from USAspending&rsquo;s agency totals.
        </p>
      </PageBand>

      <Wrap className="pb-12">
        <div className="-mt-20 grid grid-cols-3 gap-4 max-md:mt-4 max-md:grid-cols-1 max-md:gap-2.5">
          {FISCAL_YEARS.map((y) => {
            const f = agency.fy[y];
            return (
              <KpiTile
                key={y}
                type="contracts"
                label={`FY${y}`}
                value={f ? fmtPct(f.share) : null}
                caption={f ? `of contract dollars were not competed: ${fmtUsdCompact(f.nc)} of ${fmtUsdCompact(f.total)}` : ''}
                source="USAspending"
                sourceHref="https://www.usaspending.gov/agency"
                asOf={f?.fetchedAt ?? null}
                state={totals.state}
                note={f?.lagOpen ? 'Incomplete: DoD reports contract actions 90 days late, so this year will rise.' : undefined}
                unavailableReason={f ? undefined : `No total stored for FY${y}.`}
              />
            );
          })}
        </div>

        <SourceBar datasets={['contract_totals', 'contracts']} className="mt-6" />

        <section className="pt-8" aria-labelledby="ag-by-fy">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="ag-by-fy" className="text-[24px] max-md:text-[22px]">Contract dollars by fiscal year</span>}
              sub="All prime contract obligations of the agency, split by the agency's competition code. Every figure is from USAspending's agency totals."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[14.5px]">
                <caption className="sr-only">Contract obligations, non-competed and competed, by fiscal year</caption>
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted">
                    <th scope="col" className="border-b border-line px-2.5 py-2">Fiscal year</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">All contract obligations</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Not competed</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Competed</th>
                    <th scope="col" className="border-b border-line px-2.5 py-2 text-right">Share not competed</th>
                  </tr>
                </thead>
                <tbody>
                  {FISCAL_YEARS.map((y) => {
                    const f = agency.fy[y];
                    return (
                      <tr key={y}>
                        <th scope="row" className="border-b border-line px-2.5 py-2.5 text-left font-semibold">
                          FY{y}
                          {f?.lagOpen && <span className="ml-2 rounded-md bg-stale-tint px-1.5 py-0.5 text-[11.5px] font-semibold text-stale-ink">incomplete</span>}
                          {f && <span className="block text-[12px] font-normal text-muted">Oct 1 – {fmtDate(f.periodEnd)}</span>}
                        </th>
                        {f ? (
                          <>
                            <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]" title={fmtUsd(f.total) ?? undefined}>{fmtUsdCompact(f.total)}</td>
                            <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]" title={fmtUsd(f.nc) ?? undefined}>{fmtUsdCompact(f.nc)}</td>
                            <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px]" title={fmtUsd(f.competed) ?? undefined}>{fmtUsdCompact(f.competed)}</td>
                            <td className="border-b border-line px-2.5 py-2.5 text-right font-mono text-[13.5px] font-medium">{fmtPct(f.share) ?? 'Unavailable'}</td>
                          </>
                        ) : (
                          <td colSpan={4} className="border-b border-line px-2.5 py-2.5 text-right text-muted">Unavailable: no total stored for this fiscal year.</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-[860px] text-[13px] text-muted">
              Source: <a href="https://www.usaspending.gov/agency" target="_blank" rel="noopener noreferrer" className="underline">USAspending.gov</a>{' '}agency totals, prime contract types A–D, by contract-action date;
              fetched {fmtDate(totals.lastUpdated) ?? 'on an unknown date'}. “Not competed” = extent-competed code not available for competition, not competed, not competed under simplified
              acquisition, or non-competitive delivery order. Orders placed under a competed contract keep its code, so they count as competed.
              {lagYears.length > 0 && ` FY${lagYears.join(', FY')} ${lagYears.length === 1 ? 'is' : 'are'} incomplete: this agency's contract actions are reported ${agency.fy[lagYears[0]]?.lagDays ?? 90} days late.`}
            </p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="ag-awards">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="ag-awards" className="text-[24px] max-md:text-[22px]">Largest non-competed awards in our records</span>}
              sub="A look at the biggest individual awards behind the share. These rows do not add up to the totals above."
            />
            <nav aria-label="Filter awards by fiscal year signed" className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] font-semibold text-muted">Signed in</span>
              {[null, ...FISCAL_YEARS].map((y) => {
                const active = y === fyFilter;
                return (
                  <Link
                    key={y ?? 'all'}
                    href={y ? `/agencies/${code}?fy=${y}` : `/agencies/${code}`}
                    scroll={false}
                    aria-current={active ? 'true' : undefined}
                    className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${active ? 'bg-ink text-white' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint'}`}
                  >
                    {y ? `FY${y}` : 'FY2024–26'}
                  </Link>
                );
              })}
            </nav>
            {awards === null ? (
              <p className="rounded-2xl bg-down-tint px-4 py-3 text-[14px] text-down-ink">Awards are unavailable right now: the contracts database did not answer.</p>
            ) : awards.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14px] text-muted">No non-competed award of $1M+ from this agency is in our records for this period.</p>
            ) : (
              <AwardsTable
                awards={awards}
                mode="agency"
                caption={`Largest non-competed awards from ${agency.name}, ${fyFilter ? `FY${fyFilter}` : 'FY2024–26'} (obligated to date)`}
                csvName={`awards-${agency.code}${fyFilter ? `-fy${fyFilter}` : ''}`}
                footer={
                  <span>
                    The {fmtCount(awards.length)} largest non-competed awards of $1M+ signed {fyFilter ? `in FY${fyFilter}` : 'in FY2024–26'} (rule r5-v1). “Obligated to date” is the total committed on the award so far,
                    including later modifications, not spending in a fiscal year. Source: USAspending.gov award records.
                  </span>
                }
              />
            )}
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
