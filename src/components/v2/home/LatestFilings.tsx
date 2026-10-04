import Link from 'next/link';
import { cn } from '@/lib/cn';
import FilingLink from '@/components/v2/FilingLink';
import { MoneyIcon } from '@/components/v2/MoneyChip';
import { partyLetter } from '@/components/v2/TradesTable';
import type { LatestFiling } from '@/lib/v2/home';
import { fmtDate, fmtRange } from '@/lib/v2/format';
import { optionDetail, ownerLabel, tradeSentence } from '@/lib/v2/instruments';

const PHONE_LIMIT = 4;

function sourceName(system: string): string {
  if (system === 'House_Clerk') return 'House Clerk PTR';
  if (system === 'Senate_EFD') return 'Senate eFD report';
  return system;
}

/**
 * "Latest filings" (D6a): one entry per report, newest first report first. Each shows the member
 * (linked to their page), the first report's date, how many transactions the report holds, its
 * newest few trades in the A7 wording (options never read as a plain buy or sell, ranges stay
 * ranges, owner "Self" includes trusts) and the filing itself.
 */
export default function LatestFilings({ filings }: { filings: LatestFiling[] }) {
  return (
    <ol className="divide-y divide-line">
      {filings.map((f, i) => {
        const more = f.rowCount - f.trades.length;
        const day = f.firstReport.slice(0, 10);
        const seat = `${f.chamber} · ${partyLetter(f.party)}-${f.state}`;
        return (
          // Phones show the newest four reports; "All trades" carries the rest.
          <li key={f.url} className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 py-4 first:pt-1 last:pb-1 max-sm:grid-cols-1', i >= PHONE_LIMIT && 'max-sm:hidden', i === PHONE_LIMIT - 1 && 'max-sm:border-b-0 max-sm:pb-1')}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                {f.bioguide ? (
                  <Link href={`/people/${f.bioguide}`} className="font-display text-[19px] font-extrabold leading-tight text-ink hover:text-trades-ink hover:underline">
                    {f.member}
                  </Link>
                ) : (
                  <span className="font-display text-[19px] font-extrabold leading-tight">{f.member}</span>
                )}
                <span className="text-[13px] text-muted">{seat}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                First report filed <time dateTime={day} className="font-semibold text-ink">{fmtDate(day)}</time>
                {' · '}
                {f.rowCount === 1 ? '1 transaction' : `${f.rowCount.toLocaleString('en-US')} transactions`} in this report
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {f.trades.map((t) => {
                  const opt = optionDetail(t);
                  const owner = ownerLabel(t.owner, t.member_chamber);
                  return (
                    <li key={t.id} className="flex items-start gap-2 text-[14px] leading-snug">
                      <MoneyIcon type="trades" size="sm" className="mt-px" />
                      <span className="min-w-0">
                        <span className="font-semibold">{tradeSentence(t)}</span>
                        {opt && <span className="text-muted"> ({opt})</span>}
                        <span className="block text-[12.5px] text-muted">
                          <span className="whitespace-nowrap font-mono text-[13px] text-ink">{fmtRange(t.amount_min, t.amount_max, t.amount_range) ?? 'Amount not stated'}</span>
                          {' · '}
                          <span className="whitespace-nowrap">Traded {fmtDate(t.transaction_date) ?? 'date not stated'}</span>
                          {owner && <> · Owner: {owner}</>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {more > 0 && f.bioguide && (
                <Link
                  href={`/data/trades?member=${f.bioguide}&by=filed&from=${day}&to=${day}`}
                  className="mt-2 inline-block text-[13.5px] font-semibold text-trades-ink hover:underline"
                >
                  {more === 1 ? '1 more transaction' : `${more.toLocaleString('en-US')} more transactions`} in this report →
                </Link>
              )}
            </div>
            <div className="sm:pt-1 sm:text-right">
              <FilingLink href={f.url} source={sourceName(f.sourceSystem)} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
