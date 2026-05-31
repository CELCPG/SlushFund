import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export interface CardProps {
  /** Danger-tinted surface — matches the dashboard KPI highlight. */
  highlight?: boolean;
  padding?: CardPadding;
  className?: string;
  children: ReactNode;
}

export function Card({ highlight, padding = 'md', className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border',
        highlight ? 'border-red-700/60 bg-red-950/30' : 'border-slate-800 bg-slate-900',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-sm font-semibold text-slate-200', className)}>{children}</h3>;
}
