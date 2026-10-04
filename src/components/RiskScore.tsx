'use client';

import { AlertTriangle, Shield, ShieldAlert, Zap } from 'lucide-react';

interface Props {
  /** 0-100 risk score. */
  score: number;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Render as a number-only badge. */
  compact?: boolean;
}

interface Tier {
  label: string;
  color: string;        // text color
  bg: string;           // background
  border: string;       // border
  icon: React.ReactNode;
}

function tierFor(score: number): Tier {
  if (score >= 80) return {
    label: 'Extreme',
    color: 'text-red-300',
    bg: 'bg-red-950/60',
    border: 'border-red-700',
    icon: <Zap size={11} />,
  };
  if (score >= 60) return {
    label: 'High',
    color: 'text-rose-300',
    bg: 'bg-rose-950/60',
    border: 'border-rose-700',
    icon: <AlertTriangle size={11} />,
  };
  if (score >= 40) return {
    label: 'Elevated',
    color: 'text-amber-300',
    bg: 'bg-amber-950/40',
    border: 'border-amber-700',
    icon: <ShieldAlert size={11} />,
  };
  return {
    label: 'Low',
    color: 'text-slate-300',
    bg: 'bg-slate-900/60',
    border: 'border-slate-700',
    icon: <Shield size={11} />,
  };
}

/**
 * Standardized 0-100 risk score. Color ramp into Slush Red, threat-level
 * labels (Low / Elevated / High / Extreme). Same component everywhere.
 */
export default function RiskScore({ score, size = 'md', compact = false }: Props) {
  const tier = tierFor(score);
  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }[size];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-mono font-bold tabular-nums border ${tier.bg} ${tier.border} ${tier.color} ${sizeClass}`}
        title={`Risk: ${tier.label} (${score}/100)`}
      >
        {score}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-mono font-bold tabular-nums border ${tier.bg} ${tier.border} ${tier.color} ${sizeClass}`}
      title={`Risk score ${score}/100`}
    >
      {tier.icon}
      <span className="font-black">{score}</span>
      <span className="font-bold uppercase tracking-widest text-[10px] opacity-80">{tier.label}</span>
    </span>
  );
}
