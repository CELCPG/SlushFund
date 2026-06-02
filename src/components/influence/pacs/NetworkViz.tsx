'use client';
import { Network } from 'lucide-react';
import { PAC_NODES, PAC_EDGES } from '@/lib/pac-data';

// ─── PAC Money Flow Network ────────────────────────────────────────────────────
// Grid-based network diagram. Each PAC sits in a fixed cell of a 7-column grid;
// edge labels route around the grid lines so they don't crash into nodes.

export default function NetworkViz() {
  const nodes = [...PAC_NODES].sort((a, b) => b.raised - a.raised).slice(0, 20);

  // Color by the underlying connected_to/type field. The original
  // PACNode.type can be any of trump_ally, republican, conservative, koch,
  // democrat, progressive, bipartisan, crypto, defense, tech, finance, trump.
  const groupColors: Record<string, string> = {
    trump_ally: '#ef4444',
    trump: '#ef4444',
    republican: '#f97316',
    conservative: '#f97316',
    koch: '#f97316',
    democrat: '#3b82f6',
    progressive: '#a855f7',
    bipartisan: '#64748b',
    crypto: '#22c55e',
    defense: '#64748b',
    tech: '#3b82f6',
    finance: '#06b6d4',
    party: '#64748b',
  };

  // Grid: 7 columns × 6 rows. Each cell holds one node, sized to its
  // dollar total. Zones are 2x2 or 1x2 blocks of cells in the corners.
  //   . . RNC APAC . .   .
  //   . SLF  .   SVAM .  .
  //   . NRCC . MAGA DNC .
  //   FP CFG NRSC SMP 16:30 PUSA  .
  //   . AFP OneNation  .  HMP Fairshake a16z
  //   . . CNP  .   .   .   .   SW Crypto
  // Position for each real top-20 PAC (extracted from PAC_DATABASE).
  // 6-column grid × 6 rows. Largest PACs in the upper-left for visual weight.
  const zoneAssignments: Record<
    string,
    { col: number; row: number; group: string; fullName: string; zone: string }
  > = {
    // Row 0: the two biggest fundraisers (party committees)
    'RNC JFC':   { col: 0, row: 0, group: 'republican', fullName: 'RNC Joint Fundraising',     zone: 'party'  },
    'DNC JFC':   { col: 5, row: 0, group: 'dem',        fullName: 'DNC Joint Fundraising',     zone: 'party'  },
    // Row 1: Senate/House leadership + dark money
    SLF:         { col: 1, row: 1, group: 'republican', fullName: 'Senate Leadership Fund',    zone: 'gop'    },
    SMP:         { col: 4, row: 1, group: 'dem',        fullName: 'Senate Majority PAC',       zone: 'dem'    },
    HMP:         { col: 4, row: 2, group: 'dem',        fullName: 'House Majority PAC',        zone: 'dem'    },
    '16:30':     { col: 3, row: 1, group: 'dem',        fullName: 'Sixteen Thirty Fund',       zone: 'dem'    },
    PUSA:        { col: 3, row: 2, group: 'dem',        fullName: 'Priorities USA',            zone: 'dem'    },
    // Row 2: Koch / Trump / AIPAC
    'AFP Action':{ col: 0, row: 2, group: 'koch',       fullName: 'Americans for Prosperity',  zone: 'koch'   },
    FP:          { col: 1, row: 2, group: 'koch',       fullName: 'Freedom Partners',          zone: 'koch'   },
    'MAGA Inc':  { col: 2, row: 2, group: 'trump_ally', fullName: 'MAGA Inc',                  zone: 'trump'  },
    'AIPAC PAC': { col: 3, row: 3, group: 'bipartisan', fullName: 'AIPAC PAC',                 zone: 'bipartisan' },
    APAC:        { col: 2, row: 1, group: 'trump_ally', fullName: 'America PAC (Musk)',        zone: 'trump'  },
    SVAM:        { col: 2, row: 3, group: 'trump_ally', fullName: 'SAVE America PAC',          zone: 'trump'  },
    // Row 3: AIPAC arm, Trump-related
    UDP:         { col: 4, row: 3, group: 'bipartisan', fullName: 'United Democracy Project',  zone: 'bipartisan' },
    // Row 4: smaller PACs
    Fairshake:   { col: 5, row: 2, group: 'crypto',     fullName: 'Fairshake PAC',             zone: 'crypto' },
    'Amazon PAC':{ col: 5, row: 3, group: 'tech',       fullName: 'Amazon PAC',                zone: 'tech'   },
    'Alphabet PAC':{ col: 5, row: 4, group: 'tech',     fullName: 'Alphabet PAC',              zone: 'tech'   },
    'MSFT PAC':  { col: 4, row: 4, group: 'tech',       fullName: 'Microsoft PAC',             zone: 'tech'   },
    'Meta PAC':  { col: 3, row: 4, group: 'tech',       fullName: 'Meta PAC',                  zone: 'tech'   },
    'LM PAC':    { col: 0, row: 4, group: 'defense',    fullName: 'Lockheed Martin PAC',       zone: 'defense'},
  };

  // Zone background rectangles. The right-wing side (Koch/Trump/GOP) is
  // on the left of the grid; Dem/tech/crypto is on the right; AIPAC
  // straddles the middle.
  const ZONES: Array<{
    name: string;
    label: string;
    color: string;
    col0: number; col1: number;
    row0: number; row1: number;
  }> = [
    { name: 'party',      label: 'PARTY COMMITTEES',    color: '#64748b', col0: 0, col1: 5, row0: 0, row1: 1 },
    { name: 'gop',        label: 'GOP ESTABLISHMENT',   color: '#f97316', col0: 0, col1: 2, row0: 0, row1: 3 },
    { name: 'trump',      label: 'TRUMP / MAGA',        color: '#ef4444', col0: 2, col1: 3, row0: 1, row1: 4 },
    { name: 'koch',       label: 'KOCH NETWORK',        color: '#f97316', col0: 0, col1: 2, row0: 1, row1: 4 },
    { name: 'bipartisan', label: 'AIPAC / BIPARTISAN',  color: '#a855f7', col0: 2, col1: 5, row0: 2, row1: 4 },
    { name: 'dem',        label: 'DEM / DARK MONEY',    color: '#3b82f6', col0: 3, col1: 5, row0: 0, row1: 3 },
    { name: 'crypto',     label: 'CRYPTO',              color: '#22c55e', col0: 5, col1: 6, row0: 1, row1: 3 },
    { name: 'tech',       label: 'TECH / BIG TECH',     color: '#3b82f6', col0: 3, col1: 6, row0: 3, row1: 5 },
    { name: 'defense',    label: 'DEFENSE',             color: '#64748b', col0: 0, col1: 1, row0: 4, row1: 5 },
  ];

  const COL_W = 130;
  const ROW_H = 90;
  const PAD_X = 30;
  const PAD_Y = 50;
  const GRID_COLS = 6;
  const GRID_ROWS = 6;
  const SVG_W = PAD_X * 2 + GRID_COLS * COL_W;
  const SVG_H = PAD_Y * 2 + GRID_ROWS * ROW_H;

  const positions: Record<string, { x: number; y: number; r: number; n: typeof nodes[0] }> = {};
  for (const n of nodes) {
    const z = zoneAssignments[n.abbr];
    if (!z) continue;
    const x = PAD_X + z.col * COL_W + COL_W / 2;
    const y = PAD_Y + z.row * ROW_H + ROW_H / 2;
    const r = Math.max(14, Math.min(28, 12 + Math.log10(Math.max(1, n.raised)) * 4));
    positions[n.abbr] = { x, y, r, n };
  }

  const activeEdges = PAC_EDGES.filter(
    (e) => positions[e.source] && positions[e.target],
  );

  function getEdgeStyle(type: string) {
    if (type === 'funds') return { dash: '', color: '#ef4444', opacity: 0.6 };
    if (type === 'affiliated') return { dash: '6 3', color: '#3b82f6', opacity: 0.5 };
    if (type === 'joint_fundraising') return { dash: '8 4', color: '#f97316', opacity: 0.5 };
    return { dash: '4 2', color: '#64748b', opacity: 0.4 };
  }

  // Edge label placement strategy: instead of a small perpendicular offset
  // (which can land a label right on top of a node sublabel in the same
  // column/row), we move labels well off the line. The label is placed
  // at the midpoint, then pushed:
  //   - Horizontally by `perpX * off` (perpendicular to edge)
  //   - Vertically along the edge by `along` (to dodge sibling edges)
  //   - With `stagger` index to space multiple labels from the same source.
  function labelOffset(
    src: { x: number; y: number; r: number },
    tgt: { x: number; y: number; r: number },
    stagger: number = 0,
  ) {
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    // Distance from the line so the label sits clear of both node circles.
    const off = Math.max(src.r, tgt.r) + 18;
    return { perpX: perpX * off, perpY: perpY * off };
  }

  // Group edges by source so we can stagger labels for star patterns
  const edgesBySource: Record<string, number> = {};
  for (const e of activeEdges) {
    edgesBySource[e.source] = (edgesBySource[e.source] ?? 0) + 1;
  }
  const edgeIndexBySource: Record<string, number> = {};
  const edgeIndexByTarget: Record<string, number> = {};
  for (const e of activeEdges) {
    edgeIndexBySource[e.source] = (edgeIndexBySource[e.source] ?? -1) + 1;
    edgeIndexByTarget[e.target] = (edgeIndexByTarget[e.target] ?? -1) + 1;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-blue-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">
            PAC Money Flow Network, 2016 to 2024
          </h3>
        </div>
        <span className="text-slate-500 text-xs">Arrows show direction of funds</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="md:hidden text-xs text-slate-500 px-3 pt-2 flex items-center gap-1.5">
          <span>← Scroll horizontally for full network →</span>
        </div>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block md:!w-full"
          style={{ minHeight: 540, width: SVG_W, maxWidth: 'none', height: 'auto' }}
        >
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
            <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Zone background rectangles */}
          {ZONES.map((zone) => {
            const x = PAD_X + zone.col0 * COL_W;
            const y = PAD_Y + zone.row0 * ROW_H;
            const w = (zone.col1 - zone.col0 + 1) * COL_W;
            const h = (zone.row1 - zone.row0 + 1) * ROW_H;
            return (
              <g key={zone.name}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={6}
                  fill={zone.color}
                  fillOpacity={0.05}
                  stroke={zone.color}
                  strokeOpacity={0.15}
                  strokeWidth={1}
                />
                <text
                  x={x + 8}
                  y={y + 14}
                  fontSize="9"
                  fill={zone.color}
                  fontWeight="700"
                  opacity="0.8"
                >
                  {zone.label}
                </text>
              </g>
            );
          })}

          {/* Edges — drawn first so nodes render on top */}
          {activeEdges.map((e, i) => {
            const src = positions[e.source];
            const tgt = positions[e.target];
            if (!src || !tgt) return null;
            const { dash, color } = getEdgeStyle(e.type);
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;
            // Stagger labels so they don't collide when a node has multiple
            // incoming or outgoing edges.
            const srcStagger = (edgeIndexBySource[e.source] ?? 0) * 5;
            const tgtStagger = (edgeIndexByTarget[e.target] ?? 0) * 5;
            const stagger = (srcStagger + tgtStagger) % 30;
            const { perpX, perpY } = labelOffset(src, tgt, stagger);
            const lx = mx + perpX;
            const ly = my + perpY;
            const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
            const markerEnd =
              color === '#ef4444' ? 'url(#arrow-red)'
              : color === '#3b82f6' ? 'url(#arrow-blue)'
              : color === '#f97316' ? 'url(#arrow-orange)'
              : 'url(#arrow-gray)';
            return (
              <g key={i}>
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x - Math.cos(angle) * (tgt.r + 4)}
                  y2={tgt.y - Math.sin(angle) * (tgt.r + 4)}
                  stroke={color}
                  strokeWidth={Math.max(1, e.weight * 0.7)}
                  strokeOpacity={0.5}
                  strokeDasharray={dash}
                  markerEnd={markerEnd}
                />
                {e.label && (
                  <g>
                    <rect
                      x={lx - e.label.length * 2.8}
                      y={ly - 7}
                      width={e.label.length * 5.6}
                      height={12}
                      fill="#0f172a"
                      fillOpacity="0.92"
                      stroke="#1e293b"
                      strokeWidth="0.5"
                      rx={2}
                    />
                    <text
                      x={lx}
                      y={ly + 2}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#e2e8f0"
                      fontWeight="500"
                    >
                      {e.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes — drawn last so they're on top of edges */}
          {Object.values(positions).map(({ x, y, r, n }) => {
            const gColor = groupColors[n.type] ?? '#64748b';
            const abbrText = n.abbr.length > 7 ? n.abbr.slice(0, 7) : n.abbr;
            // Smart truncation: cut at last word boundary before 18 chars
            const fullName = n.name ?? '';
            let subText = fullName;
            if (fullName.length > 18) {
              const cut = fullName.slice(0, 18);
              const lastSpace = cut.lastIndexOf(' ');
              subText = (lastSpace > 6 ? cut.slice(0, lastSpace) : cut) + '…';
            }
            return (
              <g key={n.abbr}>
                <circle cx={x} cy={y} r={r + 4} fill={gColor} fillOpacity="0.10" />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={gColor}
                  fillOpacity="0.85"
                  stroke={gColor}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r > 18 ? '11' : '9'}
                  fontWeight="800"
                  fill="white"
                >
                  {abbrText}
                </text>
                <text
                  x={x}
                  y={y + r + 12}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {subText.length > 18 ? subText.slice(0, 17) + '…' : subText}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-400 text-xs">Trump / MAGA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-slate-400 text-xs">GOP / Koch</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-400 text-xs">Dem dark money</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-slate-400 text-xs">Crypto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-500" />
          <span className="text-slate-400 text-xs">Party committees</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-red-500" />
          <span className="text-slate-400 text-xs">Funds</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{ background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 8px)' }}
          />
          <span className="text-slate-400 text-xs">Affiliated</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{ background: 'repeating-linear-gradient(90deg, #f97316 0, #f97316 6px, transparent 6px, transparent 10px)' }}
          />
          <span className="text-slate-400 text-xs">Joint fundraising</span>
        </div>
      </div>
    </div>
  );
}
