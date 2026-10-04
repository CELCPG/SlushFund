import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { AuditNote, Caveat, ExtLink, MethodPage, MethodSection, WorthALookNote } from '@/components/v2/trust/Method';

export const metadata: Metadata = pageMetadata({
  path: '/about/methodology/tickers',
  title: 'Methodology: company and ticker links',
  description: 'How SlushFund links a federal contractor to a publicly traded company and its ticker, and why only confirmed matches are shown.',
});
export const revalidate = 600;

const TOC = [
  { id: 'what', label: 'What a link is' },
  { id: 'source', label: 'Official sources' },
  { id: 'rule', label: 'The rule' },
  { id: 'caveats', label: 'Caveats' },
  { id: 'checks', label: 'How we check' },
];

export default function TickersMethodology() {
  return (
    <MethodPage
      title="Company and ticker links"
      dek="To ask whether members of Congress trade the stock of companies that win federal contracts, we have to know which contractor is which public company. This page explains how we make that link, and why we show only the ones we are sure of."
      datasets={['contracts']}
      moneyType="contracts"
      toc={TOC}
      reviewed="2026-10-03"
    >
      <MethodSection id="what" title="What a link is">
        <p>A link says one thing: <b>this contractor is that SEC-registered company, with ticker X.</b> It is about identity. It says nothing about whether anyone influenced an award, and a member holding a stock in a company that holds contracts is not, by itself, a finding.</p>
      </MethodSection>

      <MethodSection id="source" title="Official sources">
        <ul className="list-disc space-y-2 pl-5">
          <li>The SEC&rsquo;s list of registered companies and tickers, and each company&rsquo;s EDGAR filing record. <ExtLink href="https://www.sec.gov/search-filings">sec.gov</ExtLink></li>
          <li>The list of subsidiaries that a company files with its latest annual report (Exhibit 21).</li>
          <li>Contractor and parent-company names and IDs from <ExtLink href="https://www.usaspending.gov/search">USAspending.gov</ExtLink>.</li>
        </ul>
      </MethodSection>

      <MethodSection id="rule" title="The rule: confirmed matches only">
        <p>The rule is called <b>r7-v1</b>. Names are first tidied (punctuation, &ldquo;Inc.&rdquo; and &ldquo;Corporation&rdquo; spellings, capital letters). A link is <b>confirmed</b> by code only when the name belongs to exactly one SEC registrant and one of these holds:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>The contractor is the registrant.</b> It has the same ID, or the same tidied name, as the public company.</li>
          <li><b>The contractor sits under the registrant</b> in USAspending&rsquo;s parent chain, <i>and</i> there is separate evidence: the contractor&rsquo;s name starts with a distinctive word of the parent&rsquo;s name, or the parent&rsquo;s own subsidiary list names it. The parent field alone is not enough, and joint ventures are never confirmed.</li>
        </ol>
        <p>Everything else, such as close-but-not-equal names, ambiguous names, former company names, and subsidiaries the parent field does not connect, goes to a <b>review queue</b>. A fuzzy match is never confirmed by code. Only a person can confirm a queued match, and that decision is kept when the job re-runs. <b>The site shows confirmed links only.</b></p>
      </MethodSection>

      <MethodSection id="caveats" title="Caveats, in plain English">
        <ul className="grid gap-3">
          <Caveat lead="Coverage is partial on purpose.">
            About 57% of the dollars in the non-competed FY2026 awards we load link to a confirmed ticker (October 2026). Against all non-competed spending the share is lower. Most of the rest is not a listed company at all: private firms, foreign companies with no SEC listing, universities and research centers, and joint ventures.
          </Caveat>
          <Caveat lead="No link does not mean no relationship.">
            A contractor with no confirmed ticker may still be owned by, or tied to, a public company. We leave it unlinked until we can show why.
          </Caveat>
          <Caveat lead="One company can have several tickers.">
            Different share classes carry different symbols. For issuers of exchange-traded notes, which have many symbols, we link through the primary ticker only.
          </Caveat>
          <Caveat lead="Trade tickers are as filed.">
            The ticker on a stock trade is what the member&rsquo;s filing says. If the ticker column is blank we use the symbol the filer wrote in the asset name, in three fixed notations, and nothing else. A wrong or unusual symbol in a filing can stop a trade from linking.
          </Caveat>
          <Caveat lead="Links reflect the date of the load.">
            Companies merge, rename and delist. Each link records the rule version and when it was made.
          </Caveat>
        </ul>
        <WorthALookNote />
      </MethodSection>

      <MethodSection id="checks" title="How we check">
        <p>After the job runs we draw random samples of confirmed pairs and check each against the contractor&rsquo;s USAspending record and the company&rsquo;s SEC record, one pair at a time. The first sample exposed a real problem (note issuers with many tickers), and the rule was changed to fix it.</p>
        <AuditNote>
          The builder&rsquo;s two samples of 30 confirmed pairs each matched (October 2026). These are our own samples, so this page publishes no overall match rate.
        </AuditNote>
        <p className="text-[14.5px] text-muted">
          Think a link is wrong? <Link href="/about#report-an-error" className="font-semibold text-trades-ink hover:underline">Report an error</Link>. Contracts are described on the <Link href="/about/methodology/contracts" className="font-semibold text-trades-ink hover:underline">contracts page</Link>.
        </p>
      </MethodSection>
    </MethodPage>
  );
}
