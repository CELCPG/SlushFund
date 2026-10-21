import Link from 'next/link';
import FundingPanel from '@/components/v2/FundingPanel';
import type { CampaignMoneyResult } from '@/lib/v2/campaign-money';
import { fmtCount, fmtUsd } from '@/lib/v2/format';
import { notGradedLine, unreadCaveat } from '@/lib/v2/grade-method';
import { partyName, seatLabel } from '@/lib/v2/people';
import type { MemberRecord } from '@/lib/v2/voter';

/**
 * D11: one current member on a state voter page. Every member gets the same panels in the same order with the same wording
 * (G8): Stock Trading Grade (flag), trading in the last 24 months, "Who funds them" (flag), and links. Party is a plain label.
 */

const HOUSE_SEARCH = 'https://disclosures-clerk.house.gov/FinancialDisclosure#Search';
const SENATE_SEARCH = 'https://efdsearch.senate.gov/search/';

/** The FEC's own candidate search for this member's last name and state: the same kind of link for every member. */
export function fecSearchUrl(m: MemberRecord['member']): string {
  // fec.gov drops non-ASCII letters from q ("Barragán" finds nothing), so fold accents.
  const p = new URLSearchParams({ q: (m.last_name ?? m.name).trim().normalize('NFD').replace(/[̀-ͯ]/g, ''), state: m.state });
  return `https://www.fec.gov/data/candidates/?${p.toString()}`;
}

const box = 'min-w-0 rounded-2xl bg-page px-4 py-3';
const label = 'text-[12px] font-bold uppercase tracking-[0.05em] text-muted';

export default function MemberRecordPanel({
  rec, gradesOn, moneyOn, money,
}: { rec: MemberRecord; gradesOn: boolean; moneyOn: boolean; money: CampaignMoneyResult | null }) {
  const { member: m, activity: a, grade: g } = rec;
  const id = m.bioguide_id;
  const official = m.chamber === 'Senate' ? { href: SENATE_SEARCH, name: 'Senate eFD search' } : { href: HOUSE_SEARCH, name: 'House Clerk disclosure search' };
  return (
    <article id={`m-${id}`} aria-labelledby={`mh-${id}`} className="scroll-mt-24 rounded-card bg-card p-[22px] shadow-card max-md:rounded-2xl max-md:p-[18px]" data-member={id}>
      <h3 id={`mh-${id}`} className="font-display text-[22px] font-extrabold leading-tight max-md:text-[20px]">
        <Link href={`/people/${id}`} className="hover:underline">{m.name}</Link>
      </h3>
      <p className="mt-0.5 text-[14px] text-muted">Party: {partyName(m.party)} · {seatLabel(m)}</p>

      <div className={`mt-4 grid gap-3 ${gradesOn ? 'grid-cols-2' : 'grid-cols-1'} max-md:grid-cols-1`}>
        {gradesOn && (
          <div className={box} data-panel="grade">
            <p className={label}>Stock Trading Grade</p>
            {!g ? (
              <p className="mt-1 text-[14px] text-stale-ink">Unavailable right now: the trade database did not answer.</p>
            ) : g.letter === 'NG' ? (
              <>
                <p className="mt-1"><span className="sf-ng-cell font-display text-[22px] font-extrabold">Not graded</span></p>
                <p className="mt-1 text-[13.5px]">{notGradedLine(m.name, g.unread)}</p>
              </>
            ) : (
              <>
                <p className="mt-1 flex items-baseline gap-2">
                  <span data-letter={g.letter} className="sf-grade-cell font-display text-[34px] font-extrabold leading-none"><span className="sr-only">Grade </span>{g.letter}</span>
                  <span className="font-mono text-[13.5px] text-muted">{g.score} points of 100</span>
                </p>
                {g.unread > 0 && <p className="mt-1 text-[13px] text-stale-ink">{unreadCaveat(g.unread)}</p>}
              </>
            )}
            <p className="mt-1.5 text-[13.5px]">
              <Link href={`/people/${id}#p-grade`} className="font-semibold text-trades-ink hover:underline">Full report card<span className="sr-only"> for {m.name}</span></Link>
            </p>
          </div>
        )}

        <div className={box} data-panel="trading">
          <p className={label}>Stock trading, last 24 months</p>
          {!a ? (
            <p className="mt-1 text-[14px] text-stale-ink">Unavailable right now: the trade database did not answer.</p>
          ) : (
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[14px]">
              <dt className="text-muted">Transactions</dt>
              <dd className="font-mono">{fmtCount(a.transactions)} individual-stock</dd>
              <dt className="text-muted">Reported value</dt>
              <dd className="font-mono">{a.transactions ? `at least ${fmtUsd(a.valueMin)}` : '$0'}</dd>
              <dt className="text-muted">Reports holding them</dt>
              <dd className="font-mono">{fmtCount(a.reports)}</dd>
            </dl>
          )}
          {a && !gradesOn && g && g.unread > 0 && (
            <p className="mt-1 text-[13px] text-stale-ink">
              {fmtCount(g.unread)} scanned or paper {g.unread === 1 ? 'report' : 'reports'} from the last 24 months {g.unread === 1 ? 'is' : 'are'} not read yet, so these counts may be incomplete.
            </p>
          )}
          <p className="mt-1.5 text-[12.5px] text-muted">Stocks, stock options and other single-company securities. Value adds the lowest amount of each disclosed range.</p>
        </div>
      </div>

      {moneyOn && money && (
        <div className="mt-3 [&>section]:pt-0 [&_h2_span]:text-[18px]" data-panel="funding">
          <FundingPanel money={money} enabled name={m.name} />
        </div>
      )}

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px]" aria-label={`Records for ${m.name}`}>
        <li><Link href={`/people/${id}`} className="font-semibold text-trades-ink hover:underline">Member page</Link></li>
        <li><Link href={`/data/trades?member=${id}`} className="font-semibold text-trades-ink hover:underline">Filings we have read</Link></li>
        <li><a href={official.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink hover:underline">{official.name} ↗<span className="sr-only"> (opens in a new tab)</span></a></li>
        <li><a href={fecSearchUrl(m)} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink hover:underline">FEC candidate search ↗<span className="sr-only"> (opens in a new tab)</span></a></li>
      </ul>
    </article>
  );
}
