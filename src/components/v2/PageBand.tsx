import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Max-width page container (1240px, 32px gutters; 16px on phones). */
export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-8 max-md:px-4', className)}>{children}</div>;
}

/**
 * Indigo band under the header: page title area. Tiles that overlap its
 * bottom edge go in the next element with a negative top margin.
 */
export function PageBand({ children, className, overlap = false }: { children: ReactNode; className?: string; overlap?: boolean }) {
  return (
    <div className={cn('v2-band flow-root text-white', overlap ? 'pb-[110px] max-md:pb-8' : 'pb-10 max-md:pb-7', className)}>
      <Wrap>{children}</Wrap>
    </div>
  );
}

/** Section heading: takeaway-first title, measure in the subtitle. */
export function SectionHead({ title, sub, action, as: H = 'h2' }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
      <div className="min-w-0">
        <H className="m-0 font-display text-[32px] font-extrabold leading-[1.12] tracking-[-0.5px] max-md:text-[25px]">{title}</H>
        {sub && <p className="mt-1.5 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cn('min-w-0 rounded-card bg-card p-[22px] shadow-card max-md:rounded-2xl max-md:p-[18px]', className)}>{children}</Tag>;
}
