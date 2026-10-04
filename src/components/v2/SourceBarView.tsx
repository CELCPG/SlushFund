import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { DatasetState, DatasetStatus } from '@/lib/v2/datasets';
import { fmtDate, fmtDateTime } from '@/lib/v2/format';

/** Presentational source bar (safe in server and client components). See SourceBar. */
const RANK: Record<DatasetState, number> = { fresh: 0, not_loaded: 1, stale: 2, unavailable: 3 };

export function worstState(statuses: DatasetStatus[]): DatasetState {
  return statuses.reduce<DatasetState>((w, s) => (RANK[s.state] > RANK[w] ? s.state : w), 'fresh');
}

/** The oldest successful load among the datasets (the conservative "updated"). */
function oldestUpdate(statuses: DatasetStatus[]): string | null {
  const ts = statuses.map((s) => s.lastUpdated).filter((x): x is string => !!x).sort();
  return ts[0] ?? null;
}

const SHELL: Record<DatasetState, string> = {
  fresh: 'bg-card text-muted shadow-[0_0_0_1px_var(--color-line)]',
  not_loaded: 'bg-neutral-tint text-muted',
  stale: 'bg-stale-tint text-stale-ink shadow-[0_0_0_1px_#F0D48A]',
  unavailable: 'bg-down-tint text-down-ink shadow-[0_0_0_1px_#F5B5AE]',
};

const DOT: Record<DatasetState, string> = {
  fresh: 'bg-fresh',
  not_loaded: 'bg-[#8C91AB]',
  stale: 'bg-stale',
  unavailable: 'bg-down',
};

export function SourceBarView({
  statuses,
  methodologyHref,
  className,
}: {
  statuses: DatasetStatus[];
  methodologyHref?: string;
  className?: string;
}) {
  const state = worstState(statuses);
  const updated = oldestUpdate(statuses);
  const methods = methodologyHref ?? statuses[0]?.methodologyHref ?? '/about/methodology';
  const multi = statuses.length > 1;

  let headline: string | null = null;
  if (state === 'unavailable') headline = 'Data temporarily unavailable. Figures are hidden until the source loads.';
  else if (state === 'not_loaded') headline = 'Not loaded yet.';
  else if (state === 'stale') headline = updated ? `Not updated since ${fmtDate(updated)}.` : 'Update time unknown.';

  return (
    <div
      role="note"
      aria-label="Data source and freshness"
      data-state={state}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5 text-[13px] leading-snug', SHELL[state], className)}
    >
      <span aria-hidden className={cn('h-2 w-2 flex-none rounded-full', DOT[state])} />
      {headline && <b className="font-semibold">{headline}</b>}
      <span>
        <span className="font-semibold">Source:</span>{' '}
        {statuses.filter((s, i, all) => all.findIndex((x) => x.source.name === s.source.name) === i).map((s, i) => (
          <span key={s.key}>
            {i > 0 && ' · '}
            <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-current/30 underline-offset-2 hover:decoration-current">
              {s.source.name}
            </a>
          </span>
        ))}
      </span>
      <Sep />
      <span>
        <span className="font-semibold">Coverage:</span>{' '}
        {statuses.map((s, i) => (
          <span key={s.key}>
            {i > 0 && ' · '}
            {multi && <>{shortName(s)} </>}
            {s.state === 'not_loaded' ? 'none yet' : s.state === 'unavailable' ? 'unknown' : (s.coverage ?? 'unknown')}
          </span>
        ))}
      </span>
      {state === 'fresh' && (
        <>
          <Sep />
          <span>
            <span className="font-semibold">Updated:</span>{' '}
            <time dateTime={updated ?? undefined}>{updated ? fmtDateTime(updated) : 'unknown'}</time>
          </span>
        </>
      )}
      <Link href={methods} className="ml-auto whitespace-nowrap font-semibold text-trades-ink hover:underline">
        Methodology →
      </Link>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="hidden opacity-40 sm:inline">|</span>;
}

function shortName(s: DatasetStatus): string {
  if (s.key === 'house_trades') return 'House';
  if (s.key === 'senate_trades') return 'Senate';
  return s.label;
}
