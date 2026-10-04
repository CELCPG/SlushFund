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
