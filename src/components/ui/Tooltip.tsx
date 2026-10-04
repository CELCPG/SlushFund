import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Side = 'top' | 'bottom' | 'left' | 'right';

const POS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * Dependency-free tooltip. Shows on hover and keyboard focus (via group-focus-within).
 * Wrap the trigger as children; pass the tip text/node in `content`.
 */
export function Tooltip({
  content,
  side = 'top',
  children,
  className,
}: {
  content: ReactNode;
  side?: Side;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden w-max max-w-xs whitespace-normal rounded-md border ' +
            'border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 shadow-lg ' +
            'group-hover:block group-focus-within:block',
          POS[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
