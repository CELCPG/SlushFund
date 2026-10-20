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

export const PRESIDENT_PATH = '/people/executive/donald-trump';
export const MOST_ACTIVE_PATH = '/data/most-active-traders';
export const GRADE_METHOD_PATH = '/about/methodology/report-card';

/**
 * Paths that answer the site's own 404 on this deployment because their flag is off: the board, and /design and /design/story
 * on production. src/proxy.ts rewrites them to an unmatched path, so the response is the generic 404 (server-rendered, the root
 * layout's title, no canonical). The pages still call notFound() and return hiddenPageMetadata() as a second line (A9 N1:
 * with only those, the 404 carried the page's own title and canonical and had no server-rendered body).
 */
export function hiddenByFlag(pathname: string, env: Env = process.env): boolean {
  if (pathname === '/data/late-filers') return !lateFilersEnabled(env);
  if (pathname === PRESIDENT_PATH) return !presidentPageEnabled(env);
  if (pathname === MOST_ACTIVE_PATH) return !mostActiveEnabled(env);
  if (pathname === GRADE_METHOD_PATH) return !gradesEnabled(env);
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
