'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isActive, shellPath } from '@/components/v2/shell/nav';

/** Desktop section links with the current section highlighted. */
export function NavLinks() {
  const pathname = shellPath(usePathname());
  return (
    <nav aria-label="Main" className="flex gap-1 max-md:hidden">
      {NAV_ITEMS.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn('whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-on-deep hover:bg-white/10 hover:text-white', on && 'bg-white/12 text-white')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Header search: a plain GET form to /search, so it works without JS. */
export function HeaderSearch({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <form action="/search" method="get" role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">Search members and companies</label>
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-deep">⌕</span>
      <input
        id={id}
        name="q"
        type="search"
        autoFocus={autoFocus}
        placeholder="Search members, companies"
        autoComplete="off"
        className="h-10 w-full rounded-xl bg-white/12 pl-9 pr-3 text-sm text-white placeholder:text-on-deep focus:bg-white/18 focus:outline-none focus-visible:outline-highlight"
      />
    </form>
  );
}

/** Hides the header search on the homepage, where the hero has the big one. */
export function HeaderSearchSlot() {
  const pathname = shellPath(usePathname());
  if (pathname === '/') return <div className="flex-1 max-md:hidden" />;
  return <HeaderSearch className="max-w-[420px] flex-1 max-md:hidden" />;
}

/** Phone menu: burger button and a panel with search and the five sections. */
export function MobileMenu() {
  const pathname = shellPath(usePathname());
  // The menu is open for the path it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenOn(null); buttonRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-lg text-white"
      >
        <span aria-hidden>{open ? '✕' : '☰'}</span>
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-50 border-t border-white/10 bg-deep px-4 pb-5 pt-3 shadow-[0_16px_30px_rgba(0,0,0,.3)]"
      >
        <HeaderSearch className="mb-3" />
        <nav aria-label="Main" className="grid gap-1">
          {NAV_ITEMS.map((item) => {
            const on = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={cn('rounded-xl px-3 py-3 text-base font-semibold text-on-deep', on ? 'bg-white/12 text-white' : 'hover:bg-white/8')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
