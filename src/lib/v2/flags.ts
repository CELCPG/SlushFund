/**
 * Feature flags that keep a page off the live site until the Auditor gives GO (pre-publish gate).
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can load it too.
 */

type Env = Record<string, string | undefined>;

/**
 * The board of reports filed more than 45 days after the trade (/data/late-filers) shows days from trade to first report,
 * which is not public until an Auditor GO. It is ON in local dev and in Vercel previews, and OFF on the production
 * deployment (VERCEL_ENV === 'production') unless SHOW_LATE_FILERS=1 is set there (F1: Apex sets it at launch only
 * if the re-check gives the board GO). One switch for the page, the sitemap, the Data tab, the /data card and the
 * method sentence. Vercel reads env vars at build time too, so changing it needs a redeploy.
 */
export function lateFilersEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_LATE_FILERS === '1';
}

/**
 * Where the board shows as a preview (dev and Vercel previews): a "Preview only" note, noindex, and "(preview)"
 * on the /data card. On production with SHOW_LATE_FILERS=1 the board is public and carries none of these.
 */
export function lateFilersPreview(env: Env = process.env): boolean {
  return lateFilersEnabled(env) && env.VERCEL_ENV !== 'production';
}

/**
 * /design and /design/story are review tools: mock "Preview" states, placeholder text and made-up
 * example headlines (A8 L2). On in local dev and in Vercel previews; 404 on the production deployment.
 */
export function designPagesEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production';
}

/**
 * D9: the President's 278-T page (/people/executive/donald-trump). Days from trade to report and OGE bands are not public
 * until the Auditor's page check (A12) gives GO: on in dev and previews, off on production unless SHOW_PRESIDENT_TRADES=1.
 */
export function presidentPageEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_PRESIDENT_TRADES === '1';
}

/**
 * D15: the President section (/president, /president/timing, /president/largest, /president/data-quality) and its
 * "The President" nav item, built only from executive_trades and executive_filings. Off on production until the Auditor's
 * page check: SHOW_PRESIDENT_DEEPDIVE=1. While off, every /president path answers the site 404 and the nav item is absent.
 */
export function presidentDeepDiveEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_PRESIDENT_DEEPDIVE === '1';
}

/** D10: the leaderboard /data/most-active-traders. Same pattern: off on production unless SHOW_MOST_ACTIVE=1. */
export function mostActiveEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_MOST_ACTIVE === '1';
}

/**
 * D10: the Stock Trading Grade (report card on member pages, the grade column on the leaderboard, and the method page
 * /about/methodology/report-card). Off on production until A12 and Colin sign off on the method (SHOW_GRADES=1).
 */
export function gradesEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_GRADES === '1';
}

/**
 * D10: the "Who funds them" panel on member pages (FEC, F1's member_campaign_money). While off, or while the view does
 * not exist, the panel says only "Campaign finance data: coming soon". Off on production unless SHOW_CAMPAIGN_MONEY=1.
 */
export function campaignMoneyEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_CAMPAIGN_MONEY === '1';
}

/**
 * D11: the per-state voter pages (/your-members and /your-members/[state], "Your members of Congress: the records"). Current
 * members only, no ballot claims. Off on production until the Auditor's page check (SHOW_VOTER_PAGES=1).
 */
export function voterPagesEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_VOTER_PAGES === '1';
}

/**
 * D12: the four investigation posts under /investigations/<slug> (Musk / Bloomberg, Oracle / Bezos) and the entity CSV they link.
 * Off on production until the Auditor's story check (A15) and Colin: SHOW_INVESTIGATIONS_V2=1. While off, /investigations shows
 * its "no stories" page and every /investigations/<path> answers the site 404 (withdrawn slugs still answer 410 first).
 */
export function investigationsV2Enabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_INVESTIGATIONS_V2 === '1';
}

/**
 * D17: the Election Center (/election-2026), the front door that pulls the grades, campaign money, trading board, voter pages and
 * President page into one place. Off on production unless SHOW_ELECTION_CENTER=1 (Auditor GO first); each section also follows its
 * own flag (grades, campaign money, leaderboard, voter pages, President), so the hub never shows or links what is still hidden.
 */
export function electionCenterEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_ELECTION_CENTER === '1';
}

export const ELECTION_PATH = '/election-2026';

/**
 * D19: the site-wide analytics hub (/analytics). Same pattern: on in dev and previews, off on production unless SHOW_ANALYTICS_HUB=1.
 * Inside the page, sections that show figures from another gated feature (grades, President trades, investigation transactions,
 * campaign money) stay behind that feature's own flag.
 */
export function analyticsHubEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_ANALYTICS_HUB === '1';
}

export const ANALYTICS_PATH = '/analytics';

/**
 * D18: the sector heatmap and top-ticker boards (/data/what-congress-trades, "What Congress is trading"). Counts only, from
 * congress_trades. Off on production until the Auditor's page check: SHOW_SECTOR_HEATMAP=1.
 */
export function sectorHeatmapEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_SECTOR_HEATMAP === '1';
}

/**
 * D20: the shareable infographic series (/graphics and /graphics/<slug>). Off on production until the Auditor's check (SHOW_INFOGRAPHICS=1).
 * Each graphic also follows the flag of the feature whose figures it draws, so turning this one on alone never reveals a figure whose
 * own page is still waiting on its audit (report card -> SHOW_GRADES, receipts -> SHOW_CAMPAIGN_MONEY, days to report ->
 * SHOW_LATE_FILERS, President -> SHOW_PRESIDENT_TRADES).
 */
export function infographicsEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_INFOGRAPHICS === '1';
}

export const GRAPHICS_PATH = '/graphics';
export const GRAPHIC_SLUGS = ['grading-congress', 'where-the-money-comes-from', 'trading-while-disclosing', 'the-presidents-trades'] as const;
export type GraphicSlug = (typeof GRAPHIC_SLUGS)[number];

export function graphicEnabled(slug: string, env: Env = process.env): boolean {
  if (!infographicsEnabled(env)) return false;
  switch (slug) {
    case 'grading-congress': return gradesEnabled(env);
    case 'where-the-money-comes-from': return campaignMoneyEnabled(env);
    case 'trading-while-disclosing': return lateFilersEnabled(env);
    case 'the-presidents-trades': return presidentPageEnabled(env);
    default: return false;
  }
}

/**
 * D21: the "Follow the money" flow graphic on member pages (money in, the member, what their disclosed trades touch) and its
 * compact money-in variant on voter-page member cards. Off on production until the Auditor's page check: SHOW_MONEY_TRAIL=1.
 */
export function moneyTrailEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production' || env.SHOW_MONEY_TRAIL === '1';
}
export const PRESIDENT_PATH = '/people/executive/donald-trump';
export const PRESIDENT_HUB_PATH = '/president';
export const PRESIDENT_TIMING_PATH = '/president/timing';
export const PRESIDENT_LARGEST_PATH = '/president/largest';
export const PRESIDENT_QUALITY_PATH = '/president/data-quality';
export const MOST_ACTIVE_PATH = '/data/most-active-traders';
export const SECTOR_HEATMAP_PATH = '/data/what-congress-trades';
export const GRADE_METHOD_PATH = '/about/methodology/report-card';
export const VOTER_PATH = '/your-members';

/**
 * Paths that answer the site's own 404 on this deployment because their flag is off: the board, and /design and /design/story
 * on production. src/proxy.ts rewrites them to an unmatched path, so the response is the generic 404 (server-rendered, the root
 * layout's title, no canonical). The pages still call notFound() and return hiddenPageMetadata() as a second line (A9 N1:
 * with only those, the 404 carried the page's own title and canonical and had no server-rendered body).
 */
export function hiddenByFlag(pathname: string, env: Env = process.env): boolean {
  if (pathname === '/data/late-filers') return !lateFilersEnabled(env);
  if (pathname === ELECTION_PATH) return !electionCenterEnabled(env);
  if (pathname === PRESIDENT_PATH) return !presidentPageEnabled(env);
  if (pathname === PRESIDENT_HUB_PATH || pathname.startsWith(`${PRESIDENT_HUB_PATH}/`)) return !presidentDeepDiveEnabled(env);
  if (pathname === MOST_ACTIVE_PATH) return !mostActiveEnabled(env);
  if (pathname === ANALYTICS_PATH) return !analyticsHubEnabled(env);
  if (pathname === SECTOR_HEATMAP_PATH) return !sectorHeatmapEnabled(env);
  if (pathname === GRADE_METHOD_PATH) return !gradesEnabled(env);
  if (pathname === VOTER_PATH || pathname.startsWith(`${VOTER_PATH}/`)) return !voterPagesEnabled(env);
  if (pathname === GRAPHICS_PATH) return !infographicsEnabled(env);
  if (pathname.startsWith(`${GRAPHICS_PATH}/`)) {
    if (!infographicsEnabled(env)) return true;
    const slug = pathname.slice(GRAPHICS_PATH.length + 1).split('/')[0];
    return (GRAPHIC_SLUGS as readonly string[]).includes(slug) ? !graphicEnabled(slug, env) : false;
  }
  if (pathname.startsWith('/investigations/')) return !investigationsV2Enabled(env);
  if (pathname === '/design' || pathname.startsWith('/design/')) return !designPagesEnabled(env);
  return false;
}

/**
 * Test hook for the A8 L4 proof (D8d): while SLUSHFUND_TEST_FAIL_READS_UNTIL (an ISO time or epoch ms) is in the
 * future, every database request answers 500 without reaching the network (src/lib/supabase.ts). Never on the
 * production deployment.
 */
export function readFailureInjected(env: Env = process.env, now = Date.now()): boolean {
  const until = env.SLUSHFUND_TEST_FAIL_READS_UNTIL;
  if (!until || env.VERCEL_ENV === 'production') return false;
  const t = /^\d+$/.test(until) ? Number(until) : Date.parse(until);
  return Number.isFinite(t) && now < t;
}
