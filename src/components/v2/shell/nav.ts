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

/** D15: "The President" sits after People, and only while SHOW_PRESIDENT_DEEPDIVE is on (flags.ts presidentDeepDiveEnabled). */
export const PRESIDENT_NAV_ITEM: NavItem = { href: '/president', label: 'The President' };

/** D15+D17: flag-gated nav items; nothing links to a 404 while its flag is off. */
export function navItems(showPresident: boolean, electionCenterOn = false): readonly NavItem[] {
  let items: readonly NavItem[] = NAV_ITEMS;
  if (showPresident) {
    const i = items.findIndex((n) => n.href === '/people');
    items = [...items.slice(0, i + 1), PRESIDENT_NAV_ITEM, ...items.slice(i + 1)];
  }
  if (electionCenterOn) {
    const about = items.findIndex((n) => n.href === '/about');
    items = [...items.slice(0, about), { href: '/election-2026', label: 'Election 2026' }, ...items.slice(about)];
  }
  return items;
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
