import { createClient } from '@supabase/supabase-js';

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
 */
const retryingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return fetch(input, init);
  const pause = () => new Promise((done) => setTimeout(done, 350));
  try {
    const res = await fetch(input, init);
    if (res.status < 500) return res;
  } catch {
    // network error: fall through to the one retry
  }
  await pause();
  return fetch(input, init);
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: retryingFetch } })
  : null;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const supabaseAdmin = isSupabaseConfigured && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { global: { fetch: retryingFetch } })
  : null;