import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Bitcoin, BarChart3, DollarSign, Users, Landmark, AlertTriangle, Clock, FileText, TrendingDown } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#111118_0%,#0a0a0f_70%)]" />
        {/* Red accent box */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-48 bg-[var(--slush-red)] opacity-80" />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--slush-red)] animate-pulse" />
            <span className="text-[var(--slush-red)] text-sm font-mono uppercase tracking-widest">Live Data · FY2024–FY2026</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-4 tracking-tight">
            <span className="display-heading">Slush</span><br />
            <span className="text-[var(--slush-red)] display-heading">Fund</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mt-4 leading-relaxed">
            Your Taxes and 401k are their Personal Slush Funds. Something has to Change!
          </p>
        </div>
      </section>

      {/* ─── THE LOOP ─── */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-white font-black text-3xl mb-6">The Loop</h2>
          <div className="space-y-3 text-slate-300 text-base leading-relaxed max-w-3xl">
            <p>A no-bid contract gets awarded. The politician on the committee overseeing that agency already owns the stock. The contract is announced. The stock jumps. The politician sells.</p>
            <p>The cash comes out of the 401ks and pension funds that bought before the announcement and are still holding after the exit.</p>
            <p>Weeks later, the company's PAC donates to the politician who controls that agency's budget. The same executives who won the no-bid contract fund the PAC. The politician gets re-elected on dark money. Same committee, same company, next contract cycle.</p>
            <p className="text-white font-semibold">Your taxes fund the contract. Your 401k funds their exit. Your retirement holds the bag.</p>
            <p>This isn't corruption slipping through the cracks. This is the system working exactly as designed.</p>
            <p className="text-amber-400 font-bold text-lg">Time to Break the Loop.</p>
          </div>
        </div>
      </section>

      {/* ─── THREE TRACK CARDS ─── */}
      <section className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid md:grid-cols-3 gap-4">

            {/* Track 1: Federal Spending */}
            <Link href="/dashboard" className="group block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-600/50 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-900/50 border border-emerald-700 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-white font-bold text-base">Federal Spending</div>
                  <div className="text-slate-500 text-xs">Contracts · Grants · No-Bid Awards</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Tracked', value: '$17.0B', color: 'text-white' },
                  { label: 'Politically Connected', value: '$14.8B', color: 'text-red-400' },
                  { label: 'Flagged Awards', value: '192', color: 'text-amber-400' },
                  { label: 'No-Bid Contracts', value: '$9.7B', color: 'text-orange-400' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className={`text-lg font-black font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-slate-500 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-1 text-emerald-400 text-sm font-medium group-hover:gap-2 transition-all">
                Open Dashboard <ArrowRight size={14} />
              </div>
            </Link>

            {/* Track 2: Congress Trading */}
            <div className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-600/50 transition-all flex flex-col">
              <Link href="/congress/trades" className="block">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-900/50 border border-blue-700 flex items-center justify-center shrink-0">
                    <Landmark size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-base">Congress Trading</div>
                    <div className="text-slate-500 text-xs">House · Senate · Presidential</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'Congress Trades', value: '926', color: 'text-white' },
                    { label: 'Members Tracked', value: '52', color: 'text-blue-400' },
                    { label: 'Trump Q1 2026', value: '$220M+', color: 'text-red-400' },
                    { label: 'Fed Contractor Overlap', value: '129', color: 'text-amber-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                      <div className={`text-lg font-black font-mono ${s.color}`}>{s.value}</div>
                      <div className="text-slate-500 text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-1 text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
                  View All Trades <ArrowRight size={14} />
                </div>
              </Link>
              <Link href="/analysis/companies" className="mt-1 flex items-center gap-1 text-amber-400 text-xs hover:text-amber-300 transition-colors">
                <Shield size={11} /> Company Conflict Analysis <ArrowRight size={11} />
              </Link>
            </div>

            {/* Track 3: Crypto + Government */}
            <Link href="/crypto" className="group block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-orange-600/50 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-orange-900/50 border border-orange-700 flex items-center justify-center shrink-0">
                  <Bitcoin size={18} className="text-orange-400" />
                </div>
                <div>
                  <div className="text-white font-bold text-base">Crypto & Government</div>
                  <div className="text-slate-500 text-xs">PAC Money · Mining · Holdings</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'PAC Donations', value: '$178M', color: 'text-orange-400' },
                  { label: 'Pro-Crypto Officials', value: '15', color: 'text-emerald-400' },
                  { label: 'BTC Mining Facilities', value: '8', color: 'text-blue-400' },
                  { label: 'Politicians Holding BTC', value: '21', color: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className={`text-lg font-black font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-slate-500 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-1 text-orange-400 text-sm font-medium group-hover:gap-2 transition-all">
                Open Crypto Deep Dive <ArrowRight size={14} />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── TRUMP OGE SPOTLIGHT ─── */}
      <section className="border-b border-slate-800 bg-gradient-to-br from-red-950/30 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded">PRESIDENTIAL · OGE FORM 278-T</span>
                <span className="text-xs text-slate-400">Filed May 12, 2026 · Covers Jan 6 – Mar 30, 2026</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Trump Q1 2026 Stock Trades</h2>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                3,711 disclosed transactions worth $220M–$750M. No blind trust. Trades intersect executive decisions on AI chip exports, federal contracting, and Treasury policy. The most consequential congressional trading disclosure in modern presidential history.
              </p>
              <div className="flex gap-4 mt-4">
                <Link href="/congress/trades/trump" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
                  View Trump Trades <ArrowRight size={15} />
                </Link>
                <Link href="/congress/trades" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors border border-slate-700">
                  All Congress Trades
                </Link>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: 'Total Trades', value: '3,711', sub: 'In filing' },
                { label: 'Purchases', value: '2,196', sub: '68% buy' },
                { label: 'Contractor Overlap', value: '66+', sub: 'Tracked in DB' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/70 border border-slate-700 rounded-lg px-4 py-3 text-center">
                  <div className="text-xl font-black font-mono text-white">{s.value}</div>
                  <div className="text-xs text-slate-400">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker highlight row */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { ticker: 'NVDA', note: '9 purchases, $1.8M–$6.6M each · Jensen Huang on Beijing delegation during export talks' },
              { ticker: 'ORCL', note: '11 purchases, $2.2M–$10.6M each · Larry Ellison donated $250K+ to inauguration' },
              { ticker: 'PLTR', note: '8 buys + 4 large sales · DHS contract awarded March 2026 concurrent with buying' },
              { ticker: 'AMD', note: '10 purchases · AMD chips subject to export controls set by this admin' },
              { ticker: 'MSFT', note: '9 purchases · Azure Government holds $0 in tracked DoD/NSA contracts' },
              { ticker: 'AMZN', note: '4 sales, $5M–$25M each · Amazon = $17.5B largest fed contractor in SlushFund' },
              { ticker: 'COIN', note: '6 purchases · Coinbase won US Marshals crypto custody under this admin' },
            ].map(t => (
              <Link key={t.ticker} href={`/congress/trades/trump?ticker=${t.ticker}`}
                className="bg-slate-800/70 border border-slate-700 hover:border-red-600/60 rounded-lg px-3 py-2 flex items-center gap-2 transition-colors">
                <span className="font-mono font-black text-white text-sm">{t.ticker}</span>
                <span className="text-slate-400 text-xs max-w-xs">{t.note}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DOGE SPOTLIGHT ─── */}
      <section className="border-b border-slate-800 bg-gradient-to-br from-red-950/20 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} className="text-red-400" />
                <span className="text-xs font-mono bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded uppercase">DOGE Special Report</span>
                <span className="text-xs text-slate-400">$130B claimed · $28B verified · May 2026</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">DOGE: The Real Score</h2>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                DOGE claims $130B in savings. Independent auditors verified $28B. The difference is methodology — DOGE counts projected future savings. We count what actually happened. Full breakdown: claimed vs. verified by agency, Musk conflicts of interest, and which contractors picked up $7.5B in post-DOGE work.
              </p>
              <div className="flex gap-4 mt-4">
                <Link href="/doge" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
                  See the Real Score <ArrowRight size={15} />
                </Link>
                <Link href="/doge#winners" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors border border-slate-700">
                  Who's Winning
                </Link>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: 'Claimed', value: '$130B', color: 'text-white' },
                { label: 'Verified', value: '$28B', color: 'text-emerald-400' },
                { label: 'Gap', value: '$102B', color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-black/40 border border-red-900/40 rounded-lg px-4 py-3 text-center">
                  <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE BLOCKS: FEDERAL SPENDING ─── */}
      <section className="max-w-7xl mx-auto px-6 py-14 border-b border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Federal Spending</h2>
          </div>
          <Link href="/dashboard" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
            Full Dashboard <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <Shield size={18} className="text-red-400" />,
              title: 'Political Connection Mapping',
              desc: 'Every contract cross-referenced against Trump family, Elon Musk companies, and known allies. Real-time flagging.',
            },
            {
              icon: <AlertTriangle size={18} className="text-amber-400" />,
              title: 'No-Bid Award Detection',
              desc: 'Sole-source awards and price-inflated contracts flagged automatically. Market-rate comparisons included.',
            },
            {
              icon: <TrendingUp size={18} className="text-blue-400" />,
              title: 'DOGE Spending Analysis',
              desc: 'DOGE claims $130B in savings. Independent auditors verified $28B. Full breakdown at slushfund.net/doge.',
            },
          ].map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <h3 className="text-white font-bold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-4 gap-3 mt-4">
          {[
            { href: '/defense', label: 'Defense Contracts', sub: 'DOD spending' },
            { href: '/tech', label: 'Tech & AI Contracts', sub: 'AI infrastructure' },
            { href: '/dashboard', label: 'All Spending', sub: 'Full database' },
            { href: '/analysis', label: 'Analysis', sub: 'Deep dives' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="bg-slate-900/60 border border-slate-800 hover:border-emerald-700/50 rounded-lg px-4 py-2.5 text-sm transition-colors">
              <div className="text-white font-medium">{l.label}</div>
              <div className="text-slate-500 text-xs">{l.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── FEATURE BLOCKS: CONGRESS TRADING ─── */}
      <section className="max-w-7xl mx-auto px-6 py-14 border-b border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Landmark size={18} className="text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Congress Trading</h2>
          </div>
          <Link href="/congress/trades" className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
            View All Trades <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <FileText size={18} className="text-blue-400" />,
              title: 'Congress Members Tracked',
              desc: '52 House and Senate members. Trades sourced from Quiver Quantitative OGE disclosures. Updated weekly via cron.',
            },
            {
              icon: <Clock size={18} className="text-amber-400" />,
              title: 'Federal Contractor Overlap',
              desc: '129 trades flagged where the purchased stock is held by a company with federal contracts in the SlushFund database.',
            },
            {
              icon: <DollarSign size={18} className="text-emerald-400" />,
              title: 'Top Traders by Volume',
              desc: 'Leaderboard of congress members by total trade volume. David H. McCormick (GS $1M–$5M), Josh Gottheimer, Kevin Hern.',
            },
          ].map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <h3 className="text-white font-bold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-4 gap-3 mt-4">
          {[
            { href: '/congress/trades?chamber=senate', label: 'Senate Trades', sub: '474 trades' },
            { href: '/congress/trades?chamber=house', label: 'House Trades', sub: '452 trades' },
            { href: '/congress/trades?has_contract=true', label: 'Contractor Overlap', sub: '129 trades' },
            { href: '/congress/trades/trump', label: 'Trump OGE 278-T', sub: '$220M–$750M' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="bg-slate-900/60 border border-slate-800 hover:border-blue-700/50 rounded-lg px-4 py-2.5 text-sm transition-colors">
              <div className="text-white font-medium">{l.label}</div>
              <div className="text-slate-500 text-xs">{l.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── FEATURE BLOCKS: CRYPTO ─── */}
      <section className="max-w-7xl mx-auto px-6 py-14 border-b border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bitcoin size={18} className="text-orange-400" />
            <h2 className="text-2xl font-bold text-white">Crypto & Government</h2>
          </div>
          <Link href="/crypto" className="text-sm text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1">
            Full Crypto Deep Dive <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <Users size={18} className="text-emerald-400" />,
              title: 'Politician Crypto Holdings',
              desc: 'Self-disclosed Bitcoin and Ethereum holdings. Trump, Lummis, Lee, and 18 others who\'ve reported crypto on their financial disclosures.',
            },
            {
              icon: <DollarSign size={18} className="text-orange-400" />,
              title: 'Crypto PAC Donations',
              desc: '$178M in 2024 cycle. Fairshake ($78M), a16z ($45M), Stand With Crypto ($24M). Bipartisan donations mapped to policy wins.',
            },
            {
              icon: <Shield size={18} className="text-purple-400" />,
              title: 'Regulatory Capture',
              desc: 'How crypto donations translate to FIT21 Act passage, SEC enforcement halts, and the BITCOIN Act. The money-to-power pipeline.',
            },
          ].map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <h3 className="text-white font-bold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-4 gap-3 mt-4">
          {[
            { href: '/influence?tab=pacs', label: 'PAC Donations', sub: '$178M tracked' },
            { href: '/influence?tab=crypto', label: 'BTC Mining', sub: '8 facilities' },
            { href: '/influence?tab=crypto', label: 'Congress Holdings', sub: '21 members' },
            { href: '/influence?tab=network', label: 'Money Flow', sub: 'Full analysis' },
          ].map(l => (
            <Link key={l.label} href={l.href} className="bg-slate-900/60 border border-slate-800 hover:border-orange-700/50 rounded-lg px-4 py-2.5 text-sm transition-colors">
              <div className="text-white font-medium">{l.label}</div>
              <div className="text-slate-500 text-xs">{l.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── THE CONNECTION ─── */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-r from-red-950/50 via-slate-900 to-orange-950/50 border border-red-800/40 rounded-xl p-8">
          <h3 className="text-white font-bold text-xl mb-3">How the Three Databases Connect</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Musk + DOGE + Crypto:</strong> Elon Musk co-leads DOGE (cutting federal spending) while Tesla holds $1B+ in Bitcoin, SpaceX accepts Dogecoin, and Tesla accepts Dogecoin for payments.
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Crypto PAC + Congress + Contracts:</strong> $178M in crypto PAC donations flows to the same politicians who vote on Musk's federal contracts — and on crypto regulation.
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Trump Trading + Federal Contractors:</strong> Trump's OGE filing shows 66+ trades in companies that hold federal contracts. The President is both regulator and investor.
              </div>
            </div>
          </div>
          <Link href="/analysis" className="inline-flex items-center gap-2 mt-5 text-red-400 hover:text-red-300 font-medium text-sm">
            See the Full Analysis · Money Flow Map → <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            SlushFund · Three databases tracking political money flows · <Link href="/contact" className="text-emerald-500 hover:text-emerald-400 transition-colors">Contact</Link>
          </p>
          <div className="flex gap-4 text-slate-600 text-xs font-mono">
            <span>USAspending.gov</span>
            <span>OGE.gov</span>
            <span>FEC.gov</span>
            <span>OpenSecrets.org</span>
            <span>QuiverQuant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
