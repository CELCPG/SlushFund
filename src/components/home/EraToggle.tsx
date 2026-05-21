'use client';

import { useState } from 'react';
import { ERA_FYS, ERA_LABELS, type Era } from '@/lib/types';

const ERAS: { key: Era | 'all'; label: string; fyLabel: string }[] = [
  { key: 'all',     label: 'All Years',       fyLabel: 'FY19–26' },
  { key: 'trump_1', label: 'Trump 1.0',       fyLabel: 'FY2019' },
  { key: 'covid',   label: 'COVID Era',       fyLabel: 'FY20–21' },
  { key: 'biden',   label: 'Biden',           fyLabel: 'FY22–24' },
  { key: 'trump_2', label: 'Trump 2.0 + DOGE', fyLabel: 'FY25–26' },
];

interface EraToggleProps {
  currentEra?: Era | 'all';
  onChange: (era: Era | 'all') => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function EraToggle({ currentEra = 'all', onChange, size = 'md', className = '' }: EraToggleProps) {
  const baseClasses = 'flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 p-1';
  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const btnBase = 'px-3 py-1.5 rounded-md font-mono font-medium transition-all';
  const btnInactive = 'text-slate-400 hover:text-white hover:bg-slate-800';
  const btnActive = 'bg-[var(--slush-green)] text-black font-semibold';

  return (
    <div className={`${baseClasses} ${sizes[size]} ${className}`}>
      {ERAS.map(({ key, label, fyLabel }) => {
        const isActive = currentEra === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={fyLabel}
            className={`${btnBase} ${isActive ? btnActive : btnInactive}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}