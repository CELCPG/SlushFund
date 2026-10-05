'use client';

import { useState, type FormEvent } from 'react';
import {
  CONTACT_MAX, ERROR_TEXT, HONEYPOT_FIELD, MESSAGE_MAX, MESSAGE_MIN, PAGE_URL_MAX, REPLY_PROMISE, REPORT_API, type ReportError,
} from '@/lib/v2/error-reports';

const field = 'w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';
const label = 'mb-1 block text-[13px] font-semibold text-ink';
const hint = 'mt-1 block text-[13px] text-muted';

/**
 * The error-report form (F1). With JavaScript it posts JSON and shows the result in place, keeping what was
 * typed if it fails; without it, the browser posts the form and the route sends it back to the page.
 */
export default function ReportErrorForm({ from, sent: sentAtLoad, error: errorAtLoad }: { from: string; sent?: boolean; error?: ReportError }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>(sentAtLoad ? 'sent' : 'idle');
  const [error, setError] = useState<ReportError | null>(errorAtLoad ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState('sending');
    setError(null);
    try {
      const res = await fetch(REPORT_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: ReportError } | null;
      if (res.ok && body?.ok) { setState('sent'); return; }
      setError(body?.error && body.error in ERROR_TEXT ? body.error : 'unavailable');
    } catch {
      setError('unavailable');
    }
    setState('idle');
  }

  if (state === 'sent') {
    return (
      <div role="status" className="rounded-2xl bg-neutral-tint px-5 py-4 text-[16px]" data-report-sent>
        <p className="font-semibold">{REPLY_PROMISE}</p>
        <p className="mt-2 text-[14.5px] text-muted">Confirmed errors are fixed and listed on the corrections page.</p>
      </div>
    );
  }

  return (
    <form action={REPORT_API} method="post" onSubmit={onSubmit} className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-stale-tint px-4 py-2.5 text-[14.5px] text-stale-ink">{ERROR_TEXT[error]}</p>
      )}
      <div>
        <label htmlFor="re-page" className={label}>Page address</label>
        <input id="re-page" name="page_url" type="text" required maxLength={PAGE_URL_MAX} defaultValue={from} placeholder="/people/G000583" className={`${field} h-11`} aria-describedby="re-page-hint" />
        <span id="re-page-hint" className={hint}>The page with the error, on slushfund.net.</span>
      </div>
      <div>
        <label htmlFor="re-message" className={label}>What is wrong</label>
        <textarea id="re-message" name="message" required minLength={MESSAGE_MIN} maxLength={MESSAGE_MAX} rows={7} className={`${field} py-2.5`} aria-describedby="re-message-hint" />
        <span id="re-message-hint" className={hint}>The number, name, date or sentence you think is wrong, and the official record that differs (a link is best).</span>
      </div>
      <div>
        <label htmlFor="re-contact" className={label}>How to reach you <span className="font-normal text-muted">(optional)</span></label>
        <input id="re-contact" name="contact" type="text" maxLength={CONTACT_MAX} autoComplete="email" className={`${field} h-11`} aria-describedby="re-contact-hint" />
        <span id="re-contact-hint" className={hint}>An email address or another way to reply. We use it only to answer this report.</span>
      </div>
      {/* Honeypot: hidden from people and screen readers; bots that fill it are refused. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="re-website">Leave this field empty</label>
        <input id="re-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div>
        <button type="submit" disabled={state === 'sending'} className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-deep disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}
