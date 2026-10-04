/**
 * Formatting for v2 pages. Every function returns null for a missing value so
 * callers render "unavailable" instead of $0 or a made-up fallback.
 */

const TZ = 'America/New_York';

export function fmtCount(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toLocaleString('en-US');
}

/** 47.3% (one decimal). null stays null so callers print "Unavailable". */
export function fmtPct(share: number | null | undefined): string | null {
  if (share == null || !Number.isFinite(share)) return null;
  return `${(share * 100).toFixed(1)}%`;
}

/** $729.6B, $14.2M, $950K. Exact below $1,000. */
export function fmtUsdCompact(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(abs >= 1e13 ? 1 : 2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e11 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function fmtUsd(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * STOCK Act amounts stay ranges (design rule 4): "$15,001–$50,000".
 * Prefers the raw disclosed string's numbers; never computes a midpoint.
 */
export function fmtRange(min: number | null | undefined, max: number | null | undefined, raw?: string | null): string | null {
  // Same-day lots folded into one row keep each disclosed range in the raw
  // string ("$1,001 - $15,000 + $1,001 - $15,000 (2 lots)"). Show those lots,
  // never their sum, which is not a range anyone disclosed.
  if (raw && /\(\d+ lots\)|\s\+\s/.test(raw)) return fmtLots(raw);
  if (min != null && max != null) return `${fmtUsd(min)}–${fmtUsd(max)}`;
  if (min != null && max == null) return `Over ${fmtUsd(min)}`;
  if (raw) return raw;
  return null;
}

/**
 * "2 × $1,001–$15,000" when every lot has the same range; mixed lots are grouped by range in the
 * order filed: "11 × $1,001–$15,000 + $15,001–$50,000" (a group of one has no count).
 */
export function fmtLots(raw: string): string {
  const lots = raw.replace(/\s*\(\d+ lots\)\s*$/, '').split(/\s+\+\s+/).map((r) => r.trim().replace(/\s*-\s*/, '–'));
  if (lots.every((l) => l === lots[0])) return `${lots.length} × ${lots[0]}`;
  const groups = new Map<string, number>();
  for (const l of lots) groups.set(l, (groups.get(l) ?? 0) + 1);
  return [...groups.entries()].map(([r, n]) => (n > 1 ? `${n} × ${r}` : r)).join(' + ');
}

function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  // Bare dates (YYYY-MM-DD) are calendar dates: pin them to noon UTC so the
  // New York rendering never slips a day.
  const v = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return Number.isNaN(v.getTime()) ? null : v;
}

/** Oct 3, 2026 */
export function fmtDate(d: string | Date | null | undefined): string | null {
  const v = toDate(d);
  if (!v) return null;
  return v.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
}

/** Oct 3 (current year) or Oct 3, 2025 */
export function fmtDateShort(d: string | Date | null | undefined, now: Date = new Date()): string | null {
  const v = toDate(d);
  if (!v) return null;
  const sameYear = v.getUTCFullYear() === now.getUTCFullYear();
  return v.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Oct 3, 2026, 6:47 PM ET (for load timestamps, never for page-load time) */
export function fmtDateTime(d: string | Date | null | undefined): string | null {
  const v = toDate(d);
  if (!v) return null;
  const s = v.toLocaleString('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `${s} ET`;
}

/** Whole days between two instants (b - a). */
export function daysBetween(a: string | Date, b: string | Date): number | null {
  const x = toDate(a);
  const y = toDate(b);
  if (!x || !y) return null;
  return Math.floor((y.getTime() - x.getTime()) / 86_400_000);
}
