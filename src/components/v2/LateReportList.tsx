import Link from 'next/link';
import FilingLink from '@/components/v2/FilingLink';
import LateFilersTable from '@/components/v2/LateFilersTable';
import { partyLetter } from '@/components/v2/TradesTable';
import { buildHref } from '@/lib/v2/explorer';
import { fmtCount, fmtDate, fmtDateShort } from '@/lib/v2/format';
import { REPORT_TRADES_SHOWN, STOCK_ACT_DAYS, type LateReportView, type LateTrade } from '@/lib/v2/late-filers';

/** Short document id from the filing URL: a House PTR's number, or the start of a Senate eFD report's id. */
function docId(url: string | null, chamber: string): string | null {
  const id = (url ?? '').split('/').filter(Boolean).pop()?.replace(/\.pdf$/i, '');
  if (!id) return null;
  return chamber === 'House' ? `PTR ${id}` : `eFD ${id.slice(0, 8)}`;
}

export interface ReportWithTrades {
  report: LateReportView;
  /** null when the database did not answer for this report. */
  trades: LateTrade[] | null;
}

/**
 * The late-filers trade list, one row per report: member, the date of the report, how many of its trades
 * were reported more than the limit after the trade, and the largest gap. Each row opens (a plain
 * <details>, no script) to the trades in it, longest gap first, each with its own filing link.
 */
export default function LateReportList({ items, over }: { items: ReportWithTrades[]; over: number }) {
  return (
    <ul className="space-y-2.5">
      {items.map(({ report: r, trades }) => {
        const shown = trades?.length ?? 0;
        const sourceName = r.chamber === 'House' ? 'House Clerk PTR' : 'Senate eFD report';
        const exploreHref = r.bioguide && r.reportDate
          ? buildHref('/data/trades', { member: r.bioguide, by: 'filed', from: r.reportDate, to: r.reportDate })
          : null;
        return (
          <li key={r.key} data-report={r.key}>
            <details className="group rounded-2xl bg-card shadow-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl p-4 hover:bg-page/60 max-sm:gap-x-4 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-[13px] text-muted transition-transform group-open:rotate-90">▶</span>
                <span className="min-w-[200px] flex-1 max-sm:min-w-[60%]">
                  <b className="block text-[15.5px] font-semibold">{r.name}</b>
                  <span className="block text-[12.5px] text-muted">{partyLetter(r.party)} · {r.state} · {r.chamber}</span>
                </span>
                <span className="min-w-[120px] text-[13.5px]">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">Report filed</span>
                  {fmtDate(r.reportDate) ?? 'Date unknown'}
                  {docId(r.url, r.chamber) && <span className="block font-mono text-[11.5px] text-muted">{docId(r.url, r.chamber)}</span>}
                  {r.restated.length > 0 && <span className="block text-[12px] text-muted">restated in {r.restated.length === 1 ? 'a later filing' : `${fmtCount(r.restated.length)} later filings`}</span>}
                </span>
                <span className="min-w-[130px] text-[13.5px]">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">Trades in it</span>
                  <b className="font-mono text-[14px] font-semibold">{fmtCount(r.overCount)}</b> over {over} days
                  <span className="block text-[12px] text-muted">of {fmtCount(r.computed)} with a gap</span>
                </span>
                <span className="min-w-[150px] text-[13.5px]">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">Largest gap</span>
                  <b className="font-mono text-[15px] font-semibold">{fmtCount(r.maxDays)} days</b>
                  <span className="block text-[12px] text-muted">{r.maxTicker}, traded {fmtDateShort(r.maxTraded)}</span>
                </span>
              </summary>
              <div className="border-t border-line p-4">
                <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px]">
                  {r.bioguide
                    ? <Link href={`/people/${r.bioguide}`} className="inline-flex min-h-6 items-center font-semibold text-trades-ink hover:underline">{r.name}&rsquo;s page →</Link>
                    : null}
                  <FilingLink href={r.url} source={`${sourceName}, the first report`} label="View first report" />
                  {r.restated.length > 0 && (
                    <span className="text-[13px] text-muted">
                      restated in{' '}
                      {r.restated.slice(0, 4).map((x, i) => (
                        <span key={x.docId}>{i ? ', ' : ''}<FilingLink href={x.url} source={sourceName} label={`the ${fmtDate(x.filed) ?? 'later'} filing`} /></span>
                      ))}
                      {r.restated.length > 4 ? ` and ${fmtCount(r.restated.length - 4)} more` : ''}
                    </span>
                  )}
                  {exploreHref && <Link href={exploreHref} className="inline-flex min-h-6 items-center font-semibold text-trades-ink hover:underline">All of this member&rsquo;s trades first reported that day →</Link>}
                </p>
                {trades === null ? (
                  <p className="rounded-2xl bg-page px-4 py-4 text-[14px] text-muted">The trades in this report are unavailable right now. The report&rsquo;s own filing is linked above.</p>
                ) : (
                  <>
                    <LateFilersTable
                      trades={trades}
                      hideMember
                      caption={`Trades in ${r.name}'s report filed ${fmtDate(r.reportDate) ?? 'on an unknown date'} that were reported more than ${over} days after the trade, longest first`}
                    />
                    {r.overCount > shown && (
                      <p className="mt-3 text-[13px] text-muted">
                        Showing the {fmtCount(Math.min(shown, REPORT_TRADES_SHOWN))} longest of {fmtCount(r.overCount)} trades over {over} days in this report.
                        {exploreHref ? ' The rest are in the trades explorer, from the link above.' : ' The rest are in the filing.'}
                      </p>
                    )}
                    {r.flagged > 0 && (
                      <p className="mt-2 text-[12.5px] text-muted">{fmtCount(r.flagged)} {r.flagged === 1 ? 'trade in this report carries' : 'trades in this report carry'} a date note, shown on the row.</p>
                    )}
                    {over === STOCK_ACT_DAYS ? null : <p className="mt-2 text-[12.5px] text-muted">The STOCK Act asks for {STOCK_ACT_DAYS} days; this list is filtered to gaps over {over}.</p>}
                  </>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
