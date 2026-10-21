import { MetadataRoute } from 'next';
import { hasPublishedCorrections } from '@/data/corrections';
import { GRADE_METHOD_PATH, MOST_ACTIVE_PATH, PRESIDENT_PATH, VOTER_PATH, gradesEnabled, investigationsV2Enabled, lateFilersEnabled, mostActiveEnabled, presidentPageEnabled, voterPagesEnabled } from '@/lib/v2/flags';
import { STATE_CODES } from '@/lib/v2/explorer';
import { STORIES, storyPath } from '@/lib/v2/story-figures';

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
  // The board of reports filed more than 45 days after the trade is off on the production deployment unless SHOW_LATE_FILERS=1 (D4 flag, F1).
  if (lateFilersEnabled()) paths.push({ path: '/data/late-filers', changeFrequency: 'daily', priority: 0.7 });
  // D9 / D10, each behind its own flag (flags.ts): off on production until the Auditor's page check and Colin.
  if (presidentPageEnabled()) paths.push({ path: PRESIDENT_PATH, changeFrequency: 'weekly', priority: 0.7 });
  if (mostActiveEnabled()) paths.push({ path: MOST_ACTIVE_PATH, changeFrequency: 'daily', priority: 0.7 });
  if (gradesEnabled()) paths.push({ path: GRADE_METHOD_PATH, changeFrequency: 'monthly', priority: 0.6 });
  // D11 voter pages (SHOW_VOTER_PAGES): the index and one page per state, DC and territory with a seat.
  if (voterPagesEnabled()) {
    paths.push({ path: VOTER_PATH, changeFrequency: 'weekly', priority: 0.7 });
    for (const s of STATE_CODES) paths.push({ path: `${VOTER_PATH}/${s.toLowerCase()}`, changeFrequency: 'daily', priority: 0.6 });
  }
  // D12 investigation posts (SHOW_INVESTIGATIONS_V2): both pairs, listed together (G8).
  if (investigationsV2Enabled()) for (const s of STORIES) paths.push({ path: storyPath(s.slug), changeFrequency: 'weekly', priority: 0.7 });

  return paths.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
