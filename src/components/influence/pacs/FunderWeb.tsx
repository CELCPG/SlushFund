import { fmtM } from './format';

// ─── Funder Web ──────────────────────────────────────────────────────────────
// Top individual / corporate funders and which PACs they funded.
export default function FunderWeb() {
  const topFunders = [
    { name: 'Elon Musk', pac: 'America PAC', amount: 250_000_000, color: '#a855f7' },
    { name: 'Miriam Adelson', pac: 'America PAC', amount: 100_000_000, color: '#a855f7' },
    { name: 'Koch Industries', pac: 'AFP Action', amount: 200_000_000, color: '#f97316' },
    { name: 'George Soros / OSI', pac: 'Sixteen Thirty Fund', amount: 150_000_000, color: '#3b82f6' },
    { name: 'Tom Steyer', pac: 'Sixteen Thirty Fund', amount: 120_000_000, color: '#a855f6' },
    { name: 'Coinbase', pac: 'Fairshake PAC', amount: 50_000_000, color: '#22c55e' },
    { name: 'Andreessen Horowitz', pac: 'a16z PAC', amount: 40_000_000, color: '#3b82f6' },
    { name: 'Jeff Bezos', pac: 'Amazon PAC', amount: 15_000_000, color: '#f97316' },
    { name: 'Mark Zuckerberg', pac: 'Meta PAC', amount: 8_000_000, color: '#3b82f6' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Top Individual / Corporate Funders</h3>
      <p className="text-slate-500 text-xs mb-4">The people and companies behind the PACs, 2016–2024 total contributions</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {topFunders.map((f) => (
          <div key={f.name} className="bg-slate-800/50 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: f.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">{f.name}</div>
              <div className="text-slate-500 text-xs">{f.pac}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-amber-400 font-black font-mono">{fmtM(f.amount)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
