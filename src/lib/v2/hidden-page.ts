import type { Metadata } from 'next';

/**
 * Metadata for a page that is hidden on this deployment (its flag is off, so it answers 404; A9 N1). It carries what the site's
 * own 404 carries: no title, canonical, og:url or description of the hidden page (so the root layout's generic title shows), and noindex.
 * Without it the hidden page's own `generateMetadata` ran anyway and its title and canonical reached the 404's tab and RSC data.
 * Plain TypeScript with no runtime imports, so scripts/verify-gates.mjs can load it too.
 */
export function hiddenPageMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}
