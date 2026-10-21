import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import EmptyState from '@/components/v2/EmptyState';
import FilingLink from '@/components/v2/FilingLink';
import { Card, PageBand, Wrap } from '@/components/v2/PageBand';
import { fmtDate } from '@/lib/v2/format';
import { PRESIDENT_HUB_PATH, PRESIDENT_LARGEST_PATH, PRESIDENT_QUALITY_PATH, PRESIDENT_TIMING_PATH } from '@/lib/v2/flags';
import { COMPLIANCE_SENTENCE, type ExecCover } from '@/lib/v2/president-hub-core';

export const PRESIDENT_TABS = [
  { href: PRESIDENT_HUB_PATH, label: 'Overview' },
  { href: PRESIDENT_TIMING_PATH, label: 'Disclosure timing' },
  { href: PRESIDENT_LARGEST_PATH, label: 'Largest transactions' },
  { href: PRESIDENT_QUALITY_PATH, label: 'How the data was built' },
] as const;

/** Tabs for the President section, shown in the title band of every /president page. */
export function PresidentSubNav({ current }: { current: (typeof PRESIDENT_TABS)[number]['href'] }) {
  return (
    <nav aria-label="The President section" className="mt-5 flex flex-wrap gap-1.5">
      {PRESIDENT_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? 'page' : undefined}
          className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-on-deep hover:bg-white/10 hover:text-white', t.href === current && 'bg-white/15 text-white')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Title band: kicker, h1, lead and the section tabs. */
export function PresidentBand({ current, title, lead, children }: { current: (typeof PRESIDENT_TABS)[number]['href']; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <PageBand>
      <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">The President</p>
      <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{title}</h1>
      {lead && <div className="mt-3 max-w-[860px] text-[17px] text-on-deep max-md:text-[15.5px]">{lead}</div>}
      {children}
      <PresidentSubNav current={current} />
    </PageBand>
  );
}

/** The page when the database did not answer: nothing is shown, never a zero. */
export function PresidentUnavailable({ current, title }: { current: (typeof PRESIDENT_TABS)[number]['href']; title: string }) {
  return (
    <div data-v2>
      <PresidentBand current={current} title={title} />
      <Wrap className="pb-12 pt-6">
        <EmptyState title="Figures unavailable right now" tone="warning">The database did not answer, so no figure is shown. Try again in a few minutes.</EmptyState>
      </Wrap>
    </div>
  );
}

/** A stat block: label, big number, one line of what it counts. A null value prints "Figures unavailable", never a zero. */
export function Stat({ label, value, children, className }: { label: string; value: string | null; children?: ReactNode; className?: string }) {
  return (
    <Card className={cn('sf-kpi', className)}>
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted">{label}</p>
      <strong className="sf-kpi-value mt-1 block font-display text-[34px] font-extrabold leading-[1.1] max-sm:text-[28px]">{value ?? 'Figures unavailable'}</strong>
      {children && <div className="mt-1.5 text-[14px] text-muted">{children}</div>}
    </Card>
  );
}

export interface BarRow { key: string; label: string; sub?: string; value: number; display: string; muted?: boolean }

/**
 * Horizontal bars drawn on the server (no chart library), each row labeled with its number and a screen-reader table with the
 * same figures. Highlighted and muted bars differ by more than color: every row also states its own label and number.
 */
export function HBars({ rows, caption, unit, labelHeader = 'Row' }: { rows: BarRow[]; caption: string; unit: string; labelHeader?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead><tr><th scope="col">{labelHeader}</th><th scope="col">{unit}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><th scope="row">{r.label}{r.sub ? `, ${r.sub}` : ''}</th><td>{r.display}</td></tr>)}</tbody>
        </table>
      </div>
      <ol aria-hidden className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,210px)_1fr] items-center gap-3 text-[13px] max-md:grid-cols-[minmax(0,112px)_1fr]">
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-semibold">{r.label}</span>
              {r.sub && <span className="block truncate text-[11.5px] text-muted">{r.sub}</span>}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn('h-5 min-w-[2px] shrink', r.muted ? 'pres-bar-mute' : 'pres-bar')} style={{ width: `${Math.max(0.6, (r.value / max) * 72)}%` }} />
              <span className="whitespace-nowrap font-mono text-[12.5px] font-bold">{r.display}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * One reviewer comment as printed, ALWAYS with the agency ethics official's signed opinion in the same block (A11: a fee note is
 * never shown without it). The quote is the stored text, unchanged. `compact` is for table cells.
 */
export function CoverNote({ cover, pageHref, compact = false }: { cover: ExecCover; pageHref: string; compact?: boolean }) {
  if (!cover.reviewer_comment) return null;
  const isFee = cover.reviewer_comment_kind === 'late_fee_note';
  return (
    <div className={cn('rounded-xl bg-neutral-tint px-3.5 py-3 text-[14px]', compact && 'px-3 py-2.5 text-[13px]')} data-cover-note={isFee ? 'late_fee_note' : 'line_identification'}>
      <p>
        <span className="text-muted">{isFee ? 'Comments of Reviewing Officials box, verbatim: ' : 'Comments box (identifies a printed line), verbatim: '}</span>
        <q className="font-semibold">{cover.reviewer_comment}</q>
      </p>
      <p className="mt-1.5" data-compliance>
        {COMPLIANCE_SENTENCE}
        {cover.daeo_signed_date ? <> This report&rsquo;s opinion is dated {fmtDate(cover.daeo_signed_date)}.</> : null}
      </p>
      <p className="mt-1.5"><FilingLink href={pageHref} source="OGE Form 278-T, cover page" label="View the cover page" /></p>
    </div>
  );
}

export function SourceLine({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-4 max-w-[900px] text-[12.5px] text-muted">
      Source: OGE Form 278-T reports as posted by the U.S. Office of Government Ethics (extapps2.oge.gov), read line by line into our records.
      {children} Asset names are as the report prints them and can carry small spelling slips from that reading; the linked report is the record.
    </p>
  );
}
