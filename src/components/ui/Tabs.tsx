'use client';
import { ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

/** Shared horizontal tab bar used by the Influence hub. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-slate-800 bg-slate-950/80 sticky top-14 z-40 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#E63946] text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
