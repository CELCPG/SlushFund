import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { reportErrorHref } from '@/lib/v2/error-reports';
import { AuditNote, Caveat, ExtLink, MethodPage, MethodSection } from '@/components/v2/trust/Method';

export const metadata: Metadata = pageMetadata({
  path: '/about/methodology/contracts',
  title: 'Methodology: federal contracts',
  description: 'Where SlushFund contract awards come from, the rule that selects them, how each row traces to USAspending, and what the dollar figures mean.',
});
export const revalidate = 600;

const TOC = [
  { id: 'source', label: 'Official source' },
  { id: 'loaded', label: "What's loaded" },
  { id: 'shares', label: 'Percent not competed' },
  { id: 'trace', label: 'Tracing a row' },
  { id: 'caveats', label: 'Caveats' },
  { id: 'checks', label: 'How we check' },
];

export default function ContractsMethodology() {
  return (
    <MethodPage
      title="Federal contracts"
      dek="Every row is a federal prime contract award from USAspending.gov. This page explains the one rule that decides which awards we load, what the dollar figures mean, and where the data is incomplete."
      datasets={['contracts', 'contract_totals']}
      moneyType="contracts"
      toc={TOC}
      reviewed="2026-10-03"
    >
      <MethodSection id="source" title="Official source">
        <p>
          <ExtLink href="https://www.usaspending.gov/search">USAspending.gov</ExtLink> is the U.S. Treasury&rsquo;s official record of federal spending. It republishes the contract reports that agencies file in the Federal Procurement Data System. We read it through its public API and bulk download. Nothing else feeds this dataset.
        </p>
      </MethodSection>

      <MethodSection id="loaded" title="What's loaded">
        <p>We load every award that meets one fixed rule, called <b>r5-v1</b>. An award is in if it passes all three tests:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>It is a prime contract award</b>: a definitive contract, a purchase order, a delivery or task order, or a blanket-purchase-agreement call. Grants, loans and other assistance are out, and so are the umbrella vehicles that orders are placed under.</li>
          <li><b>It was signed in a fiscal year we load.</b> Fiscal years run October 1 to September 30. We load FY2024, FY2025 and FY2026. FY2026 ended on September 30 and is still incomplete because of the reporting delays described below. Each award belongs to exactly one fiscal year, the one in which it was signed.</li>
          <li><b>It is big enough.</b> Either the agency reported it as <i>not competed</i> and at least <b>$1 million</b> is obligated, or at least <b>$10 million</b> is obligated however it was awarded.</li>
        </ol>
        <p>&ldquo;Not competed&rdquo; means the agency coded the award as not competed, not available for competition, not competed under simplified acquisition, or a non-competitive delivery order. That is the same grouping the government uses in its own competition reports, so anyone can reproduce the list on usaspending.gov.</p>
        <p><b>We never choose awards by who received them.</b> Political connections play no part in the selection. Any tag that links a company to a person or a stock is added later by a separate, sourced step, and appears only with its source.</p>
      </MethodSection>

      <MethodSection id="shares" title="Where &ldquo;percent not competed&rdquo; comes from">
        <p>Our award rows hold every large non-competed award, but competed awards only from $10 million up. A share worked out from those rows would overstate the not-competed share. So &ldquo;percent not competed&rdquo; always comes from a separate table of <b>agency totals</b>: all prime contract obligations for each agency and fiscal year, and the non-competed part of them, taken from USAspending&rsquo;s agency figures.</p>
      </MethodSection>

      <MethodSection id="trace" title="How a row traces to its source">
        <ul className="list-disc space-y-2 pl-5">
          <li>Every row stores USAspending&rsquo;s own award ID and a link to that award&rsquo;s page on usaspending.gov. &ldquo;View award ↗&rdquo; opens it.</li>
          <li>A contract number (the PIID) is not unique across the government, so we key rows on USAspending&rsquo;s award ID, not the PIID.</li>
          <li>Each row records the rule it met and the date of the load that last saw it.</li>
        </ul>
      </MethodSection>

      <MethodSection id="caveats" title="Caveats, in plain English">
        <ul className="grid gap-3">
          <Caveat lead="Obligated means committed so far.">
            The dollar figure is the money the government has committed to date on an award signed in that fiscal year. It grows when options are exercised and contracts are modified, so an award signed in FY2024 can show more than a year&rsquo;s worth of money. It is not the contract&rsquo;s ceiling value, and it is not money already paid out. Row totals are never labeled &ldquo;spending in the year.&rdquo;
          </Caveat>
          <Caveat lead="The Defense Department reports about 90 days late.">
            DoD&rsquo;s contract actions show up on USAspending roughly three months after they happen. Our newest fiscal year therefore understates DoD and the government-wide total, and the latest quarter looks smaller than it is. Do not read a drop at the end of the current year as a drop in spending. The data-status page flags this.
          </Caveat>
          <Caveat lead="This is a selection, not all spending.">
            Non-competed awards under $1 million and competed awards under $10 million are not in the table. Counts and totals of our rows are not government totals.
          </Caveat>
          <Caveat lead="Some orders are coded &ldquo;competed&rdquo; even though one company got them.">
            A task order inherits the competition code of the contract it sits under. Some are placed with one vendor under a &ldquo;fair opportunity&rdquo; exception even when that parent contract was competed. The government codes these as competed, so we do too, unless they reach $10 million.
          </Caveat>
          <Caveat lead="Amounts move after the fact.">
            Awards are modified, de-obligated and corrected. A refresh picks up changes, and each row shows when it was last seen. An award can enter the table later when its obligation crosses a threshold, and leave it if the obligation shrinks.
          </Caveat>
          <Caveat lead="Company names are as the government reports them.">
            Recipient and parent-company names come from USAspending, not from us. Joining a contractor to a stock ticker is a separate step with its own method, described on the <Link href="/about/methodology/tickers" className="font-semibold text-trades-ink hover:underline">ticker links page</Link>.
          </Caveat>
        </ul>
      </MethodSection>

      <MethodSection id="checks" title="How we check">
        <p>After each load we compare stored rows with USAspending&rsquo;s award record on eight fields (amount, recipient, competition code, dates and contract number), and we compare agency totals with USAspending&rsquo;s own agency figures.</p>
        <AuditNote>
          In October 2026 the builder checked 30 random FY2026 rows against the award records (all matched) and three agency totals against USAspending&rsquo;s agency figures (all matched to the cent). A separate review on October 4, 2026 re-checked a sample of awards and the agency totals against USAspending, and the totals matched to the cent. These are samples, so this page publishes no overall match rate. FY2026 totals are not final until the DoD delay has passed.
        </AuditNote>
        <p className="text-[14.5px] text-muted">
          Found something wrong? <Link href={reportErrorHref('/about/methodology/contracts')} className="font-semibold text-trades-ink hover:underline">Report an error</Link>. Past changes are in the <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections log</Link>.
        </p>
      </MethodSection>
    </MethodPage>
  );
}
