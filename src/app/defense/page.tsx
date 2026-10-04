'use client';

import { useEffect } from 'react';
import { ExternalLink, Shield, ArrowRight } from 'lucide-react';

export default function DefenseRedirectPage() {
  // Auto-redirect after 3 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = 'https://corporatewarlords.com';
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-950/40 border border-red-900/50 mb-6">
          <Shield className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Defense contracts have moved
        </h1>

        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          Defense contractor deep-dives, sole-source awards, no-bid contracts and
          Pentagon spending intelligence now live on a dedicated site.
        </p>

        <a
          href="https://corporatewarlords.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-base transition-colors shadow-lg shadow-red-900/40"
        >
          <ExternalLink size={16} />
          Go to CorporateWarlords.com
          <ArrowRight size={16} />
        </a>

        <p className="text-slate-600 text-xs mt-6">
          Redirecting automatically in 3 seconds…
        </p>
      </div>
    </main>
  );
}
