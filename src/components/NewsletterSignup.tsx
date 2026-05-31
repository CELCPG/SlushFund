'use client';
import { useState } from 'react';
import { Mail, Loader2, Check, AlertCircle } from 'lucide-react';

type Props = {
  source?: string;
  variant?: 'inline' | 'stacked';
  heading?: string;
  blurb?: string;
};

export default function NewsletterSignup({
  source = 'unknown',
  variant = 'inline',
  heading,
  blurb,
}: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'Subscription failed.');
        setStatus('error');
        return;
      }
      setStatus('success');
      setEmail('');
    } catch {
      setErrorMsg('Network error. Try again.');
      setStatus('error');
    }
  }

  const stacked = variant === 'stacked';

  return (
    <div className={stacked ? 'w-full max-w-md' : 'w-full'}>
      {heading && (
        <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
          <Mail size={16} className="text-emerald-400" /> {heading}
        </h3>
      )}
      {blurb && <p className="text-slate-400 text-sm mb-3">{blurb}</p>}

      <form
        onSubmit={onSubmit}
        className={stacked ? 'flex flex-col gap-2' : 'flex flex-col sm:flex-row gap-2'}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
          disabled={status === 'submitting' || status === 'success'}
        />
        <button
          type="submit"
          disabled={status === 'submitting' || status === 'success'}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {status === 'submitting' && <Loader2 size={14} className="animate-spin" />}
          {status === 'success' ? 'Subscribed' : 'Subscribe'}
        </button>
      </form>

      {status === 'success' && (
        <p className="mt-2 text-sm text-emerald-400 flex items-center gap-1.5">
          <Check size={14} /> You're on the list. Watch your inbox.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-rose-400 flex items-center gap-1.5">
          <AlertCircle size={14} /> {errorMsg}
        </p>
      )}
    </div>
  );
}
