'use client';

import { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

/** Search input with a leading magnifier and a clear button when non-empty. */
export function SearchField({ className, value, onClear, ...props }: SearchFieldProps) {
  const hasValue = value != null && String(value).length > 0;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={value}
        className={cn(
          'h-10 w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-9 text-sm text-slate-100 ' +
            'placeholder:text-slate-500 transition-colors focus:border-slush-red focus:outline-none ' +
            'focus:ring-1 focus:ring-slush-red',
          className,
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
