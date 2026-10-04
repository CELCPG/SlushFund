'use client';

import { FileText, ExternalLink, Database, DollarSign, Network, Activity, TrendingUp } from 'lucide-react';

interface Source {
  label: string;
  short: string;
  description: string;
  url: string;
  icon: React.ReactNode;
}

const SOURCES: Source[] = [
  {
    label: 'USAspending.gov',
    short: 'Federal contracts',
    description: 'Official federal spending data: contracts, grants, loans, direct payments.',
    url: 'https://www.usaspending.gov',
    icon: <Database size={14} className="text-emerald-300" />,
  },
  {
    label: 'OGE Form 278-T',
    short: 'Presidential & executive disclosures',
    description: 'Office of Government Ethics periodic transaction reports. Source for Trump, Cabinet, senior staff trades.',
    url: 'https://oge.gov',
    icon: <FileText size={14} className="text-amber-300" />,
  },
  {
    label: 'FEC.gov',
    short: 'Campaign finance',
    description: 'Federal Election Commission. PAC donations, candidate committees, independent expenditures.',
    url: 'https://www.fec.gov',
    icon: <DollarSign size={14} className="text-blue-300" />,
  },
  {
    label: 'OpenSecrets.org',
    short: 'Influence & lobbying',
    description: 'CRP. Tracks dark money networks, lobbying disclosures, PAC money flow.',
    url: 'https://www.opensecrets.org',
    icon: <Network size={14} className="text-purple-300" />,
  },
  {
    label: 'QuiverQuant',
    short: 'Congressional trading',
    description: 'Aggregates STOCK Act disclosures from the House Clerk and Senate EFD systems.',
    url: 'https://www.quiverquant.com',
    icon: <TrendingUp size={14} className="text-rose-300" />,
  },
  {
    label: 'LDA Filings',
    short: 'Lobbying disclosures',
    description: 'Lobbying Disclosure Act filings via the Senate LDA database.',
    url: 'https://lda.senate.gov',
    icon: <Activity size={14} className="text-cyan-300" />,
  },
];

/**
 * Source receipts footer. Lists every primary data source with a deep link
 * to the underlying filing system. The aggression is earned by the sourcing.
 */
export default function SourceReceipts({ heading = 'Every claim is sourced' }: { heading?: string }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
        {heading}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCES.map(s => (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg bg-slate-950/60 border border-slate-800 p-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {s.icon}
                <span className="text-white text-sm font-bold truncate group-hover:text-slate-100">
                  {s.label}
                </span>
              </div>
              <ExternalLink size={11} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0 mt-1" />
            </div>
            <div className="text-xs text-slate-400 mb-1 font-mono uppercase tracking-widest">{s.short}</div>
            <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
          </a>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4 italic">
        Public records only. No leaks. No anonymous tips. If you can&apos;t verify it here, we don&apos;t run it.
      </p>
    </section>
  );
}
