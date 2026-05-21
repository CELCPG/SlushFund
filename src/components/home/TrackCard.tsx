'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';

type Accent = 'emerald' | 'blue' | 'orange';

const ACCENT: Record<
  Accent,
  { icon: string; bg: string; border: string; hover: string; link: string; bar: string }
> = {
  emerald: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-700',
    hover: 'hover:border-emerald-600/50',
    link: 'text-emerald-400',
    bar: '#10b981',
  },
  blue: {
    icon: 'text-blue-400',
    bg: 'bg-blue-900/40',
    border: 'border-blue-700',
    hover: 'hover:border-blue-600/50',
    link: 'text-blue-400',
    bar: '#3b82f6',
  },
  orange: {
    icon: 'text-orange-400',
    bg: 'bg-orange-900/40',
    border: 'border-orange-700',
    hover: 'hover:border-orange-600/50',
    link: 'text-orange-400',
    bar: '#f97316',
  },
};

export interface TrackStat {
  label: string;
  value: string;
  color: string;
}

export interface TrackCardProps {
  accent: Accent;
  /** Pre-rendered icon element (passed from a server component). */
  icon: ReactNode;
  title: string;
  subtitle: string;
  href: string;
  ctaLabel: string;
  stats: TrackStat[];
  /** Mini-bar values for visual interest — relative magnitudes only. */
  chartData: number[];
}

/** Reusable landing-page track card with stats and a recharts mini-bar. */
export default function TrackCard({
  accent,
  icon,
  title,
  subtitle,
  href,
  ctaLabel,
  stats,
  chartData,
}: TrackCardProps) {
  const a = ACCENT[accent];
  const data = chartData.map((v, i) => ({ i, v }));
  const max = Math.max(...chartData);

  return (
    <Link
      href={href}
      className={`group flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-5 transition-all ${a.hover}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-lg ${a.bg} border ${a.border} flex items-center justify-center shrink-0 ${a.icon}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-white font-bold text-base">{title}</div>
          <div className="text-slate-500 text-xs">{subtitle}</div>
        </div>
      </div>

      {/* Mini-bar chart */}
      <div className="h-14 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.i}
                  fill={a.bar}
                  fillOpacity={0.35 + 0.65 * (d.v / (max || 1))}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
            <div className={`text-lg font-black font-mono ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div
        className={`mt-auto flex items-center gap-1 text-sm font-medium ${a.link} group-hover:gap-2 transition-all`}
      >
        {ctaLabel} <ArrowRight size={14} />
      </div>
    </Link>
  );
}
