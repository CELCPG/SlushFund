'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { DayPayload } from '@/lib/v2/iran-war';

/**
 * W2: the interactive timeline of "The President's securities transactions during the Iran war".
 *
 * Lanes: government acts, the President's posts (one tick per post, labelled only where the chronology marks it), oversight, the
 * account's securities transactions per trade day (purchases one way, sales the other, split energy or defense / other /
 * unclassified), and the daily Brent spot price. Select or tap a day, or move with the arrow keys, to open that day's records: the
 * chronology rows with their source and archive links, and the transactions with a link to the OGE page. An "As a table" toggle shows
 * the same data as a table. Below 820px the time axis runs down the page in a scroller, so the page itself never scrolls sideways.
 *
 * Nothing on the chart joins a post to a transaction: no arrows, connectors or call-outs. The fixed line sits above the chart and in
 * the day panel. The server passes compact data; a day's rows are fetched when the day is opened (static JSON per day).
 */

export interface TlDay {
  /** Date, YYYY-MM-DD. */
  d: string;
  /** Chronology entries on the day: government, posts, oversight, labelled. */
  g: number; p: number; o: number; l: number;
  /** Purchases and sales split energy or defense / other / unclassified. */
  bp: [number, number, number];
  sl: [number, number, number];
  /** Exchanges (none in the President's reports) and the day's total. */
  x: number; t: number;
  /** Brent spot, or null. */
  b: number | null;
}
export interface TlMarker { id: string; d: string; t: string | null; k: 'g' | 'p' | 'o'; l: boolean; label: string | null }
export interface TlText {
  fixedLine: string;
  intro: string;
  legendWide: string;
  legendNarrow: string;
  keyboard: string;
  toTable: string;
  toChart: string;
  brentLine: string;
  noChron: string;
  noTx: string;
  noneED: string;
  labelledShow: string;
  labelledHide: string;
  loading: string;
  error: string;
  /** Contains the placeholder ${brent}. */
  brentOn: string;
  brentNone: string;
  /** Contains {n} and {ed}. */
  dayCount: string;
}
export interface TimelineProps {
  days: TlDay[];
  markers: TlMarker[];
  brent: { d: string; v: number }[];
  dayUrlBase: string;
  /** Pre-registered window edges (first day of the war's first month and of months two to five). */
  edges: { warStart: string; month2: string };
  text: TlText;
}

const GROUPS = ['Energy or defense', 'Other', 'Unclassified'] as const;
const LANE_LABEL = { g: 'Government acts', p: "The President's posts", o: 'Oversight', t: 'Transactions', b: 'Brent' } as const;
const LANE_NAME: Record<string, string> = { government: 'Government act', president_post: "The President's post", oversight: 'Oversight' };

type Mode = 'h' | 'v';
interface Geo {
  mode: Mode;
  w: number;
  h: number;
  step: number;
  /** Start of the time axis along its coordinate. */
  u0: number;
  lanes: Record<'g' | 'p' | 'o' | 't' | 'b', [number, number]>;
}
function geoOf(mode: Mode, n: number): Geo {
  if (mode === 'h') {
    const plot = 1030;
    return { mode, w: 1200, h: 590, step: plot / n, u0: 150, lanes: { g: [34, 84], p: [92, 142], o: [150, 190], t: [208, 428], b: [446, 546] } };
  }
  const step = 16;
  return { mode, w: 360, h: 8 + n * step, step, u0: 4, lanes: { g: [50, 82], p: [86, 130], o: [134, 160], t: [164, 300], b: [308, 356] } };
}

function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia('(max-width: 819px)');
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia('(max-width: 819px)').matches,
    () => false,
  );
}

const longDate = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
const fullShort = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
const monthLabel = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', year: 'numeric' });
const int = (n: number): string => n.toLocaleString('en-US');
const timeFrac = (t: string | null): number => {
  if (!t) return 0.5;
  const [hh, mm] = t.split(':').map(Number);
  return Math.min(0.98, Math.max(0.02, (hh * 60 + mm) / 1440));
};
const ACCENT = 'var(--sf-accent, #6534D9)';
const INK = 'var(--color-ink, #14142B)';
const MUTED = 'var(--color-muted, #4F5170)';
const LINE = 'var(--color-line, #DFE3EF)';

export default function WarTimeline({ days, markers, brent, dayUrlBase, edges, text }: TimelineProps) {
  const narrow = useNarrow();
  const mode: Mode = narrow ? 'v' : 'h';
  const n = days.length;
  const geo = useMemo(() => geoOf(mode, n), [mode, n]);
  const uid = useId().replace(/:/g, '');
  const index = useMemo(() => new Map(days.map((d, i) => [d.d, i])), [days]);
  const [cursor, setCursor] = useState<number>(() => Math.max(0, days.findIndex((d) => d.d === edges.warStart)));
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const [labelled, setLabelled] = useState(false);
  const [announce, setAnnounce] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelHeadRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- geometry helpers
  const pt = useCallback((u: number, s: number): [number, number] => (geo.mode === 'h' ? [geo.u0 + u, s] : [s, geo.u0 + u]), [geo]);
  const uOf = useCallback((i: number, frac = 0) => (i + frac) * geo.step, [geo]);

  const maxSide = useMemo(() => Math.max(1, ...days.map((d) => Math.max(d.bp[0] + d.bp[1] + d.bp[2], d.sl[0] + d.sl[1] + d.sl[2]))), [days]);
  const brentRange = useMemo(() => {
    const v = brent.map((b) => b.v);
    return { lo: Math.floor(Math.min(...v) / 20) * 20, hi: Math.ceil(Math.max(...v) / 20) * 20 };
  }, [brent]);

  // ---- the day the pointer or keyboard is on
  const dayAt = useCallback(
    (clientX: number, clientY: number, el: SVGElement): number | null => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const x = ((clientX - r.left) / r.width) * geo.w;
      const y = ((clientY - r.top) / r.height) * geo.h;
      const u = (geo.mode === 'h' ? x : y) - geo.u0;
      const i = Math.floor(u / geo.step);
      return i >= 0 && i < n ? i : null;
    },
    [geo, n],
  );

  const open = useCallback((d: string) => {
    setSelected(d);
    setTable(false);
    // a day that failed to load is fetched again when it is opened again
    setLoaded((prev) => {
      if (prev[d] !== 'error') return prev;
      const rest = { ...prev };
      delete rest[d];
      return rest;
    });
  }, []);

  const move = useCallback(
    (to: number, say = true) => {
      const i = Math.min(n - 1, Math.max(0, to));
      setCursor(i);
      const d = days[i];
      if (say) setAnnounce(`${longDate(d.d)}: ${int(d.g + d.p + d.o)} chronology entries, ${int(d.t)} securities transactions listed.`);
      // keep the cursor on screen in the vertical scroller
      const sc = scrollRef.current;
      if (sc && geo.mode === 'v') {
        const rowPx = (sc.scrollHeight / geo.h) * geo.step;
        const top = i * rowPx;
        if (top < sc.scrollTop || top > sc.scrollTop + sc.clientHeight - rowPx * 2) sc.scrollTop = Math.max(0, top - sc.clientHeight / 2);
      }
    },
    [n, days, geo],
  );

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') move(cursor + (e.shiftKey ? 7 : 1));
    else if (k === 'ArrowLeft' || k === 'ArrowUp') move(cursor - (e.shiftKey ? 7 : 1));
    else if (k === 'PageDown') move(cursor + 30);
    else if (k === 'PageUp') move(cursor - 30);
    else if (k === 'Home') move(0);
    else if (k === 'End') move(n - 1);
    else if (k === 'Enter' || k === ' ') open(days[cursor].d);
    else return;
    e.preventDefault();
  };

  // ---- the day panel's data
  const [loaded, setLoaded] = useState<Record<string, DayPayload | 'error'>>({});
  const have = selected ? loaded[selected] : undefined;
  useEffect(() => {
    if (!selected || have) return;
    let live = true;
    fetch(`${dayUrlBase}/${selected}`)
      .then((r) => (r.ok ? (r.json() as Promise<DayPayload>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (live) setLoaded((prev) => ({ ...prev, [selected]: data }));
      })
      .catch(() => {
        if (live) setLoaded((prev) => ({ ...prev, [selected]: 'error' }));
      });
    return () => {
      live = false;
    };
  }, [selected, have, dayUrlBase]);
  const panel: { state: string; data?: DayPayload } = !selected ? { state: 'idle' } : have === 'error' ? { state: 'error' } : have ? { state: 'ok', data: have } : { state: 'loading' };
  useEffect(() => {
    if (selected) panelHeadRef.current?.focus({ preventScroll: false });
  }, [selected, panel.state]);

  // ---- drawing
  const lane = geo.lanes;
  const mid = (l: [number, number]) => (l[0] + l[1]) / 2;
  const tickLabels = useMemo(() => days.map((d, i) => ({ d: d.d, i })).filter((x) => x.d.endsWith('-01')), [days]);
  const markerShapes = useMemo(() => {
    const out: React.ReactNode[] = [];
    const perDay = new Map<string, number>();
    const count = new Map<string, number>();
    for (const m of markers) if (m.k !== 'p') count.set(`${m.k}${m.d}`, (count.get(`${m.k}${m.d}`) ?? 0) + 1);
    for (const m of markers) {
      const i = index.get(m.d);
      if (i === undefined) continue;
      if (m.k === 'p') {
        const u = uOf(i, timeFrac(m.t));
        const len = m.l ? (lane.p[1] - lane.p[0]) * 0.7 : (lane.p[1] - lane.p[0]) * 0.36;
        const base = lane.p[1] - 4;
        const [x1, y1] = pt(u, base);
        const [x2, y2] = pt(u, base - len);
        out.push(<line key={m.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={m.l ? 2.2 : 1.1} opacity={m.l ? 1 : 0.62} />);
        if (m.l) {
          const [cx, cy] = pt(u, base - len);
          out.push(<circle key={`${m.id}c`} cx={cx} cy={cy} r={3} fill={ACCENT} stroke={INK} strokeWidth={0.8} />);
        }
        continue;
      }
      const key = `${m.k}${m.d}`;
      const k = perDay.get(key) ?? 0;
      perDay.set(key, k + 1);
      const total = count.get(key) ?? 1;
      const l = m.k === 'g' ? lane.g : lane.o;
      const gap = 11;
      const s = mid(l) + (k - (total - 1) / 2) * gap;
      const [cx, cy] = pt(uOf(i, m.t ? timeFrac(m.t) : 0.5), s);
      if (m.k === 'g') {
        const r = 5.2;
        out.push(<path key={m.id} d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`} fill={INK} stroke={ACCENT} strokeWidth={1} />);
      } else {
        out.push(<rect key={m.id} x={cx - 4} y={cy - 4} width={8} height={8} fill="none" stroke={INK} strokeWidth={1.8} />);
      }
    }
    return out;
  }, [markers, index, lane, pt, uOf]);

  const bars = useMemo(() => {
    const out: React.ReactNode[] = [];
    const c = mid(lane.t);
    const half = (lane.t[1] - lane.t[0]) / 2 - 6;
    const dir = geo.mode === 'h' ? { buy: -1, sell: 1 } : { buy: 1, sell: -1 };
    const len = (cum: number) => half * Math.sqrt(cum / maxSide);
    const bw = Math.max(1.4, geo.step * (geo.mode === 'h' ? 0.78 : 0.7));
    days.forEach((d, i) => {
      for (const side of ['buy', 'sell'] as const) {
        const parts = side === 'buy' ? d.bp : d.sl;
        let cum = 0;
        parts.forEach((cnt, gi) => {
          if (!cnt) return;
          const a = len(cum);
          cum += cnt;
          const b = len(cum);
          const u = uOf(i) + (geo.step - bw) / 2;
          const s0 = c + dir[side] * a;
          const s1 = c + dir[side] * b;
          const [xa, ya] = pt(u, Math.min(s0, s1));
          const [xb, yb] = pt(u + bw, Math.max(s0, s1));
          const fill = gi === 0 ? ACCENT : gi === 1 ? MUTED : `url(#${uid}-hatch)`;
          out.push(<rect key={`${d.d}${side}${gi}`} x={Math.min(xa, xb)} y={Math.min(ya, yb)} width={Math.abs(xb - xa)} height={Math.abs(yb - ya)} fill={fill} />);
        });
      }
    });
    return out;
  }, [days, lane, geo, maxSide, pt, uOf, uid]);

  const brentPath = useMemo(() => {
    const [lo, hi] = [brentRange.lo, brentRange.hi];
    const l = lane.b;
    const pts = brent
      .map((b) => {
        const i = index.get(b.d);
        if (i === undefined) return null;
        const s = geo.mode === 'h' ? l[1] - ((b.v - lo) / (hi - lo)) * (l[1] - l[0]) : l[0] + ((b.v - lo) / (hi - lo)) * (l[1] - l[0]);
        const [x, y] = pt(uOf(i, 0.5), s);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .filter(Boolean);
    return pts.length ? `M${pts.join('L')}` : '';
  }, [brent, brentRange, index, lane, geo, pt, uOf]);

  const colAt = (i: number): { x: number; y: number; w: number; h: number } => {
    if (geo.mode === 'h') return { x: geo.u0 + i * geo.step, y: 24, w: geo.step, h: geo.h - 48 };
    return { x: 0, y: geo.u0 + i * geo.step, w: geo.w, h: geo.step };
  };

  const edgeLines = [edges.warStart, edges.month2].map((d) => index.get(d)).filter((x): x is number => x !== undefined);
  const active = hover ?? cursor;
  const activeDay = days[active];
  const hoverMarkers = useMemo(() => markers.filter((m) => m.l && m.d === activeDay?.d), [markers, activeDay]);

  const chart = (
    <svg
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      width="100%"
      role="img"
      aria-label={`Timeline from ${fullShort(days[0].d)} to ${fullShort(days[n - 1].d)}: government acts, the President's posts, oversight, securities transactions per trade day, and the Brent spot price. The same data is in the table.`}
      focusable="false"
      style={{ display: 'block', maxWidth: '100%', height: 'auto', fontFamily: 'var(--font-sans)', touchAction: geo.mode === 'v' ? 'pan-y' : 'manipulation' }}
      data-timeline-svg={geo.mode}
    >
      <defs>
        <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="transparent" />
          <rect width="2" height="5" fill={MUTED} />
        </pattern>
      </defs>
      {/* window edges: the pre-registered windows, not events */}
      {edgeLines.map((i) => {
        const [x1, y1] = pt(uOf(i), 0);
        const [x2, y2] = pt(uOf(i), geo.mode === 'h' ? geo.h - 30 : geo.w);
        return <line key={i} x1={x1} y1={geo.mode === 'h' ? 24 : y1} x2={x2} y2={y2} stroke={MUTED} strokeWidth={1} strokeDasharray="3 4" />;
      })}
      {/* lane frames and labels */}
      {(['g', 'p', 'o', 't', 'b'] as const).map((k) => {
        const l = lane[k];
        if (geo.mode === 'h') {
          return (
            <g key={k}>
              <line x1={geo.u0} x2={geo.u0 + n * geo.step} y1={l[1] + 3} y2={l[1] + 3} stroke={LINE} strokeWidth={1} />
              <text x={8} y={mid(l) + 4} fontSize={14} fontWeight={700} fill={INK}>{LANE_LABEL[k]}</text>
            </g>
          );
        }
        return (
          <line key={k} x1={l[0] - 2} x2={l[0] - 2} y1={geo.u0} y2={geo.u0 + n * geo.step} stroke={LINE} strokeWidth={1} />
        );
      })}
      {/* month ticks */}
      {tickLabels.map(({ d, i }) => {
        const [x, y] = pt(uOf(i), 0);
        return geo.mode === 'h' ? (
          <g key={d}>
            <line x1={x} x2={x} y1={26} y2={geo.h - 32} stroke={LINE} strokeWidth={1} />
            <text x={x + 4} y={geo.h - 12} fontSize={14} fill={INK}>{monthLabel(d)}</text>
          </g>
        ) : (
          <g key={d}>
            <line x1={0} x2={geo.w} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={2} y={y + 13} fontSize={11.5} fontWeight={700} fill={INK}>{monthLabel(d)}</text>
          </g>
        );
      })}
      {geo.mode === 'v' && days.map((d, i) => (i % 7 === 3 ? <text key={d.d} x={2} y={geo.u0 + i * geo.step + 12} fontSize={10} fill={MUTED}>{shortDate(d.d)}</text> : null))}
      {/* transaction baseline */}
      {(() => {
        const c = mid(lane.t);
        const [x1, y1] = pt(0, c);
        const [x2, y2] = pt(n * geo.step, c);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1} />;
      })()}
      {geo.mode === 'h' && [10, 50, 100, 200].filter((v) => v < maxSide).map((v) => {
        const c = mid(lane.t);
        const half = (lane.t[1] - lane.t[0]) / 2 - 6;
        const off = half * Math.sqrt(v / maxSide);
        return (
          <g key={v}>
            <line x1={geo.u0} x2={geo.u0 + n * geo.step} y1={c - off} y2={c - off} stroke={LINE} strokeDasharray="2 4" />
            <line x1={geo.u0} x2={geo.u0 + n * geo.step} y1={c + off} y2={c + off} stroke={LINE} strokeDasharray="2 4" />
            <text x={geo.u0 - 6} y={c - off + 4} fontSize={11.5} fill={MUTED} textAnchor="end">{v}</text>
            <text x={geo.u0 - 6} y={c + off + 4} fontSize={11.5} fill={MUTED} textAnchor="end">{v}</text>
          </g>
        );
      })}
      {geo.mode === 'h' && (
        <g fontSize={11.5} fill={MUTED} textAnchor="end">
          <text x={geo.u0 - 6} y={mid(lane.t) + 4}>0</text>
          <text x={geo.u0 - 6} y={lane.t[0] + 4}>buy</text>
          <text x={geo.u0 - 6} y={lane.t[1] + 2}>sell</text>
        </g>
      )}
      {bars}
      {markerShapes}
      {brentPath && <path d={brentPath} fill="none" stroke={ACCENT} strokeWidth={geo.mode === 'h' ? 2.4 : 1.8} />}
      {geo.mode === 'h' && [brentRange.lo, (brentRange.lo + brentRange.hi) / 2, brentRange.hi].map((v) => {
        const l = lane.b;
        const y = l[1] - ((v - brentRange.lo) / (brentRange.hi - brentRange.lo)) * (l[1] - l[0]);
        return (
          <g key={v}>
            <line x1={geo.u0} x2={geo.u0 + n * geo.step} y1={y} y2={y} stroke={LINE} strokeDasharray="2 4" />
            <text x={geo.u0 - 6} y={y + 4} fontSize={11.5} fill={MUTED} textAnchor="end">${v}</text>
          </g>
        );
      })}
      {geo.mode === 'v' && (
        <g fontSize={10} fill={MUTED}>
          <text x={lane.b[0]} y={geo.u0 - 0} />
        </g>
      )}
      {/* the cursor and the selected day */}
      {(() => {
        const c = colAt(active);
        return <rect x={c.x} y={c.y} width={Math.max(c.w, 2)} height={c.h} fill={ACCENT} opacity={0.18} stroke={ACCENT} strokeWidth={1} data-cursor />;
      })()}
      {selected && index.get(selected) !== undefined && (() => {
        const c = colAt(index.get(selected)!);
        return <rect x={c.x} y={c.y} width={Math.max(c.w, 2)} height={c.h} fill="none" stroke={INK} strokeWidth={2} />;
      })()}
      {/* the hit area */}
      <rect
        x={0}
        y={0}
        width={geo.w}
        height={geo.h}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch') return;
          setHover(dayAt(e.clientX, e.clientY, e.currentTarget));
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const i = dayAt(e.clientX, e.clientY, e.currentTarget);
          if (i === null) return;
          setCursor(i);
          open(days[i].d);
        }}
      />
    </svg>
  );

  // ---- the table
  const tableDays = days.filter((d) => d.g + d.p + d.o + d.t > 0);
  const quiet = n - tableDays.length;
  const tableView = (
    <div>
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Timeline data as a table">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13.5px]" data-timeline-table>
          <caption className="pb-2 text-left font-sans text-[13.5px] text-muted">
            One row for each day with a chronology entry or a securities transaction. Purchases and sales are split energy or defense / other / unclassified. {int(quiet)} days with neither are left out.
          </caption>
          <thead>
            <tr className="border-b border-line align-bottom">
              <th scope="col" className="py-2 pr-3 font-bold">Date</th>
              <th scope="col" className="py-2 pr-3 font-bold">Government acts</th>
              <th scope="col" className="py-2 pr-3 font-bold">Posts</th>
              <th scope="col" className="py-2 pr-3 font-bold">Oversight</th>
              <th scope="col" className="py-2 pr-3 font-bold">Purchases (energy or defense / other / unclassified)</th>
              <th scope="col" className="py-2 pr-3 font-bold">Sales (energy or defense / other / unclassified)</th>
              <th scope="col" className="py-2 pr-3 font-bold">Listed</th>
              <th scope="col" className="py-2 pr-3 font-bold">Brent, $ a barrel</th>
              <th scope="col" className="py-2 font-bold"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {tableDays.map((d) => (
              <tr key={d.d} className="border-b border-line align-top">
                <th scope="row" className="whitespace-nowrap py-1.5 pr-3 font-semibold">{fullShort(d.d)}</th>
                <td className="py-1.5 pr-3 tabular-nums">{int(d.g)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{int(d.p)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{int(d.o)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{d.bp.map(int).join(' / ')}</td>
                <td className="py-1.5 pr-3 tabular-nums">{d.sl.map(int).join(' / ')}</td>
                <td className="py-1.5 pr-3 tabular-nums">{int(d.t)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{d.b === null ? 'No EIA price' : d.b.toFixed(2)}</td>
                <td className="py-1.5">
                  <button type="button" className="font-semibold text-trades-ink underline-offset-2 hover:underline" onClick={() => open(d.d)} aria-label={`Open the records for ${longDate(d.d)}`}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const labelledList = labelled && (
    <ul className="mt-3 space-y-1.5 text-[13.5px]" data-labelled-list>
      {markers.filter((m) => m.l).map((m) => (
        <li key={m.id} className="flex gap-2">
          <button type="button" className="shrink-0 whitespace-nowrap font-semibold text-trades-ink underline-offset-2 hover:underline" onClick={() => { setCursor(index.get(m.d) ?? 0); open(m.d); }}>
            {fullShort(m.d)}
          </button>
          <span className="min-w-0">
            <span className="text-muted">{m.k === 'g' ? 'Government act' : m.k === 'p' ? "The President's post" : 'Oversight'}: </span>
            {m.k === 'p' ? <q data-verbatim>{m.label}</q> : m.label}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div data-war-timeline data-mode={geo.mode} className="font-sans">
      <p className="max-w-[760px] text-[14.5px]">{text.intro}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          aria-pressed={table}
          className="rounded-none border-2 border-ink px-3 py-1.5 text-[14px] font-extrabold hover:bg-neutral-tint"
          data-timeline-toggle
        >
          {table ? text.toChart : text.toTable}
        </button>
        <button
          type="button"
          onClick={() => setLabelled((v) => !v)}
          aria-pressed={labelled}
          className="rounded-none border-2 border-line px-3 py-1.5 text-[14px] font-semibold hover:bg-neutral-tint"
        >
          {labelled ? text.labelledHide : text.labelledShow}
        </button>
      </div>
      {labelledList}

      <p className="mt-4 max-w-[900px] border-l-4 border-[var(--sf-accent,#6534D9)] bg-neutral-tint px-3 py-2 text-[15px] font-bold" data-fixed-line data-above-chart>{text.fixedLine}</p>
      {table ? (
        <div className="mt-4">{tableView}</div>
      ) : (
        <div className="mt-4">
          <div
            ref={wrapRef}
            tabIndex={0}
            role="group"
            aria-label="Timeline chart. Arrow keys move between days; Enter opens a day."
            aria-describedby={`${uid}-kb`}
            onKeyDown={onKey}
            onFocus={() => setHover(null)}
            className="relative border-2 border-line bg-card p-2"
            data-timeline-focus
          >
            {geo.mode === 'v' ? (
              <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: '68vh' }} data-timeline-scroller>
                <div className="sticky top-0 z-10 grid bg-card text-[11px] font-bold" style={{ gridTemplateColumns: '48fr 38fr 48fr 30fr 144fr 52fr' }}>
                  <span>Date</span><span>Gov</span><span>Posts</span><span>Over</span><span className="text-center">Sell | Buy</span><span>Brent</span>
                </div>
                {chart}
              </div>
            ) : (
              chart
            )}
            {hover !== null && geo.mode === 'h' && activeDay && (
              <div
                className="pointer-events-none absolute z-20 max-w-[300px] border-2 border-ink bg-card p-2 text-[13px] shadow-card"
                style={{ left: `${Math.min(70, Math.max(2, ((geo.u0 + (hover + 0.5) * geo.step) / geo.w) * 100 - 8))}%`, top: 8 }}
                aria-hidden
              >
                <p className="font-extrabold">{fullShort(activeDay.d)}</p>
                <p>{int(activeDay.g + activeDay.p + activeDay.o)} chronology entries, {int(activeDay.t)} transactions listed</p>
                {hoverMarkers.map((m) => (
                  <p key={m.id} className="mt-1 text-muted">{m.k === 'p' ? <q data-verbatim>{m.label}</q> : m.label}</p>
                ))}
              </div>
            )}
          </div>
          <p id={`${uid}-kb`} className="mt-2 max-w-[900px] text-[13px] text-muted">{text.keyboard}</p>
          <p className="sr-only" aria-live="polite" role="status">{announce}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
            <button type="button" className="border-2 border-line px-2.5 py-1 font-semibold hover:bg-neutral-tint" onClick={() => move(cursor - 1)} aria-label="Previous day">&larr; Day</button>
            <button type="button" className="border-2 border-line px-2.5 py-1 font-semibold hover:bg-neutral-tint" onClick={() => move(cursor + 1)} aria-label="Next day">Day &rarr;</button>
            <label className="flex items-center gap-2">
              <span className="font-semibold">Go to a date</span>
              <input
                type="date"
                min={days[0].d}
                max={days[n - 1].d}
                value={days[cursor].d}
                onChange={(e) => {
                  const i = index.get(e.target.value);
                  if (i !== undefined) move(i);
                }}
                className="border-2 border-line bg-card px-2 py-1"
              />
            </label>
            <button type="button" className="border-2 border-ink px-2.5 py-1 font-extrabold hover:bg-neutral-tint" onClick={() => open(days[cursor].d)}>
              Open {shortDate(days[cursor].d)}
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" data-legend>
            <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><rect width="14" height="14" fill={ACCENT} /></svg>{GROUPS[0]}</li>
            <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><rect width="14" height="14" fill={MUTED} /></svg>{GROUPS[1]}</li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden><defs><pattern id={`${uid}-lg`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill={MUTED} /></pattern></defs><rect width="14" height="14" fill={`url(#${uid}-lg)`} stroke={MUTED} /></svg>
              {GROUPS[2]}
            </li>
            <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><path d="M7 1L13 7L7 13L1 7Z" fill={INK} stroke={ACCENT} /></svg>Government act</li>
            <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><line x1="7" x2="7" y1="1" y2="13" stroke={INK} strokeWidth="2" /></svg>Post</li>
            <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><rect x="2" y="2" width="10" height="10" fill="none" stroke={INK} strokeWidth="2" /></svg>Oversight</li>
            <li className="flex items-center gap-1.5"><svg width="22" height="14" aria-hidden><path d="M1 11L8 5L14 8L21 2" fill="none" stroke={ACCENT} strokeWidth="2.4" /></svg>Brent spot</li>
          </ul>
          <p className="mt-2 max-w-[900px] text-[13px] text-muted">{geo.mode === 'h' ? text.legendWide : text.legendNarrow}</p>
          <p className="mt-1 max-w-[900px] text-[13px] text-muted">{text.brentLine}</p>
        </div>
      )}

      {selected && (
        <section className="mt-6 border-2 border-ink bg-card p-4 max-md:p-3" aria-labelledby={`${uid}-ph`} data-day-panel={selected}>
          <div className="flex items-start justify-between gap-3">
            <h3 id={`${uid}-ph`} ref={panelHeadRef} tabIndex={-1} className="text-[20px] font-extrabold leading-tight">{longDate(selected)}</h3>
            <button type="button" className="shrink-0 border-2 border-line px-2.5 py-1 text-[13.5px] font-semibold hover:bg-neutral-tint" onClick={() => { setSelected(null); wrapRef.current?.focus(); }}>
              Close
            </button>
          </div>
          <p className="mt-2 border-l-4 border-[var(--sf-accent,#6534D9)] bg-neutral-tint px-3 py-2 text-[14.5px] font-bold" data-fixed-line>{text.fixedLine}</p>
          <DayBody key={selected} panel={panel} text={text} />
        </section>
      )}
    </div>
  );
}

function DayBody({ panel, text }: { panel: { state: string; data?: DayPayload }; text: TlText }) {
  const [shown, setShown] = useState(100);
  const { noChron, noTx, noneED } = text;
  if (panel.state === 'loading' || panel.state === 'idle') return <p className="mt-3 text-[14.5px]" role="status">{text.loading}</p>;
  if (panel.state === 'error' || !panel.data) return <p className="mt-3 text-[14.5px]" role="status">{text.error}</p>;
  const d = panel.data;
  const ed = d.tx.filter((t) => t.cls === 'ED').length;
  return (
    <div className="mt-3 space-y-5 text-[14.5px]">
      <p>
        {d.brent !== null ? text.brentOn.replace('{brent}', d.brent.toFixed(2)) : text.brentNone}
        {d.wti !== null ? ` WTI: $${d.wti.toFixed(2)} a barrel.` : null}
      </p>
      <div>
        <h4 className="text-[15px] font-extrabold">Chronology entries ({int(d.chron.length)})</h4>
        {d.chron.length === 0 ? (
          <p className="mt-1 text-muted">{noChron}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {d.chron.map((c) => (
              <li key={c.id} className="border-l-4 border-line pl-3" data-chron={c.id}>
                <p className="text-[13px] font-bold uppercase tracking-[0.05em] text-muted">
                  {LANE_NAME[c.lane] ?? c.lane}
                  {c.time ? ` · ${c.time} ET` : ''}
                  {c.labelled ? ' · labelled on the chart' : ''}
                </p>
                {c.lane === 'president_post' ? (
                  <blockquote className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap break-words" data-verbatim tabIndex={0} aria-label="The post, verbatim">{c.quote ?? c.text}</blockquote>
                ) : (
                  <p className="mt-1">{c.text}</p>
                )}
                <p className="mt-1 text-[13.5px]">
                  <a href={c.sourceUrl} className="font-semibold text-trades-ink underline-offset-2 hover:underline" rel="noreferrer">Source</a>
                  {c.archiveUrl ? <> · <a href={c.archiveUrl} className="font-semibold text-trades-ink underline-offset-2 hover:underline" rel="noreferrer">Archive copy</a></> : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-[15px] font-extrabold">Securities transactions with this trade date ({int(d.tx.length)})</h4>
        {d.tx.length === 0 ? (
          <p className="mt-1 text-muted">{noTx}</p>
        ) : (
          <>
            <p className="mt-1 text-muted" data-day-count>
              {text.dayCount.replace('{n}', int(d.tx.length)).replace('{ed}', int(ed))}{ed === 0 ? ` ${noneED}.` : ''}
            </p>
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Transactions for this day">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-line align-bottom">
                    <th scope="col" className="py-1.5 pr-3 font-bold">Asset</th>
                    <th scope="col" className="py-1.5 pr-3 font-bold">Type</th>
                    <th scope="col" className="py-1.5 pr-3 font-bold">Amount band</th>
                    <th scope="col" className="py-1.5 pr-3 font-bold">Group</th>
                    <th scope="col" className="py-1.5 font-bold">Report, page and line</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tx.slice(0, shown).map((t) => (
                    <tr key={t.id} className="border-b border-line align-top">
                      <th scope="row" className="py-1.5 pr-3 font-normal">{t.asset}</th>
                      <td className="py-1.5 pr-3">{t.type === 'purchase' ? 'Purchase' : t.type === 'sale' ? 'Sale' : 'Exchange'}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3">{t.band}</td>
                      <td className="py-1.5 pr-3">{t.cls === 'ED' ? GROUPS[0] : t.cls === 'other' ? GROUPS[1] : GROUPS[2]}</td>
                      <td className="py-1.5">
                        <a href={t.href} className="font-semibold text-trades-ink underline-offset-2 hover:underline" rel="noreferrer">
                          {t.report}{t.page ? `, page ${t.page}` : ''}{t.line ? `, line ${t.line}` : ''}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < d.tx.length && (
              <button type="button" className="mt-2 border-2 border-line px-3 py-1.5 font-semibold hover:bg-neutral-tint" onClick={() => setShown((s) => s + 200)}>
                Show {int(Math.min(200, d.tx.length - shown))} more of {int(d.tx.length - shown)} remaining
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
