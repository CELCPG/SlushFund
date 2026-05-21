'use client';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left: Logo + tagline */}
          <div className="flex items-center gap-3">
            <img src="/slushfund-logo.png" alt="SlushFund" className="h-7 w-auto object-contain opacity-70" />
            <span className="text-slate-500 text-sm">Tracking the money.</span>
          </div>

          {/* Center: Nav links */}
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link href="/explain" className="hover:text-white transition-colors">How It Works</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Spending</Link>
            <Link href="/congress/trades" className="hover:text-white transition-colors">Congress Trades</Link>
            <Link href="/pacs" className="hover:text-white transition-colors">PAC Money</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Investigations</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>

          {/* Right: Social */}
          <div className="flex items-center gap-4">
            <a
              href="https://reddit.com/r/slushfunddotnet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M14.5 8.5c-.5-1-1.5-1.5-2.5-1.5-1 0-2 .5-2.5 1.5-.3.6-1 1-2 1s-1.7-.4-2-1c-.5-1-1.5-1.5-2.5-1.5-1 0-2 .5-2.5 1.5v1c0 5.5 4.5 10 10 10s10-4.5 10-10v-1c-.5-1-1.5-1.5-2.5-1.5s-2 .5-2.5 1.5c-.3.6-1 1-2 1s-1.7-.4-2-1z" fill="currentColor"/>
              </svg>
              r/slushfunddotnet
            </a>
            <a
              href="https://tiktok.com/@slushfund"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.77a8.16 8.16 0 004.77 1.52V6.85a4.85 4.85 0 01-1-.16z"/>
              </svg>
              @slushfund
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <span className="text-slate-600 text-xs">All data from public filings. STOCK Act, FEC, USAspending.gov.</span>
          <span className="text-slate-600 text-xs">SlushFund.net {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}