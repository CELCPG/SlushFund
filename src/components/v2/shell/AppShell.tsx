import Link from 'next/link';
import type { ReactNode } from 'react';
import Wordmark from '@/components/v2/shell/Wordmark';
import { HeaderSearchSlot, MobileMenu, NavLinks } from '@/components/v2/shell/HeaderNav';
import ScrollRegions from '@/components/v2/shell/ScrollRegions';
import { FOOTER_LINKS } from '@/components/v2/shell/nav';

/**
 * v2 app shell: indigo header (wordmark, search, five sections, phone menu),
 * the page, and the footer. Replaces the old 5-dropdown Navbar.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-highlight focus:px-3 focus:py-2 focus:font-semibold focus:text-highlight-ink">
        Skip to content
      </a>
      <header className="v2-header relative z-40 text-white">
        <div className="mx-auto flex h-[var(--header-h)] max-w-[1240px] items-center gap-6 px-8 max-md:gap-3 max-md:px-4">
          <Wordmark />
          <HeaderSearchSlot />
          <NavLinks />
          <div className="ml-auto md:hidden" />
          <MobileMenu />
        </div>
      </header>
      {/* tabIndex -1: the skip link moves focus here, not just the scroll position. */}
      <main id="main" tabIndex={-1} className="legacy-frame flex-1">
        {children}
      </main>
      <Footer />
      <ScrollRegions />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-deep text-[13px] text-on-deep">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start justify-between gap-6 px-8 pb-10 pt-7 max-md:px-4">
        <div className="max-w-[420px]">
          <Link href="/" className="font-display text-xl font-extrabold text-white">
            Slush<span className="text-wordmark">Fund</span>
          </Link>
          <p className="mt-1.5">A free public watchdog. Public records only: every number links to the official filing it came from.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-6 items-center font-semibold text-white hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
