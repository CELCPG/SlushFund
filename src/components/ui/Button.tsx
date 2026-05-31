import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Structural icon type — robust across lucide-react versions. */
type IconComponent = React.ComponentType<{ className?: string }>;

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-slush-red text-white hover:bg-slush-red-dark border border-transparent',
  secondary: 'bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 border border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-500 border border-transparent',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slush-red focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none';

/** Compose button styling onto a non-button element (e.g. a Next <Link>). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  iconRight?: IconComponent;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, disabled, className, children, ...props },
  ref,
) {
  const iconCls = ICON_SIZE[size];
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...props}
    >
      {loading ? (
        <span className={cn('animate-spin rounded-full border-2 border-current border-t-transparent', iconCls)} />
      ) : (
        Icon && <Icon className={iconCls} />
      )}
      {children}
      {IconRight && !loading && <IconRight className={iconCls} />}
    </button>
  );
});
