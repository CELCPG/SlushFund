import { cn } from '@/lib/cn';

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  /** Lucide (or any) icon component rendered at 13px. */
  icon?: React.ElementType;
  /** Tailwind text-color class for the icon + value, e.g. "text-emerald-400". */
  color?: string;
  /** Danger-tinted surface for emphasized stats. */
  highlight?: boolean;
}

/**
 * Heavy investigative KPI tile (mono value, uppercase label).
 * Shared replacement for the inline KpiCard previously duplicated in
 * dashboard/page.tsx and congress/trades/page.tsx.
 * (For the lighter influence-hub tile, use StatCard.)
 */
export function KpiCard({ label, value, sub, icon: Icon, color = 'text-slate-200', highlight }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border px-5 py-4',
        highlight ? 'border-red-700/60 bg-red-950/30' : 'border-slate-800 bg-slate-900',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon size={13} className={color} />}
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className={cn('font-mono text-3xl font-black', color)}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
