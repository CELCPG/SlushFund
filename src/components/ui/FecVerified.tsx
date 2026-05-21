'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface FecDonor {
  contributor: string;
  employer: string | null;
  amount: number;
  date: string | null;
}

interface FecData {
  configured: boolean;
  verified?: boolean;
  committee?: { name: string } | null;
  totals?: { receipts: number; disbursements: number; cycle: number } | null;
  top_donors?: FecDonor[];
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

/**
 * Live "FEC verified" panel for a PAC. Fetches official FEC committee totals
 * for the given committee_id. Renders nothing if no committee_id is provided
 * or the FEC API is unconfigured/unavailable — curated data stands on its own.
 */
export function FecVerified({ committeeId, cycle = 2024 }: { committeeId?: string; cycle?: number }) {
  const [data, setData] = useState<FecData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!committeeId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/fec?committee_id=${committeeId}&cycle=${cycle}`)
      .then((r) => r.json())
      .then((json: FecData) => {
        if (cancelled) return;
        if (json.totals) setData(json);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [committeeId, cycle]);

  if (!committeeId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin" />
        Checking FEC filings…
      </div>
    );
  }

  if (failed || !data?.totals) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-500">
        Live FEC data unavailable. Showing curated figures only.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-400" />
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
          FEC Verified
        </span>
        <span className="text-[10px] text-slate-500">
          {data.committee?.name} · cycle {data.totals.cycle}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Receipts (FEC)</div>
          <div className="text-sm font-bold text-emerald-300">{fmt(data.totals.receipts)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Disbursements (FEC)</div>
          <div className="text-sm font-bold text-emerald-300">{fmt(data.totals.disbursements)}</div>
        </div>
      </div>
      {data.top_donors && data.top_donors.length > 0 && (
        <div className="mt-3 border-t border-emerald-500/20 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
            Largest FEC-disclosed donors (cycle {data.totals.cycle})
          </div>
          <div className="space-y-1">
            {data.top_donors.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300 truncate">
                  {d.contributor}
                  {d.employer && d.employer !== d.contributor && (
                    <span className="text-slate-600"> · {d.employer}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono font-semibold text-emerald-300">{fmt(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-500">
        Official figures pulled live from the Federal Election Commission.
      </div>
    </div>
  );
}
