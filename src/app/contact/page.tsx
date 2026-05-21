'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
      } else {
        setStatus('success');
        setForm({ name: '', email: '', subject: '', message: '' });
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft size={14} /> Back to SlushFund
        </Link>

        <div className="mb-8">
          <h1 className="text-white font-black text-4xl mb-3">Contact Us</h1>
          <p className="text-slate-400 leading-relaxed">
            Tips, data corrections, partnership inquiries, or just want to say something? Drop us a line. We read everything.
          </p>
          <p className="text-slate-600 text-sm mt-2">
            For sensitive tips, use a throwaway email. We do not track or log visitor identities.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-8 text-center">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl mb-2">Message sent.</h2>
            <p className="text-slate-400">We will be in touch. Check your inbox for a confirmation email.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name + Email row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-slate-400 text-xs uppercase tracking-widest mb-2">Name <span className="text-red-400">*</span></label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-slate-400 text-xs uppercase tracking-widest mb-2">Email <span className="text-red-400">*</span></label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-slate-400 text-xs uppercase tracking-widest mb-2">Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                placeholder="What's this about?"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-slate-400 text-xs uppercase tracking-widest mb-2">Message <span className="text-red-400">*</span></label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                maxLength={2000}
                value={form.message}
                onChange={handleChange}
                placeholder="Share a tip, correct a record, or just reach out..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
              <div className="text-slate-600 text-xs text-right mt-1">{form.message.length}/2000</div>
            </div>

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-start gap-2 bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-3">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{errorMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg text-sm transition-colors"
            >
              {status === 'loading' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={14} /> Send Message
                </>
              )}
            </button>

            <p className="text-slate-600 text-xs text-center">
              Your email is never displayed publicly. We do not share or sell contact info.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}