/**
 * Reader error reports (F1, A8 L5): the rules the /report-an-error form, its route and the database share.
 * The table's own CHECK constraints (supabase/migrations/20261014_f1_error_reports.sql) hold the same limits.
 * Plain TypeScript with no imports, so scripts/verify-gates.mjs can load it too.
 */

export const REPORT_PATH = '/report-an-error';
export const REPORT_API = '/api/report-an-error';
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;
export const CONTACT_MAX = 200;
export const PAGE_URL_MAX = 500;
/** The route's in-memory limit per hashed IP address (per server instance; fine for launch). */
export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
/** The hidden field people never see; a filled one means a bot. */
export const HONEYPOT_FIELD = 'website';
export const REPLY_PROMISE = 'Thanks. We reply to reports that include a contact within 2 business days.';

/** The form's link from any page: `/report-an-error?from=/people/G000583`. */
export function reportErrorHref(fromPath?: string | null): string {
  const from = normalizePageUrl(fromPath ?? '');
  return from ? `${REPORT_PATH}?from=${encodeURIComponent(from)}` : REPORT_PATH;
}

/**
 * A slushfund.net path ("/people/G000583") or full address (https://slushfund.net/…, https://www.slushfund.net/…),
 * trimmed; anything else (another site, "//host", "javascript:") is null.
 */
export function normalizePageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.length > PAGE_URL_MAX || /[\s<>"\\]/.test(v)) return null;
  if (/^\/(?![/\\])/.test(v)) return v;
  if (/^https:\/\/(www\.)?slushfund\.net(\/|$)/.test(v)) return v;
  return null;
}

export type ReportError = 'page_url' | 'message' | 'contact' | 'rejected' | 'rate_limited' | 'unavailable';

export const ERROR_TEXT: Record<ReportError, string> = {
  page_url: 'Enter the address of a page on slushfund.net, for example /people/G000583.',
  message: `Describe the error in ${MESSAGE_MIN} to ${MESSAGE_MAX.toLocaleString('en-US')} characters.`,
  contact: `Keep the contact to ${CONTACT_MAX} characters.`,
  rejected: 'This report could not be sent.',
  rate_limited: 'Too many reports from this connection in the last few minutes. Please try again in 10 minutes.',
  unavailable: 'The report could not be saved just now. Please try again in a few minutes.',
};

export interface ReportInput {
  page_url: string;
  message: string;
  contact: string | null;
}

/** Checks a submitted form. A filled honeypot is refused like any other bad input, and nothing is stored. */
export function validateReport(form: Record<string, unknown>): { ok: true; value: ReportInput } | { ok: false; error: ReportError } {
  const honey = form[HONEYPOT_FIELD];
  if (typeof honey === 'string' && honey.trim() !== '') return { ok: false, error: 'rejected' };
  const pageUrl = normalizePageUrl(form.page_url);
  if (!pageUrl) return { ok: false, error: 'page_url' };
  const message = typeof form.message === 'string' ? form.message.trim() : '';
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) return { ok: false, error: 'message' };
  const contactRaw = typeof form.contact === 'string' ? form.contact.trim() : '';
  if (contactRaw.length > CONTACT_MAX) return { ok: false, error: 'contact' };
  return { ok: true, value: { page_url: pageUrl, message, contact: contactRaw || null } };
}

/** A sliding-window counter per key. Every attempt counts, refused ones included. */
export function makeRateLimiter({ max, windowMs } = RATE_LIMIT) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    return recent.length <= max;
  };
}
