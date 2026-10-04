import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ContainerSize = 'default' | 'wide' | 'narrow';

const SIZE: Record<ContainerSize, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-7xl',
  wide: 'max-w-screen-2xl',
};

/** Canonical page gutter. Replaces the repeated `max-w-7xl mx-auto px-…` wrapper. */
export function Container({
  size = 'default',
  className,
  children,
}: {
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('mx-auto w-full px-4 lg:px-6', SIZE[size], className)}>{children}</div>;
}
