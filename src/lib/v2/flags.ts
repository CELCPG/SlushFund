/**
 * Feature flags that keep a page off the live site until the Auditor gives GO (pre-publish gate).
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can load it too.
 */

type Env = Record<string, string | undefined>;

/**
 * The late-filers board shows days from trade to first report, which is not public until an
 * Auditor GO. It is ON in local dev and in Vercel previews, and OFF on the production deployment
 * (VERCEL_ENV === 'production'). Remove this flag, and its uses, once the audit passes.
 */
export function lateFilersEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== 'production';
}
