import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DollarSign, TrendingUp, Building2, AlertTriangle, FileText,
  ArrowRight, Shield, Database, Activity, Scale, Network, ExternalLink
} from 'lucide-react';
import { fmt } from '@/lib/utils';
import { loadEntityPageData } from '@/lib/entity-data';
import WhoPays from '@/components/WhoPays';
import RiskScore from '@/components/RiskScore';
import SourceReceipts from '@/components/SourceReceipts';
import { Glossary } from '@/components/Glossary';
import TrackPageView from '@/components/TrackPageView';
import { getAllEntitySlugs } from '@/lib/entities';

export const revalidate = 600; // 10 min

export async function generateStaticParams() {
  return getAllEntitySlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadEntityPageData(slug);
  if (!data) return { title: 'Entity Not Found' };
  return {
    title: `${data.config.name}. SlushFund`,
    description: data.config.summary,
    alternates: { canonical: `/entity/${slug}` },
  };
}

const LOOP_STEPS = [
  { n: 1, label: 'No-bid award' },
  { n: 2, label: 'Insider holds' },
  { n: 3, label: 'Announcement spike' },
  { n: 4, label: 'Insider sells' },
  { n: 5, label: 'PAC money back' },
] as const;

const LOOP_FILTER_URLS = {
  1: '/dashboard?competition=no_bid,sole_source',
  2: '/congress/trades?has_contract=true',
  3: '/investigations',
  4: '/congress/trades?type=SELL&has_contract=true',
  5: '/influence?tab=pacs',
} as const;

export default async function EntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadEntityPageData(slug);
  if (!data) notFound();

  const { config, spending, trading, influence, timeline, loop_position, total_tracked } = data;

  return (
    <div className="min-h-screen bg-slate-950">
      <TrackPageView event="entity_page_view" data={{ slug, tracked: total_tracked }} />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 text-sm mb-4">
            <Link href="/" className="text-slate-500 hover:text-white transition-colors">Home</Link>
            <span className="text-slate-700">/</span>
            <Link href="/investigations" className="text-slate-500 hover:text-white transition-colors">Entities</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-mono">{config.slug}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-widest text-red-300 bg-red-900/20 border border-red-900/40">
                  <Shield size={11} /> {config.connection}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-widest text-slate-400 bg-slate-800/60 border border-slate-700">
                  {config.kind}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3 leading-tight">
                {config.name}
              </h1>
              <p className="text-slate-400 text-base max-w-3xl mb-2">
                {config.blurb}
              </p>
              <p className="text-slate-500 text-sm max-w-3xl">
                {config.summary}
              </p>
            </div>

            {/* Headline metric: total dollars tracked */}
            <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 min-w-[260px]">
              <div className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-1">Total tracked</div>
              <div className="text-3xl font-black text-white mb-3">{fmt.compact(total_tracked)}</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Contracts</span>
                  <span className="font-mono text-slate-200">{fmt.compact(spending.total_dollars)}</span>
                </div>
                {trading.total_trades > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Trades</span>
                    <span className="font-mono text-slate-200">{trading.total_trades}</span>
                  </div>
                )}
                {influence.total_raised > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>PAC raised</span>
                    <span className="font-mono text-slate-200">{fmt.compact(influence.total_raised)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ── LOOP POSITION DIAGRAM ─────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-white">Loop position</h2>
              <p className="text-slate-500 text-sm">Where {config.name} appears in the five-step money cycle.</p>
            </div>
            <Link href="/loop" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">
              What is The Loop? <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {loop_position.map((lp) => {
              const step = LOOP_STEPS[lp.step - 1];
              const filterUrl = LOOP_FILTER_URLS[lp.step as 1 | 2 | 3 | 4 | 5];
              return (
                <Link
                  key={lp.step}
                  href={filterUrl}
                  className={`group rounded-xl border p-4 transition-colors ${
                    lp.present
                      ? 'border-red-600/50 bg-red-950/20 hover:border-red-500'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black ${
                      lp.present ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {lp.step}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      lp.present ? 'text-red-300' : 'text-slate-500'
                    }`}>
                      {lp.present ? 'Present' : 'Not yet'}
                    </span>
                  </div>
                  <h3 className={`font-bold text-sm mb-1 ${lp.present ? 'text-white' : 'text-slate-400'}`}>
                    {step.label}
                  </h3>
                  {lp.present && (
                    <div className="text-xs text-slate-400 font-mono">
                      {lp.count.toLocaleString()} signal{lp.count === 1 ? '' : 's'}
                      {lp.dollars > 0 && ` · ${fmt.compact(lp.dollars)}`}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500 group-hover:text-slate-300 inline-flex items-center gap-1 transition-colors">
                    See evidence <ArrowRight size={10} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── CONTRACTS ──────────────────────────────────────────────── */}
          <section className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Building2 size={18} className="text-emerald-400" /> Federal contracts
                </h2>
                <p className="text-slate-500 text-sm">
                  {spending.count.toLocaleString()} award{spending.count === 1 ? '' : 's'}
                  {spending.no_bid_count > 0 && (
                    <> · <Glossary term="no-bid">{spending.no_bid_count} no-bid/sole-source</Glossary></>
                  )}
                  {spending.high_risk_count > 0 && ` · ${spending.high_risk_count} high risk`}
                </p>
              </div>
              <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white">All contracts →</Link>
            </div>

            {spending.agencies.length > 0 && (
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {spending.agencies.slice(0, 4).map(a => (
                  <div key={a.name} className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
                    <div className="text-xs text-slate-500 truncate" title={a.name}>{a.name}</div>
                    <div className="text-sm font-mono font-bold text-white">{fmt.compact(a.dollars)}</div>
                  </div>
                ))}
              </div>
            )}

            {spending.awards.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center">
                <Database size={20} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No contract data tagged to this entity yet.</p>
                <p className="text-slate-600 text-xs mt-1 font-mono">Data updating</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs font-mono uppercase tracking-widest border-b border-slate-800">
                      <th className="pb-2 pr-3">Recipient</th>
                      <th className="pb-2 pr-3">Agency</th>
                      <th className="pb-2 pr-3 text-right">Amount</th>
                      <th className="pb-2 pr-3 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spending.awards.slice(0, 10).map(a => (
                      <tr key={a.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                        <td className="py-2 pr-3">
                          <Link href={`/contract/${a.id}`} className="text-white hover:text-red-300 font-medium truncate inline-block max-w-[260px]" title={a.recipient_name}>
                            {a.recipient_name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-slate-400 truncate max-w-[180px]" title={a.awarding_agency}>{a.awarding_agency}</td>
                        <td className="py-2 pr-3 text-right font-mono text-white">{fmt.compact(a.dollar_amount)}</td>
                        <td className="py-2 pr-3 text-right">
                          <RiskScore score={Number(a.risk_score || 0)} size="sm" compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── TRADES (if any) ──────────────────────────────────────── */}
          {trading.total_trades > 0 ? (
            <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-400" /> Trades
                  </h2>
                  <p className="text-slate-500 text-sm">
                    {trading.total_trades} trade{trading.total_trades === 1 ? '' : 's'} · {trading.buys} buy / {trading.sells} sell
                  </p>
                </div>
                <Link href="/congress/trades" className="text-xs text-slate-400 hover:text-white">All trades →</Link>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trading.trades.slice(0, 8).map(t => (
                  <div key={t.id} className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{t.member_name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {t.transaction_date} · {t.amount_range ?? ''}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-mono font-bold ${
                        t.transaction_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {t.transaction_type}
                      </span>
                    </div>
                    {t.has_federal_contract && (
                      <div className="mt-1 text-xs text-amber-400 inline-flex items-center gap-1">
                        <AlertTriangle size={10} /> Contractor overlap
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            /* If no trades, show INFLUENCE here as the third column */
            <EntityInfluencePanel influence={influence} />
          )}
        </div>

        {/* If we showed trades above, show influence as a full-width row */}
        {trading.total_trades > 0 && (
          <EntityInfluencePanelWide influence={influence} />
        )}

        {/* ── TIMELINE ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-white">Timeline</h2>
              <p className="text-slate-500 text-sm">Contracts, trades, and PAC activity on one chronological axis.</p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Showing {timeline.length} most recent
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
              <p className="text-slate-400 text-sm">No dated events to plot yet.</p>
              <p className="text-slate-600 text-xs mt-1 font-mono">Data updating</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <ol className="divide-y divide-slate-800">
                {timeline.slice(0, 20).map((e, i) => (
                  <li key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-900/60 transition-colors">
                    <span className="font-mono text-xs text-slate-500 w-24 shrink-0">{e.date}</span>
                    <span className={`shrink-0 w-2 h-2 rounded-full ${
                      e.kind === 'contract' ? 'bg-emerald-400' :
                      e.kind === 'trade' ? 'bg-blue-400' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{e.title}</div>
                      <div className="text-xs text-slate-500 truncate">{e.detail}</div>
                    </div>
                    <div className="font-mono text-xs text-slate-300 shrink-0">{fmt.compact(e.amount)}</div>
                    {e.href && (
                      <Link href={e.href} className="text-slate-500 hover:text-white" aria-label="Open">
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* ── WHO PAYS (entity total) ───────────────────────────────────── */}
        {total_tracked > 0 && (
          <WhoPays
            amount={total_tracked}
            label={`the ${config.name} contracts we've tracked`}
          />
        )}

        {/* ── SOURCES ─────────────────────────────────────────────────── */}
        <SourceReceipts />

      </div>
    </div>
  );
}

function EntityInfluencePanel({ influence }: { influence: any }) {
  return (
    <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Scale size={18} className="text-amber-400" /> Influence
          </h2>
          <p className="text-slate-500 text-sm">
            {influence.pacs.length} PAC{influence.pacs.length === 1 ? '' : 's'} · {fmt.compact(influence.total_raised)} raised 2016-2024
          </p>
        </div>
        <Link href="/influence" className="text-xs text-slate-400 hover:text-white">Influence →</Link>
      </div>
      {influence.pacs.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-center">
          <p className="text-slate-400 text-sm">No PAC data linked to this entity yet.</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">Data updating</p>
        </div>
      ) : (
        <div className="space-y-2">
          {influence.pacs.slice(0, 5).map((p: any) => (
            <div key={p.pac_name} className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-white text-sm font-medium truncate">{p.pac_name}</span>
                <span className="font-mono text-xs text-amber-300">{fmt.compact(p.total_raised_2016_2024)}</span>
              </div>
              <div className="text-xs text-slate-500 truncate">
                {p.source_org} · founded {p.founding_year}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EntityInfluencePanelWide({ influence }: { influence: any }) {
  if (influence.pacs.length === 0) return null;
  return (
    <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Scale size={18} className="text-amber-400" /> Influence
          </h2>
          <p className="text-slate-500 text-sm">
            {influence.pacs.length} PAC{influence.pacs.length === 1 ? '' : 's'} · {fmt.compact(influence.total_raised)} raised 2016-2024
          </p>
        </div>
        <Link href="/influence" className="text-xs text-slate-400 hover:text-white">Influence →</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {influence.pacs.slice(0, 6).map((p: any) => (
          <div key={p.pac_name} className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white text-sm font-medium truncate">{p.pac_name}</span>
              <span className="font-mono text-xs text-amber-300">{fmt.compact(p.total_raised_2016_2024)}</span>
            </div>
            <div className="text-xs text-slate-500 truncate">
              {p.source_org} · founded {p.founding_year}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
