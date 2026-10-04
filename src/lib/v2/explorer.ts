/**
 * Shared bits of the data explorers (D4): reading filters from the URL, building permalinks, paging.
 * No server imports, so client components can use it too. Every filter lives in the URL query:
 * a permalink is the address bar.
 */

export type SP = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;
/** A CSV export holds at most this many rows (the UI says so). */
export const EXPORT_ROW_CAP = 10_000;

/** First value of a query parameter, '' when absent. */
export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/** Value must be one of the options, else ''. */
export function pick<T extends string>(v: string | string[] | undefined, options: readonly T[]): T | '' {
  const s = one(v);
  return (options as readonly string[]).includes(s) ? (s as T) : '';
}

/** A real calendar date as YYYY-MM-DD, else ''. */
export function isoDate(v: string | string[] | undefined): string {
  const s = one(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= '1990-01-01' && s <= '2100-01-01' ? s : '';
}

/** Page number from the URL, clamped to 1..pages. */
export function pageOf(v: string | string[] | undefined, pages: number): number {
  const n = Math.floor(Number(one(v)));
  return Number.isFinite(n) ? Math.min(Math.max(1, pages), Math.max(1, n)) : 1;
}

/** /path?a=1&b=2 with empty values dropped. */
export function buildHref(path: string, params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

/** True when the URL carries any parameter we read (filtered and paged views are not indexed). */
export function hasAny(sp: SP, keys: readonly string[]): boolean {
  return keys.some((k) => one(sp[k]) !== '');
}

/** Two-letter codes for the state filter (50 states, DC and the territories with a seat). */
export const STATE_CODES = [
  'AK', 'AL', 'AR', 'AS', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'GU', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
  'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MP', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK',
  'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VI', 'VT', 'WA', 'WI', 'WV', 'WY',
] as const;

// ---------------------------------------------------------------- server helpers (no imports)

type Page<T> = { data: T[] | null; error: unknown; count?: number | null };

/**
 * One page, retried once after 400 ms when the database answers with an error: the anon role has a 3 s
 * statement timeout, so a cold or busy instance can fail a page that the next request serves (A7c G5).
 * A second failure is returned as is; callers show "unavailable", never a zero.
 */
async function pageWithRetry<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, from: number, to: number): Promise<Page<T>> {
  const r = await build(from, to);
  if (!r.error && r.data) return r;
  await new Promise((done) => setTimeout(done, 400));
  return build(from, to);
}

/** Read every page of a query (PostgREST caps a response at 1,000 rows). null on any failure (after one retry per page). */
export async function readAll<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, maxRows = 60_000): Promise<T[] | null> {
  const SIZE = 1000;
  const first = await pageWithRetry(build, 0, SIZE - 1);
  if (first.error || !first.data) return null;
  const rows = [...first.data];
  if (first.data.length < SIZE) return rows;
  const want = Math.min(first.count ?? maxRows, maxRows);
  const starts: number[] = [];
  for (let s = SIZE; s < want; s += SIZE) starts.push(s);
  for (let i = 0; i < starts.length; i += 8) {
    const batch = await Promise.all(starts.slice(i, i + 8).map((s) => pageWithRetry(build, s, s + SIZE - 1)));
    for (const b of batch) {
      if (b.error || !b.data) return null;
      rows.push(...b.data);
    }
  }
  return rows;
}

/**
 * Memoize an async loader in module scope for `ttlMs`. Failures are never cached: a rejection, and a loader that
 * resolves null or undefined to say "the database did not answer", is dropped, so the next request tries again
 * instead of showing "unavailable" for 30 minutes after one transient error (A7c G5, found in D8c: a single
 * failed read on a cold start hid the late-filers board until the cache expired).
 */
export function memo<T>(fn: () => Promise<T>, ttlMs = 30 * 60 * 1000): () => Promise<T> {
  let hit: { at: number; p: Promise<T> } | null = null;
  return () => {
    if (!hit || Date.now() - hit.at > ttlMs) {
      const p = fn();
      const mine = { at: Date.now(), p };
      hit = mine;
      p.then(
        (v) => {
          if (v === null || v === undefined) {
            if (hit === mine) hit = null;
          }
        },
        () => {
          if (hit === mine) hit = null;
        },
      );
    }
    return hit.p;
  };
}
