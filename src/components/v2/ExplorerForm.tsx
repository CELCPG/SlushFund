'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';

/**
 * The filter form of a data explorer. It is a plain GET form, so it works without JavaScript; with
 * JavaScript it sends the visitor to a clean permalink instead: empty fields and fields left at their
 * default are dropped, and the page number is reset.
 */
export default function ExplorerForm({
  action,
  defaults = {},
  className,
  children,
}: {
  action: string;
  /** Field values that mean "not filtered" and stay out of the URL (for example sort=filed). */
  defaults?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget).entries()) {
      const s = String(v).trim();
      if (s && k !== 'page' && defaults[k] !== s) p.set(k, s);
    }
    const qs = p.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }
  return (
    <form action={action} method="get" onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}
