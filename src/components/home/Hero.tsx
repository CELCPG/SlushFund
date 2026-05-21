import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';

/**
 * Landing hero. Keeps the SlushFund display wordmark and "Live Data" badge,
 * adds a one-line plain-language descriptor and two clear entry CTAs.
 * Visual interest is code-built: animated gradient glow + an SVG money-flow motif.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#15151f_0%,#0a0a0f_70%)]" />

      {/* Animated glow blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[var(--slush-red)]/20 blur-3xl animate-hero-glow" />
      <div
        className="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl animate-hero-glow"
        style={{ animationDelay: '3s' }}
      />

      {/* Money-flow SVG motif (decorative) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#3a3a4a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Red accent bar */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-56 bg-[var(--slush-red)] opacity-80" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-28">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--slush-red)] animate-pulse" />
          <span className="text-[var(--slush-red)] text-sm font-mono uppercase tracking-widest">
            Live Data · FY2024–FY2026
          </span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.95] mb-6 tracking-tight">
          <span className="display-heading">Slush</span>
          <br />
          <span className="text-[var(--slush-red)] display-heading">Fund</span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-200 max-w-3xl leading-relaxed font-medium">
          A public watchdog that follows the money. We track federal contracts, congressional
          stock trades, and crypto donations, and surface where your tax dollars and 401k
          quietly become someone&apos;s personal slush fund.
        </p>

        <div className="flex flex-wrap gap-3 mt-9">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-[var(--slush-red)] hover:bg-[var(--slush-red-dark)] text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            <Search size={16} /> Explore the Data
          </Link>
          <a
            href="#what-is-slushfund"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-3 rounded-lg text-sm transition-colors border border-slate-700"
          >
            How It Works <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
