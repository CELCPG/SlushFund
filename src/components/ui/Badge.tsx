import { ReactNode } from 'react';
import { CONNECTION_LABELS } from '@/lib/utils';
import type { ConnectionType } from '@/lib/types';

export type BadgeTone =
  | 'trump' | 'musk' | 'ally' | 'donor' | 'foreign' | 'neutral'
  | 'danger' | 'warning' | 'success' | 'info';

const TONE: Record<BadgeTone, string> = {
  trump: 'bg-red-500/15 text-red-300 border-red-500/30',
  musk: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  ally: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  donor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  foreign: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  neutral: 'bg-slate-700/40 text-slate-300 border-slate-600',
  danger: 'bg-red-500/15 text-red-300 border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  info: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

/** Maps a connection_type / connection_category string to a badge tone. */
export function toneForConnection(connection?: string): BadgeTone {
  switch (connection) {
    case 'trump_family': return 'trump';
    case 'elon_musk': return 'musk';
    case 'trump_ally': return 'ally';
    case 'gop_donor': return 'donor';
    case 'foreign_sovereign': return 'foreign';
    default: return 'neutral';
  }
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

// ─── Connection badge (canonical) ──────────────────────────────────────────
// Solid investigative style; single source replacing inline copies in
// dashboard / tech / defense pages.
const CONNECTION_STYLES: Record<string, string> = {
  elon_musk: 'bg-purple-900 text-purple-200 border-purple-700',
  trump_family: 'bg-red-900 text-red-200 border-red-700',
  trump_ally: 'bg-blue-900 text-blue-200 border-blue-700',
  suspected: 'bg-amber-900 text-amber-200 border-amber-700',
  none: 'bg-slate-800 text-slate-400 border-slate-700',
};

export function ConnectionBadge({ type }: { type: string | null }) {
  if (!type || type === 'none') return <span className="text-xs text-slate-600">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
        CONNECTION_STYLES[type] ?? CONNECTION_STYLES.none
      }`}
    >
      {CONNECTION_LABELS[type as ConnectionType] ?? type}
    </span>
  );
}

// ─── Flag badge (canonical) ────────────────────────────────────────────────
// Single source replacing inline copies in dashboard / tech / defense /
// contract pages. Supersedes the orphaned .flag-* CSS in globals.css.
const FLAG_STYLES: Record<string, string> = {
  no_bid: 'bg-rose-900 text-rose-300 border-rose-700',
  sole_source: 'bg-orange-900 text-orange-300 border-orange-700',
  related_party: 'bg-violet-900 text-violet-300 border-violet-700',
  inflated: 'bg-pink-900 text-pink-300 border-pink-700',
  no_compete_high_value: 'bg-red-900 text-red-300 border-red-700',
  large_award: 'bg-amber-900 text-amber-300 border-amber-700',
  limited_competition: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  non_competitive: 'bg-red-900 text-red-300 border-red-700',
  cost_plus: 'bg-slate-700 text-slate-300 border-slate-600',
  emergency: 'bg-blue-900 text-blue-300 border-blue-700',
};

export function FlagBadge({ flag }: { flag: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${
        FLAG_STYLES[flag] ?? 'bg-slate-800 text-slate-400 border-slate-700'
      }`}
    >
      {flag.replace(/_/g, ' ')}
    </span>
  );
}

// ─── MiniBar ───────────────────────────────────────────────────────────────
export function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-slate-800">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
