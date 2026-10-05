import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { reportErrorHref } from '@/lib/v2/error-reports';
import { AuditNote, Caveat, ExtLink, MethodPage, MethodSection, WorthALookNote } from '@/components/v2/trust/Method';
import { lateFilersEnabled, lateFilersPreview } from '@/lib/v2/flags';

export const metadata: Metadata = pageMetadata({
  path: '/about/methodology/trades',
  title: 'Methodology: congressional trades',
  description: 'Where House and Senate trades come from, what we load, how each row traces to its filing, and what the numbers cannot tell you.',
});
export const revalidate = 600;

const TOC = [
  { id: 'source', label: 'Official sources' },
  { id: 'loaded', label: "What's loaded" },
  { id: 'trace', label: 'Tracing a row' },
  { id: 'caveats', label: 'Caveats' },
  { id: 'checks', label: 'How we check' },
];

export default function TradesMethodology() {
  return (
    <MethodPage
      title="Trades: House and Senate"
      dek="Every row is one line from a periodic transaction report that a member of Congress filed under the STOCK Act. This page says what we load, how a row traces back to its filing, and what the numbers can and cannot tell you."
      datasets={['house_trades', 'senate_trades']}
      moneyType="trades"
      toc={TOC}
      reviewed="2026-10-04"
    >
      <MethodSection id="source" title="Official sources">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>House:</b> the House Clerk&rsquo;s Financial Disclosure site, which publishes every periodic transaction report (PTR) as a PDF, with a yearly index. <ExtLink href="https://disclosures-clerk.house.gov/FinancialDisclosure">disclosures-clerk.house.gov</ExtLink></li>
          <li><b>Senate:</b> the Senate&rsquo;s Electronic Financial Disclosure system (eFD). <ExtLink href="https://efdsearch.senate.gov/search/">efdsearch.senate.gov</ExtLink></li>
          <li><b>Who is who:</b> a member&rsquo;s name, party, state and Bioguide ID come from the public <ExtLink href="https://github.com/unitedstates/congress-legislators">congress-legislators</ExtLink> roster, never from the text of a filing.</li>
        </ul>
        <p>We use no third-party trade aggregators. If a trade is not in one of those two official systems, it is not on SlushFund.</p>
      </MethodSection>

      <MethodSection id="loaded" title="What's loaded">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>House:</b> electronic PTRs from 2021 to today. Earlier years are not loaded.</li>
          <li><b>Senate:</b> electronic PTRs filed from 2024 to today, for every senator who served in that window.</li>
          <li><b>Each row</b> is one transaction line: who, which company and ticker, buy, sell or exchange, the date of the trade, the date it was filed, and the amount band the member reported.</li>
          <li>The bar at the top of this page shows the coverage and last load that are in the database right now.</li>
        </ul>
        <p>Loaders run by code. Nobody types a trade in by hand. The House loader reads each PDF; the Senate loader reads each eFD report page. Both wait at least a second between requests to the government sites.</p>
      </MethodSection>

      <MethodSection id="trace" title="How a row traces to its filing">
        <ul className="list-disc space-y-2 pl-5">
          <li>Every row keeps the filing&rsquo;s own ID (the House document number or the Senate report ID) and the web address of that filing.</li>
          <li>&ldquo;View filing ↗&rdquo; on a row opens the original PDF or eFD page, so anyone can check the line against the source.</li>
          <li>When a member amends a report, the row keeps both: the first report is the main link, and the amendment is a second link beside it.</li>
          <li>The filed date is the date the first version of the report was filed, because the STOCK Act&rsquo;s 45-day clock belongs to the original filing.</li>
          <li>The member and party are matched to the roster by name and checked by hand when a name is ambiguous. A name we cannot match is listed for review, never guessed.</li>
        </ul>
      </MethodSection>

      <MethodSection id="caveats" title="Caveats, in plain English">
        <ul className="grid gap-3">
          <Caveat lead="Amounts are bands, not exact values.">
            The law lets members report a range such as $15,001&ndash;$50,000. We show the range exactly as filed. We never turn it into a midpoint, and we never add ranges together and show the total as if it were a real amount.
          </Caveat>
          <Caveat lead="Same-day lots are folded into one row.">
            If a member reports several lots of the same stock, in the same direction, on the same day, in one filing, we store them as one row. The row lists every band that was disclosed (for example &ldquo;2 &times; $1,001&ndash;$15,000&rdquo;). The row&rsquo;s internal minimum and maximum are sums, so counts of &ldquo;trades&rdquo; are counts of rows, not of lots.
          </Caveat>
          <Caveat lead="Scanned and paper filings are not loaded.">
            Some House filings are scanned images, and some senators file on paper. Code cannot read them reliably, and we do not guess. A member who files mostly on paper will look like they trade less than they do. The Senate lists paper filings; we do not turn them into rows.
          </Caveat>
          <Caveat lead="Only lines with a ticker symbol are loaded.">
            In our first full Senate load (October 2026), about four in ten source lines had no ticker, such as bonds, many funds and private assets. Those lines are not in the table. Treat any count of trades as a minimum.
          </Caveat>
          <Caveat lead="Options are shown with their terms, when the filing gives them.">
            Where the filing says whether an option is a call or a put, we show it, with the strike price and the expiry date (for example &ldquo;Sold call options &middot; strike $340 &middot; expires Dec 18, 2026&rdquo;). Where a filing leaves a term out, the row says so and the filing has the rest. Options and other non-stock assets are listed apart from stock purchases and sales and never counted as one.
          </Caveat>
          <Caveat lead="&ldquo;Days to file&rdquo; is not a verdict.">
            We do not show a days-to-file count or label any filing late on a trade row. The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade, and an amended report carries a later date than the original. Where a trade is dated more than two years before its report, or the dates as filed look inconsistent, the row carries a plain date note that describes the dates; it is not a ruling. Any days-to-file figure is measured to the first report, never to an amendment. We count calendar days from the trade date to the first report. We do not adjust for weekends or holidays, so a report filed on the next business day after a weekend deadline is included.
            {lateFilersEnabled() && (lateFilersPreview()
              ? <>{' '}A preview-only board, <Link href="/data/late-filers" className="font-semibold underline">reports filed more than 45 days after the trade</Link>, already shows it, measured to the first report, until an audit decides whether it goes public.</>
              : <>{' '}The board of <Link href="/data/late-filers" className="font-semibold underline">reports filed more than 45 days after the trade</Link> shows it, measured to the first report.</>)}
          </Caveat>
          <Caveat lead="Who owns the asset matters.">
            Members also report trades by a spouse or a dependent child. The row shows the owner (self, spouse, joint, child).
          </Caveat>
          <Caveat lead="Committees are today&rsquo;s seats.">
            Committee membership comes from the current roster. It may not match the seats a member held on the day of a past trade.
          </Caveat>
          <Caveat lead="Filings contain typos.">
            We show dates as filed. A date that cannot be right (for example one in the future) gets a plain date note on the row instead of being corrected silently, and no lateness is computed for it.
          </Caveat>
        </ul>
        <WorthALookNote />
      </MethodSection>

      <MethodSection id="checks" title="How we check">
        <p>After a load, we re-open a random sample of stored rows against the original filing, using a second parser written separately from the loader, and compare every field. A row that does not match is investigated, and the cause is fixed in the loader, not patched in the data.</p>
        <AuditNote>
          Reviews separate from the builder, on October 3 and 4, 2026, compared sampled rows and page figures with the original House Clerk and Senate eFD filings. Data problems they found were fixed and checked again. They were samples, so this page describes the method and publishes no match rate.
          {lateFilersEnabled() && !lateFilersPreview()
            ? ' The board of reports filed more than 45 days after the trade was re-checked against the filings on October 4, 2026.'
            : ' Days from a trade to its first report stay preview-only until a review clears them.'}
        </AuditNote>
        <p className="text-[14.5px] text-muted">
          Found something wrong? <Link href={reportErrorHref('/about/methodology/trades')} className="font-semibold text-trades-ink hover:underline">Report an error</Link>. Past changes are in the <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections log</Link>.
        </p>
      </MethodSection>
    </MethodPage>
  );
}
