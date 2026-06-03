'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Search } from 'lucide-react';
import type { Award } from '@/lib/types';
import { KpiCard, FlagBadge, Table, type Column } from '@/components/ui';
import { pickVendorCallout } from './vendor-callouts';

function fmtUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Client island: fetches and displays a vendor's federal contracts.
 *
 * Search strategy: pass ALL aliases through, joined with "OR" so we catch
 * awards to any of the vendor's known names. e.g. "Trump Organization" page
 * also matches "Trump Winery", "DJT Holdings", etc.
 */
export function VendorContracts({
  searchTerm,
  aliases = [],
  connectionCategory,
}: {
  searchTerm: string;
  /** Other known names/aliases for this vendor — searched alongside `searchTerm`. */
  aliases?: string[];
  /** Category from POLITICAL_ENTITIES — used to route the data-coverage callout. */
  connectionCategory?: string;
}) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // The /api/contracts route accepts a `search` param. It splits on
        // commas and ORs each term against recipient_name and description,
        // so we can pass the primary name + every alias as one query.
        //
        // PostgREST's `or` filter has a URL-length limit (~8KB). For entities
        // with 30+ aliases (Google, Amazon, Koch family) the joined query can
        // exceed that and silently returns 0. Cap at 12 terms — we always
        // include the primary name first, then up to 11 highest-signal aliases.
        const allTerms = [searchTerm, ...aliases].filter(Boolean);
        const terms = allTerms.slice(0, 12);
        const q = new URLSearchParams({
          search: terms.join(','),
          recipient_only: '1',
          limit: '100',
          sort: 'dollar_amount',
          dir: 'desc',
        });
        const res = await fetch(`/api/contracts?${q.toString()}`);
        const data = await res.json();
        if (!cancelled) setAwards(Array.isArray(data.awards) ? data.awards : []);
      } catch {
        if (!cancelled) setAwards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, aliases.join('|')]);

  const total = awards.reduce((s, a) => s + Number(a.dollar_amount || 0), 0);
  const noBid = awards.filter((a) => a.flags?.includes('no_bid') || a.flags?.includes('sole_source')).length;
  const topRisk = awards.reduce((m, a) => Math.max(m, Number(a.risk_score || 0)), 0);

  const columns: Column<Award>[] = [
    {
      key: 'recipient_name',
      header: 'Recipient',
      sortable: true,
      render: (a) => (
        <Link href={`/contract/${a.id}`} className="font-medium text-white hover:text-emerald-400">
          {a.recipient_name}
          <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-slate-500">{a.description}</div>
        </Link>
      ),
    },
    {
      key: 'dollar_amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      sortValue: (a) => Number(a.dollar_amount || 0),
      render: (a) => <span className="font-mono font-bold text-white">{fmtUSD(Number(a.dollar_amount))}</span>,
    },
    { key: 'awarding_agency', header: 'Agency', render: (a) => <span className="text-xs text-slate-300">{a.awarding_agency}</span> },
    {
      key: 'flags',
      header: 'Flags',
      render: (a) => (
        <div className="flex flex-wrap gap-1">
          {(a.flags ?? []).slice(0, 3).map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </div>
      ),
    },
    {
      key: 'risk_score',
      header: 'Risk',
      sortable: true,
      align: 'right',
      sortValue: (a) => Number(a.risk_score || 0),
      render: (a) => (
        <span className={`font-mono font-bold ${Number(a.risk_score) >= 80 ? 'text-rose-400' : Number(a.risk_score) >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
          {a.risk_score}
        </span>
      ),
    },
  ];

  // Build the alias list shown in the callout (deduped, capped at 4)
  // We still display all aliases in the transparency strip below — the slice
  // is just for the headline (PostgREST URL limit is enforced in the fetch).
  const knownAliases = Array.from(new Set([searchTerm, ...aliases]));
  const displayAliases = knownAliases.slice(0, 4);
  const hiddenCount = knownAliases.length - displayAliases.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Contracts Tracked" value={loading ? '—' : String(awards.length)} color="text-white" />
        <KpiCard label="Total Value" value={loading ? '—' : fmtUSD(total)} color="text-emerald-400" />
        <KpiCard label="No-Bid / Sole-Source" value={loading ? '—' : String(noBid)} color="text-amber-400" highlight={noBid > 0} />
        <KpiCard label="Highest Risk Score" value={loading ? '—' : String(topRisk)} color={topRisk >= 80 ? 'text-rose-400' : 'text-slate-200'} />
      </div>

      {/* Searched-aliases transparency strip. Shows the user exactly which
          names we tried to match against, so they know why a profile might
          show zero. Capped at 4 for visual sanity; "+N more" indicates
          additional aliases were searched. */}
      {knownAliases.length > 1 && (
        <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-xs text-slate-400">
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <span className="font-semibold text-slate-300">Searched:</span>{' '}
            <code className="font-mono text-amber-300/80">{displayAliases.join(' · ')}</code>
            {hiddenCount > 0 && <span className="text-slate-500"> +{hiddenCount} more</span>}
          </div>
        </div>
      )}

      {/* Data-coverage callout. Shows when the search returns nothing OR
          very little, to be honest about the gap between "what we track"
          and "what's been reported publicly". The callout is routed by the
          vendor's connection_category (e.g. mar-a-lago → Trump callout)
          so each entity gets a tailored explanation of where its real
          federal money actually flows. */}
      {!loading && awards.length === 0 && (
        <>{pickVendorCallout({ name: searchTerm, connectionCategory: connectionCategory ?? 'none' })}</>
      )}

      <Table
        columns={columns}
        data={awards}
        rowKey={(a) => a.id}
        loading={loading}
        defaultSort={{ key: 'dollar_amount', dir: 'desc' }}
        empty="No matching federal contracts in the current dataset. Check back as we sync more data."
      />

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ExternalLink className="h-3 w-3" />
        Source: USAspending.gov federal award data, matched on recipient name.
      </p>
    </div>
  );
}
