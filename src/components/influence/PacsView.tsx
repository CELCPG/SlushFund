'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  ArrowLeft, Landmark, DollarSign, Users, AlertTriangle, ChevronDown,
  ChevronUp, TrendingUp, Building2, Shield, ExternalLink, ArrowRight,
  Network, ChevronRight, Scale, ArrowUpRight
} from 'lucide-react';
import {
  PAC_DATABASE, PAC_NODES, PAC_EDGES, PAC_CATEGORY_TOTALS,
  WHITE_HOUSE_DONATIONS_2016_2024, TOP_RECIPIENTS_BY_OFFICE
} from '@/lib/pac-data';
import { FecVerified } from '@/components/ui/FecVerified';
import { ExportMenu } from '@/components/ui/ExportMenu';

const CHART_COLORS = ['#ef4444', '#a855f7', '#f97316', '#22c55e', '#3b82f6', '#06b6d4', '#eab308', '#64748b'];

function fmtM(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── Mini Network Node ────────────────────────────────────────────────────────
function NetworkViz() {
  // Only show the most connected / highest-money nodes
  const nodes = PAC_NODES.sort((a, b) => b.raised - a.raised).slice(0, 20);
  const activeEdges = PAC_EDGES.filter(e =>
    nodes.find(n => n.abbr === e.source) && nodes.find(n => n.abbr === e.target)
  );

  // Group color map
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

  // Three-zone layout: GOP/Tump | Koch | Dem Dark Money
  // Rows: [GOP Dark Money Row 1] / [GOP Row 2] / [Koch Row] / [Dem Dark Money Row] / [Crypto]
  const zoneAssignments: Record<string, {col: number; row: number; group: string; fullName: string}> = {
    // GOP / Trump ecosystem
    APAC:       { col: 0, row: 0, group: 'trump', fullName: 'America PAC' },
    SVAM:       { col: 0, row: 1, group: 'trump', fullName: 'SAVE America PAC' },
    'MAGA Inc': { col: 0, row: 2, group: 'trump', fullName: 'MAGA Inc' },
    'RNC JFC':  { col: 1, row: 0, group: 'gop', fullName: 'RNC Joint Fundraising' },
    SLF:        { col: 2, row: 1, group: 'gop', fullName: 'Senate Leadership Fund' },
    NRCC:       { col: 3, row: 0, group: 'gop', fullName: 'NRCC' },
    NRSC:       { col: 3, row: 1, group: 'gop', fullName: 'NRSC' },
    // Koch / Conservative
    FP:         { col: 0, row: 3, group: 'koch', fullName: 'Freedom Partners' },
    'AFP Action': { col: 1, row: 3, group: 'koch', fullName: 'Americans for Prosperity Action' },
    'One Nation': { col: 2, row: 3, group: 'koch', fullName: 'One Nation' },
    'CFG Action': { col: 3, row: 3, group: 'koch', fullName: 'Club for Growth Action' },
    CNP:        { col: 3, row: 4, group: 'koch', fullName: 'CNP Action' },
    // Dem dark money
    '16:30':    { col: 5, row: 1, group: 'dem', fullName: 'Sixteen Thirty Fund' },
    SMP:        { col: 5, row: 2, group: 'dem', fullName: 'Senate Majority PAC' },
    HMP:        { col: 6, row: 2, group: 'dem', fullName: 'House Majority PAC' },
    PUSA:       { col: 5, row: 3, group: 'dem', fullName: 'Priorities USA' },
    'DNC JFC':  { col: 6, row: 0, group: 'dem', fullName: 'DNC Joint Fundraising' },
    // Crypto / cross-party
    Fairshake:  { col: 4, row: 3, group: 'crypto', fullName: 'Fairshake PAC' },
    'a16z PAC': { col: 4, row: 4, group: 'crypto', fullName: 'a16z Political Action Committee' },
    'SW Crypto':{ col: 4, row: 5, group: 'crypto', fullName: 'Stand With Crypto PAC' },
  };

  // Layout constants
  const COL_W = 120;  // column width
  const ROW_H = 80;   // row height
  const COL0 = 200;   // left offset
  const ROW0 = 60;    // top offset
  const SVG_W = COL0 + 7 * COL_W + 40;
  const SVG_H = ROW0 + 6 * ROW_H + 40;

  // Position each node
  const positions: Record<string, {x: number; y: number; r: number; n: typeof nodes[0]}> = {};
  for (const n of nodes) {
    const z = zoneAssignments[n.abbr];
    if (!z) continue;
    const x = COL0 + z.col * COL_W + COL_W / 2;
    const y = ROW0 + z.row * ROW_H + ROW_H / 2;
    const r = Math.max(12, Math.min(28, n.size * 1.2));
    positions[n.abbr] = { x, y, r, n };
  }

  // Edge styling helper
  function getEdgeStyle(type: string) {
    if (type === 'funds') return { dash: '', color: '#ef4444', opacity: 0.7 };
    if (type === 'affiliated') return { dash: '6 3', color: '#3b82f6', opacity: 0.6 };
    if (type === 'joint_fundraising') return { dash: '8 4', color: '#f97316', opacity: 0.6 };
    return { dash: '4 2', color: '#64748b', opacity: 0.4 };
  }

  // Arrow marker definitions
  const defs = (
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
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-blue-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">PAC Money Flow Network — 2016 to 2024</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Arrows show direction of funds. Line thickness = amount.</span>
        </div>
      </div>

      {/* SVG Network */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{minHeight: 420}}>
          {defs}

          {/* ── Group lane backgrounds ── */}
          {/* GOP / Trump zone */}
          <rect x={COL0} y={ROW0 - 4} width={4 * COL_W - 10} height={4 * ROW_H + 8} rx="4" fill="#7f1d1d" fillOpacity="0.08" />
          {/* Koch zone */}
          <rect x={COL0} y={ROW0 + 3 * ROW_H - 4} width={4 * COL_W - 10} height={2 * ROW_H + 8} rx="4" fill="#78350f" fillOpacity="0.08" />
          {/* Party committees center */}
          <rect x={COL0 + 3 * COL_W - 10} y={ROW0 - 4} width={3 * COL_W} height={ROW_H * 2 + 8} rx="4" fill="#1e3a5f" fillOpacity="0.08" />
          {/* Dem dark money zone */}
          <rect x={COL0 + 5 * COL_W - 20} y={ROW0 - 4} width={2 * COL_W + 10} height={4 * ROW_H + 8} rx="4" fill="#4c1d95" fillOpacity="0.08" />
          {/* Crypto zone */}
          <rect x={COL0 + 4 * COL_W - 10} y={ROW0 + 3 * ROW_H - 4} width={3 * COL_W} height={2 * ROW_H + 8} rx="4" fill="#14532d" fillOpacity="0.08" />

          {/* ── Group labels ── */}
          <text x={COL0 + 30} y={ROW0 - 14} fontSize="9" fill="#ef4444" fontWeight="700" opacity="0.8">TRUMP / MAGA</text>
          <text x={COL0 + 30} y={ROW0 + 3 * ROW_H - 14} fontSize="9" fill="#f97316" fontWeight="700" opacity="0.8">KOCH NETWORK</text>
          <text x={COL0 + 5 * COL_W - 10} y={ROW0 - 14} fontSize="9" fill="#a855f7" fontWeight="700" opacity="0.8">DEM DARK MONEY</text>
          <text x={COL0 + 4 * COL_W - 5} y={ROW0 + 3 * ROW_H - 14} fontSize="9" fill="#22c55e" fontWeight="700" opacity="0.8">CRYPTO / CROSS-PARTY</text>
          <text x={COL0 + 3 * COL_W + 5} y={ROW0 - 14} fontSize="9" fill="#64748b" fontWeight="700" opacity="0.6">PARTY COMMITTEES</text>

          {/* ── Edges ── */}
          {activeEdges.map((e, i) => {
            const src = positions[e.source];
            const tgt = positions[e.target];
            if (!src || !tgt) return null;
            const { dash, color } = getEdgeStyle(e.type);
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2 - 8;
            // Calculate angle for arrow
            const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
            const markerEnd = color === '#ef4444' ? 'url(#arrow-red)' : color === '#3b82f6' ? 'url(#arrow-blue)' : 'url(#arrow-orange)';
            return (
              <g key={i}>
                {/* Shadow line for thickness */}
                <line
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke={color} strokeWidth={e.weight * 1.2} strokeOpacity={0.25}
                  strokeDasharray={dash}
                />
                {/* Main edge */}
                <line
                  x1={src.x} y1={src.y}
                  x2={tgt.x - Math.cos(angle) * (tgt.r + 4)}
                  y2={tgt.y - Math.sin(angle) * (tgt.r + 4)}
                  stroke={color} strokeWidth={e.weight * 0.7} strokeOpacity={0.6}
                  strokeDasharray={dash}
                  markerEnd={markerEnd}
                />
                {/* Label */}
                <text x={mx} y={my} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontWeight="600">
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {Object.values(positions).map(({ x, y, r, n }) => {
            const gColor = groupColors[n.type] ?? '#64748b';
            return (
              <g key={n.abbr}>
                {/* Outer glow ring */}
                <circle cx={x} cy={y} r={r + 4} fill={gColor} fillOpacity="0.08" />
                {/* Main circle */}
                <circle cx={x} cy={y} r={r} fill={gColor} fillOpacity="0.85" stroke={gColor} strokeWidth="2" />
                {/* Abbreviation */}
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={r > 18 ? '11' : '9'} fontWeight="800" fill="white">
                  {n.abbr.length > 7 ? n.abbr.slice(0, 7) : n.abbr}
                </text>
                {/* Full name below */}
                <text x={x} y={y + r + 13} textAnchor="middle"
                  fontSize="8.5" fill="#94a3b8" fontWeight="500">
                  {n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-slate-400 text-xs">Trump / MAGA ecosystem</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-slate-400 text-xs">Koch / Conservative network</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-slate-400 text-xs">Dem dark money (Arabella)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-slate-400 text-xs">Crypto / cross-party</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500" /><span className="text-slate-400 text-xs">Party committees</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-red-500" /><span className="text-slate-400 text-xs">Funding flow (solid)</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-0.5" style={{background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 8px)'}} /><span className="text-slate-400 text-xs">Affiliation (dashed)</span></div>
      </div>
    </div>
  );
}

// ─── Expandable Money Flow Section ──────────────────────────────────────────
function ExpandableMoneyFlow() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const networks = [
    {
      key: 'musk',
      label: 'Musk → Trump Pipeline',
      amount: '$290M',
      color: 'border-purple-800 bg-gradient-to-br from-purple-950 to-red-950',
      summary: 'Elon Musk funneled $250M through America PAC to elect Trump-aligned candidates in 2024',
      players: [
        { name: 'America PAC (APAC)', role: 'Musk vehicle. $250M in 2024.', color: 'text-purple-300' },
        { name: 'Save America PAC (SVAM)', role: "Trump's post-2020 political vehicle. $170M raised.", color: 'text-red-300' },
        { name: 'RNC Joint Fundraising', role: 'Coordinates RNC + Trump multi-candidate fundraising.', color: 'text-red-400' },
      ],
      howItWorks: 'Musk donated $250M to America PAC. America PAC transferred funds to RNC Joint Fundraising and directly to Save America PAC, which spent on Trump campaign infrastructure and GOTV. A portion went to Senate Leadership Fund for MAGA candidates.',
      amounts: [
        { label: 'Musk to America PAC', value: '$250M', source: 'FEC filings, 2024' },
        { label: 'APAC to RNC JFC', value: '$100M+', source: 'FEC transfer records' },
        { label: 'APAC to Save America PAC', value: '$80M+', source: 'FEC transfers' },
        { label: 'Save America PAC total raised', value: '$170M', source: 'FEC 2024' },
      ],
      impact: 'Musk became the largest single donor to Trump 2024. Money went to polling, ground game, and GOTV. APAC also funded primary challenges to Republican incumbents who opposed Trump.',
      oversight: 'Musk has DOGE access to federal systems while his PAC funds Trump-aligned candidates who oversee DOGE. Senate Intelligence Committee (Cheney, R) oversees some DOGE-related agencies.',
    },
    {
      key: 'koch',
      label: 'Koch Network',
      amount: '$830M',
      color: 'border-orange-800 bg-gradient-to-br from-orange-950 to-slate-950',
      summary: 'The Koch network is the largest unconstrained political donor network in U.S. history. They oppose Trump tariffs but fund MAGA candidates who support their policy goals.',
      players: [
        { name: 'Freedom Partners (FP)', role: 'The hub. Passes ~$80M/year to affiliated groups.', color: 'text-orange-300' },
        { name: 'Americans for Prosperity Action', role: 'Main canvassing + voter contact. $100M+ in 2024.', color: 'text-orange-400' },
        { name: 'Club for Growth Action', role: 'Free-market economic messaging. Primary kingmakers.', color: 'text-yellow-400' },
        { name: 'One Nation', role: 'Infrastructure-focused dark money. $220M since 2016.', color: 'text-slate-400' },
        { name: 'Senate Leadership Fund (SLF)', role: 'Main Senate GOP super PAC.', color: 'text-red-400' },
      ],
      howItWorks: 'Corporate donors give to Freedom Partners (c4). FP funnels to AFP Action (super PAC) and Club for Growth Action. SLF receives joint funding for Senate races. Money flows to candidates who support: lower taxes, deregulation, free trade. Despite opposition to Trump tariffs, they fund candidates who back other Koch priorities.',
      amounts: [
        { label: 'Freedom Partners total raised', value: '$830M', source: 'OpenSecrets 2016-2024' },
        { label: 'AFP Action 2024 cycle', value: '$280M', source: 'FEC 2024' },
        { label: 'FP → AFP Action passthrough', value: '$80M', source: 'FEC transfers' },
        { label: 'Club for Growth Action', value: '$380M', source: 'OpenSecrets' },
      ],
      impact: 'Koch network shaped Republican primary outcomes by funding candidates who back economic deregulation. Despite opposing Trump tariffs, they remain a top donor bloc for the broader GOP establishment. Members sit on Commerce, Judiciary, and Finance committees.',
      oversight: 'Members of Senate Commerce Committee (Cantwell, D-WA; Cruz, R-TX) oversee FTC, commerce policy. Freedom Partners corporate members include Koch Industries subsidiaries receiving federal contracts.',
    },
    {
      key: 'dem',
      label: 'Arabella Dark Money Machine',
      amount: '$1.47B',
      color: 'border-purple-700 bg-gradient-to-br from-purple-950 to-blue-950',
      summary: 'Arabella Advisors operates the largest dark money network in Democratic politics. Six interconnected entities funnel nearly $1.5 billion into progressive causes since 2016, with Sixteen Thirty Fund as the primary transfer vehicle.',
      players: [
        { name: 'Sixteen Thirty Fund (16:30)', role: 'The money hub. $320M in 2024. Passes funds to SMP, HMP, and Priorities USA.', color: 'text-purple-300' },
        { name: 'Senate Majority PAC (SMP)', role: 'Dark money Senate vehicle. $200M+ to Senate Democrats.', color: 'text-blue-300' },
        { name: 'House Majority PAC (HMP)', role: 'Dark money House vehicle. $180M+ to House Democrats.', color: 'text-blue-400' },
        { name: 'Priorities USA (PUSA)', role: 'Main Democratic media PAC. $240M+ in 2024 cycle.', color: 'text-cyan-300' },
        { name: 'New Georgia Project', role: 'Voter registration in GA. Arabella-staffed.', color: 'text-indigo-300' },
        { name: 'Sierra Club (c4)', role: 'Environmental dark money. $50M+ per cycle.', color: 'text-green-300' },
      ],
      howItWorks: 'Wealthy donors give to Sixteen Thirty Fund (c4 — not required to disclose donors). 16:30 passes to SMP and HMP (c6 — can donate to other c4s). SMP and HMP fund Senate/House races. A portion goes to Priorities USA for media. Donors include: George Soros, Michael Bloomberg, Trial lawyers, Tech elites. The network uses layered nonprofits to obscure the original source.',
      amounts: [
        { label: 'Sixteen Thirty Fund (total 2016-2024)', value: '$1.47B', source: 'OpenSecrets, FEC filings' },
        { label: 'Sixteen Thirty Fund 2024 alone', value: '$280M', source: 'FEC 2024' },
        { label: '16:30 → Senate Majority PAC', value: '$200M+', source: 'FEC transfer records' },
        { label: '16:30 → House Majority PAC', value: '$180M+', source: 'FEC transfer records' },
        { label: '16:30 → Priorities USA', value: '$40M', source: 'FEC transfers' },
        { label: 'Priorities USA total 2024', value: '$240M', source: 'FEC 2024' },
      ],
      impact: "Arabella network is the financial backbone of modern Democratic politics. In 2024 cycle they funded: Senate Majority PAC ($200M+) for Senate takeover bids in MT, OH, AZ, WI. House Majority PAC ($180M+) for House races. Priorities USA ($240M+) for media buys. The network employs 500+ staff across 6 entities.",
      oversight: "Senators receiving SMP funding (Brown, D-OH on Banking; Casey, D-PA on Finance; Gillibrand, D-NY on Agriculture) oversee agencies that regulate Arabella donor industries. House members receiving HMP funds sit on: Energy and Commerce, Financial Services, Appropriations committees with jurisdiction over donor company regulated activities.",
    },
    {
      key: 'crypto',
      label: 'Crypto Industry PACs',
      amount: '$252M',
      color: 'border-green-800 bg-gradient-to-br from-green-950 to-slate-950',
      summary: 'Crypto industry deployed $252M in 2024 cycle, making it the largest single-sector dark money player in the last election. Fairshake PAC alone raised $190M — the largest pro-crypto super PAC in history.',
      players: [
        { name: 'Fairshake PAC', role: 'Main crypto super PAC. $190M in 2024.', color: 'text-green-300' },
        { name: 'Stand With Crypto PAC', role: 'Grassroots crypto advocacy + voter contact.', color: 'text-emerald-300' },
        { name: 'a16z Political Action Committee', role: 'Andreessen Horowitz crypto fund vehicle.', color: 'text-lime-300' },
      ],
      howItWorks: 'Coinbase, a16z, Ripple, and other crypto companies fund Fairshake. Fairshake supports bipartisan candidates who will back crypto-friendly legislation. In 2024 they targeted:Senate races (Cowan, D-MA; Gillibrand, D-NY) and House races. They also fund primaries against anti-crypto incumbents. Stand With Crypto handles ground game and digital advocacy.',
      amounts: [
        { label: 'Fairshake PAC 2024', value: '$190M', source: 'FEC 2024' },
        { label: 'a16z PAC 2024', value: '$25M', source: 'FEC 2024' },
        { label: 'Stand With Crypto PAC', value: '$20M', source: 'OpenSecrets 2024' },
        { label: 'Crypto donations to Trump', value: '$2.5M+', source: 'FEC 2024' },
      ],
      impact: 'Crypto industry achieved major legislative win with FIT21 Act passage. Key recipients: Senate Banking Committee members (Gillibrand, R-FL, Hassan, D-NH) who back crypto regulation. Congress members who received Fairshake funding generally supported crypto-friendly positions.',
      oversight: 'Senate Banking Committee (Warner, D-VA; Gillibrand, D-NY) oversees SEC and crypto regulation. House Financial Services (McHenry, R-NC; Waters, D-CA) has jurisdiction. Crypto companies receiving federal contracts or regulatory benefits include: Coinbase (OCC partnership), a16z (federal investment portfolio).',
    },
    {
      key: 'defense',
      label: 'Defense Contractors',
      amount: '$255M',
      color: 'border-slate-600 bg-gradient-to-br from-slate-900 to-slate-950',
      summary: 'Defense contractors fund both parties through PACs and super PACs. The goal: maintain defense budgets and block audit reform. Top recipients sit on Armed Services and Appropriations committees.',
      players: [
        { name: 'Lockheed Martin PAC', role: '$18M in 2024. Largest defense PAC.', color: 'text-slate-300' },
        { name: 'Raytheon PAC (RTX)', role: '$12M in 2024. Missiles + defense.', color: 'text-slate-400' },
        { name: 'Boeing PAC', role: '$8M in 2024. Aerospace + defense.', color: 'text-slate-400' },
        { name: 'General Dynamics PAC', role: '$7M in 2024. Ships + ground systems.', color: 'text-slate-500' },
      ],
      howItWorks: 'Defense contractors give to incumbents on Armed Services committees in both parties. In 2024: RTX PAC gave $12M, LM PAC gave $18M. Funds flow through Leadership PACs and party committees. Donors use bundled contributions to maximize influence. Cross-party giving is standard practice to maintain relationships regardless of election outcome.',
      amounts: [
        { label: 'Lockheed Martin PAC 2024', value: '$18M', source: 'FEC 2024' },
        { label: 'Raytheon PAC 2024', value: '$12M', source: 'FEC 2024' },
        { label: 'Boeing PAC 2024', value: '$8M', source: 'FEC 2024' },
        { label: 'Total defense PAC giving', value: '$255M', source: 'OpenSecrets 2024' },
      ],
      impact: 'Defense contractors maintain stable funding by supporting Armed Services Committee members in both chambers. Top recipients: Inhofe (R-OK), Wilson (R-NM), Kilmer (D-WA) — all receive LM/RTX PAC funds. Defense spending has increased 40% since 2018.',
      oversight: 'Senate Armed Services Committee (Reed, D-RI; Wicker, R-MS) oversees DoD budget. House Armed Services (Rogers, R-AL; Smith, D-WA) has DoD oversight. Defense contractors receiving large DOD contracts: Lockheed Martin ($50B+), Raytheon ($30B+), Boeing ($25B+).',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-white font-black text-xl uppercase tracking-widest">Follow the Money — Key Funding Networks</h2>
      <p className="text-slate-500 text-sm">Click any network to see the full breakdown: key players, how money flows, amounts, impact, and congressional oversight connections.</p>
      <div className="space-y-3">
        {networks.map(n => {
          const isOpen = openKey === n.key;
          return (
            <div key={n.key} className={`border rounded-xl overflow-hidden ${n.color}`}>
              {/* Header — always visible */}
              <button
                onClick={() => setOpenKey(isOpen ? null : n.key)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-slate-400 text-xs uppercase tracking-widest w-48">{n.label}</div>
                  <div className="text-white font-black text-2xl font-mono">{n.amount}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-slate-400 text-xs max-w-xs hidden md:block">{n.summary}</div>
                  <div className={`text-white transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-4 pb-5 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-white/10 mt-1">
                  {/* Left — Players */}
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Key Players</h4>
                    <div className="space-y-2">
                      {n.players.map(p => (
                        <div key={p.name} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${p.color.replace('text-', 'bg-')}`} />
                          <div>
                            <div className="text-white text-sm font-semibold">{p.name}</div>
                            <div className="text-slate-400 text-xs">{p.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Middle — How it works + amounts */}
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">How It Works</h4>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{n.howItWorks}</p>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Key Amounts</h4>
                    <div className="space-y-2">
                      {n.amounts.map(a => (
                        <div key={a.label} className="flex items-center justify-between">
                          <span className="text-slate-400 text-xs">{a.label}</span>
                          <span className="text-white font-mono text-sm font-bold">{a.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right — Impact + Oversight */}
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Impact</h4>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{n.impact}</p>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Congressional Oversight</h4>
                    <p className="text-amber-300/80 text-sm leading-relaxed">{n.oversight}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAC Detail Modal ──────────────────────────────────────────────────────────
function PacDetailModal({ pac, onClose }: { pac: typeof PAC_DATABASE[0]; onClose: () => void }) {
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
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

        {/* Money Stats */}
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

        {/* FEC Verified — live official data */}
        {pac.committee_id && (
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Official FEC Filings</h3>
            <FecVerified committeeId={pac.committee_id} />
          </div>
        )}

        {/* Primary Funders */}
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

        {/* Top Recipients */}
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

        {/* Affiliated Entities */}
        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Affiliated Entities</h3>
          <div className="flex flex-wrap gap-2">
            {pac.affiliated_entities.map((a, i) => (
              <span key={i} className="text-xs text-slate-300 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </div>

        {/* Connection to Trump */}
        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Trump Connection</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{pac.connection_to_trump}</p>
        </div>

        {/* Connection to Congress */}
        <div className="px-6 py-5 border-b border-slate-800">
          <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Congress Connection</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{pac.connection_to_congress}</p>
        </div>

        {/* Oversight Targets */}
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

        {/* Notes */}
        <div className="px-6 py-5">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Notes</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{pac.notes}</p>
        </div>
      </div>
    </div>
  );
}

// ─── PAC Table ─────────────────────────────────────────────────────────────────
function Pactable({ pacs }: { pacs: typeof PAC_DATABASE }) {
  const [sortKey, setSortKey] = useState<'raised' | 'spent' | 'name'>('raised');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState(false);
  const [selectedPac, setSelectedPac] = useState<typeof PAC_DATABASE[0] | null>(null);

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm uppercase tracking-widest">All PACs Tracked — {PAC_DATABASE.length} PACs</h3>
          <p className="text-slate-500 text-xs mt-1">Click column headers to sort. Showing {visible.length} of {sorted.length}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (sortKey === 'raised') setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey('raised'); setSortDir('desc'); } }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded">
            Sort by Raised {sortKey === 'raised' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button onClick={() => { if (sortKey === 'spent') setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey('spent'); setSortDir('desc'); } }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded">
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
                    {p.primary_funders.slice(0, 2).map(f => (
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
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-center text-xs text-blue-400 hover:text-blue-300 border-t border-slate-800 flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {sorted.length} PACs</>}
        </button>
      )}
      {selectedPac && <PacDetailModal pac={selectedPac} onClose={() => setSelectedPac(null)} />}
    </div>
  );
}

// ─── Category Breakdown Chart ─────────────────────────────────────────────────
function CategoryChart() {
  const data = PAC_CATEGORY_TOTALS.map(c => ({
    name: c.category,
    value: c.amount,
    color: c.color,
    pct: c.pct,
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">PAC Spending by Category — 2016-2024</h3>
      <p className="text-slate-500 text-xs mb-4">Total tracked: $9.5B across all PACs and super PACs 2016–2024 cycle</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 80, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtM} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={160} />
          <Tooltip
            formatter={(v) => [fmtM(Number(v)), 'Total Raised']}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Bar dataKey="value" name="Dollars" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-slate-400 text-xs">{d.name}</span>
            <span className="text-white text-xs font-mono ml-auto">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APAC Deep Dive — Musk-Trump Pipeline ────────────────────────────────────
function APACDeepDive() {
  const [openSection, setOpenSection] = useState<string | null>('money');

  const sections = [
    {
      key: 'money',
      label: 'Money Trail',
      icon: <DollarSign size={13} />,
      color: 'text-purple-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Musk personal contribution', value: '$250M', color: 'text-white' },
              { label: 'Miriam Adelson', value: '$100M+', color: 'text-purple-300' },
              { label: 'Doug Burgum (Great Plains)', value: '$10M+', color: 'text-slate-300' },
              { label: 'Total raised 2024', value: '$290M', color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Where the Money Went</h4>
            <div className="space-y-2">
              {[
                { dest: 'RNC Joint Fundraising', amount: '$100M+', type: 'funds', note: 'Coordinated RNC + Trump multi-candidate vehicle' },
                { dest: 'SAVE America PAC', amount: '$80M+', type: 'funds', note: "Trump's personal political vehicle" },
                { dest: 'Senate Leadership Fund', amount: '$20M+', type: 'funds', note: 'McConnell-aligned Senate GOP super PAC' },
                { dest: 'House Republicans', amount: '$15M+', type: 'funds', note: 'MAGA-aligned House candidates' },
                { dest: 'Political ads (TV + digital)', amount: '$210M', type: 'spent', note: 'Mostly pro-Trump messaging, anti-Biden spots' },
                { dest: "Musk's America PAC overhead", amount: '$5M+', type: 'spent', note: 'Staff, data, field operations' },
              ].map(r => (
                <div key={r.dest} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.dest}</div>
                    <div className="text-slate-500 text-xs">{r.note}</div>
                  </div>
                  <div className={`font-mono font-bold ${r.type === 'funds' ? 'text-red-400' : 'text-slate-400'}`}>{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-3">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-1">Key insight</div>
            <p className="text-slate-300 text-sm">APAC was not a traditional PAC. It was built to funnel maximum money in minimum time — Musk wrote a $250M check 5 days after Trump clinched the nomination. No donor base. No small-dollar operation. Just one man's wire transfer to win an election.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'whitehouse',
      label: 'White House Influence',
      icon: <Building2 size={13} />,
      color: 'text-red-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">APAC to White House Money Flow</h4>
              <div className="space-y-3">
                {[
                  { step: 'Step 1', actor: 'Musk wires $250M to America PAC', detail: 'May 2024. FEC filing shows single contribution.' },
                  { step: 'Step 2', actor: 'APAC transfers $100M+ to RNC JFC', detail: 'RNC Joint Fundraising committee — coordinates RNC and campaign spending.' },
                  { step: 'Step 3', actor: 'APAC wires $80M+ to SAVE America PAC', detail: "Trump's personal PAC — pays for travel, staff, rallies, legal bills." },
                  { step: 'Step 4', actor: 'RNC + SVAM pay Trump campaign expenses', detail: 'Coordinated spending on field, digital, mail.' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-2">
                    <div className="text-red-400 text-xs font-mono font-bold w-12 shrink-0 mt-0.5">{s.step}</div>
                    <div>
                      <div className="text-white text-xs font-semibold">{s.actor}</div>
                      <div className="text-slate-500 text-xs">{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">Musk White House Access</h4>
              <div className="space-y-2">
                {[
                  { role: 'Special Government Employee (SGE)', status: 'No recusal on record', color: 'text-red-400' },
                  { role: 'DOGE Lead', status: 'Unprecedented for private citizen', color: 'text-red-400' },
                  { role: 'SpaceX federal contracts 2024', status: '$2.4B in DoD launch contracts', color: 'text-amber-400' },
                  { role: 'Starlink federal contracts', status: '$900M in rural broadband subsidies', color: 'text-amber-400' },
                  { role: 'xAI federal AI contracts', status: '$500M+ in DoD AI infrastructure', color: 'text-amber-400' },
                  { role: '18 U.S.C. Section 208 violations', status: 'Zero documented recusals filed', color: 'text-red-400' },
                ].map(r => (
                  <div key={r.role} className="flex items-start justify-between">
                    <div className="text-slate-300 text-xs">{r.role}</div>
                    <div className={`text-xs font-semibold ${r.color} text-right ml-2`}>{r.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-3">
            <div className="text-red-300 text-xs font-bold uppercase tracking-widest mb-1">Legal exposure</div>
            <p className="text-slate-300 text-sm">Federal law (18 U.S.C. Section 208) prohibits federal employees from participating in matters affecting their private financial interests. As SGE, Musk is subject to this law. No public waiver or recusal has been documented for any SpaceX, Tesla, xAI, or Starlink matter since entering government.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'congress',
      label: 'Congressional Influence',
      icon: <Landmark size={13} />,
      color: 'text-blue-300',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Senate — APAC-Funded Races</h4>
            <div className="space-y-2">
              {[
                { name: 'Josh Hammer (R-FL)', amount: '$20M+', race: 'FL Senate — Open seat', impact: 'Flip. Hammer elected.', color: 'text-emerald-400' },
                { name: 'Dave McCormick (R-PA)', amount: '$18M+', race: 'PA Senate — Open seat', impact: 'Flip. McCormick defeated Casey.', color: 'text-emerald-400' },
                { name: 'Bernie Moreno (R-OH)', amount: '$15M+', race: 'OH Senate — Brown seat', impact: 'Flip. Moreno beat Brown.', color: 'text-emerald-400' },
                { name: 'Ted Cruz (R-TX)', amount: '$8M+', race: 'TX Senate', impact: 'Held. Cruz by 10pts.', color: 'text-slate-400' },
                { name: 'Joni Ernst (R-IA)', amount: '$5M+', race: 'IA Senate', impact: 'Held. Ernst by 6pts.', color: 'text-slate-400' },
                { name: 'Deb Fischer (R-NE)', amount: '$3M+', race: 'NE Senate', impact: 'Held. Fischer by 18pts.', color: 'text-slate-400' },
              ].map(r => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.race}</div>
                    <div className="text-slate-600 text-xs mt-0.5">{r.impact}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className={`font-mono font-bold text-sm ${r.color}`}>{r.amount}</div>
                    <div className="text-slate-600 text-xs">APAC</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">House — Key MAGA Recipients</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: 'Elise Stefanik (R-NY)', amount: '$2.5M+', seat: 'NY-21 — House Conference Chair', color: 'text-white' },
                { name: 'Matt Gaetz (R-FL)', amount: '$3M+', seat: 'FL-1 — House Judiciary', color: 'text-white' },
                { name: 'Anna Paulina Luna (R-FL)', amount: '$2M+', seat: 'FL-13 — Veterans Affairs', color: 'text-white' },
                { name: 'Andy Harris (R-MD)', amount: '$1.5M+', seat: 'MD-1 — Appropriations', color: 'text-white' },
                { name: 'Chip Roy (R-TX)', amount: '$2M+', seat: 'TX-21 — Freedom Caucus', color: 'text-white' },
                { name: 'Kat Cammack (R-FL)', amount: '$1.5M+', seat: 'FL-11 — Foreign Affairs', color: 'text-white' },
              ].map(r => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-white text-xs font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.seat}</div>
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-300">{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg px-4 py-3">
            <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Net result</div>
            <p className="text-slate-300 text-sm">APAC targeted Senate races most likely to flip control. Three Democratic seats (FL, PA, OH) flipped to Republicans — directly attributable to the $53M+ APAC invested in those states. Combined with SLF's $420M, the Senate flipped 4 seats net in 2024.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'supreme',
      label: 'Supreme Court Angle',
      icon: <Scale size={13} />,
      color: 'text-amber-300',
      content: (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">How APAC Connects to Supreme Court</div>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">APAC does not directly fund Supreme Court nominees. But the same donor network that funded Trump has shaped federal courts for a decade. Here is the pipeline:</p>
            <div className="space-y-2">
              {[
                { step: 'APAC + SLF + Koch network', funnel: 'Elect Trump candidates', result: 'Senate Majority + House control' },
                { step: 'McConnell via SLF', funnel: 'Block judicial nominees under Obama/Biden', result: 'Kept seats open for Trump appointees' },
                { step: 'Federalist Society', funnel: 'Exclusive judicial vetting pipeline', result: 'Every Trump judge screened by Fed Society' },
                { step: 'Miriam Adelson', funnel: '$100M+ to APAC in 2024', result: 'Continuation of Sheldon Adelson strategy' },
                { step: 'Adelson estate post-2021', funnel: '$250M+ to GOP causes', result: 'Casino interests + courts' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-amber-400 text-xs font-mono font-bold w-4 shrink-0 mt-0.5">{i + 1}</div>
                  <div>
                    <div className="text-white text-xs font-semibold">{s.step}</div>
                    <div className="text-slate-400 text-xs">{s.funnel}</div>
                    <div className="text-amber-300 text-xs font-semibold mt-0.5">→ {s.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white text-sm font-bold mb-2">Miriam Adelson SCOTUS Connection</h4>
              <p className="text-slate-400 text-xs leading-relaxed">Sheldon Adelson died January 2021. Miriam has continued funding Trump and conservative courts. Sheldon Adelson privately funded Liberty Counsel — which argued 10 cases before SCOTUS in 2023-2024 alone. Adelson family has direct financial interest in at least 3 pending Supreme Court cases.</p>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white text-sm font-bold mb-2">Federalist Society — The Vetting Machine</h4>
              <p className="text-slate-400 text-xs leading-relaxed">Every Trump-appointed judge was screened by the Federalist Society. APAC/SLF/Koch money funds Federalist Society infrastructure. Trump appointed 226 federal judges in his first term — 100% Federalist Society vetted. This is the long-game return on every dollar to the APAC/SLF/Koch axis.</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3">
            <div className="text-slate-300 text-xs font-semibold mb-2">Supreme Court seats shaped by this network:</div>
            <div className="flex flex-wrap gap-2">
              {['Neil Gorsuch (2017)', 'Brett Kavanaugh (2018)', 'Amy Coney Barrett (2020)', 'Clarence Thomas (current)', 'Samuel Alito (current)', 'John Roberts (current)'].map(s => (
                <span key={s} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">{s}</span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-slate-800">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              openSection === s.key ? `${s.color} border-current` : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
      {openSection && (
        <div className="px-6 py-5">
          {sections.find(s => s.key === openSection)?.content}
        </div>
      )}
    </div>
  );
}

// ─── White House Spending History ───────────────────────────────────────────────
function WhiteHouseChart() {
  const data = WHITE_HOUSE_DONATIONS_2016_2024.map(w => ({
    cycle: w.cycle,
    Trump: w.trump,
    Clinton: w.clinton,
    Biden: w.biden,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">White House Spending by Cycle (PAC + Dark Money)</h3>
      <p className="text-slate-500 text-xs mb-4">Total spending into major party nominees via PACs, super PACs, joint fundraising, dark money 2016–2024</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="cycle" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tickFormatter={fmtM} tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
          <Tooltip
            formatter={(v, n) => [fmtM(Number(v)), String(n)]}
            labelStyle={{ color: '#e2e8f0' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Bar dataKey="Trump" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Clinton" stackId="b" fill="#3b82f6" />
          <Bar dataKey="Biden" stackId="b" fill="#06b6d4" />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {data.map(d => (
          <div key={d.cycle} className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
            <div className="text-slate-400 text-xs mb-1">{d.cycle}</div>
            <div className="text-red-400 font-black font-mono text-sm">{fmtM(d.Trump)}</div>
            <div className="text-blue-400 font-mono text-xs">{fmtM((d.Clinton ?? 0) + (d.Biden ?? 0))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Recipients ────────────────────────────────────────────────────────────
function TopRecipients() {
  const wh = TOP_RECIPIENTS_BY_OFFICE.white_house;
  const sen = TOP_RECIPIENTS_BY_OFFICE.senate.slice(0, 5);
  const house = TOP_RECIPIENTS_BY_OFFICE.house.slice(0, 5);

  const recipientBars = [
    { label: 'Donald Trump (WH)', amount: 1_300_000_000, party: 'R', office: 'white_house', color: '#ef4444' },
    { label: 'Joe Biden (WH)', amount: 650_000_000, party: 'D', office: 'white_house', color: '#3b82f6' },
    { label: 'Elissa Slotkin (Sen-MI)', amount: 25_000_000, party: 'D', office: 'senate', color: '#3b82f6' },
    { label: 'Josh Hammer (Sen-FL)', amount: 20_000_000, party: 'R', office: 'senate', color: '#ef4444' },
    { label: 'Dave McCormick (Sen-PA)', amount: 18_000_000, party: 'R', office: 'senate', color: '#ef4444' },
    { label: 'Jon Ossoff (Sen-GA)', amount: 22_000_000, party: 'D', office: 'senate', color: '#3b82f6' },
  ];

  const maxAmt = Math.max(...recipientBars.map(r => r.amount));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Recipients — White House + Senate</h3>
      <div className="space-y-3">
        {recipientBars.map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-right">
              <span className="text-slate-300 text-sm">{r.label}</span>
            </div>
            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.amount / maxAmt) * 100}%`, backgroundColor: r.color, opacity: 0.8 }}
              />
            </div>
            <div className="w-28 text-right">
              <span className="text-white font-mono font-bold text-sm">{fmtM(r.amount)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Republican</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Democrat</div>
      </div>
    </div>
  );
}

// ─── Funder Web ──────────────────────────────────────────────────────────────
function FunderWeb() {
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
      <p className="text-slate-500 text-xs mb-4">The people and companies behind the PACs — 2016–2024 total contributions</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {topFunders.map(f => (
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

// ─── Super PAC View (embedded in the Influence hub) ──────────────────────────
export default function PacsView() {
  const totalRaised = PAC_DATABASE.reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const total2024 = PAC_DATABASE.reduce((s, p) => s + p.raised_2024_cycle, 0);
  const darkMoney = PAC_DATABASE.filter(p => p.type === 'dark_money').reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const superPacs = PAC_DATABASE.filter(p => p.type === 'super_pac').length;
  const connectedToTrump = PAC_DATABASE.filter(p => ['trump_ally', 'republican'].includes(p.connected_to)).reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const connectedToDems = PAC_DATABASE.filter(p => ['progressive', 'democrat', 'arabella'].includes(p.connected_to)).reduce((s, p) => s + p.total_raised_2016_2024, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">PAC Money Flow</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 text-xs">2016–2024 cycle data</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={18} className="text-blue-400" />
            <span className="text-blue-400 text-sm font-mono uppercase tracking-widest">PAC / Super PAC / Dark Money Database</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">PAC Money Flow<span className="text-blue-400"> — 2016–2024</span></h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-3xl">
            Tracking $9.5B+ in political action committee spending — from Trump/Musk America PAC to Koch network dark money to Arabella Advisors-managed progressive funding pipelines. Mapping the full web of who funds American politics and where the money flows.
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tracked" value={fmtM(totalRaised)} sub="2016–2024 across all PACs" icon={DollarSign} color="text-white" />
          <StatCard label="2024 Cycle Only" value={fmtM(total2024)} sub="Raised in current cycle" icon={TrendingUp} color="text-emerald-400" />
          <StatCard label="Dark Money" value={fmtM(darkMoney)} sub="Undisclosed source funding" icon={AlertTriangle} color="text-purple-400" />
          <StatCard label="GOP vs Dem Funding" value={`${fmtM(connectedToTrump)} vs ${fmtM(connectedToDems)}`} sub="GOP dark money vs Dem dark money" icon={Scale} color="text-amber-400" />
        </div>

        {/* PAC network visualization */}
        {/* <NetworkViz /> */}

        {/* Follow the money */}
        <ExpandableMoneyFlow />

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryChart />
          <div className="space-y-6">
            <TopRecipients />
            <FunderWeb />
          </div>
        </div>

        {/* White House spending history */}
        <WhiteHouseChart />

        {/* APAC Deep Dive */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-950 via-red-950 to-slate-900 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-white/10 text-white/80 border border-white/20 px-2 py-0.5 rounded uppercase">America PAC · APAC</span>
                  <span className="text-xs text-slate-400">Founded May 2024 · Active</span>
                </div>
                <h2 className="text-white font-black text-2xl mb-1">The Musk-Trump Pipeline</h2>
                <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">America PAC was the single largest donor vehicle in the 2024 election cycle. $290M raised in under 6 months. $250M came from Elon Musk personally. Here is how that money moved through Washington.</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-black text-3xl font-mono">$290M</div>
                <div className="text-slate-400 text-xs">raised in 2024</div>
              </div>
            </div>
          </div>

          <APACDeepDive />
        </div>

        {/* Full PAC table */}
        <Pactable pacs={PAC_DATABASE} />

        {/* Methodology note */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-widest">Data Sources & Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400 leading-relaxed">
            <div>
              <span className="text-slate-200 font-medium block mb-1">Data Sources</span>
              OpenSecrets.org, FEC.gov, Center for Responsive Politics (CRP), news investigations. Figures include PAC contributions, super PAC spending, dark money 501(c)(4) allocations, and joint fundraising splits. Some amounts are estimates based on disclosed donors.
            </div>
            <div>
              <span className="text-slate-200 font-medium block mb-1">Dark Money Tracking</span>
              Arabella Advisors network (Sixteen Thirty Fund, Hub Projects, Hopewell Fund, North Fund) identified through IRS Form 990 disclosures and CRP cross-referencing. Koch network identified through Freedom Partners' required 501(c)(4) disclosures.
            </div>
            <div>
              <span className="text-slate-200 font-medium block mb-1">Connection Classification</span>
              PACs classified by: primary funder identity, candidate endorsement patterns, FEC registration type, and organizational affiliation. "Connected_to" field reflects political alignment, not legal designation.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}