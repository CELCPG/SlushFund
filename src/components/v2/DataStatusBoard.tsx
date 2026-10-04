import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { DatasetState, DatasetStatus } from '@/lib/v2/datasets';
import { fmtCount, fmtDate, fmtDateTime } from '@/lib/v2/format';
import { MoneyIcon } from '@/components/v2/MoneyChip';
import { StatePill } from '@/components/v2/DataStatus';

/**
 * /data/status: one row per dataset (source, coverage, rows, last loaded, known gaps). A grid that
 * reads as a table from 768px up and as one labelled card per dataset on phones. A dataset that has
 * passed its threshold shows amber (D1 rule); one the database can't answer shows red with no
 * numbers; one with no rows says "Not loaded yet".
 */

const COLS = 'md:grid md:grid-cols-[minmax(190px,1.15fr)_minmax(150px,0.95fr)_minmax(110px,0.7fr)_minmax(90px,0.55fr)_minmax(190px,1.05fr)_minmax(270px,2fr)] md:gap-x-5';

const ROW_TONE: Record<DatasetState, string> = {
  fresh: '',
  stale: 'bg-stale-tint/60 shadow-[inset_4px_0_0_0_var(--color-stale,#B7791F)]',
  unavailable: 'bg-down-tint/50',
  not_loaded: '',
};

function ageText(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${fmtCount(days)} days ago`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted md:hidden">{children}</span>;
}

function SourceLink({ s }: { s: DatasetStatus }) {
  const cls = 'font-semibold text-trades-ink hover:underline';
  return s.source.url.startsWith('/')
    ? <Link href={s.source.url} className={cls}>{s.source.name}</Link>
    : <a href={s.source.url} target="_blank" rel="noopener noreferrer" className={cls}>{s.source.name} ↗</a>;
}

function Row({ s }: { s: DatasetStatus }) {
  const down = s.state === 'unavailable';
  const none = s.state === 'not_loaded';
  const age = ageText(s.ageDays);
  return (
    <div role="row" className={cn('border-t border-line px-[18px] py-4 text-[13.5px]', COLS, ROW_TONE[s.state])} data-dataset={s.key} data-state={s.state}>
      <div role="cell" className="min-w-0">
        <div className="flex items-start gap-2.5">
          {s.moneyType
            ? <MoneyIcon type={s.moneyType} size="lg" />
            : <span aria-hidden className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-deep font-mono text-[15px] text-white">M</span>}
          <div className="min-w-0">
            <h3 className="font-display text-[16px] font-extrabold leading-tight">{s.label}</h3>
            <p className="mt-0.5 text-[12.5px] text-muted">{s.scope}</p>
            <div className="mt-2"><StatePill state={s.state} /></div>
          </div>
        </div>
      </div>

      <div role="cell" className="mt-3 min-w-0 md:mt-0">
        <Label>Source</Label>
        <SourceLink s={s} />
        <Link href={s.methodologyHref} className="mt-0.5 block text-[12.5px] font-semibold text-muted hover:text-ink hover:underline">How we load it →</Link>
      </div>

      <div role="cell" className="mt-3 min-w-0 md:mt-0">
        <Label>Coverage</Label>
        {none ? 'None yet' : down ? 'Unknown' : (s.coverage ?? 'Unknown')}
        {!none && !down && s.latestRecord && (
          <span className="block text-[12px] text-muted">{s.latestRecordLabel} {fmtDate(s.latestRecord)}</span>
        )}
      </div>

      <div role="cell" className="mt-3 min-w-0 md:mt-0 md:text-right">
        <Label>Rows</Label>
        <span className="font-mono text-[14px] font-medium">{down ? '—' : (fmtCount(s.rowCount) ?? '—')}</span>
      </div>

      <div role="cell" className="mt-3 min-w-0 md:mt-0">
        <Label>Last loaded</Label>
        {s.lastUpdated && !down ? (
          <>
            <time dateTime={s.lastUpdated} className="block">{fmtDateTime(s.lastUpdated)}</time>
            {age && (
              <span className={cn('block text-[12.5px]', s.state === 'stale' ? 'font-semibold text-stale-ink' : 'text-muted')}>
                {age}{s.state === 'stale' ? ` · behind (amber after ${s.staleAfterDays} days)` : ''}
              </span>
            )}
            <span className="block text-[11.5px] text-muted">
              {s.updatedBasis === 'sync_log'
                ? `from the loader log (sync_log.${s.updatedColumn ?? 'completed_at'})`
                : `from the newest ${s.updatedColumn ?? 'updated_at'} on the rows`}
            </span>
          </>
        ) : down ? (
          <span className="font-semibold text-down-ink">Unavailable</span>
        ) : none ? (
          <span className="text-muted">Not loaded yet</span>
        ) : (
          <span className="font-semibold text-stale-ink">Update time unknown</span>
        )}
      </div>

      <div role="cell" className="mt-3 min-w-0 md:mt-0">
        <Label>Known gaps</Label>
        {down ? (
          <p className="text-down-ink">The database did not answer, so nothing is shown rather than a stand-in.</p>
        ) : s.knownGaps.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 marker:text-muted">
            {s.knownGaps.map((g) => <li key={g}>{g}</li>)}
          </ul>
        ) : (
          <span className="text-muted">None recorded</span>
        )}
        {s.caveat && <p className="mt-1.5 text-[12.5px] text-muted"><b className="text-ink">Caveat:</b> {s.caveat}</p>}
      </div>
    </div>
  );
}

export default function DataStatusBoard({ statuses, label }: { statuses: DatasetStatus[]; label: string }) {
  return (
    <div role="table" aria-label={label} className="overflow-hidden rounded-card bg-card shadow-card">
      <div role="row" className={cn('hidden px-[18px] py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted', COLS)}>
        {['Dataset', 'Source', 'Coverage', 'Rows', 'Last loaded', 'Known gaps'].map((h, i) => (
          <div key={h} role="columnheader" className={i === 3 ? 'text-right' : ''}>{h}</div>
        ))}
      </div>
      {statuses.map((s) => <Row key={s.key} s={s} />)}
    </div>
  );
}
