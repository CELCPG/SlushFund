import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { MONEY_TYPES, type MoneyType } from '@/lib/v2/money';
import { fmtDateShort } from '@/lib/v2/format';
import type { DatasetState } from '@/lib/v2/datasets';
import { MoneyIcon } from '@/components/v2/MoneyChip';

export interface KpiTileProps {
  /** Money type colors the tile; omit for a neutral white tile. */
  type?: MoneyType;
  /** Short label above the number ("Contracts", "Stock trades"). Defaults to the money type label. */
  label?: string;
  /** The figure, already formatted. null = unavailable: no number is shown. */
  value: string | null;
  /** What the number counts ("prime contract obligations, FY2026"). */
  caption: string;
  /** Source name (and optional link). */
  source: string;
  sourceHref?: string;
  /** As-of date of the underlying data (load time or period end). */
  asOf: string | null;
  /** Data state; stale shows an amber note, unavailable/not_loaded hide the number. */
  state?: DatasetState;
  /** Why the number is missing, when it is ("Not loaded yet (FEC)"). */
  unavailableReason?: string;
  /** Optional small chart (sparkline) under the caption. */
  chart?: ReactNode;
  /** Extra footnote line (a caveat). */
  note?: string;
  className?: string;
}

/**
 * KPI tile: number + label + source + as-of. When the data is missing it says
 * "Unavailable" and why. It never shows $0 or a fallback figure.
 */
export default function KpiTile({
  type, label, value, caption, source, sourceHref, asOf, state = 'fresh', unavailableReason, chart, note, className,
}: KpiTileProps) {
  const m = type ? MONEY_TYPES[type] : null;
  const missing = value == null || state === 'unavailable' || state === 'not_loaded';
  const tone = m ? (missing ? 'bg-card text-ink shadow-card' : cn(m.tile, 'shadow-tile')) : 'bg-card text-ink shadow-card';
  const sub = m && !missing ? 'text-white' : 'text-muted';

  return (
    <div className={cn('relative flex min-w-0 flex-col overflow-hidden rounded-tile p-5 pb-4 max-sm:rounded-2xl max-sm:p-3.5', tone, className)}>
      <div className="flex items-center gap-2">
        {m && missing && <MoneyIcon type={m.type} size="sm" />}
        {m && !missing && (
          <span aria-hidden className="inline-grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-white/20 font-mono text-[11px] font-medium">{m.letter}</span>
        )}
        <span className="text-[13px] font-bold uppercase tracking-[0.04em] max-sm:text-[11.5px]">{label ?? m?.label ?? 'Figure'}</span>
      </div>

      {missing ? (
        <div className="mt-2">
          <strong className="block font-display text-[26px] font-extrabold leading-tight text-muted max-sm:text-[20px]">Unavailable</strong>
          <p className="mt-1 text-[13.5px] text-muted max-sm:text-[12.5px]">
            {unavailableReason ?? (state === 'not_loaded' ? 'Not loaded yet.' : 'The source did not load. No figure is shown.')}
          </p>
        </div>
      ) : (
        <>
          <strong className="mt-2 mb-0.5 block font-display text-[40px] font-extrabold leading-[1.1] max-sm:text-[28px]">{value}</strong>
          <p className={cn('text-sm max-sm:text-[12.5px]', m ? 'text-white' : 'text-muted')}>{caption}</p>
        </>
      )}

      {!missing && chart && <div className="mt-3">{chart}</div>}

      {state === 'stale' && !missing && (
        <p className={cn('mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', m ? 'bg-white/20 text-white' : 'bg-stale-tint text-stale-ink')}>
          <span aria-hidden>●</span> Not recently updated
        </p>
      )}

      <div className={cn('mt-auto flex justify-between gap-2 pt-2.5 text-xs max-sm:flex-col max-sm:gap-0 max-sm:text-[11px]', sub)}>
        <span className="min-w-0 truncate">
          {sourceHref ? (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="underline decoration-current/40 underline-offset-2 hover:decoration-current">{source}</a>
          ) : source}
        </span>
        <span className="whitespace-nowrap">{asOf ? `as of ${fmtDateShort(asOf)}` : missing ? '' : 'as-of unknown'}</span>
      </div>
      {note && <p className={cn('mt-1.5 text-[11.5px] leading-snug', sub)}>{note}</p>}
    </div>
  );
}

/**
 * Labeled mini bar chart for tiles. Every bar carries its label (first and
 * last printed under the chart) and the newest bar is solid.
 */
export function TileSpark({ points, caption }: { points: { label: string; value: number }[]; caption?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.value));
  if (!(max > 0)) return null;
  return (
    <figure className="m-0">
      <div className="flex h-[34px] items-end gap-1" role="img" aria-label={caption ?? points.map((p) => `${p.label}: ${p.value}`).join(', ')}>
        {points.map((p, i) => (
          <i
            key={p.label}
            title={`${p.label}: ${p.value.toLocaleString('en-US')}`}
            className={cn('block flex-1 rounded-t-[3px]', i === points.length - 1 ? 'bg-white' : 'bg-white/45')}
            style={{ height: `${Math.max(6, Math.round((p.value / max) * 100))}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between font-mono text-[10.5px] text-white">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </figcaption>
    </figure>
  );
}
