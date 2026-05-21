'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Database, Link2, Gavel, Flag, ArrowRight } from 'lucide-react';
import { type HomeStats, formatCompactUSD } from '@/lib/home-stats';
import EraToggle from '@/components/home/EraToggle';
import { ERA_LABELS, type Era } from '@/lib/types';

/** Headline numbers band. Values come from getHomeStats() (live or curated). */
export default function LiveStatsBand({ stats }: { stats: HomeStats }) {
  const [selectedEra, setSelectedEra] = useState<Era | 'all'>(stats.era ?? 'all');
  const [displayStats, setDisplayStats] = useState(stats);

  useEffect(() => {
    if (selectedEra === 'all') {
      setDisplayStats(stats);
      return;
    }
    // Refetch stats filtered by era
    fetch(`/api/era-stats?era=${selectedEra}`)
      .then(r => r.json())
      .then(data => {
        setDisplayStats({
          live: true,
          totalDollars: data.total_dollars ?? 0,
          connectedDollars: data.connected_dollars ?? 0,
          noBidDollars: data.no_bid_dollars ?? 0,
          flaggedCount: data.flagged_count ?? 0,
          congressTrades: stats.congressTrades,
          membersTracked: stats.membersTracked,
          contractorOverlap: stats.contractorOverlap,
          cryptoPacDollars: stats.cryptoPacDollars,
          politiciansHoldingBtc: stats.politiciansHoldingBtc,
          era: selectedEra,
        });
      })
      .catch(() => {
        // On error, show the server stats with era override
        setDisplayStats({ ...stats, era: selectedEra });
      });
  }, [selectedEra, stats]);

  const items = [
    {
      icon: Database,
      label: 'Total Tracked',
      value: formatCompactUSD(stats.totalDollars),
      color: 'text-white',
      sub: 'Federal contracts & grants',
    },
    {
      icon: Link2,
      label: 'Politically Connected',
      value: formatCompactUSD(stats.connectedDollars),
      color: 'text-red-400',
      sub: 'Awarded to flagged vendors',
    },
    {
      icon: Gavel,
      label: 'No-Bid / Sole-Source',
      value: formatCompactUSD(stats.noBidDollars),
      color: 'text-orange-400',
      sub: 'Awarded without competition',
    },
    {
      icon: Flag,
      label: 'Flagged Awards',
      value: stats.flaggedCount.toLocaleString(),
      color: 'text-amber-400',
      sub: 'Surfaced for review',
    },
  ];

  const eraLabel = selectedEra === 'all' ? 'All Years' : ERA_LABELS[selectedEra];

  return (
    <section className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  displayStats.live ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                {displayStats.live ? 'Live from the database' : 'Tracked to date'}
              </span>
            </div>
            <EraToggle currentEra={selectedEra} onChange={setSelectedEra} size="sm" />
            {selectedEra !== 'all' && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                {eraLabel}
              </span>
            )}
          </div>
          <Link
            href={`/dashboard${selectedEra !== 'all' ? `?era=${selectedEra}` : ''}`}
            className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
          >
            Full breakdown <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.label}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 text-slate-500 mb-3">
                  <Icon size={15} />
                  <span className="text-xs font-medium uppercase tracking-wide">{it.label}</span>
                </div>
                <div className={`text-3xl md:text-4xl font-black font-mono ${it.color}`}>
                  {it.value}
                </div>
                <div className="text-slate-500 text-xs mt-2">{it.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
