import { createClient } from '@supabase/supabase-js';
import { readFailureInjected } from '@/lib/v2/flags';
import { noteFailedRead } from '@/lib/v2/read-failure';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Without credentials the clients are null and callers must show "unavailable"
// (never stand-in data).
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Reads retried once (A7c G5, D8c). The anon role has a 3 s statement timeout, so on a cold or busy instance the
 * first read of a large relation can come back as HTTP 500 while the next one, which finds the cache warm, is fast
 * (seen on get_alert_summary, member_conflict_scores and monthly_spending_trend; 6 of 271 gate requests failed in
 * one run with nothing wrong in the data). GET and HEAD only, once, after 350 ms; a second failure is returned as
 * it is, and every page then says "unavailable" rather than showing a zero.
 * A8 L4 (D8d): a request that still fails (5xx, 429 or a network error; RPC POSTs included) shortens the cache life
 * of the page being rendered to a minute, so ISR does not keep an "unavailable" page for the route's full revalidate.
 */
const retryingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return settle(attempt(input, init));
  const pause = () => new Promise((done) => setTimeout(done, 350));
  try {
    const res = await attempt(input, init);
    if (res.status < 500) return res;
  } catch {
    // network error: fall through to the one retry
  }
  await pause();
  return settle(attempt(input, init));
};

/** One request, or the L4 test hook's injected 500, what a statement timeout returns (SLUSHFUND_TEST_FAIL_READS_UNTIL; never in production). */
function attempt(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
  if (readFailureInjected()) {
    return Promise.resolve(new Response(JSON.stringify({ message: 'injected read failure (SLUSHFUND_TEST_FAIL_READS_UNTIL)' }), { status: 500, headers: { 'content-type': 'application/json' } }));
  }
  return fetch(input, init);
}

/** The last answer to a request: a failure is noted before it is returned. */
async function settle(p: Promise<Response>): Promise<Response> {
  let res: Response;
  try {
    res = await p;
  } catch (e) {
    await noteFailedRead();
    throw e;
  }
  if (res.status >= 500 || res.status === 429) await noteFailedRead();
  return res;
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: retryingFetch } })
  : null;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const supabaseAdmin = isSupabaseConfigured && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { global: { fetch: retryingFetch } })
  : null;