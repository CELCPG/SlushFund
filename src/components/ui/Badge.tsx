import { ReactNode } from 'react';

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
