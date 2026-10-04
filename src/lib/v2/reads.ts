import 'server-only';
import { noteFailedRead } from '@/lib/v2/read-failure';

/**
 * Module-scope memo and paged reads shared by the v2 loaders (companies, people, late filers). One copy, so a fix
 * reaches every loader: before D8d, companies.ts and people.ts each kept a memo that cached a failed (null) read for
 * 30 minutes (A8 L4).
 */

type Page<T> = { data: T[] | null; error: unknown; count?: number | null };

/**
 * One page, retried once after 400 ms when the database answers with an error: the anon role has a 3 s statement
 * timeout, so a cold or busy instance can fail a page that the next request serves (A7c G5). A second failure is
 * returned as is; callers show "unavailable", never a zero.
 */
async function pageWithRetry<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, from: number, to: number): Promise<Page<T>> {
  const r = await build(from, to);
  if (!r.error && r.data) return r;
  await new Promise((done) => setTimeout(done, 400));
  return build(from, to);
}

/**
 * Read every page of a query (PostgREST caps a response at 1,000 rows). null on any failure (after one retry per
 * page); a failure also shortens the cache life of the page being rendered (noteFailedRead).
 */
export async function readAll<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, maxRows = 60_000): Promise<T[] | null> {
  const SIZE = 1000;
  const first = await pageWithRetry(build, 0, SIZE - 1);
  if (first.error || !first.data) return failed();
  const rows = [...first.data];
  if (first.data.length < SIZE) return rows;
  const want = Math.min(first.count ?? maxRows, maxRows);
  const starts: number[] = [];
  for (let s = SIZE; s < want; s += SIZE) starts.push(s);
  for (let i = 0; i < starts.length; i += 8) {
    const batch = await Promise.all(starts.slice(i, i + 8).map((s) => pageWithRetry(build, s, s + SIZE - 1)));
    for (const b of batch) {
      if (b.error || !b.data) return failed();
      rows.push(...b.data);
    }
  }
  return rows;
}

async function failed(): Promise<null> {
  await noteFailedRead();
  return null;
}

/**
 * Memoize an async loader in module scope for `ttlMs`. Failures are never cached: a rejection, and a loader that
 * resolves null or undefined to say "the database did not answer", is dropped, so the next request tries again
 * instead of showing "unavailable" for 30 minutes after one transient error (A7c G5, A8 L4). Every caller that gets
 * a failure, including one that joined a read another request started, shortens its own page's cache.
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
          if ((v === null || v === undefined) && hit === mine) hit = null;
        },
        () => {
          if (hit === mine) hit = null;
        },
      );
    }
    return hit.p.then(
      async (v) => {
        if (v === null || v === undefined) await noteFailedRead();
        return v;
      },
      async (e) => {
        await noteFailedRead();
        throw e;
      },
    );
  };
}
