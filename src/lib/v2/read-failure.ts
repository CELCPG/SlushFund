import { unstable_cache } from 'next/cache';

/**
 * What happens to a page when a database read fails (A8 L4).
 *
 * Pages say "unavailable" when a read fails, never a zero. Before D8d that render was then cached by ISR for the
 * route's full revalidate (10 to 30 minutes), so one transient error (the anon role has a 3 s statement timeout)
 * kept /companies, search and the contracts source bar dark long after the database answered again.
 *
 * noteFailedRead() lowers the revalidate of the page being rendered to FAILED_READ_REVALIDATE. Next keeps the lowest
 * revalidate that any unstable_cache call in a render asks for, so a good render keeps its route's revalidate and a
 * failed one is regenerated after a minute. Outside a page render (scripts, route handlers) it does nothing.
 *
 * Imports only next/cache, so src/lib/supabase.ts can use it. The L4 test hook is readFailureInjected() in flags.ts.
 */

/** Seconds a page rendered after a failed read stays cached. */
export const FAILED_READ_REVALIDATE = 60;

const shortenPageCache = unstable_cache(async () => FAILED_READ_REVALIDATE, ['slushfund-failed-read-v1'], { revalidate: FAILED_READ_REVALIDATE });

export async function noteFailedRead(): Promise<void> {
  try {
    await shortenPageCache();
  } catch {
    // not inside a render: nothing to shorten
  }
}
