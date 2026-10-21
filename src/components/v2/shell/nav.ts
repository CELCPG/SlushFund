/** The five top-level sections (ia-audit §5.1). */
export const NAV_ITEMS = [
  { href: '/investigations', label: 'Investigations' },
  { href: '/people', label: 'People' },
  { href: '/companies', label: 'Companies' },
  { href: '/data', label: 'Data' },
  { href: '/about', label: 'About' },
] as const;

export interface NavItem {
  href: string;
  label: string;
}

/** D17: "Election 2026" sits before About, only while the Election Center flag is on (nothing links to a 404). */
export function navItems(electionCenterOn: boolean): readonly NavItem[] {
  if (!electionCenterOn) return NAV_ITEMS;
  const about = NAV_ITEMS.findIndex((i) => i.href === '/about');
  return [...NAV_ITEMS.slice(0, about), { href: '/election-2026', label: 'Election 2026' }, ...NAV_ITEMS.slice(about)];
}

export const FOOTER_LINKS = [
  { href: '/about/methodology', label: 'Methods' },
  { href: '/about/corrections', label: 'Corrections' },
  { href: '/latest', label: 'Latest' },
  { href: '/data/trades', label: 'Trades explorer' },
  { href: '/data/contracts', label: 'Contracts explorer' },
  { href: '/data#downloads', label: 'Data downloads' },
  { href: '/data/status', label: 'Data status' },
  { href: '/about', label: 'About' },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The path the shell renders for. Vercel regenerates the homepage under ISR as '/index', so usePathname() returned
 * '/index' on the server and '/' in the browser: the header rendered its search form in HTML and an empty slot on
 * the client, and React threw hydration error #418 on / (A8 N8; the preview's RSC payload carried "c":["","index"]).
 */
export function shellPath(pathname: string | null | undefined): string {
  return !pathname || pathname === '/index' ? '/' : pathname;
}
