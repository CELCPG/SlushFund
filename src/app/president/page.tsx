import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilingLink from '@/components/v2/FilingLink';
import { Card, SectionHead, Wrap } from '@/components/v2/PageBand';
import { CoverNote, HBars, PresidentBand, PresidentUnavailable, SourceLine, Stat } from '@/components/v2/president/PresidentParts';
import { PRESIDENT_HUB_PATH, PRESIDENT_LARGEST_PATH, PRESIDENT_PATH, PRESIDENT_QUALITY_PATH, PRESIDENT_TIMING_PATH, presidentDeepDiveEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { DAYS_METHOD_SENTENCE, FORM_RULE_SENTENCE } from '@/lib/v2/president';
import { COMPLIANCE_SENTENCE, FEE_NOTE_SENTENCE } from '@/lib/v2/president-hub-core';
import { getHub } from '@/lib/v2/president-hub';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D15 hub. Behind presidentDeepDiveEnabled() (off on production unless SHOW_PRESIDENT_DEEPDIVE=1) until the Auditor's page check.
// Wording: A11 "Wording rules for the D9 President page" (allowed sentences verbatim), A11b N5. Every figure is computed from the
// database in president-hub-core.ts; a failed read prints "Figures unavailable", never a zero.
export function generateMetadata(): Metadata {
  if (!presidentDeepDiveEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: PRESIDENT_HUB_PATH,
    title: 'The President: securities transactions reported to OGE',
    description: 'Every securities transaction President Trump reported on OGE Form 278-T, with when each was reported, the largest by amount band, and how the records were read and checked.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const shortDate = (d: string | null) => fmtDate(d) ?? 'date not read';

export default async function PresidentHubPage() {
  if (!presidentDeepDiveEnabled()) notFound();
  const h = await getHub();
  if (!h) return <PresidentUnavailable current={PRESIDENT_HUB_PATH} title="The President" />;

  const feeCovers = (h.covers ?? []).filter((c) => c.reviewer_comment_kind === 'late_fee_note' && c.reviewer_comment);
  const byDoc = new Map(h.perReport.map((r) => [r.docId, r]));
  const owners = h.owners.map((o) => `${o.value} ${fmtCount(o.count)}`).join(', ');
  const onlySelf = h.owners.length === 1 && h.owners[0].value === 'Self';

  return (
    <div data-v2>
      <PresidentBand
        current={PRESIDENT_HUB_PATH}
        title="The President"
        lead={
          <div className="sf-hero-figure">
            <strong className="sf-kpi-value block font-display text-[84px] font-extrabold leading-[0.95] max-md:text-[60px]" data-figure="total">{fmtCount(h.total)}</strong>
            <p className="mt-2">
              President Trump reported {fmtCount(h.total)} securities transactions in {fmtCount(h.reports)} periodic transaction reports (OGE Form 278-T) signed between {shortDate(h.firstSigned)} and {shortDate(h.lastSigned)}, as posted by the U.S. Office of Government Ethics.
            </p>
          </div>
        }
      />

      <Wrap className="pb-12">
        {/* ------------------------------------------------------------ stat band */}
        <div className="mt-6 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Stat label="Reports" value={fmtCount(h.reports)}>
            Periodic transaction reports, signed {shortDate(h.firstSigned)} to {shortDate(h.lastSigned)}.
          </Stat>
          <Stat label="Trade dates" value={`${fmtDate(h.firstTrade) ?? '?'} to ${fmtDate(h.lastTrade) ?? '?'}`} className="[&_strong]:text-[24px]">
            The earliest and latest trade dates printed on the reports.
          </Stat>
          <Stat label="Purchases and sales" value={`${fmtCount(h.purchases)} / ${fmtCount(h.sales)}`}>
            {fmtCount(h.purchases)} purchases and {fmtCount(h.sales)} sales, as the reports print them.
          </Stat>
          <Card className="sf-kpi">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted">Asset classes</p>
            <ul className="mt-1 font-display text-[22px] font-extrabold leading-[1.25]">
              <li><span className="sf-kpi-value">{fmtCount(h.classes.stock) ?? 'Figures unavailable'}</span> stock</li>
              <li><span className="sf-kpi-value">{fmtCount(h.classes.bond) ?? 'Figures unavailable'}</span> bond</li>
              <li><span className="sf-kpi-value">{fmtCount(h.classes.fund) ?? 'Figures unavailable'}</span> fund</li>
              {h.classes.other > 0 && <li><span className="sf-kpi-value">{fmtCount(h.classes.other)}</span> other</li>}
            </ul>
          </Card>
        </div>
        <p className="mt-3 max-w-[900px] text-[13px] text-muted">
          Asset classes are our reading of the asset text as the report prints it: stock is shares of a company, bond is a coupon or maturity security (municipal, corporate, perpetual, U.S. Treasury), fund is a mutual fund, ETF or money-market fund. The ten Vice President rows in the same table are in none of these figures.
        </p>

        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-4 max-lg:grid-cols-1">
          <Card>
            <SectionHead as="h2" title={<span className="text-[24px] max-md:text-[22px]">Who the lines are marked for</span>} />
            <p className="text-[15.5px]" data-section="owners">
              Owner as recorded: {owners}.
            </p>
            <p className="mt-2 text-[14px] text-muted">
              The 278-T has no owner column. We record a line as spouse, joint or dependent child only when the line itself carries that marking, and {onlySelf ? 'no line on these reports does' : 'the lines counted above do'}. The reports do not separate the President&rsquo;s own transactions from any family trust&rsquo;s: they show one filer and the lines as printed.
            </p>
          </Card>
          <Card>
            <SectionHead as="h2" title={<span className="text-[24px] max-md:text-[22px]">Asset-class mix</span>} />
            <HBars
              caption="Securities transactions by asset class"
              unit="Transactions"
              labelHeader="Asset class"
              rows={[
                { key: 'stock', label: 'Stock', value: h.classes.stock, display: fmtCount(h.classes.stock) ?? '' },
                { key: 'bond', label: 'Bond', value: h.classes.bond, display: fmtCount(h.classes.bond) ?? '' },
                { key: 'fund', label: 'Fund', value: h.classes.fund, display: fmtCount(h.classes.fund) ?? '' },
                ...(h.classes.other > 0 ? [{ key: 'other', label: 'Other', value: h.classes.other, display: fmtCount(h.classes.other) ?? '' }] : []),
              ]}
            />
          </Card>
        </div>

        {/* ------------------------------------------------------------ transactions per report */}
        <section className="pt-8" aria-labelledby="per-report">
          <Card>
            <SectionHead as="h2" title={<span id="per-report" className="text-[24px] max-md:text-[22px]">Transactions in each report</span>} sub="In the order the President signed the reports. One bar is one report; the number is the count of securities transactions on it." />
            <HBars
              caption="Securities transactions in each of the reports, in the order signed"
              unit="Transactions"
              labelHeader="Report"
              rows={h.perReport.map((r) => ({ key: r.docId, label: r.label.replace('278-T signed ', ''), sub: `trades ${fmtDate(r.firstTrade) ?? '?'} to ${fmtDate(r.lastTrade) ?? '?'}`, value: r.transactions, display: fmtCount(r.transactions) ?? '' }))}
            />
          </Card>
        </section>

        {/* ------------------------------------------------------------ 45 days */}
        <section className="pt-8" aria-labelledby="gaps">
          <Card>
            <SectionHead as="h2" title={<span id="gaps" className="text-[24px] max-md:text-[22px]">Reported more than 45 days after the trade</span>} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]">
              <p>{FORM_RULE_SENTENCE}</p>
              <p data-figure="over45">
                <b>{fmtCount(h.over45)} transactions in {fmtCount(h.over45Reports)} of the {fmtCount(h.reports)} reports were reported more than 45 days after the trade date shown, counted to the date President Trump signed the report.</b>
              </p>
              <p className="text-[14px] text-muted">{DAYS_METHOD_SENTENCE} A gap over 45 days is a measured fact about two dates as printed, not a finding about the filer.</p>
              {h.notComputed > 0 && (
                <p className="text-[14px] text-muted">
                  {h.notComputedAllNotRequired
                    ? <>{fmtCount(h.notComputed)} transactions are not counted either way: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.</>
                    : <>{fmtCount(h.notComputed)} transactions were not computed.</>}
                </p>
              )}
              <p><Link href={PRESIDENT_TIMING_PATH} className="font-semibold text-trades-ink underline">The timing in detail: every report, the spread of days, the 278-T exemption</Link></p>
            </div>
          </Card>
        </section>

        {/* ------------------------------------------------------------ the five fee notes */}
        <section className="pt-8" aria-labelledby="notes">
          <Card>
            <SectionHead as="h2" title={<span id="notes" className="text-[24px] max-md:text-[22px]">What the reviewing official wrote on five covers</span>} />
            {h.covers == null ? (
              <p className="text-[15px] text-muted" data-section="reviewer-notes">Figures unavailable: the cover records did not load, so nothing about the covers is shown.</p>
            ) : feeCovers.length === 0 ? (
              <p className="text-[15px] text-muted" data-section="reviewer-notes">No cover in the records carries a note about fees.</p>
            ) : (
              <div data-section="reviewer-notes">
                <p className="max-w-[860px] text-[15.5px]">{FEE_NOTE_SENTENCE(feeCovers.length, h.reports)} {COMPLIANCE_SENTENCE}</p>
                <ul className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                  {feeCovers.map((c) => {
                    const r = byDoc.get(c.source_doc_id);
                    return (
                      <li key={c.source_doc_id} className="min-w-0">
                        <p className="mb-1.5 text-[13.5px] font-semibold">{r ? r.label : c.file_name}</p>
                        <CoverNote cover={c} pageHref={`${r?.url ?? c.disclosure_url}#page=1`} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>
        </section>

        {/* ------------------------------------------------------------ links */}
        <section className="pt-8" aria-labelledby="links">
          <Card>
            <SectionHead as="h2" title={<span id="links" className="text-[24px] max-md:text-[22px]">Go to the records</span>} />
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] max-md:grid-cols-1">
              <li><Link href={`${PRESIDENT_PATH}#transactions`} className="font-semibold text-trades-ink underline">Every transaction, with its report (filter, sort, page through)</Link></li>
              <li><Link href={PRESIDENT_PATH} className="font-semibold text-trades-ink underline">President Trump: securities transactions (the full list page)</Link></li>
              <li><Link href={PRESIDENT_LARGEST_PATH} className="font-semibold text-trades-ink underline">Largest transactions by amount band</Link></li>
              <li><Link href={PRESIDENT_QUALITY_PATH} className="font-semibold text-trades-ink underline">How the data was built, checked and fixed</Link></li>
              <li><Link href="/about/methodology/trades" className="font-semibold text-trades-ink underline">Methodology for trade data</Link></li>
              <li><Link href="/report-an-error" className="font-semibold text-trades-ink underline">Report an error</Link></li>
            </ul>
            <h3 className="mt-5 text-[15px] font-bold">Each report at the Office of Government Ethics</h3>
            <ol className="mt-2 grid grid-cols-2 gap-x-6 text-[14px] max-md:grid-cols-1">
              {h.perReport.map((r) => (
                <li key={r.docId} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-1.5">
                  <span className="min-w-0">{r.label} <span className="text-muted">({fmtCount(r.transactions)} transactions)</span></span>
                  <FilingLink href={r.url} source="OGE Form 278-T" label="View report" />
                </li>
              ))}
            </ol>
            <SourceLine />
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
