'use client';
import { FecVerified } from '@/components/ui/FecVerified';
import type { PACDonation } from '@/lib/pac-data';
import { fmtM } from './format';

// ─── PAC Detail Modal ──────────────────────────────────────────────────────────
// Opens when a row in Pactable is clicked. Shows full breakdown for one PAC.
export default function PacDetailModal({ pac, onClose }: { pac: PACDonation; onClose: () => void }) {
  const connColors: Record<string, string> = {
    trump_ally: 'text-red-400 bg-red-950/40 border-red-800',
    republican: 'text-orange-400 bg-orange-950/40 border-orange-800',
    democrat: 'text-blue-400 bg-blue-950/40 border-blue-800',
    progressive: 'text-purple-400 bg-purple-950/40 border-purple-800',
    crypto: 'text-green-400 bg-green-950/40 border-green-800',
    defense: 'text-slate-400 bg-slate-900 border-slate-700',
    tech: 'text-cyan-400 bg-cyan-950/40 border-cyan-800',
    finance: 'text-teal-400 bg-teal-950/40 border-teal-800',
    koch: 'text-amber-400 bg-amber-950/40 border-amber-800',
    arabella: 'text-purple-400 bg-purple-950/40 border-purple-800',
    conservative: 'text-orange-400 bg-orange-950/40 border-orange-800',
    gop_dark_money: 'text-red-400 bg-red-950/40 border-red-800',
  };

  const typeColors: Record<string, string> = {
    super_pac: 'bg-red-900/40 text-red-400 border-red-800',
    pac: 'bg-blue-900/40 text-blue-400 border-blue-800',
    dark_money: 'bg-purple-900/40 text-purple-400 border-purple-800',
    leadership_pac: 'bg-orange-900/40 text-orange-400 border-orange-800',
    joint_fundraising: 'bg-slate-800 text-slate-400 border-slate-700',
    ' 501c4': 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-white font-black text-2xl">{pac.pac_name}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${typeColors[pac.type] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {pac.type.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${connColors[pac.connected_to] ?? 'text-slate-400 bg-slate-900 border-slate-700'}`}>
                {pac.connected_to.replace('_', ' ')}
              </span>
              <span className="text-slate-500 text-xs">Founded {pac.founding_year}</span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-500 text-xs">{pac.affiliated_entities.length} affiliates</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 border-b border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl px-4 py-3">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Raised (2016-24)</div>
              <div className="text-white font-black text-2xl font-mono">{fmtM(pac.total_raised_2016_2024)}</div>
            </div>
            <div className="bg-emerald-950/30 rounded-xl px-4 py-3 border border-emerald-900/50">
              <div className="text-emerald-400 text-xs uppercase tracking-widest mb-1">2024 Cycle</div>
              <div className="text-emerald-400 font-black text-2xl font-mono">{fmtM(pac.raised_2024_cycle)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl px-4 py-3">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Spent</div>
              <div className="text-white font-black text-2xl font-mono">{fmtM(pac.spending_2016_2024)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl px-4 py-3">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Political Ads</div>
              <div className="text-amber-400 font-black text-2xl font-mono">{fmtM(pac.political_ads_spent)}</div>
            </div>
          </div>
        </div>

        {pac.committee_id && (
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Official FEC Filings</h3>
            <FecVerified committeeId={pac.committee_id} />
          </div>
        )}

        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Primary Funders</h3>
          <div className="space-y-2">
            {pac.primary_funders.map((f, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-800/40 rounded-lg px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">{f.name}</span>
                    <span className="text-amber-400 text-xs font-mono font-bold">{f.amount_range}</span>
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">{f.connection}</div>
                </div>
              </div>
            ))}
          </div>
          {pac.funder_chain && (
            <div className="mt-3 rounded-lg bg-slate-800/40 border border-slate-700 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">How the money is routed</div>
              <p className="text-slate-400 text-xs leading-relaxed">{pac.funder_chain}</p>
            </div>
          )}
          {pac.source_urls && pac.source_urls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {pac.source_urls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                  Source {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Top Recipients</h3>
          <div className="space-y-2">
            {pac.top_recipients.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${r.party === 'R' ? 'bg-red-900/50 text-red-400' : r.party === 'D' ? 'bg-blue-900/50 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
                    {r.party}
                  </span>
                  <div>
                    <span className="text-white text-sm font-semibold">{r.name}</span>
                    <span className="text-slate-500 text-xs ml-2">{r.office.replace('_', ' ')}</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-mono font-bold">{fmtM(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Affiliated Entities</h3>
          <div className="flex flex-wrap gap-2">
            {pac.affiliated_entities.map((a, i) => (
              <span key={i} className="text-xs text-slate-300 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Trump Connection</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{pac.connection_to_trump}</p>
        </div>

        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Congress Connection</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{pac.connection_to_congress}</p>
        </div>

        {pac.oversight_targets.length > 0 && (
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">Oversight Targets</h3>
            <div className="flex flex-wrap gap-2">
              {pac.oversight_targets.map((t, i) => (
                <span key={i} className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/50 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Notes</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{pac.notes}</p>
        </div>
      </div>
    </div>
  );
}
