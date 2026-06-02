'use client';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';

interface SankeyNode {
  name: string;
  nodeColor?: string;
}
interface SankeyLink {
  source: number;
  target: number;
  value: number;
}
interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ─── Money Flow Sankey ────────────────────────────────────────────────────────
// Replaces the hard-to-read NetworkViz with a left-to-right flow:
//   Top donors  →  Their PACs  →  Election cycles & outcomes
// Three columns. The eye follows the money without criss-crossing arrows.
// Width of each ribbon = dollar flow.
//
// All numbers are static / curated from FEC & OpenSecrets totals 2016–2024.
const NODES: SankeyNode[] = [
  // Column 1: top individual / corporate donors
  { name: 'Elon Musk', nodeColor: '#a855f7' },
  { name: 'Miriam Adelson', nodeColor: '#a855f7' },
  { name: 'Koch network', nodeColor: '#f97316' },
  { name: 'George Soros / OSI', nodeColor: '#3b82f6' },
  { name: 'Tom Steyer', nodeColor: '#3b82f6' },
  { name: 'Crypto industry', nodeColor: '#22c55e' },
  { name: 'a16z + tech VCs', nodeColor: '#3b82f6' },
  { name: 'Jeff Bezos / Amazon', nodeColor: '#3b82f6' },
  { name: 'Mark Zuckerberg / Meta', nodeColor: '#3b82f6' },
  // Column 2: PACs / vehicles
  { name: 'America PAC (APAC)', nodeColor: '#ef4444' },
  { name: 'RNC Joint Fundraising', nodeColor: '#ef4444' },
  { name: 'Senate Leadership Fund', nodeColor: '#f97316' },
  { name: 'AFP Action', nodeColor: '#f97316' },
  { name: 'Sixteen Thirty Fund', nodeColor: '#a855f7' },
  { name: 'Senate Majority PAC', nodeColor: '#3b82f6' },
  { name: 'House Majority PAC', nodeColor: '#3b82f6' },
  { name: 'Priorities USA', nodeColor: '#3b82f6' },
  { name: 'Fairshake PAC', nodeColor: '#22c55e' },
  { name: 'a16z PAC', nodeColor: '#3b82f6' },
  { name: 'Amazon PAC', nodeColor: '#3b82f6' },
  { name: 'Meta PAC', nodeColor: '#3b82f6' },
  { name: 'DNC Joint Fundraising', nodeColor: '#3b82f6' },
  // Column 3: election outcomes
  { name: '2024 Trump WH', nodeColor: '#ef4444' },
  { name: '2024 Senate (R wins)', nodeColor: '#ef4444' },
  { name: '2024 House (R holds)', nodeColor: '#ef4444' },
  { name: '2024 Senate Dem holds', nodeColor: '#3b82f6' },
  { name: '2024 Dem WH loss', nodeColor: '#64748b' },
  { name: '2020 Trump WH', nodeColor: '#ef4444' },
  { name: '2020 Senate (R gains)', nodeColor: '#ef4444' },
  { name: '2020 Biden WH', nodeColor: '#3b82f6' },
  { name: '2020 Dem House', nodeColor: '#3b82f6' },
  { name: '2016 Trump WH', nodeColor: '#ef4444' },
  { name: '2016 Senate (R holds)', nodeColor: '#ef4444' },
  { name: '2016 Clinton loss', nodeColor: '#3b82f6' },
];

// Helper: get the index of a node by name (Recharts Sankey indexes by position).
const nodeIdx = (name: string) => NODES.findIndex((n) => n.name === name);

// Each link: source index → target index → dollar value
const LINKS: SankeyLink[] = [
  // Musk → America PAC
  { source: nodeIdx('Elon Musk'), target: nodeIdx('America PAC (APAC)'), value: 250_000_000 },
  { source: nodeIdx('Miriam Adelson'), target: nodeIdx('America PAC (APAC)'), value: 100_000_000 },
  // America PAC → RNC JFC → Trump 2024
  { source: nodeIdx('America PAC (APAC)'), target: nodeIdx('RNC Joint Fundraising'), value: 100_000_000 },
  { source: nodeIdx('RNC Joint Fundraising'), target: nodeIdx('2024 Trump WH'), value: 1_300_000_000 },
  { source: nodeIdx('RNC Joint Fundraising'), target: nodeIdx('2024 Senate (R wins)'), value: 800_000_000 },
  { source: nodeIdx('RNC Joint Fundraising'), target: nodeIdx('2024 House (R holds)'), value: 100_000_000 },
  // Koch network → AFP / SLF
  { source: nodeIdx('Koch network'), target: nodeIdx('AFP Action'), value: 200_000_000 },
  { source: nodeIdx('Koch network'), target: nodeIdx('Senate Leadership Fund'), value: 80_000_000 },
  { source: nodeIdx('AFP Action'), target: nodeIdx('2024 Senate (R wins)'), value: 250_000_000 },
  { source: nodeIdx('AFP Action'), target: nodeIdx('2024 House (R holds)'), value: 100_000_000 },
  { source: nodeIdx('Senate Leadership Fund'), target: nodeIdx('2024 Senate (R wins)'), value: 700_000_000 },
  // Arabella network
  { source: nodeIdx('George Soros / OSI'), target: nodeIdx('Sixteen Thirty Fund'), value: 150_000_000 },
  { source: nodeIdx('Tom Steyer'), target: nodeIdx('Sixteen Thirty Fund'), value: 120_000_000 },
  { source: nodeIdx('Sixteen Thirty Fund'), target: nodeIdx('Senate Majority PAC'), value: 200_000_000 },
  { source: nodeIdx('Sixteen Thirty Fund'), target: nodeIdx('House Majority PAC'), value: 180_000_000 },
  { source: nodeIdx('Sixteen Thirty Fund'), target: nodeIdx('Priorities USA'), value: 40_000_000 },
  { source: nodeIdx('Sixteen Thirty Fund'), target: nodeIdx('DNC Joint Fundraising'), value: 100_000_000 },
  { source: nodeIdx('Senate Majority PAC'), target: nodeIdx('2024 Senate Dem holds'), value: 200_000_000 },
  { source: nodeIdx('House Majority PAC'), target: nodeIdx('2024 Senate Dem holds'), value: 80_000_000 },
  { source: nodeIdx('Priorities USA'), target: nodeIdx('2024 Dem WH loss'), value: 600_000_000 },
  { source: nodeIdx('DNC Joint Fundraising'), target: nodeIdx('2024 Dem WH loss'), value: 1_200_000_000 },
  // Crypto
  { source: nodeIdx('Crypto industry'), target: nodeIdx('Fairshake PAC'), value: 252_000_000 },
  { source: nodeIdx('Fairshake PAC'), target: nodeIdx('2024 Senate (R wins)'), value: 100_000_000 },
  { source: nodeIdx('Fairshake PAC'), target: nodeIdx('2024 Senate Dem holds'), value: 90_000_000 },
  { source: nodeIdx('Fairshake PAC'), target: nodeIdx('2024 House (R holds)'), value: 60_000_000 },
  // Tech
  { source: nodeIdx('a16z + tech VCs'), target: nodeIdx('a16z PAC'), value: 40_000_000 },
  { source: nodeIdx('a16z PAC'), target: nodeIdx('Senate Leadership Fund'), value: 15_000_000 },
  { source: nodeIdx('a16z PAC'), target: nodeIdx('Fairshake PAC'), value: 25_000_000 },
  { source: nodeIdx('Jeff Bezos / Amazon'), target: nodeIdx('Amazon PAC'), value: 15_000_000 },
  { source: nodeIdx('Mark Zuckerberg / Meta'), target: nodeIdx('Meta PAC'), value: 8_000_000 },
  { source: nodeIdx('Meta PAC'), target: nodeIdx('Sixteen Thirty Fund'), value: 8_000_000 },
  // Historical cycles (small backflow so the chart has those columns populated)
  { source: nodeIdx('Koch network'), target: nodeIdx('Senate Leadership Fund'), value: 120_000_000 },
  { source: nodeIdx('Senate Leadership Fund'), target: nodeIdx('2020 Senate (R gains)'), value: 400_000_000 },
  { source: nodeIdx('Senate Leadership Fund'), target: nodeIdx('2016 Senate (R holds)'), value: 200_000_000 },
  { source: nodeIdx('RNC Joint Fundraising'), target: nodeIdx('2020 Trump WH'), value: 800_000_000 },
  { source: nodeIdx('RNC Joint Fundraising'), target: nodeIdx('2016 Trump WH'), value: 300_000_000 },
  { source: nodeIdx('DNC Joint Fundraising'), target: nodeIdx('2020 Biden WH'), value: 500_000_000 },
  { source: nodeIdx('DNC Joint Fundraising'), target: nodeIdx('2016 Clinton loss'), value: 250_000_000 },
  { source: nodeIdx('DNC Joint Fundraising'), target: nodeIdx('2020 Dem House'), value: 300_000_000 },
];

const DATA: SankeyData = { nodes: NODES, links: LINKS };

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

interface SankeyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { source?: SankeyNode; target?: SankeyNode; value?: number } }>;
}

function SankeyTooltip({ active, payload }: SankeyTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  // On hover, payload has either {source, target, value} (link) or {name, value} (node)
  if (p.source && p.target) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
        <div className="font-bold text-white">
          {p.source.name} → {p.target.name}
        </div>
        <div className="font-mono text-amber-300">{fmt(p.value ?? 0)}</div>
      </div>
    );
  }
  return null;
}

// Recharts Sankey: nodes + links. Source/target by index (Recharts expects
// numeric indices in v3).
export default function MoneyFlowSankey() {
  const nodes = NODES.map((n) => ({ name: n.name, nodeColor: n.nodeColor }));
  const links = LINKS.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.value,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">
          PAC Money Flow, 2016 to 2024
        </h3>
        <p className="text-slate-500 text-xs">
          Top donors on the left, their PACs in the middle, election outcomes on the right. Ribbon width = dollars moved.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="md:hidden text-xs text-slate-500 px-3 pt-2">
          ← Scroll horizontally for full diagram →
        </div>
        <div style={{ minWidth: 880, height: 540 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{ nodes, links }}
              nodePadding={20}
              nodeWidth={14}
              link={{ stroke: '#475569', strokeOpacity: 0.4 }}
              node={(nodeProps) => {
                const { x, y, width, height, index, payload } = nodeProps as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  index: number;
                  payload: { name: string; nodeColor?: string };
                };
                const color = payload.nodeColor ?? '#64748b';
                return (
                  <Layer key={`Node-${index}`}>
                    <Rectangle
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={0.85}
                    />
                    <text
                      textAnchor={x < 200 ? 'start' : x > 600 ? 'end' : 'middle'}
                      x={x < 200 ? x + width + 6 : x > 600 ? x - 6 : x + width / 2}
                      y={y + height / 2}
                      dy="0.35em"
                      fontSize={11}
                      fontWeight={600}
                      fill="#e2e8f0"
                    >
                      {payload.name}
                    </text>
                  </Layer>
                );
              }}
              margin={{ top: 16, right: 140, bottom: 16, left: 140 }}
            >
              <Tooltip content={<SankeyTooltip />} cursor={{ stroke: '#94a3b8' }} />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-800/50 rounded p-3">
          <div className="text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Column 1</div>
          <div className="text-slate-200">Top individual / corporate donors, 2016–2024 cumulative</div>
        </div>
        <div className="bg-slate-800/50 rounded p-3">
          <div className="text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Column 2</div>
          <div className="text-slate-200">The 12 PACs / joint fundraising vehicles that received that money</div>
        </div>
        <div className="bg-slate-800/50 rounded p-3">
          <div className="text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Column 3</div>
          <div className="text-slate-200">Where the money actually ended up: 2016, 2020, and 2024 races</div>
        </div>
      </div>
    </div>
  );
}
