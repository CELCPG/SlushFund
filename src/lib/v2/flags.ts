/**
 * Feature flags that keep a page off the live site until the Auditor gives GO (pre-publish gate).
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can load it too.
 */

type Env = Record<string, string | undefined>;

/**
 * The board of reports filed after the 45-day limit (/data/late-filers) shows days from trade to first report,
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
