import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FISCAL_YEARS, usdExact, type AwardRow, type FyRow, type RecipientRow } from '@/lib/v2/story-figures';

/**
 * D12 story tables. Amounts are printed as recorded, to the cent (G3). Each table scrolls inside its own focusable region on
 * narrow screens, so the page itself never scrolls sideways.
 */

const pct = (s: number | null) => (s == null ? '—' : `${(s * 100).toFixed(1)}%`);
const TH = 'whitespace-nowrap px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.05em] text-muted';
const TD = 'whitespace-nowrap px-3 py-2 text-right font-mono text-[13px]';

export function StoryFigure({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <figure className="my-2 rounded-2xl bg-card p-5 font-sans shadow-card max-md:p-3.5" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="text-[16px] font-extrabold leading-snug">{title}</figcaption>
      <div role="region" aria-labelledby={`${id}-title`} tabIndex={0} className="mt-3 overflow-x-auto rounded-lg border border-line">
        {children}
      </div>
      {note && <div className="mt-3 space-y-1.5 border-t border-line pt-2.5 text-[13px] leading-relaxed text-muted">{note}</div>}
    </figure>
  );
}

export function FyTable({ rows, labelHead, withShare }: { rows: FyRow[]; labelHead: string; withShare: boolean }) {
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead className="bg-neutral-tint">
        <tr>
          <th scope="col" className={TH}>{labelHead}</th>
          {FISCAL_YEARS.map((y) => (
            <th key={y} scope="col" className={cn(TH, 'text-right')}>FY{y}</th>
          ))}
          <th scope="col" className={cn(TH, 'text-right')}>FY2024–26</th>
          {withShare && <th scope="col" className={cn(TH, 'text-right')}>Coded not competed</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const total = r.label.startsWith('Total');
          return (
            <tr key={r.label} className={cn('border-t border-line', total && 'bg-neutral-tint font-bold')} data-fy-row={r.label}>
              <th scope="row" className={cn('min-w-[200px] px-3 py-2 text-left font-sans text-[13.5px] font-semibold', r.sub && 'pl-7 font-normal text-muted')}>
                {r.label}
              </th>
              {FISCAL_YEARS.map((y) => (
                <td key={y} className={TD}>{usdExact(r.fy[y])}</td>
              ))}
              <td className={cn(TD, 'font-semibold')}>{usdExact(r.total)}</td>
              {withShare && <td className={TD}>{r.nc == null ? 'n/a' : pct(r.ncShare)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RecipientTable({ rows }: { rows: RecipientRow[] }) {
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead className="bg-neutral-tint">
        <tr>
          <th scope="col" className={TH}>Recipient (as recorded)</th>
          <th scope="col" className={TH}>UEI</th>
          <th scope="col" className={cn(TH, 'text-right')}>Contracts, FY2024–26</th>
          <th scope="col" className={cn(TH, 'text-right')}>Of which coded not competed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.uei} className="border-t border-line" data-recipient={r.uei}>
            <th scope="row" className="min-w-[220px] px-3 py-2 text-left font-sans text-[13.5px] font-semibold">{r.name}</th>
            <td className="whitespace-nowrap px-3 py-2 font-mono text-[13px]">{r.uei}</td>
            <td className={TD}>{usdExact(r.total)}</td>
            <td className={TD}>{usdExact(r.nc)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AwardsTable({ rows }: { rows: AwardRow[] }) {
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead className="bg-neutral-tint">
        <tr>
          <th scope="col" className={TH}>Award (USAspending page)</th>
          <th scope="col" className={TH}>Type</th>
          <th scope="col" className={TH}>Awarding agency</th>
          <th scope="col" className={TH}>Recipient in these rows</th>
          <th scope="col" className={cn(TH, 'text-right')}>Obligated, FY2024–26</th>
          <th scope="col" className={TH}>Competition, as coded</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.awardId} className="border-t border-line align-top" data-award={r.awardId}>
            <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-mono text-[13px] font-semibold">
              <a href={r.url} className="text-trades-ink underline-offset-2 hover:underline">{r.awardId}</a>
            </th>
            <td className="whitespace-nowrap px-3 py-2">{r.category === 'idv' ? 'IDV' : 'Contract'}</td>
            <td className="min-w-[200px] px-3 py-2">{r.agency}</td>
            <td className="min-w-[200px] px-3 py-2">{r.recipient} <span className="font-mono text-[12px] text-muted">({r.uei})</span></td>
            <td className={TD}>{usdExact(r.total)}</td>
            <td className="min-w-[220px] px-3 py-2 text-[13px]">{r.competition}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
