import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { MONEY_TYPES, MONEY_TYPE_ORDER, type MoneyType } from '@/lib/v2/money';

/** The letter icon (C / T / $ / L). Decorative: the label always sits next to it. */
export function MoneyIcon({ type, size = 'md', className }: { type: MoneyType; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const m = MONEY_TYPES[type];
  const dims = size === 'sm' ? 'h-[18px] w-[18px] rounded-[5px] text-[11px]' : size === 'lg' ? 'h-[34px] w-[34px] rounded-[10px] text-[15px]' : 'h-[22px] w-[22px] rounded-[6px] text-[12px]';
  return (
    <span aria-hidden className={cn('inline-grid flex-none place-items-center font-mono font-medium leading-none', m.icon, dims, className)}>
      {m.letter}
    </span>
  );
}

/**
 * Money-type chip: letter icon + label, optionally followed by a value
 * ("Contracts · $2.1B"). The label is always present so color is never the
 * only cue.
 */
export function MoneyChip({
  type,
  value,
  label,
  className,
}: {
  type: MoneyType;
  /** Optional figure or note after the label. */
  value?: ReactNode;
  /** Override the label text (keep it naming the money type). */
  label?: string;
  className?: string;
}) {
  const m = MONEY_TYPES[type];
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-[3px] pr-3 text-[13px] font-semibold', m.chip, className)}>
      <MoneyIcon type={type} size="sm" />
      <span>{label ?? m.label}</span>
      {value != null && (
        <>
          <span aria-hidden className="opacity-60">·</span>
          <span className="truncate font-mono text-[12.5px] font-medium">{value}</span>
        </>
      )}
    </span>
  );
}

/** The four-color key ("How to read the colors"). */
export function MoneyLegend({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {MONEY_TYPE_ORDER.map((t) => <MoneyChip key={t} type={t} />)}
      </div>
    );
  }
  return (
    <div className={cn('grid grid-cols-2 gap-2.5', className)}>
      {MONEY_TYPE_ORDER.map((t) => {
        const m = MONEY_TYPES[t];
        return (
          <div key={t} className={cn('rounded-2xl p-4 text-sm', m.chip)}>
            <div className="mb-1 flex items-center gap-2">
              <MoneyIcon type={t} />
              <b className="font-display text-[17px] font-extrabold">{m.label}</b>
            </div>
            {m.description} ({m.source})
          </div>
        );
      })}
    </div>
  );
}

/** "Worth a look" highlighter tag: a pattern in the records, never an accusation. */
export function FlagChip({ children = 'Worth a look', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-highlight px-3 py-1 text-[13px] font-semibold text-highlight-ink', className)}>
      <span aria-hidden>⚑</span>
      {children}
    </span>
  );
}
