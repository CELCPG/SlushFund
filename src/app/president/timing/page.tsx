import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import FilingLink from '@/components/v2/FilingLink';
import { Card, SectionHead, Wrap } from '@/components/v2/PageBand';
import { CoverNote, HBars, PresidentBand, PresidentUnavailable, SourceLine } from '@/components/v2/president/PresidentParts';
import { PRESIDENT_TIMING_PATH, presidentDeepDiveEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { DAYS_METHOD_SENTENCE, FORM_RULE_SENTENCE, NOT_REQUIRED_SENTENCE } from '@/lib/v2/president';
import { COMPLIANCE_SENTENCE, FEE_NOTE_SENTENCE,FEE_RULE_SENTENCE, REPORT_BINS } from '@/lib/v2/president-hub-core';
import { getHub } from '@/lib/v2/president-hub';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D15 /president/timing. Wording (A11, non-negotiable): "reported more than 45 days after the trade", never "late" or "on time" as a
// characterization; a late-fee cover note only verbatim and next to the signed compliance opinion; Treasury and fund rows are not
// computed (late_basis = not_required_on_278T) and sit outside every timing count.
export function generateMetadata(): Metadata {
  if (!presidentDeepDiveEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: PRESIDENT_TIMING_PATH,
    title: 'The President: when each transaction was reported',
    description: 'For each of the President’s 19 periodic transaction reports, how many days passed between each trade and the report, as the dates are printed.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

export default async function PresidentTimingPage() {
  if (!presidentDeepDiveEnabled()) notFound();
  const h = await getHub();
  if (!h) return <PresidentUnavailable current={PRESIDENT_TIMING_PATH} title="When each transaction was reported" />;

  const notComp = h.trades.filter((t) => t.stock_act_late == null);
  const notCompFund = notComp.filter((t) => t.instrument_class === 'fund').length;
  const notCompBond = notComp.filter((t) => t.instrument_class === 'bond').length;
  const feeCount = (h.covers ?? []).filter((c) => c.reviewer_comment_kind === 'late_fee_note').length;
  const withGaps = h.perReport.filter((r) => r.over45 > 0);

  const columns: DataTableColumn[] = [
    { key: 'report', header: 'Report (date signed)', mobile: 'title', sortKey: 'signed' },
    { key: 'tx', header: 'Transactions', numeric: true },
    ...REPORT_BINS.map((b) => ({ key: b.key, header: `${b.label} days`, numeric: true } as DataTableColumn)),
    { key: 'over', header: 'More than 45 days', numeric: true },
    { key: 'nc', header: 'Not computed', numeric: true },
    { key: 'longest', header: 'Longest gap (days)', numeric: true },
    { key: 'cover', header: 'Cover comments box', sortable: false, className: 'min-w-[210px] max-sm:min-w-0' },
    { key: 'src', header: 'Report', sortable: false, mobile: 'action' },
  ];
  const sameDay = (signed: string | null) => h.perReport.filter((x) => x.signed === signed).length;
  const rows: DataTableRow[] = h.perReport.map((r) => {
    const binTotal = (keys: string[]) => keys.reduce((n, k) => n + (r.bins as Record<string, number>)[k], 0);
    const cover = r.cover;
    return {
      id: r.docId,
      values: {
        report: r.label, signed: r.signed, tx: r.transactions,
        ...Object.fromEntries(REPORT_BINS.map((b) => [b.key, binTotal(b.bins)])),
        nc: r.notComputed, over: r.over45, longest: r.longestGap, cover: cover?.reviewer_comment ?? null, src: r.fileName,
      },
      cells: {
        report: (
          <span className="block min-w-[104px]">
            <span className="font-semibold">{fmtDate(r.signed) ?? 'date not read'}</span>
            <span className="block text-[12.5px] text-muted">{r.label.replace(/^278-T signed [^(]*/, '').trim() || (sameDay(r.signed) > 1 ? `1 of ${sameDay(r.signed)} reports that day` : 'one report that day')}</span>
          </span>
        ),
        longest: r.longestGap == null ? <span className="text-muted">Not computed</span> : <span className="font-mono">{fmtCount(r.longestGap)}</span>,
        cover: h.covers == null
          ? <span className="text-[12.5px] text-muted">Figures unavailable</span>
          : cover?.reviewer_comment
            ? <CoverNote cover={cover} pageHref={`${r.url}#page=1`} compact />
            : <span className="text-[13px] text-muted">No comment on the cover.</span>,
        src: <FilingLink href={r.url} source="OGE Form 278-T" label="View report" />,
      },
    };
  });

  return (
    <div data-v2>
      <PresidentBand
        current={PRESIDENT_TIMING_PATH}
        title="When each transaction was reported"
        lead={<p>{FORM_RULE_SENTENCE}</p>}
      />
      <Wrap className="pb-12">
        <section className="pt-6" aria-labelledby="summary">
          <Card>
            <SectionHead as="h2" title={<span id="summary" className="text-[24px] max-md:text-[22px]">What the dates show</span>} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]">
              <p data-figure="over45">
                <b>{fmtCount(h.over45)} transactions in {fmtCount(h.over45Reports)} of the {fmtCount(h.reports)} reports were reported more than 45 days after the trade date shown, counted to the date President Trump signed the report.</b>
              </p>
              <p>{fmtCount(h.atOrUnder45)} transactions were reported 45 days or fewer after the trade date shown. {fmtCount(h.notComputed)} are not counted either way (see the 278-T exemption below).</p>
              <p className="text-[14px] text-muted">{DAYS_METHOD_SENTENCE} A gap over 45 days is a measured fact about two dates as printed, not a finding about the filer.</p>
            </div>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="hist">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="hist" className="text-[24px] max-md:text-[22px]">Days between the trade and the report</span>}
              sub={`Each bar counts the transactions whose gap falls in that range of calendar days. ${fmtCount(h.computed)} transactions have a computed gap.`}
            />
            <HBars
              caption="Transactions by number of days between the trade date and the date the President signed the report"
              unit="Transactions"
              labelHeader="Days from trade to report"
              rows={h.hist.map((b) => ({ key: b.key, label: `${b.label} days`, sub: b.over45 ? 'more than 45' : '45 or fewer', value: b.count, display: fmtCount(b.count) ?? '', muted: !b.over45 }))}
            />
            <p className="mt-3 text-[12.5px] text-muted">Solid bars are gaps of more than 45 days, faded bars are 45 days or fewer; every row also says which. The form&rsquo;s 45-day limit is the only line drawn: no other cutoff carries a meaning.</p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="by-report">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="by-report" className="text-[24px] max-md:text-[22px]">Every report</span>}
              sub={`${fmtCount(withGaps.length)} of the ${fmtCount(h.reports)} reports hold at least one transaction reported more than 45 days after the trade. Counts are transactions in each range of calendar days from trade to the date the President signed.`}
            />
            <DataTable columns={columns} rows={rows} caption="Each of the President's 278-T reports: transactions by days from trade to report, and what the cover's comments box says" />
            {h.covers != null && feeCount > 0 && <p className="mt-3 max-w-[860px] text-[14px]">{FEE_NOTE_SENTENCE(feeCount, h.reports)} {COMPLIANCE_SENTENCE}</p>}
            <p className="mt-2 max-w-[860px] text-[13px] text-muted">{FEE_RULE_SENTENCE}</p>
            <p className="mt-1 max-w-[860px] text-[12.5px] text-muted">Reports are ranked by date signed, never by the number of rows.</p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="exempt">
          <Card>
            <SectionHead as="h2" title={<span id="exempt" className="text-[24px] max-md:text-[22px]">Why {fmtCount(h.notComputed)} transactions have no gap</span>} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]" data-section="exemption">
              <p>{NOT_REQUIRED_SENTENCE}</p>
              <p>
                That covers {fmtCount(notCompFund)} lines for funds (mutual funds, ETFs and money-market funds) and {fmtCount(notCompBond)} for U.S. Treasury securities
                {h.notComputedAllNotRequired ? '' : ' and others'}. For those lines the stored gap is blank, and they are left out of every count on this page: they are not among the {fmtCount(h.over45)} reported more than 45 days after the trade, and not among the {fmtCount(h.atOrUnder45)} reported in 45 days or fewer.
              </p>
              <p className="text-[14px] text-muted">The 278-T&rsquo;s own Summary of Contents says these holdings need not be reported on the form. A blank gap means &ldquo;not computed&rdquo;; it is never a finding either way.</p>
            </div>
          </Card>
        </section>
        <SourceLine />
      </Wrap>
    </div>
  );
}
