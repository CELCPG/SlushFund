'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Network,
  ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type NodeType = 'politician' | 'agency' | 'contractor' | 'pac';
type EdgeType = 'stock' | 'contract' | 'pac_donation' | 'oversight';
type Party = 'D' | 'R';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  party?: Party;
  size: number;        // base radius
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
  // stats
  conflictScore?: number;
  contractVolume?: number;
  totalSpending?: number;
  tradeCount?: number;
  description?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  value: number;   // dollar amount or shares
  label?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_GRAPH: GraphData = {
  nodes: [
    // Politicians
    { id: 'cathy-mcmorris', type: 'politician', label: 'Cathy McMorris Rodgers', party: 'R', size: 28, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 92, description: 'Former House E&C Committee Chair, crypto investor' },
    { id: 'cynthia-lummis', type: 'politician', label: 'Cynthia Lummis', party: 'R', size: 24, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 88, description: 'Sen Banking Comm, long-time crypto holder' },
    { id: 'al-franks', type: 'politician', label: 'Al Franks', party: 'R', size: 22, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 85, description: 'Ex-Rep, AG Hughes former lobbyist, Anduril investor' },
    { id: 'brian-mast', type: 'politician', label: 'Brian Mast', party: 'R', size: 20, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 78, description: 'House Foreign Affairs, defense contractor investor' },
    { id: 'darin-lahood', type: 'politician', label: 'Darin Lahood', party: 'R', size: 19, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 74, description: 'House Judiciary, Raytheon investor' },
    { id: 'mike-turner', type: 'politician', label: 'Mike Turner', party: 'R', size: 26, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 95, description: 'House Intel Chair, owns Palantir, Raytheon' },
    { id: 'jim-himes', type: 'politician', label: 'Jim Himes', party: 'D', size: 18, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 55, description: 'House Intel Ranking, tech sector investor' },
    { id: 'maxine-waters', type: 'politician', label: 'Maxine Waters', party: 'D', size: 22, x: 0, y: 0, vx: 0, vy: 0, fixed: false, conflictScore: 68, description: 'Fin Services Ranking, holds financial sector' },

    // Agencies
    { id: ' dod', type: 'agency', label: 'Dept of Defense', size: 22, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Federal defense procurement' },
    { id: 'hhs', type: 'agency', label: 'Dept of HHS', size: 20, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Health & Human Services' },
    { id: 'dshs', type: 'agency', label: 'Dept of DHS', size: 18, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Homeland Security' },
    { id: 'doe', type: 'agency', label: 'Dept of Energy', size: 16, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Energy & nuclear security' },
    { id: 'treas', type: 'agency', label: 'Dept of Treasury', size: 15, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Financial oversight' },
    { id: ' va', type: 'agency', label: 'Dept of Veterans Affairs', size: 14, x: 0, y: 0, vx: 0, vy: 0, fixed: false, description: 'Veteran services & healthcare' },

    // Contractors
    { id: 'pltr', type: 'contractor', label: 'Palantir (PLTR)', size: 26, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 2.4e9, description: 'Data analytics for defense & intel' },
    { id: 'ba', type: 'contractor', label: 'Boeing (BA)', size: 24, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 48e9, description: 'Aerospace & defense prime' },
    { id: 'rtx', type: 'contractor', label: 'Raytheon (RTX)', size: 23, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 32e9, description: 'Missiles & air defense' },
    { id: 'nvda', type: 'contractor', label: 'Nvidia (NVDA)', size: 21, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 4.1e9, description: 'AI chips for DoD' },
    { id: 'msft', type: 'contractor', label: 'Microsoft (MSFT)', size: 20, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 12e9, description: 'Cloud & AI for federal govt' },
    { id: 'anduril', type: 'contractor', label: 'Anduril', size: 19, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 3.2e9, description: 'Defense tech startup' },
    { id: 'coi', type: 'contractor', label: 'Coinbase (COIN)', size: 17, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 0, description: 'Crypto exchange, political spending' },
    { id: 'mstr', type: 'contractor', label: 'Strategy (MSTR)', size: 16, x: 0, y: 0, vx: 0, vy: 0, fixed: false, contractVolume: 0, description: 'Bitcoin treasury company' },

    // PACs
    { id: 'america-pac', type: 'pac', label: 'America PAC', size: 23, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  300e6, description: 'Trump-aligned Super PAC' },
    { id: 'arabella-1', type: 'pac', label: 'Arabella Fund I', size: 18, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  140e6, description: 'Dark money 501(c)(4) network' },
    { id: 'arabella-2', type: 'pac', label: 'Arabella Fund II', size: 17, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  120e6, description: 'Dark money 501(c)(4) network' },
    { id: 'koch', type: 'pac', label: 'Koch Network', size: 20, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  200e6, description: 'Libertarian-leaning dark money' },
    { id: 'slf', type: 'pac', label: 'Senate Leadership Fund', size: 21, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  250e6, description: 'McConnell-aligned Senate GOP PAC' },
    { id: 'grf', type: 'pac', label: 'Guam Republicans Fund', size: 14, x: 0, y: 0, vx: 0, vy: 0, fixed: false, totalSpending:  8e6, description: 'Territorial GOP PAC' },
  ],
  edges: [
    // Stock ownership — politician → contractor
    { id: 'e1', source: 'mike-turner', target: 'pltr', type: 'stock', value: 250000, label: '$250K shares' },
    { id: 'e2', source: 'mike-turner', target: 'rtx', type: 'stock', value: 180000, label: '$180K shares' },
    { id: 'e3', source: 'cathy-mcmorris', target: 'coi', type: 'stock', value: 95000, label: '$95K COIN' },
    { id: 'e4', source: 'cynthia-lummis', target: 'mstr', type: 'stock', value: 120000, label: '$120K MSTR' },
    { id: 'e5', source: 'brian-mast', target: 'rtx', type: 'stock', value: 85000, label: '$85K RTX' },
    { id: 'e6', source: 'darin-lahood', target: 'rtx', type: 'stock', value: 75000, label: '$75K RTX' },
    { id: 'e7', source: 'jim-himes', target: 'msft', type: 'stock', value: 110000, label: '$110K MSFT' },
    { id: 'e8', source: 'al-franks', target: 'anduril', type: 'stock', value: 200000, label: '$200K Anduril' },
    { id: 'e9', source: 'cathy-mcmorris', target: 'nvda', type: 'stock', value: 65000, label: '$65K NVDA' },
    { id: 'e10', source: 'maxine-waters', target: 'ba', type: 'stock', value: 45000, label: '$45K BA' },

    // Contract award — agency → contractor (thicker = more $)
    { id: 'e11', source: ' dod', target: 'ba', type: 'contract', value: 48e9, label: '$48B DoD' },
    { id: 'e12', source: ' dod', target: 'rtx', type: 'contract', value: 32e9, label: '$32B DoD' },
    { id: 'e13', source: ' dod', target: 'pltr', type: 'contract', value: 2.4e9, label: '$2.4B DoD' },
    { id: 'e14', source: ' dod', target: 'anduril', type: 'contract', value: 3.2e9, label: '$3.2B DoD' },
    { id: 'e15', source: ' dod', target: 'nvda', type: 'contract', value: 4.1e9, label: '$4.1B DoD' },
    { id: 'e16', source: 'hhs', target: 'msft', type: 'contract', value: 4.5e9, label: '$4.5B HHS' },
    { id: 'e17', source: 'dshs', target: 'pltr', type: 'contract', value: 800e6, label: '$800M DHS' },
    { id: 'e18', source: 'doe', target: 'nvda', type: 'contract', value: 1.2e9, label: '$1.2B DOE' },
    { id: 'e19', source: 'treas', target: 'msft', type: 'contract', value: 2.1e9, label: '$2.1B Treasury' },
    { id: 'e20', source: ' va', target: 'msft', type: 'contract', value: 1.8e9, label: '$1.8B VA' },
    { id: 'e21', source: 'hhs', target: 'pltr', type: 'contract', value: 600e6, label: '$600M HHS' },

    // PAC donation — PAC → politician
    { id: 'e22', source: 'america-pac', target: 'mike-turner', type: 'pac_donation', value: 2.5e6, label: '$2.5M' },
    { id: 'e23', source: 'america-pac', target: 'darin-lahood', type: 'pac_donation', value: 1.8e6, label: '$1.8M' },
    { id: 'e24', source: 'america-pac', target: 'brian-mast', type: 'pac_donation', value: 1.5e6, label: '$1.5M' },
    { id: 'e25', source: 'slf', target: 'cynthia-lummis', type: 'pac_donation', value: 1.2e6, label: '$1.2M' },
    { id: 'e26', source: 'slf', target: 'darin-lahood', type: 'pac_donation', value: 900000, label: '$900K' },
    { id: 'e27', source: 'koch', target: 'cathy-mcmorris', type: 'pac_donation', value: 800000, label: '$800K' },
    { id: 'e28', source: 'arabella-1', target: 'jim-himes', type: 'pac_donation', value: 600000, label: '$600K' },
    { id: 'e29', source: 'arabella-2', target: 'maxine-waters', type: 'pac_donation', value: 550000, label: '$550K' },
    { id: 'e30', source: 'america-pac', target: 'al-franks', type: 'pac_donation', value: 1.1e6, label: '$1.1M' },
    { id: 'e31', source: 'grf', target: 'cathy-mcmorris', type: 'pac_donation', value: 250000, label: '$250K' },

    // Committee oversight — politician → agency
    { id: 'e32', source: 'mike-turner', target: ' dod', type: 'oversight', value: 0, label: 'House Intel' },
    { id: 'e33', source: 'cathy-mcmorris', target: 'hhs', type: 'oversight', value: 0, label: 'E&C Comm' },
    { id: 'e34', source: 'cynthia-lummis', target: 'treas', type: 'oversight', value: 0, label: 'Banking Comm' },
    { id: 'e35', source: 'al-franks', target: ' dod', type: 'oversight', value: 0, label: 'Armed Svcs' },
    { id: 'e36', source: 'brian-mast', target: 'dshs', type: 'oversight', value: 0, label: 'Foreign Affairs' },
    { id: 'e37', source: 'darin-lahood', target: ' dod', type: 'oversight', value: 0, label: 'Judiciary' },
    { id: 'e38', source: 'jim-himes', target: ' dod', type: 'oversight', value: 0, label: 'Intel Ranking' },
    { id: 'e39', source: 'maxine-waters', target: 'treas', type: 'oversight', value: 0, label: 'FinSvcs Ranking' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EDGE_COLORS: Record<EdgeType, string> = {
  stock: '#3b82f6',
  contract: '#f97316',
  pac_donation: '#a855f7',
  oversight: '#64748b',
};

const EDGE_STYLES: Record<EdgeType, { dash: string; strokeWidth: number }> = {
  stock: { dash: '8,4', strokeWidth: 2 },
  contract: { dash: '0', strokeWidth: 3 },
  pac_donation: { dash: '4,4', strokeWidth: 2 },
  oversight: { dash: '0', strokeWidth: 1 },
};

const NODE_COLORS: Record<NodeType, string> = {
  politician: '#3b82f6',
  agency: '#64748b',
  contractor: '#f97316',
  pac: '#a855f7',
};

function fmtBillions(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Force Simulation ─────────────────────────────────────────────────────────
function runSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  setNodes: (fn: (n: GraphNode[]) => GraphNode[]) => void,
  onDone: () => void,
) {
  let iter = 0;
  const maxIter = 150;

  function tick() {
    if (iter >= maxIter) { onDone(); return; }

    const REPULSION = 8000;
    const SPRING_LEN = 180;
    const SPRING_K = 0.04;
    const DAMPING = 0.85;
    const CENTER_K = 0.005;

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Spring for edges
    const edgeMap: Record<string, GraphEdge[]> = {};
    for (const e of edges) {
      if (!edgeMap[e.source]) edgeMap[e.source] = [];
      if (!edgeMap[e.target]) edgeMap[e.target] = [];
      edgeMap[e.source]!.push(e);
      edgeMap[e.target]!.push(e);
    }
    for (const n of nodes) {
      const myEdges = edgeMap[n.id] ?? [];
      for (const e of myEdges) {
        const otherId = e.source === n.id ? e.target : e.source;
        const other = nodes.find(o => o.id === otherId);
        if (!other) continue;
        const dx = other.x - n.x;
        const dy = other.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - SPRING_LEN;
        const f = SPRING_K * displacement;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        n.vx += fx;
        n.vy += fy;
      }
    }

    // Center gravity
    const cx = width / 2, cy = height / 2;
    for (const n of nodes) {
      n.vx += (cx - n.x) * CENTER_K;
      n.vy += (cy - n.y) * CENTER_K;
    }

    // Integrate
    for (const n of nodes) {
      if (!n.fixed) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // soft bounds
        n.x = Math.max(80, Math.min(width - 80, n.x));
        n.y = Math.max(80, Math.min(height - 80, n.y));
      }
    }

    setNodes(prev => [...prev]);
    iter++;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// ─── Graph SVG Component ───────────────────────────────────────────────────────
function GraphSVG({
  nodes,
  edges,
  selectedId,
  highlightedIds,
  filter,
  search,
  viewBox,
  onZoom,
  onPanStart,
  onPanMove,
  onPanEnd,
  isPanning,
  onNodeClick,
  onNodeDrag,
  onNodeDragEnd,
  draggingNodeId,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  highlightedIds: Set<string>;
  filter: NodeType | 'all';
  search: string;
  viewBox: { x: number; y: number; w: number; h: number };
  onZoom: (factor: number, cx: number, cy: number) => void;
  onPanStart: (x: number, y: number) => void;
  onPanMove: (x: number, y: number) => void;
  onPanEnd: () => void;
  isPanning: boolean;
  onNodeClick: (id: string) => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
  onNodeDragEnd: (id: string) => void;
  draggingNodeId: string | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragNodeIdRef = useRef<string | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visibleNodes = useMemo(() => {
    return nodes.filter(n => {
      if (filter !== 'all' && n.type !== filter) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [nodes, filter, search]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

  function getVisibleEdges(nodeId: string) {
    return visibleEdges.filter(e => e.source === nodeId || e.target === nodeId);
  }

  function getConnectedNodes(nodeId: string): Set<string> {
    const s = new Set<string>();
    for (const e of visibleEdges) {
      if (e.source === nodeId) s.add(e.target);
      if (e.target === nodeId) s.add(e.source);
    }
    return s;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    onZoom(e.deltaY < 0 ? 0.9 : 1.1, cx, cy);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as SVGElement).closest('[data-node]')) return;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (panStartRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      // pan by adjusting viewBox
      const scaleX = viewBox.w / svgRef.current!.clientWidth;
      const scaleY = viewBox.h / svgRef.current!.clientHeight;
      onPanMove(dx * scaleX, dy * scaleY);
    }
  }

  function handleMouseUp() {
    panStartRef.current = null;
    onPanEnd();
  }

  function toSvgX(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    return viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
  }

  function toSvgY(clientY: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    return viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
  }

  function nodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    isDraggingRef.current = false;
    dragNodeIdRef.current = nodeId;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    const svgX = toSvgX(e.clientX);
    const svgY = toSvgY(e.clientY);
    onNodeDrag(nodeId, svgX, svgY);
  }

  function nodeMouseMove(e: React.MouseEvent) {
    if (!dragNodeIdRef.current) return;
    isDraggingRef.current = true;
    const svgX = toSvgX(e.clientX);
    const svgY = toSvgY(e.clientY);
    onNodeDrag(dragNodeIdRef.current, svgX, svgY);
  }

  function nodeMouseUp(e: React.MouseEvent, nodeId: string) {
    if (isDraggingRef.current) {
      onNodeDragEnd(nodeId);
    } else {
      onNodeClick(nodeId);
    }
    dragNodeIdRef.current = null;
    isDraggingRef.current = false;
  }

  function nodeMouseEnter(e: React.MouseEvent, nodeId: string) {
    setHoveredId(nodeId);
  }

  function nodeMouseLeave() {
    setHoveredId(null);
  }

  const showLabel = (nodeId: string) => {
    if (hoveredId === nodeId) return true;
    if (selectedId === nodeId) return true;
    return false;
  };

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => { handleMouseMove(e); nodeMouseMove(e); }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid background */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${viewBox.x},${viewBox.y})`}>
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
        </pattern>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
        </marker>
      </defs>
      <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0a0a0f" />
      <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#grid)" />

      {/* Edges */}
      {visibleEdges.map(edge => {
        const src = visibleNodes.find(n => n.id === edge.source);
        const tgt = visibleNodes.find(n => n.id === edge.target);
        if (!src || !tgt) return null;
        const isHighlighted =
          selectedId === edge.source || selectedId === edge.target ||
          hoveredId === edge.source || hoveredId === edge.target;
        const style = EDGE_STYLES[edge.type];
        const edgeColor = isHighlighted ? '#ffffff' : EDGE_COLORS[edge.type];
        const strokeW = isHighlighted ? style.strokeWidth + 1 : style.strokeWidth;

        return (
          <g key={edge.id}>
            {edge.type !== 'oversight' && (
              // Value label on edge
              <text
                x={(src.x + tgt.x) / 2}
                y={(src.y + tgt.y) / 2 - 6}
                textAnchor="middle"
                fill={edgeColor}
                fontSize="10"
                fontFamily="monospace"
                opacity={isHighlighted ? 1 : 0.6}
              >
                {edge.label}
              </text>
            )}
            <line
              x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
              stroke={edgeColor}
              strokeWidth={strokeW}
              strokeDasharray={style.dash}
              opacity={isHighlighted ? 1 : 0.5}
              markerEnd={edge.type === 'contract' && isHighlighted ? 'url(#arrow)' : undefined}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {visibleNodes.map(node => {
        const isHighlighted = selectedId === node.id || hoveredId === node.id;
        const connectedToHighlight = selectedId && (() => {
          return visibleEdges.some(e =>
            (e.source === selectedId && e.target === node.id) ||
            (e.target === selectedId && e.source === node.id)
          );
        })();
        const isDimmed = (selectedId || hoveredId) && !isHighlighted && !connectedToHighlight;
        const r = node.size;
        const color = node.type === 'politician'
          ? (node.party === 'D' ? '#3b82f6' : '#ef4444')
          : NODE_COLORS[node.type];

        return (
          <g
            key={node.id}
            data-node="true"
            opacity={isDimmed ? 0.25 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseDown={(e) => nodeMouseDown(e, node.id)}
            onMouseEnter={(e) => nodeMouseEnter(e, node.id)}
            onMouseLeave={() => nodeMouseLeave()}
          >
            {/* Glow ring */}
            {isHighlighted && (
              <circle cx={node.x} cy={node.y} r={r + 6} fill="none" stroke={color} strokeWidth="2" opacity="0.4" />
            )}

            {node.type === 'politician' && (
              <circle cx={node.x} cy={node.y} r={r} fill={color} opacity="0.85" />
            )}
            {node.type === 'agency' && (
              <rect x={node.x - r} y={node.y - r} width={r * 2} height={r * 2} fill={color} opacity="0.85" rx="3" />
            )}
            {node.type === 'contractor' && (
              <rect
                x={node.x - r * 0.7} y={node.y - r * 0.7}
                width={r * 1.4} height={r * 1.4}
                fill={color} opacity="0.85" rx="3"
                transform={`rotate(45, ${node.x}, ${node.y})`}
              />
            )}
            {node.type === 'pac' && (
              <polygon
                points={Array.from({ length: 6 }, (_, i) => {
                  const angle = (Math.PI / 3) * i - Math.PI / 6;
                  return `${node.x + r * Math.cos(angle)},${node.y + r * Math.sin(angle)}`;
                }).join(' ')}
                fill={color} opacity="0.85"
              />
            )}

            {/* Label */}
            {(showLabel(node.id) || (node.size > 20)) && (
              <text
                x={node.x}
                y={node.y + r + 14}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
              >
                {node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function SidePanel({
  node,
  edges,
  allNodes,
  onClose,
  onSelectNode,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const color = node.type === 'politician'
    ? (node.party === 'D' ? '#3b82f6' : '#ef4444')
    : NODE_COLORS[node.type];

  const connections = edges
    .filter(e => e.source === node.id || e.target === node.id)
    .map(e => {
      const otherId = e.source === node.id ? e.target : e.source;
      const other = allNodes.find(n => n.id === otherId);
      const isOutgoing = e.source === node.id;
      return { edge: e, other: other!, isOutgoing };
    })
    .filter(c => c.other);

  const typeLabel = { politician: 'Politician', agency: 'Federal Agency', contractor: 'Contractor', pac: 'Super PAC' }[node.type];

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-slate-950/95 backdrop-blur border-l border-slate-800 z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/98 border-b border-slate-800 px-4 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{typeLabel}</span>
          </div>
          <div className="text-white font-bold text-base leading-tight">{node.label}</div>
          {node.party && (
            <span className={`text-xs font-mono font-bold mt-1 inline-block px-1.5 py-0.5 rounded ${node.party === 'D' ? 'bg-blue-900/60 text-blue-300' : 'bg-red-900/60 text-red-300'}`}>
              {node.party === 'D' ? 'Democrat' : 'Republican'}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-4 border-b border-slate-800/60">
        {node.conflictScore !== undefined && (
          <div className="mb-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Conflict Score</div>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-black font-mono" style={{ color }}>
                {node.conflictScore}
              </div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${node.conflictScore}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>
        )}
        {node.contractVolume !== undefined && (
          <div className="mb-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Contract Volume</div>
            <div className="text-2xl font-black font-mono text-orange-400">{fmtBillions(node.contractVolume)}</div>
            <div className="text-slate-500 text-xs mt-0.5">Federal contracts</div>
          </div>
        )}
        {node.totalSpending !== undefined && (
          <div className="mb-3">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Total PAC Spending</div>
            <div className="text-2xl font-black font-mono text-purple-400">{fmtBillions(node.totalSpending)}</div>
          </div>
        )}
        {node.description && (
          <div className="text-slate-400 text-xs leading-relaxed">{node.description}</div>
        )}
      </div>

      {/* Connections */}
      <div className="px-4 py-4">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
          {connections.length} Connection{connections.length !== 1 ? 's' : ''}
        </div>
        <div className="space-y-2">
          {connections.map(({ edge, other, isOutgoing }) => {
            const edgeColor = EDGE_COLORS[edge.type];
            const edgeLabel = {
              stock: 'Owns shares of',
              contract: 'Contract awarded',
              pac_donation: 'PAC donation from',
              oversight: 'Oversight committee',
            }[edge.type];
            const otherColor = other.type === 'politician'
              ? (other.party === 'D' ? '#3b82f6' : '#ef4444')
              : NODE_COLORS[other.type];
            return (
              <button
                key={edge.id}
                onClick={() => onSelectNode(other.id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700 transition-all group"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: otherColor }}
                />
                <div className="flex-1 text-left">
                  <div className="text-slate-200 text-xs font-medium group-hover:text-white">{other.label}</div>
                  <div className="text-slate-500 text-xs">{edgeLabel}{edge.label ? `: ${edge.label}` : ''}</div>
                </div>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: edgeColor }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const items: { label: string; color: string; dash?: string; type: EdgeType }[] = [
    { label: 'Stock ownership', color: EDGE_COLORS.stock, dash: '8,4', type: 'stock' },
    { label: 'Contract award ($)', color: EDGE_COLORS.contract, type: 'contract' },
    { label: 'PAC donation', color: EDGE_COLORS.pac_donation, dash: '4,4', type: 'pac_donation' },
    { label: 'Committee oversight', color: EDGE_COLORS.oversight, type: 'oversight' },
  ];

  return (
    <div className="absolute bottom-6 left-6 bg-slate-950/90 backdrop-blur border border-slate-800 rounded-xl px-4 py-3 z-20">
      <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Relationships</div>
      {items.map(item => (
        <div key={item.type} className="flex items-center gap-2.5 mb-1.5">
          <svg width="28" height="10">
            <line
              x1="0" y1="5" x2="28" y2="5"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.dash ?? undefined}
            />
          </svg>
          <span className="text-slate-300 text-xs">{item.label}</span>
        </div>
      ))}
      <div className="border-t border-slate-800 mt-3 pt-3">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Node types</div>
        {[
          { label: 'Politician (D)', color: '#3b82f6' },
          { label: 'Politician (R)', color: '#ef4444' },
          { label: 'Federal Agency', color: '#64748b' },
          { label: 'Contractor', color: '#f97316' },
          { label: 'Super PAC', color: '#a855f7' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300 text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const [graphData, setGraphData] = useState<GraphData>(MOCK_GRAPH);
  const [nodes, setNodes] = useState<GraphNode[]>(MOCK_GRAPH.nodes);
  const [filter, setFilter] = useState<NodeType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: -50, y: -50, w: 1400, h: 900 });
  const [isSimulating, setIsSimulating] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fetch live data to enrich graph
  useEffect(() => {
    fetch('/api/congress/trades?limit=1000')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.trades) return;
        // Enrich politician nodes with trade data
        setNodes(prev => {
          const updated = [...prev];
          const tradeCounts: Record<string, number> = {};
          for (const t of data.trades) {
            const id = t.member_name?.toLowerCase().replace(/\s+/g, '-') ?? '';
            tradeCounts[id] = (tradeCounts[id] ?? 0) + 1;
          }
          // Merge trade counts into existing nodes
          return updated.map(n => {
            if (n.type === 'politician') {
              const labelKey = n.label.toLowerCase().replace(/\s+/g, '-');
              return { ...n, tradeCount: tradeCounts[labelKey] ?? n.tradeCount };
            }
            return n;
          });
        });
      })
      .catch(() => {});
  }, []);

  // Run force simulation on mount / resize
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width || 1200;
    const h = rect.height || 700;

    // Initialize positions in a circle
    setNodes(prev => prev.map((n, i) => {
      const angle = (2 * Math.PI * i) / prev.length;
      const r = Math.min(w, h) * 0.35;
      return { ...n, x: w / 2 + r * Math.cos(angle), y: h / 2 + r * Math.sin(angle), vx: 0, vy: 0 };
    }));
    setIsSimulating(true);
  }, []);

  // Simulation
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width || 1200;
    const h = rect.height || 700;

    const timer = setTimeout(() => {
      runSimulation(nodes, graphData.edges, w, h, setNodes, () => setIsSimulating(false));
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Zoom controls
  function handleZoom(factor: number, _cx?: number, _cy?: number) {
    setViewBox(prev => {
      const newW = Math.max(400, Math.min(4000, prev.w * factor));
      const newH = Math.max(300, Math.min(3000, prev.h * factor));
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }

  function resetView() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setViewBox({ x: -50, y: -50, w: rect.width + 100, h: rect.height + 100 });
  }

  function fitAll() {
    if (!nodes.length) return;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 80;
    const minY = Math.min(...ys) - 80;
    const maxX = Math.max(...xs) + 80;
    const maxY = Math.max(...ys) + 80;
    setViewBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }

  function handlePanMove(dx: number, dy: number) {
    setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
  }

  function handleNodeDrag(id: string, x: number, y: number) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y, fixed: true } : n));
  }

  function handleNodeDragEnd(id: string) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, fixed: false } : n));
  }

  const selectedNode = nodes.find(n => n.id === selectedId);
  const highlightedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const s = new Set<string>([selectedId]);
    for (const e of graphData.edges) {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    }
    return s;
  }, [selectedId, graphData.edges]);

  // Filter counts
  const counts = useMemo(() => ({
    all: graphData.nodes.filter(n => n.type === 'politician' || n.type === 'agency' || n.type === 'contractor' || n.type === 'pac').length,
    politician: graphData.nodes.filter(n => n.type === 'politician').length,
    agency: graphData.nodes.filter(n => n.type === 'agency').length,
    contractor: graphData.nodes.filter(n => n.type === 'contractor').length,
    pac: graphData.nodes.filter(n => n.type === 'pac').length,
  }), [graphData.nodes]);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-black">The Web</h1>
            <p className="text-slate-400 mt-1">Explore the connections between Congress, contracts, and dark money.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <Network size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">The interactive graph is best viewed on a larger screen. Switch to a tablet or desktop to explore the full network.</p>
          </div>
          {/* Fallback list */}
          <div className="mt-6 space-y-4">
            {['politician', 'contractor', 'pac'].map(type => (
              <div key={type}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{type}s</h3>
                <div className="grid grid-cols-1 gap-2">
                  {graphData.nodes.filter(n => n.type === type).slice(0, 4).map(node => (
                    <div key={node.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: node.type === 'politician' ? '#ef4444' : NODE_COLORS[node.type] }} />
                      <div>
                        <div className="text-sm font-medium text-white">{node.label}</div>
                        <div className="text-xs text-slate-500">{node.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Network size={24} className="text-[#E63946]" />
                <h1 className="text-2xl font-black text-white">The Web</h1>
              </div>
              <p className="text-slate-400 text-sm ml-[36px]">Explore the connections between Congress, contracts, and dark money.</p>
            </div>
            {isSimulating && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-[#E63946] animate-pulse" />
                <span>Building graph…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-slate-800/60 bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {(['all', 'politician', 'agency', 'contractor', 'pac'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/40'
                  : 'bg-slate-800/60 text-slate-400 border border-transparent hover:text-white hover:bg-slate-800'
              }`}
            >
              {f === 'all' ? 'All' : f === 'politician' ? 'Politicians' : f === 'agency' ? 'Agencies' : f === 'contractor' ? 'Contractors' : 'PACs'}
              <span className="ml-1.5 opacity-60">{counts[f]}</span>
            </button>
          ))}

          {/* Search */}
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search nodes…"
              className="pl-8 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E63946]/60 w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="relative w-full" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
        <GraphSVG
          nodes={nodes}
          edges={graphData.edges}
          selectedId={selectedId}
          highlightedIds={highlightedIds}
          filter={filter}
          search={search}
          viewBox={viewBox}
          onZoom={handleZoom}
          onPanStart={(x, y) => {}}
          onPanMove={handlePanMove}
          onPanEnd={() => {}}
          isPanning={false}
          onNodeClick={(id) => setSelectedId(id === selectedId ? null : id)}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          draggingNodeId={null}
        />

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 z-30">
          <button
            onClick={() => handleZoom(0.8)}
            className="w-8 h-8 flex items-center justify-center bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="w-8 h-8 flex items-center justify-center bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={resetView}
            className="w-8 h-8 flex items-center justify-center bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={fitAll}
            className="w-8 h-8 flex items-center justify-center bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <Legend />

        {/* Side panel */}
        {selectedNode && (
          <SidePanel
            node={selectedNode}
            edges={graphData.edges}
            allNodes={nodes}
            onClose={() => setSelectedId(null)}
            onSelectNode={(id) => setSelectedId(id)}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-4 py-4 text-center">
        <p className="text-slate-600 text-xs">
          Data sources: USAspending.gov · Congress.gov · Federal Election Commission · QuiverQuant · Wall Street Journal
        </p>
      </div>
    </div>
  );
}