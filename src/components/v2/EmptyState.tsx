import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { DatasetStatus } from '@/lib/v2/datasets';
import { SourceBarView } from '@/components/v2/SourceBarView';

/**
 * Empty state: says plainly what is missing and why, with the real data
 * status when a dataset is involved. Used wherever a page cannot render
 * honestly (no data, data unavailable, page not rebuilt yet).
 */
export default function EmptyState({
  title,
  children,
  statuses,
  action,
  tone = 'neutral',
  icon = '∅',
  className,
}: {
  title: string;
  children?: ReactNode;
  /** Real dataset status shown under the message. */
  statuses?: DatasetStatus[];
  action?: { href: string; label: string };
  tone?: 'neutral' | 'warning';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-card bg-card p-6 text-center shadow-card sm:p-10',
        tone === 'warning' && 'shadow-[0_0_0_1px_#F0D48A]',
        className,
      )}
    >
      <div aria-hidden className={cn('mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl font-display text-2xl font-extrabold', tone === 'warning' ? 'bg-stale-tint text-stale-ink' : 'bg-neutral-tint text-muted')}>
        {icon}
      </div>
      <h2 className="font-display text-[22px] font-extrabold leading-tight sm:text-[26px]">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-[560px] text-[15px] text-muted">{children}</div>}
      {statuses && statuses.length > 0 && <SourceBarView statuses={statuses} className="mx-auto mt-5 max-w-[760px] text-left" />}
      {action && (
        <Link href={action.href} className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-deep">
          {action.label}
        </Link>
      )}
    </section>
  );
}
