import { ReactNode } from 'react';

type Accent = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'slate';

const ACCENT: Record<Accent, { ring: string; text: string }> = {
  red: { ring: 'border-red-500/30', text: 'text-red-400' },
  amber: { ring: 'border-amber-500/30', text: 'text-amber-400' },
  green: { ring: 'border-emerald-500/30', text: 'text-emerald-400' },
  blue: { ring: 'border-blue-500/30', text: 'text-blue-400' },
  purple: { ring: 'border-purple-500/30', text: 'text-purple-400' },
  slate: { ring: 'border-slate-700', text: 'text-slate-200' },
};

export interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
  accent?: Accent;
}

/** Shared KPI tile. One consistent stat card across the Influence hub. */
export function StatCard({ label, value, sublabel, icon, accent = 'slate' }: StatCardProps) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-xl border ${a.ring} bg-slate-900/60 p-4`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon && <span className={a.text}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${a.text}`}>{value}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}
