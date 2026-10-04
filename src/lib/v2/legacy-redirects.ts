/**
 * Legacy URLs whose new home needs a lookup, so they can't be static next.config redirects (D2).
 * src/proxy.ts answers each with a 301 before the legacy gate runs. The lookup tables are built
 * from the database by scripts/build-legacy-map.mjs (no imports there, plain data).
 *
 *   /congress/members/<name-slug>  → /people/<bioguide>, or /people?q=<name> when no single member matches
 *   /score/<name-slug>             → same lookup (the old per-senator score cards)
 *   /agency/<code or agency name>  → /agencies/<toptier code>, or /agencies when unknown
 *   /vendor/<slug>                 → /companies/<company slug> when one USAspending parent record matched, else /companies
 */
import { LEGACY_AGENCIES, LEGACY_PEOPLE, LEGACY_VENDORS } from './legacy-map.generated';

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The old member slug rule: lowercase, whitespace → "-", anything else not [a-z0-9-] dropped. */
export function legacyPersonSlug(raw: string): string {
  return decode(raw).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function personTarget(raw: string): string {
  const slug = legacyPersonSlug(raw);
  const id = LEGACY_PEOPLE[slug] ?? LEGACY_PEOPLE[slug.normalize('NFD').replace(/[̀-ͯ]/g, '')];
  if (id) return `/people/${id}`;
  const name = slug.replace(/-+/g, ' ').trim().slice(0, 60);
  return name ? `/people?q=${encodeURIComponent(name)}` : '/people';
}

function agencyTarget(raw: string): string {
  const v = decode(raw).trim();
  if (/^\d{3,4}$/.test(v)) return `/agencies/${v}`;
  const key = v.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const code = LEGACY_AGENCIES[key];
  return code ? `/agencies/${code}` : '/agencies';
}

/** Destination for a legacy path that needs a lookup, or null when the path is not one of them. */
export function resolveLegacyRedirect(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '');
  let m = /^\/congress\/members\/([^/]+)$/.exec(p);
  if (m) return personTarget(m[1]);
  m = /^\/score\/([^/]+)$/.exec(p);
  if (m && m[1] !== 'methodology') return personTarget(m[1]);
  if (p === '/congress/members') return '/people';
  m = /^\/agency\/([^/]+)$/.exec(p);
  if (m) return agencyTarget(m[1]);
  if (p === '/agency') return '/agencies';
  m = /^\/vendor\/([^/]+)$/.exec(p);
  if (m) {
    const slug = LEGACY_VENDORS[decode(m[1]).toLowerCase()];
    return slug ? `/companies/${slug}` : '/companies';
  }
  if (p === '/vendor') return '/companies';
  return null;
}
