import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ERROR_TEXT, REPORT_PATH, makeRateLimiter, normalizePageUrl, validateReport, type ReportError } from '@/lib/v2/error-reports';

// F1 (A8 L5): saves one reader error report with the site's anon key, which may INSERT into error_reports
// and nothing else (no SELECT, UPDATE or DELETE; see the migration). No service key here. Apex forwards new
// rows to Colin from a local script. The form posts JSON from the browser; without JavaScript it posts the
// form itself and gets a 303 back to the page.
export const dynamic = 'force-dynamic';

const allow = makeRateLimiter();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function clientIp(req: Request): string {
  // Vercel sets both headers from the connection; a client cannot override them there.
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function readForm(req: Request): Promise<Record<string, unknown> | null> {
  const ctype = req.headers.get('content-type') ?? '';
  try {
    if (ctype.includes('application/json')) {
      const body = await req.json();
      return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    }
    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      return Object.fromEntries((await req.formData()).entries());
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request) {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json') || (req.headers.get('content-type') ?? '').includes('application/json');
  const form = await readForm(req);
  const reply = (status: number, error?: ReportError) => {
    if (wantsJson) return NextResponse.json(error ? { ok: false, error, message: ERROR_TEXT[error] } : { ok: true }, { status });
    const to = new URL(REPORT_PATH, req.url);
    if (error) {
      to.searchParams.set('error', error);
      const from = normalizePageUrl(form?.page_url);
      if (from) to.searchParams.set('from', from);
    } else to.searchParams.set('sent', '1');
    return NextResponse.redirect(to, 303);
  };

  if (!allow(sha(`error-reports:${clientIp(req)}`))) return reply(429, 'rate_limited');
  if (!form) return reply(400, 'rejected');
  const checked = validateReport(form);
  if (!checked.ok) return reply(400, checked.error);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return reply(503, 'unavailable');
  const ua = req.headers.get('user-agent');
  const row = { ...checked.value, user_agent_hash: ua ? sha(ua).slice(0, 32) : null };
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/error_reports`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
      cache: 'no-store',
    });
    if (res.status !== 201) {
      console.error('error_reports insert failed', res.status, (await res.text()).slice(0, 200));
      return reply(503, 'unavailable');
    }
  } catch (e) {
    console.error('error_reports insert failed', String(e).slice(0, 200));
    return reply(503, 'unavailable');
  }
  return reply(wantsJson ? 201 : 303);
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'Use the form at /report-an-error.' }, { status: 405, headers: { Allow: 'POST' } });
}
