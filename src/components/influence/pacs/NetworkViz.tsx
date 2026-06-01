'use client';
import { Network } from 'lucide-react';
import { PAC_NODES, PAC_EDGES } from '@/lib/pac-data';

// ─── PAC Money Flow Network Visualization ────────────────────────────────────
// SVG-based force-laid-out network of top 20 PACs by money raised.
// 208 lines — lazy-loaded via next/dynamic in PacsView.
export default function NetworkViz() {
  const nodes = [...PAC_NODES].sort((a, b) => b.raised - a.raised).slice(0, 20);
  const activeEdges = PAC_EDGES.filter(
    (e) => nodes.find((n) => n.abbr === e.source) && nodes.find((n) => n.abbr === e.target),
  );

  const groupColors: Record<string, string> = {
    trump_ally: '#ef4444',
    republican: '#f97316',
    democrat: '#3b82f6',
    progressive: '#a855f7',
    conservative: '#f97316',
    crypto: '#22c55e',
    defense: '#64748b',
    tech: '#3b82f6',
    finance: '#06b6d4',
    koch: '#f97316',
    arabella: '#a855f7',
    musk: '#a855f7',
    gop_dark_money: '#dc2626',
  };

  const zoneAssignments: Record<string, { col: number; row: number; group: string; fullName: string }> = {
    APAC: { col: 0, row: 0, group: 'trump', fullName: 'America PAC' },
    SVAM: { col: 0, row: 1, group: 'trump', fullName: 'SAVE America PAC' },
    'MAGA Inc': { col: 0, row: 2, group: 'trump', fullName: 'MAGA Inc' },
    'RNC JFC': { col: 1, row: 0, group: 'gop', fullName: 'RNC Joint Fundraising' },
    SLF: { col: 2, row: 1, group: 'gop', fullName: 'Senate Leadership Fund' },
    NRCC: { col: 3, row: 0, group: 'gop', fullName: 'NRCC' },
    NRSC: { col: 3, row: 1, group: 'gop', fullName: 'NRSC' },
    FP: { col: 0, row: 3, group: 'koch', fullName: 'Freedom Partners' },
    'AFP Action': { col: 1, row: 3, group: 'koch', fullName: 'Americans for Prosperity Action' },
    'One Nation': { col: 2, row: 3, group: 'koch', fullName: 'One Nation' },
    'CFG Action': { col: 3, row: 3, group: 'koch', fullName: 'Club for Growth Action' },
    CNP: { col: 3, row: 4, group: 'koch', fullName: 'CNP Action' },
    '16:30': { col: 5, row: 1, group: 'dem', fullName: 'Sixteen Thirty Fund' },
    SMP: { col: 5, row: 2, group: 'dem', fullName: 'Senate Majority PAC' },
    HMP: { col: 6, row: 2, group: 'dem', fullName: 'House Majority PAC' },
    PUSA: { col: 5, row: 3, group: 'dem', fullName: 'Priorities USA' },
    'DNC JFC': { col: 6, row: 0, group: 'dem', fullName: 'DNC Joint Fundraising' },
    Fairshake: { col: 4, row: 3, group: 'crypto', fullName: 'Fairshake PAC' },
    'a16z PAC': { col: 4, row: 4, group: 'crypto', fullName: 'a16z Political Action Committee' },
    'SW Crypto': { col: 4, row: 5, group: 'crypto', fullName: 'Stand With Crypto PAC' },
  };

  const COL_W = 120;
  const ROW_H = 80;
  const COL0 = 200;
  const ROW0 = 60;
  const SVG_W = COL0 + 7 * COL_W + 40;
  const SVG_H = ROW0 + 6 * ROW_H + 40;

  const positions: Record<string, { x: number; y: number; r: number; n: typeof nodes[0] }> = {};
  for (const n of nodes) {
    const z = zoneAssignments[n.abbr];
    if (!z) continue;
    const x = COL0 + z.col * COL_W + COL_W / 2;
    const y = ROW0 + z.row * ROW_H + ROW_H / 2;
    const r = Math.max(12, Math.min(28, n.size * 1.2));
    positions[n.abbr] = { x, y, r, n };
  }

  function getEdgeStyle(type: string) {
    if (type === 'funds') return { dash: '', color: '#ef4444', opacity: 0.7 };
    if (type === 'affiliated') return { dash: '6 3', color: '#3b82f6', opacity: 0.6 };
    if (type === 'joint_fundraising') return { dash: '8 4', color: '#f97316', opacity: 0.6 };
    return { dash: '4 2', color: '#64748b', opacity: 0.4 };
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-blue-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">
            PAC Money Flow Network — 2016 to 2024
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Arrows show direction of funds. Line thickness = amount.</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ minHeight: 420 }}>
          <defs>
            <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
            </marker>
            <marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
            </marker>
          </defs>

          <rect x={COL0} y={ROW0 - 4} width={4 * COL_W - 10} height={4 * ROW_H + 8} rx="4" fill="#7f1d1d" fillOpacity="0.08" />
          <rect x={COL0} y={ROW0 + 3 * ROW_H - 4} width={4 * COL_W - 10} height={2 * ROW_H + 8} rx="4" fill="#78350f" fillOpacity="0.08" />
          <rect x={COL0 + 3 * COL_W - 10} y={ROW0 - 4} width={3 * COL_W} height={ROW_H * 2 + 8} rx="4" fill="#1e3a5f" fillOpacity="0.08" />
          <rect x={COL0 + 5 * COL_W - 20} y={ROW0 - 4} width={2 * COL_W + 10} height={4 * ROW_H + 8} rx="4" fill="#4c1d95" fillOpacity="0.08" />
          <rect x={COL0 + 4 * COL_W - 10} y={ROW0 + 3 * ROW_H - 4} width={3 * COL_W} height={2 * ROW_H + 8} rx="4" fill="#14532d" fillOpacity="0.08" />

          <text x={COL0 + 30} y={ROW0 - 14} fontSize="9" fill="#ef4444" fontWeight="700" opacity="0.8">TRUMP / MAGA</text>
          <text x={COL0 + 30} y={ROW0 + 3 * ROW_H - 14} fontSize="9" fill="#f97316" fontWeight="700" opacity="0.8">KOCH NETWORK</text>
          <text x={COL0 + 5 * COL_W - 10} y={ROW0 - 14} fontSize="9" fill="#a855f7" fontWeight="700" opacity="0.8">DEM DARK MONEY</text>
          <text x={COL0 + 4 * COL_W - 5} y={ROW0 + 3 * ROW_H - 14} fontSize="9" fill="#22c55e" fontWeight="700" opacity="0.8">CRYPTO / CROSS-PARTY</text>
          <text x={COL0 + 3 * COL_W + 5} y={ROW0 - 14} fontSize="9" fill="#64748b" fontWeight="700" opacity="0.6">PARTY COMMITTEES</text>

          {activeEdges.map((e, i) => {
            const src = positions[e.source];
            const tgt = positions[e.target];
            if (!src || !tgt) return null;
            const { dash, color } = getEdgeStyle(e.type);
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2 - 8;
            const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
            const markerEnd =
              color === '#ef4444' ? 'url(#arrow-red)' : color === '#3b82f6' ? 'url(#arrow-blue)' : 'url(#arrow-orange)';
            return (
              <g key={i}>
                <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={color} strokeWidth={e.weight * 1.2} strokeOpacity={0.25} strokeDasharray={dash} />
                <line
                  x1={src.x} y1={src.y}
                  x2={tgt.x - Math.cos(angle) * (tgt.r + 4)}
                  y2={tgt.y - Math.sin(angle) * (tgt.r + 4)}
                  stroke={color} strokeWidth={e.weight * 0.7} strokeOpacity={0.6} strokeDasharray={dash} markerEnd={markerEnd}
                />
                <text x={mx} y={my} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontWeight="600">{e.label}</text>
              </g>
            );
          })}

          {Object.values(positions).map(({ x, y, r, n }) => {
            const gColor = groupColors[n.type] ?? '#64748b';
            return (
              <g key={n.abbr}>
                <circle cx={x} cy={y} r={r + 4} fill={gColor} fillOpacity="0.08" />
                <circle cx={x} cy={y} r={r} fill={gColor} fillOpacity="0.85" stroke={gColor} strokeWidth="2" />
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={r > 18 ? '11' : '9'} fontWeight="800" fill="white">
                  {n.abbr.length > 7 ? n.abbr.slice(0, 7) : n.abbr}
                </text>
                <text x={x} y={y + r + 13} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontWeight="500">
                  {n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-slate-400 text-xs">Trump / MAGA ecosystem</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-slate-400 text-xs">Koch / Conservative network</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-slate-400 text-xs">Dem dark money (Arabella)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-slate-400 text-xs">Crypto / cross-party</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500" /><span className="text-slate-400 text-xs">Party committees</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-red-500" /><span className="text-slate-400 text-xs">Funding flow (solid)</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 8px)' }} /><span className="text-slate-400 text-xs">Affiliation (dashed)</span></div>
      </div>
    </div>
  );
}
