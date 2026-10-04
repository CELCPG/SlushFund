import Link from 'next/link';
import { cn } from '@/lib/cn';
import { getDatasetStatuses, type DatasetKey, type DatasetState, type DatasetStatus } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtDateShort, fmtDateTime } from '@/lib/v2/format';
import { MoneyIcon } from '@/components/v2/MoneyChip';

const DOT: Record<DatasetState, string> = {
  fresh: 'bg-fresh',
  stale: 'bg-stale',
  unavailable: 'bg-down',
  not_loaded: 'bg-[#8C91AB]',
};

const STATE_LABEL: Record<DatasetState, string> = {
  fresh: 'Up to date',
  stale: 'Behind',
  unavailable: 'Unavailable',
  not_loaded: 'Not loaded yet',
};

/** One-line phrase per dataset: "Contracts · Oct 3", "House trades · 5 days behind". */
export function statusPhrase(s: DatasetStatus): string {
  if (s.state === 'unavailable') return 'unavailable';
  if (s.state === 'not_loaded') return 'not loaded yet';
  if (s.state === 'stale') return s.ageDays != null ? `${s.ageDays} days since last update` : 'update time unknown';
  return fmtDateShort(s.lastUpdated) ?? 'unknown';
}

/** Compact strip (homepage, footers of hubs). */
export default async function DataStatusPanel({ datasets, className }: { datasets?: DatasetKey[]; className?: string }) {
  const statuses = await getDatasetStatuses(datasets);
  return <DataStatusPanelView statuses={statuses} className={className} />;
}

export function DataStatusPanelView({ statuses, className }: { statuses: DatasetStatus[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-card px-[18px] py-3.5 text-sm shadow-card', className)}>
      <b className="mr-1">Data status</b>
      <ul className="contents">
        {statuses.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('h-2 w-2 rounded-full', DOT[s.state])} />
            <span>
              {s.label} · <span className={s.state === 'stale' ? 'font-semibold text-stale-ink' : s.state === 'unavailable' ? 'font-semibold text-down-ink' : ''}>{statusPhrase(s)}</span>
              <span className="sr-only"> ({STATE_LABEL[s.state]})</span>
            </span>
          </li>
        ))}
      </ul>
      <Link href="/about/data-status" className="ml-auto font-semibold text-trades-ink hover:underline">
        All datasets →
      </Link>
    </div>
  );
}

/** Full table for /about/data-status: one card per dataset, stacked on phones. */
export async function DataStatusTable({ datasets }: { datasets?: DatasetKey[] }) {
  const statuses = await getDatasetStatuses(datasets);
  return <DataStatusTableView statuses={statuses} />;
}

export function DataStatusTableView({ statuses }: { statuses: DatasetStatus[] }) {
  return (
    <div className="grid gap-3">
      {statuses.map((s) => (
        <article key={s.key} className="rounded-card bg-card p-5 shadow-card" aria-labelledby={`ds-${s.key}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {s.moneyType ? <MoneyIcon type={s.moneyType} size="lg" /> : <span aria-hidden className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-deep font-mono text-[15px] text-white">M</span>}
              <div className="min-w-0">
                <h3 id={`ds-${s.key}`} className="font-display text-lg font-extrabold leading-tight">{s.label}</h3>
                <p className="text-[13px] text-muted">{s.scope}</p>
              </div>
            </div>
            <StatePill state={s.state} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-4">
            <Field label="Source">
              <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink hover:underline">{s.source.name} ↗</a>
            </Field>
            <Field label="Coverage">{s.state === 'not_loaded' ? 'None yet' : s.state === 'unavailable' ? 'Unknown' : (s.coverage ?? 'Unknown')}</Field>
            <Field label="Last successful load">
              {s.lastUpdated ? <time dateTime={s.lastUpdated}>{fmtDateTime(s.lastUpdated)}</time> : '—'}
              {s.updatedBasis === 'row_timestamps' && <span className="block text-[11.5px] text-muted">from row timestamps</span>}
              {s.updatedBasis === 'sync_log' && <span className="block text-[11.5px] text-muted">from the loader log</span>}
            </Field>
            <Field label="Rows">{s.state === 'unavailable' ? '—' : (fmtCount(s.rowCount) ?? '—')}</Field>
            <Field label={s.latestRecordLabel}>{s.latestRecord ? fmtDate(s.latestRecord) : '—'}</Field>
            <Field label="Refresh">{s.cadence}</Field>
            <Field label="Amber after">{s.staleAfterDays} days without a load</Field>
            <Field label="Method">
              <Link href={s.methodologyHref} className="font-semibold text-trades-ink hover:underline">How we load it →</Link>
            </Field>
          </dl>
          {s.caveat && <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted"><b className="text-ink">Caveat:</b> {s.caveat}</p>}
        </article>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

export function StatePill({ state }: { state: DatasetState }) {
  const cls: Record<DatasetState, string> = {
    fresh: 'bg-[#E3F4EA] text-[#11633A]',
    stale: 'bg-stale-tint text-stale-ink',
    unavailable: 'bg-down-tint text-down-ink',
    not_loaded: 'bg-neutral-tint text-muted',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-semibold', cls[state])}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', DOT[state])} />
      {STATE_LABEL[state]}
    </span>
  );
}
