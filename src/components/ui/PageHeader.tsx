import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './Container';

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Render as a sticky top bar (matches the dashboard/analysis pattern). */
  sticky?: boolean;
  className?: string;
}

/** Standard page heading: eyebrow + title + description, with an optional right-aligned actions slot. */
export function PageHeader({ title, eyebrow, description, actions, sticky, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b border-slate-800',
        sticky && 'sticky top-14 z-30 bg-slate-950/90 backdrop-blur',
        className,
      )}
    >
      <Container className="flex flex-col gap-3 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slush-red">{eyebrow}</div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </Container>
    </div>
  );
}
