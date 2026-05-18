'use client';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, DollarSign, TrendingUp, Users, Shield, Link2, Newspaper, Landmark } from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import { getEnrichment, ENTITY_ENRICHMENT, POLITICAL_ENTITIES } from '@/lib/political-entities';
import type { ConnectionType } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  elon_musk: 'bg-purple-900 text-purple-200 border-purple-700',
  trump_family: 'bg-red-900 text-red-200 border-red-700',
  trump_ally: 'bg-blue-900 text-blue-200 border-blue-700',
  'mar-a-lago': 'bg-orange-900 text-orange-200 border-orange-700',
  gop_donor: 'bg-emerald-900 text-emerald-200 border-emerald-700',
  lobbyist: 'bg-yellow-900 text-yellow-200 border-yellow-700',
  none: 'bg-slate-800 text-slate-300 border-slate-700',
};

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-mono">
      {label} <ExternalLink size={10} />
    </a>
  );
}

function EnrichmentRow({ entityName }: { entityName: string }) {
  const enrichment = getEnrichment(entityName);
  const entity = POLITICAL_ENTITIES.find(e => e.name.toLowerCase() === entityName.toLowerCase())
    ?? POLITICAL_ENTITIES.find(e => e.aliases.some(a => a.toLowerCase() === entityName.toLowerCase()));

  if (!enrichment && !entity) return null;

  const cat = (enrichment?.connection_category ?? entity?.connection_category ?? 'none') as ConnectionType;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-bold text-lg">{enrichment?.entity_name ?? entityName}</h3>
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${CATEGORY_COLORS[cat] ?? 'bg-slate-800'}`}>
            {CONNECTION_LABELS[cat]}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {enrichment && enrichment.total_fec_contributions > 0 && (
            <div className="text-right">
              <div className="text-slate-400 text-xs uppercase tracking-widest">FEC $</div>
              <div className="text-emerald-400 font-black font-mono text-sm">{fmt.dollars(enrichment.total_fec_contributions)}</div>
            </div>
          )}
          {enrichment && enrichment.total_lobbying_spend > 0 && (
            <div className="text-right">
              <div className="text-slate-400 text-xs uppercase tracking-widest">Lobbying $</div>
              <div className="text-amber-400 font-black font-mono text-sm">{fmt.dollars(enrichment.total_lobbying_spend)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Political connections */}
        {enrichment && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {enrichment.doge_role && (
              <div className="bg-purple-900/30 border border-purple-800 rounded-lg px-3 py-2">
                <div className="text-slate-400 text-xs mb-1">DOGE Role</div>
                <div className="text-purple-200 text-xs font-medium">{enrichment.doge_role}</div>
              </div>
            )}
            {enrichment.mar_a_lago_visits != null && (
              <div className="bg-orange-900/30 border border-orange-800 rounded-lg px-3 py-2">
                <div className="text-slate-400 text-xs mb-1">Mar-a-Lago Visits</div>
                <div className="text-orange-200 text-xs font-medium">{enrichment.mar_a_lago_visits} documented</div>
              </div>
            )}
            {enrichment.trump_property_meetings && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                <div className="text-slate-400 text-xs mb-1">Trump Property</div>
                <div className="text-red-200 text-xs font-medium">Meeting documented</div>
              </div>
            )}
            {enrichment.inauguration_host && (
              <div className="bg-blue-900/30 border border-blue-800 rounded-lg px-3 py-2">
                <div className="text-slate-400 text-xs mb-1">Inauguration</div>
                <div className="text-blue-200 text-xs font-medium">Host/fundraiser</div>
              </div>
            )}
            {enrichment.dark_money_connection && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-slate-400 text-xs mb-1">Dark Money</div>
                <div className="text-slate-300 text-xs font-medium">{enrichment.dark_money_connection}</div>
              </div>
            )}
          </div>
        )}

        {/* FEC / Trump PAC */}
        {enrichment && enrichment.trump_pac_donors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Landmark size={14} className="text-emerald-400" />
              <h4 className="text-white font-bold text-sm">FEC Contributions to Trump PACs</h4>
            </div>
            <div className="space-y-1.5">
              {enrichment.trump_pac_donors.map((donor, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                  <div>
                    <span className="text-slate-200 text-xs font-mono">{donor.name}</span>
                    {donor.pac_name && <span className="text-slate-500 text-xs ml-2">via {donor.pac_name}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-black font-mono text-sm">{fmt.dollars(donor.amount)}</span>
                    <span className="text-slate-500 text-xs">{donor.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News */}
        {enrichment && enrichment.news_investigations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Newspaper size={14} className="text-amber-400" />
              <h4 className="text-white font-bold text-sm">News Investigations</h4>
            </div>
            <div className="space-y-1.5">
              {enrichment.news_investigations.map((news, i) => (
                <a key={i} href={news.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 bg-slate-800/50 rounded px-3 py-2 hover:bg-slate-800 transition-colors">
                  <span className="text-slate-400 text-xs mt-0.5 shrink-0">{news.outlet}</span>
                  <span className="text-slate-200 text-xs flex-1">{news.headline}</span>
                  <span className="text-slate-500 text-xs shrink-0">{news.date}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Source links */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-800">
          {enrichment?.wikipedia_url && (
            <SourceLink href={enrichment.wikipedia_url} label="Wikipedia" />
          )}
          {enrichment?.opensecrets_url && (
            <SourceLink href={enrichment.opensecrets_url} label="OpenSecrets" />
          )}
          {enrichment?.fec_main_page && (
            <SourceLink href={enrichment.fec_main_page} label="FEC.gov" />
          )}
          {enrichment?.fec_source_urls.filter(u => u !== enrichment.fec_main_page).map((url, i) => (
            <SourceLink key={i} href={url} label="FEC Source" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Top entities by FEC + lobbying spend combined
function TopConnectionsTable() {
  const rows = Object.values(ENTITY_ENRICHMENT)
    .filter(e => e.total_fec_contributions > 0 || e.total_lobbying_spend > 0)
    .sort((a, b) => (b.total_fec_contributions + b.total_lobbying_spend * 0.1) - (a.total_fec_contributions + a.total_lobbying_spend * 0.1))
    .slice(0, 10);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Top 10 Entities by Political Spending</h3>
        <p className="text-slate-500 text-xs mt-1">FEC contributions to Trump PACs + lobbying spend (OpenSecrets)</p>
      </div>
      <div className="divide-y divide-slate-800">
        {rows.map((e, i) => {
          const entity = POLITICAL_ENTITIES.find(p => p.name.toLowerCase() === e.entity_name.toLowerCase());
          const cat = (e.connection_category) as ConnectionType;
          return (
            <div key={e.entity_name} className="px-5 py-3 flex items-center gap-4">
              <span className="text-slate-600 text-xs font-mono w-5 text-right shrink-0">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">{e.entity_name}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${CATEGORY_COLORS[cat] ?? 'bg-slate-800'}`}>
                    {CONNECTION_LABELS[cat]}
                  </span>
                </div>
                <div className="flex gap-3 mt-1">
                  {e.wikipedia_url && (
                    <a href={e.wikipedia_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">Wikipedia</a>
                  )}
                  {e.opensecrets_url && (
                    <a href={e.opensecrets_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-xs">OpenSecrets</a>
                  )}
                  {e.fec_main_page && (
                    <a href={e.fec_main_page} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-xs">FEC.gov</a>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex gap-6">
                  {e.total_fec_contributions > 0 && (
                    <div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest">FEC $</div>
                      <div className="text-emerald-400 font-black font-mono text-sm">{fmt.dollars(e.total_fec_contributions)}</div>
                    </div>
                  )}
                  {e.total_lobbying_spend > 0 && (
                    <div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest">Lobby $</div>
                      <div className="text-amber-400 font-black font-mono text-sm">{fmt.dollars(e.total_lobbying_spend)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const enrichedEntityNames = Object.keys(ENTITY_ENRICHMENT);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">Political Connection Evidence</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Political Connection Evidence</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            FEC filings, OpenSecrets lobbying data, dark money connections, Mar-a-Lago visits, and news investigations — all sourced and linked.
          </p>
        </div>

        {/* Top 10 Table */}
        <TopConnectionsTable />

        {/* Individual Entity Cards */}
        <div>
          <h2 className="text-white font-bold text-xl mb-4 uppercase tracking-widest text-slate-400">Entity-by-Entity Evidence</h2>
          <div className="space-y-4">
            {enrichedEntityNames.map(name => (
              <EnrichmentRow key={name} entityName={name} />
            ))}
          </div>
        </div>

        {/* Data Sources Footer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-widest">Data Sources</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <a href="https://www.fec.gov/data/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
              <Landmark size={12} /> FEC.gov
            </a>
            <a href="https://www.opensecrets.org" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300">
              <DollarSign size={12} /> OpenSecrets.org
            </a>
            <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300">
              <Newspaper size={12} /> Wikipedia
            </a>
            <a href="https://www.usaspending.gov" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300">
              <Link2 size={12} /> USAspending.gov
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}