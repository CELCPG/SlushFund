import Link from 'next/link';
import { ArrowRight, Shield, AlertTriangle, ArrowDown, ExternalLink } from 'lucide-react';
import { ENTITIES } from '@/lib/entities';
import { loadEntitySpending, loadEntityTrading, loadEntityInfluence } from '@/lib/entity-data';
import { Glossary } from '@/components/Glossary';
import LoopStepLink from '@/components/home/LoopStepLink';

export const metadata = {
  title: 'The Loop · How the money moves · SlushFund',
  description: 'The five steps from a no-bid contract to a re-election funded by the vendor PAC. Walked through with a real example: Elon Musk.',
};

const STEPS = [
  {
    n: 1,
    label: 'No-bid award',
    desc: 'A contract is awarded without competitive bidding. Emergency designation, sole source, or ignored procurement rules.',
    href: '/dashboard?competition=no_bid,sole_source',
  },
  {
    n: 2,
    label: 'Insider holds',
    desc: 'A member of Congress or executive branch official already holds stock in the vendor, or sits on its board.',
    href: '/congress/trades?has_contract=true',
  },
  {
    n: 3,
    label: 'Announcement spike',
    desc: 'The award is announced. The vendor stock price jumps. The insider\u2019s position is now worth more.',
    href: '/investigations',
  },
  {
    n: 4,
    label: 'Insider sells',
    desc: 'The insider liquidates. Your 401k, holding the same stock, holds the bag when the price comes back down.',
    href: '/congress/trades?type=SELL&has_contract=true',
  },
  {
    n: 5,
    label: 'PAC money back',
    desc: 'The vendor\u2019s PAC donates to the officials who awarded the contract. The loop is closed. It runs again.',
    href: '/influence?tab=pacs',
  },
];

/**
 * Pick the entity with the biggest footprint across all three databases
 * (spending + trades + influence). That's our "real example" — usually Musk or Trump Org.
 */
async function pickFeaturedExample() {
  const totals = await Promise.all(
    ENTITIES.map(async (e) => {
      const [s, t, i] = await Promise.all([
        loadEntitySpending(e),
        loadEntityTrading(e),
        loadEntityInfluence(e),
      ]);
      // Score: contracts dollar value (~$M each), trades ($10K each), influence ($1K each)
      const tradeVolume = t.trades.reduce((a, x) => a + Math.min(x.amount_max ?? 50_000, 1_000_000), 0);
      const pacVolume = i.pacs.reduce((a, x) => a + x.total_raised_2016_2024, 0);
      const score = s.total_dollars + tradeVolume + pacVolume * 10;
      return { entity: e, dollars: s.total_dollars, trades: t.trades.length, influence: i.pacs.length, score };
    })
  );
  return totals.sort((a, b) => b.score - a.score)[0];
}

export default async function LoopPage() {
  // Top 6 entities to show as live examples
  const totals = await Promise.all(
    ENTITIES.map(async (e) => {
      const s = await loadEntitySpending(e);
      return { entity: e, dollars: s.total_dollars };
    })
  );
  const featured = totals
    .filter(t => t.dollars > 0)
    .sort((a, b) => b.dollars - a.dollars)
    .slice(0, 6);

  // The one we walk through end-to-end
  const example = await pickFeaturedExample();
  const exampleSpending = await loadEntitySpending(example.entity);
  const exampleTrades = (await loadEntityTrading(example.entity)).trades;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-mono uppercase tracking-widest mb-6">
            <Shield size={12} /> The Loop
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            How the money moves.
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mb-2">
            The five steps from a <Glossary term="no-bid">no-bid contract</Glossary> to a re-election funded by the vendor PAC. This is the information architecture of the site. Every data page you click is one step in the loop.
          </p>
        </div>
      </div>

      {/* The five steps */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">The five steps</h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <LoopStepLink key={s.n} step={s} />
          ))}
        </div>
      </div>

      {/* Worked example */}
      <div className="border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 text-[10px] font-mono uppercase tracking-widest">Worked example</span>
          </div>
          <h2 className="text-3xl font-black text-white mb-3">
            {example.entity.name}, end-to-end.
          </h2>
          <p className="text-slate-400 max-w-2xl mb-8">
            This is what the loop looks like in real data, for {example.entity.name}. The numbers are live.
          </p>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Federal contracts</div>
              <div className="text-2xl font-black text-white">${(exampleSpending.total_dollars / 1_000_000_000).toFixed(2)}B</div>
              <div className="text-xs text-slate-500 mt-1">{exampleSpending.count.toLocaleString()} awards</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Congressional trades</div>
              <div className="text-2xl font-black text-white">{exampleTrades.length}</div>
              <div className="text-xs text-slate-500 mt-1">disclosed in window</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">No-bid share</div>
              <div className="text-2xl font-black text-red-400">
                {exampleSpending.count > 0 ? Math.round((exampleSpending.no_bid_count / exampleSpending.count) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-500 mt-1">of tracked dollars</div>
            </div>
          </div>

          {/* Walking timeline */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <ol className="space-y-6">
              {STEPS.map((s, idx) => (
                <li key={s.n} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center text-red-400 font-black font-mono text-sm">
                      {s.n}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-slate-800 my-2 min-h-[24px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <h3 className="text-white font-bold text-base mb-1">{s.label}</h3>
                    <p className="text-slate-400 text-sm mb-2">{s.desc}</p>
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-mono uppercase tracking-widest"
                    >
                      Open evidence <ExternalLink size={11} />
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-slate-300 text-sm">See the full {example.entity.name} dossier.</p>
                <p className="text-slate-500 text-xs">Every contract, every trade, every PAC dollar. Receipts included.</p>
              </div>
              <Link
                href={`/entity/${example.entity.slug}`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                Open dossier <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* See it running right now */}
      {featured.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">See it running right now</h2>
          <p className="text-slate-400 text-sm mb-4">
            These entities appear in the loop. Each one has a full page with every contract, every trade, every PAC dollar.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map(({ entity, dollars }) => (
              <Link
                key={entity.slug}
                href={`/entity/${entity.slug}`}
                className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-red-600/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-red-400">{entity.connection}</span>
                  <span className="font-mono text-xs text-slate-300">${(dollars / 1_000_000).toFixed(0)}M</span>
                </div>
                <div className="text-white font-bold group-hover:text-red-300 transition-colors">{entity.name}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{entity.blurb}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Why this matters */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-xl border border-amber-600/30 bg-amber-900/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-200 font-bold text-sm mb-1">Why this matters</h3>
            <p className="text-amber-100/70 text-sm">
              The loop is not a theory. Every step above has a real, searchable evidence view. Start at any step and pull the thread. The <Glossary term="stock-act">STOCK Act</Glossary> was supposed to break this loop. It didn’t.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
