'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAC_DATABASE, type PACDonation } from '@/lib/pac-data';
import { ExportMenu } from '@/components/ui/ExportMenu';
import PacDetailModal from './PacDetailModal';
import { fmtM } from './format';

// ─── PAC Table ─────────────────────────────────────────────────────────────────
// Sortable, expandable table of all tracked PACs. Click a row to open detail modal.
export default function Pactable({ pacs }: { pacs: PACDonation[] }) {
  const [sortKey, setSortKey] = useState<'raised' | 'spent' | 'name'>('raised');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState(false);
  const [selectedPac, setSelectedPac] = useState<PACDonation | null>(null);

  const sorted = [...pacs].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'raised') cmp = b.total_raised_2016_2024 - a.total_raised_2016_2024;
    else if (sortKey === 'spent') cmp = b.spending_2016_2024 - a.spending_2016_2024;
    else cmp = a.pac_name.localeCompare(b.pac_name);
    return sortDir === 'asc' ? -cmp : cmp;
  });

  const visible = expanded ? sorted : sorted.slice(0, 18);

  const typeColors: Record<string, string> = {
    super_pac: 'bg-red-900/40 text-red-400',
    pac: 'bg-blue-900/40 text-blue-400',
    dark_money: 'bg-purple-900/40 text-purple-400',
    leadership_pac: 'bg-orange-900/40 text-orange-400',
    joint_fundraising: 'bg-slate-800 text-slate-400',
  };

  const connColors: Record<string, string> = {
    trump_ally: 'text-red-400',
    republican: 'text-orange-400',
    democrat: 'text-blue-400',
    progressive: 'text-purple-400',
    crypto: 'text-green-400',
    defense: 'text-slate-400',
    tech: 'text-cyan-400',
    finance: 'text-teal-400',
    koch: 'text-amber-400',
    arabella: 'text-purple-400',
    gop_dark_money: 'text-red-400',
    conservative: 'text-orange-400',
  };

  function toggleSort(key: 'raised' | 'spent') {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">All PACs Tracked — {PAC_DATABASE.length} PACs</h3>
          <p className="text-slate-500 text-xs mt-1">Click column headers to sort. Showing {visible.length} of {sorted.length}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSort('raised')}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded"
          >
            Sort by Raised {sortKey === 'raised' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button
            onClick={() => toggleSort('spent')}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded"
          >
            Sort by Spent {sortKey === 'spent' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
          </button>
          <ExportMenu rows={sorted} filename="slushfund-pacs" label="Export PACs" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="text-left px-5 py-3 text-slate-400 text-xs uppercase tracking-widest">PAC</th>
              <th className="text-right px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">Type</th>
              <th className="text-right px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">Raised (2016-24)</th>
              <th className="text-right px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">2024 Cycle</th>
              <th className="text-right px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">Spent</th>
              <th className="text-left px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">Connection</th>
              <th className="text-left px-3 py-3 text-slate-400 text-xs uppercase tracking-widest">Top Funders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((p, i) => (
              <tr key={i} className="hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => setSelectedPac(p)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{p.pac_name}</span>
                    {p.committee_id && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1 py-0.5">
                        FEC ✓
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs">{p.founding_year} · {p.affiliated_entities.length} affiliates</div>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${typeColors[p.type] ?? 'bg-slate-800 text-slate-400'}`}>
                    {p.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-white font-mono font-bold">{fmtM(p.total_raised_2016_2024)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-emerald-400 font-mono">{fmtM(p.raised_2024_cycle)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-slate-300 font-mono">{fmtM(p.spending_2016_2024)}</span>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-bold ${connColors[p.connected_to] ?? 'text-slate-400'}`}>
                    {p.connected_to.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs text-slate-400 max-w-48">
                    {p.primary_funders.slice(0, 2).map((f) => (
                      <div key={f.name} className="truncate">{f.name}</div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > 18 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1"
        >
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {sorted.length} PACs</>}
        </button>
      )}
      {selectedPac && <PacDetailModal pac={selectedPac} onClose={() => setSelectedPac(null)} />}
    </div>
  );
}
