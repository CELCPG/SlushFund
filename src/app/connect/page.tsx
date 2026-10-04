import type { Metadata } from 'next';
import NewsletterSignup from '@/components/NewsletterSignup';

export const metadata: Metadata = {
  title: 'Connect. SlushFund',
  description: 'Follow SlushFund on TikTok and Reddit, or sign up for the Slush Report newsletter.',
};

export default function ConnectPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <header className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">Connect with SlushFund</h1>
        <p className="text-slate-300 text-lg">
          We're not running an inbox anymore. Follow us where the conversation actually happens or
          subscribe to the newsletter if you want the cleanest signal.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-4 mb-12">
        <a
          href="https://www.tiktok.com/@slushfund"
          target="_blank"
          rel="noopener noreferrer"
          className="group p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-rose-400">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.77a8.16 8.16 0 004.77 1.52V6.85a4.85 4.85 0 01-1-.16z" />
            </svg>
            <span className="text-white font-bold text-xl">TikTok</span>
          </div>
          <p className="text-slate-400 text-sm mb-3">Short clips on the latest flagged contracts and trades.</p>
          <span className="text-rose-400 font-mono text-sm group-hover:underline">@slushfund</span>
        </a>

        <a
          href="https://www.reddit.com/r/slushfunddotnet"
          target="_blank"
          rel="noopener noreferrer"
          className="group p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-orange-500 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14.5 8.5c-.5-1-1.5-1.5-2.5-1.5-1 0-2 .5-2.5 1.5-.3.6-1 1-2 1s-1.7-.4-2-1c-.5-1-1.5-1.5-2.5-1.5-1 0-2 .5-2.5 1.5v1c0 5.5 4.5 10 10 10s10-4.5 10-10v-1c-.5-1-1.5-1.5-2.5-1.5s-2 .5-2.5 1.5c-.3.6-1 1-2 1s-1.7-.4-2-1z" fill="currentColor" />
            </svg>
            <span className="text-white font-bold text-xl">Reddit</span>
          </div>
          <p className="text-slate-400 text-sm mb-3">Discussion, tips, and deep-dive threads from the community.</p>
          <span className="text-orange-400 font-mono text-sm group-hover:underline">r/slushfunddotnet</span>
        </a>
      </section>

      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <NewsletterSignup
          source="connect"
          variant="stacked"
          heading="Subscribe to The Slush Report"
          blurb="A weekly summary of the most suspicious contracts and trades we surfaced. Free, no spam."
        />
      </section>
    </div>
  );
}
