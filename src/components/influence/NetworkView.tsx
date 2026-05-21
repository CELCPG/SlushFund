'use client';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Badge, toneForConnection } from '@/components/ui/Badge';
import { CRYPTO_INVESTMENTS } from '@/lib/crypto-data';
import { BILLS, billsForEntity } from '@/lib/policy-data';

/** Network tab — entity-centric: each investor/donor and the bills it touches. */
export default function NetworkView() {
  // Build a row per investor entity that links to at least one tracked bill.
  const rows = CRYPTO_INVESTMENTS.map((inv) => ({
    investor: inv.investor_name,
    connection: inv.connection_type ?? 'none',
    policy_stake: inv.policy_stake,
    bills: billsForEntity(inv.investor_name),
    source: inv.source_urls[0],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Influence Network</h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          Each investor or donor below is mapped to the legislation it stands to gain from.
          A connection here means money on one side and a policy outcome on the other.
        </p>
      </header>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.investor} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid lg:grid-cols-[1fr_auto_1.4fr] gap-3 items-start">
              {/* Donor side */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{r.investor}</span>
                  <Badge tone={toneForConnection(r.connection)}>
                    {r.connection.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {r.policy_stake && (
                  <p className="mt-1 text-xs text-slate-500">{r.policy_stake}</p>
                )}
                {r.source && (
                  <a href={r.source} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <ExternalLink size={11} /> Source
                  </a>
                )}
              </div>

              {/* Connector */}
              <div className="hidden lg:flex items-center pt-1 text-slate-600">
                <ArrowRight size={16} />
              </div>

              {/* Policy side */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Linked legislation
                </div>
                {r.bills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {r.bills.map((b) => (
                      <Badge key={b.bill_id} tone="info">{b.short_name}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-600">No directly linked bills tracked yet</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600">
        Linkages are drawn from the curated bill dataset ({BILLS.length} bills) and the crypto
        investor database. As more bills are tracked, more connections surface here.
      </p>
    </div>
  );
}
