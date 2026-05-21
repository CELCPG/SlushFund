import Link from 'next/link';
import { ArrowLeft, Search, Home, BarChart3, Landmark, DollarSign } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Hero with big 404 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6">
          <span className="text-8xl font-black text-slate-800 select-none">404</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Page Not Found</h1>
        <p className="text-slate-400 text-lg max-w-md mb-8 leading-relaxed">
          That page does not exist. Either the URL is wrong or it was moved. Try searching for what you need below.
        </p>

        {/* Search suggestions */}
        <div className="w-full max-w-lg mb-10">
          <p className="text-slate-500 text-sm mb-3 uppercase tracking-wider font-medium">Popular pages</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/dashboard', icon: <BarChart3 size={16} />, label: 'Federal Spending', sub: '$17B in contracts' },
              { href: '/congress/trades', icon: <Landmark size={16} />, label: 'Congress Trades', sub: '926 live trades' },
              { href: '/pacs', icon: <DollarSign size={16} />, label: 'PAC Money', sub: 'Dark money networks' },
              { href: '/blog', icon: <Search size={16} />, label: 'Investigations', sub: '11 published articles' },
            ].map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-emerald-600/40 rounded-xl px-4 py-3 text-left transition-all"
              >
                <span className="text-emerald-400">{l.icon}</span>
                <div>
                  <div className="text-white font-medium text-sm">{l.label}</div>
                  <div className="text-slate-500 text-xs">{l.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Back to SlushFund Home
        </Link>
      </div>

      {/* Bottom note */}
      <div className="border-t border-slate-800 py-6 text-center">
        <p className="text-slate-600 text-xs">
          If you arrived here from a link,{' '}
          <a href="/contact" className="text-emerald-500 hover:underline">
            let us know
          </a>{' '}
          and we will look into it.
        </p>
      </div>
    </div>
  );
}