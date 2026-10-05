import { MetadataRoute } from 'next';
import { hasPublishedCorrections } from '@/data/corrections';
import { lateFilersEnabled } from '@/lib/v2/flags';

// D5: the sitemap lists only pages that are live and verified. Gated legacy pages, the
// withdrawn stories and the old vendor pages are out (see src/lib/v2/redirect-map.ts). Add
// each new page family here as it ships. /design/* is noindex and stays out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://slushfund.net';
  const now = new Date().toISOString();

  const paths: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1.0 },
    { path: '/investigations', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/people', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/companies', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/data', changeFrequency: 'daily', priority: 0.8 },
    { path: '/data/trades', changeFrequency: 'daily', priority: 0.7 },
    { path: '/data/contracts', changeFrequency: 'daily', priority: 0.7 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/about/methodology', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/about/methodology/trades', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/about/methodology/contracts', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/about/methodology/tickers', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/data/status', changeFrequency: 'daily', priority: 0.5 },
    { path: '/latest', changeFrequency: 'daily', priority: 0.7 },
  ];
  // The corrections log is listed only once it has a published entry.
  if (hasPublishedCorrections()) paths.push({ path: '/about/corrections', changeFrequency: 'weekly', priority: 0.6 });
  // The board of reports filed after the 45-day limit is off on the production deployment unless SHOW_LATE_FILERS=1 (D4 flag, F1).
  if (lateFilersEnabled()) paths.push({ path: '/data/late-filers', changeFrequency: 'daily', priority: 0.7 });

  return paths.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
