import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

const FIELD_BASE =
  'w-full rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 placeholder:text-slate-500 ' +
  'transition-colors focus:border-slush-red focus:outline-none focus:ring-1 focus:ring-slush-red ' +
  'disabled:opacity-50 disabled:pointer-events-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, 'h-10 px-3', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(FIELD_BASE, 'h-10 px-3 pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);
