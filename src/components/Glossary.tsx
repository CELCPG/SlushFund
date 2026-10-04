'use client';

/**
 * Glossary — inline tooltip for jargon.
 *
 * Usage:
 *   <Glossary term="no-bid">no-bid contract</Glossary>
 *
 * Hover (desktop) or tap (mobile) the inline term to see a short plain-English
 * explanation. No external popovers, no library deps.
 */

import { useState, useId, ReactNode } from 'react';

export type GlossaryEntry = {
  /** The term as the user should see it. Case-insensitive match. */
  term: string;
  /** Short, plain-English explanation (one or two sentences, ~120 chars max). */
  definition: string;
  /** Optional one-line source note. */
  source?: string;
};

export const GLOSSARY: Record<string, Omit<GlossaryEntry, 'term'>> = {
  'no-bid': {
    definition:
      'A contract awarded without a competitive bidding process. Federal law requires justification, but the loophole is wide.',
    source: '41 U.S.C. § 3304',
  },
  'sole-source': {
    definition:
      'A no-bid contract justified by claiming only one vendor can do the work. Frequently used for "follow-on" awards to incumbent contractors.',
    source: 'FAR 6.302-1',
  },
  'connection-type': {
    definition:
      'Our classification of how a contractor connects to politically exposed people — Trump family, Musk, Trump ally, GOP donor, Mar-a-Lago member, related party, or none.',
  },
  '278-t': {
    definition:
      'The public financial disclosure form required of senior executive-branch officials. Slower than the 278 (annual) and reveals broad holdings ranges, not exact amounts.',
    source: '5 CFR § 2634.301',
  },
  'stock-act': {
    definition:
      'Stop Trading on Congressional Knowledge Act (2012). Banned congressional insider trading. Contains disclosure and 45-day recusal rules, with broad exemptions.',
  },
  'blind-trust': {
    definition:
      'A financial arrangement where the owner cannot see or control specific assets. Supposed to prevent conflicts of interest. Often structured with such loose terms that the owner retains effective knowledge.',
  },
  'no-bid-pct': {
    definition:
      'Percent of an entity’s tracked dollars that were awarded without competition. The higher, the more the award pattern smells.',
  },
  'overlap': {
    definition:
      'A congressional trade in a company that holds active federal contracts in the member’s oversight area. The legal floor for an ethics referral — not proof of a crime, but rarely a coincidence.',
  },
  'risk-score': {
    definition:
      '0–100 composite of no-bid share, dollar volume, and entity concentration. 40+ is elevated. 60+ is high. 80+ is extreme.',
  },
  'connection_type': {
    definition:
      'See connection-type — we use `connection_type` as the database column name.',
  },
  'lda': {
    definition:
      'Lobbying Disclosure Act filings. Quarterly federal disclosures of who is paid to lobby whom. Aggregated by OpenSecrets.',
    source: '2 U.S.C. § 1601 et seq.',
  },
  'quiver': {
    definition:
      'Quiver Quantitative — third-party API that scrapes House and Senate financial disclosure PDFs and normalizes them into structured trades.',
  },
};

type Props = {
  term: keyof typeof GLOSSARY | string;
  children: ReactNode;
  className?: string;
  /** Force a "dotted underline" or "bordered" look. Default: dotted-underline. */
  variant?: 'underline' | 'border';
};

export function Glossary({ term, children, className = '', variant = 'underline' }: Props) {
  const key = term.toLowerCase();
  const entry = GLOSSARY[key];
  const [open, setOpen] = useState(false);
  const tipId = useId();

  if (!entry) {
    // Unknown term — render children as-is so we never silently break copy.
    return <>{children}</>;
  }

  const base =
    'cursor-help inline-flex items-baseline gap-0.5 transition-colors';
  const style =
    variant === 'border'
      ? 'border-b border-dotted border-slate-500 hover:border-slush-red hover:text-slush-red'
      : 'underline decoration-dotted decoration-slate-500 underline-offset-4 hover:decoration-slush-red hover:text-slush-red';

  return (
    <span className={`relative inline ${className}`}>
      <button
        type="button"
        aria-describedby={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className={`${base} ${style}`}
      >
        {children}
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute z-50 left-0 bottom-full mb-2 w-72 max-w-[80vw] px-3.5 py-2.5 rounded-md bg-slate-900 border border-slate-700 shadow-2xl text-left text-[12px] leading-snug text-slate-200 font-sans normal-case tracking-normal"
        >
          <span className="block font-bold text-slush-red text-[10px] uppercase tracking-widest mb-1">
            {term}
          </span>
          <span className="block text-slate-200">{entry.definition}</span>
          {entry.source && (
            <span className="block mt-1.5 text-[10px] font-mono text-slate-500">
              Source: {entry.source}
            </span>
          )}
          {/* Arrow */}
          <span className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-700" />
        </span>
      )}
    </span>
  );
}
