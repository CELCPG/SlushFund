import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import FilingLink from '@/components/v2/FilingLink';
import { Card, SectionHead, Wrap } from '@/components/v2/PageBand';
import { HBars, PresidentBand, PresidentUnavailable, SourceLine } from '@/components/v2/president/PresidentParts';
import { PRESIDENT_LARGEST_PATH, PRESIDENT_PATH, presidentDeepDiveEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { CLASS_LABEL } from '@/lib/v2/president';
import { displayAsset, reportLabel, scanHref } from '@/lib/v2/president-hub-core';
import { getHub } from '@/lib/v2/president-hub';
import { LARGEST_CHECKED_ON, LARGEST_FLOOR, isCheckedAgainstPage } from '@/lib/v2/president-largest-verified';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D15 /president/largest. HARD RULE (A11 / A11b): a row appears here only because it sits in the top band, and it is marked "compared
// with its page" only when it equals the line president-largest-verified.ts recorded after reading its page image. A row that is
// not in that record is shown as not yet compared and verify-gates fails. Amounts are OGE bands; two rows in one band are never ranked.
export function generateMetadata(): Metadata {
  if (!presidentDeepDiveEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: PRESIDENT_LARGEST_PATH,
    title: 'The President: the largest reported transactions by amount band',
    description: 'The securities transactions in the highest amount band on the President’s 278-T reports, each with a link to its page in the OGE report.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

export default async function PresidentLargestPage() {
  if (!presidentDeepDiveEnabled()) notFound();
  const h = await getHub();
  if (!h) return <PresidentUnavailable current={PRESIDENT_LARGEST_PATH} title="The largest reported transactions" />;

  const byDoc = new Map(h.filings.map((f) => [f.docId, f]));
  const top = h.trades
    .filter((t) => Number(t.amount_min ?? 0) >= LARGEST_FLOOR)
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || a.source_doc_id.localeCompare(b.source_doc_id) || (a.row_number_printed ?? 0) - (b.row_number_printed ?? 0));
  const topBand = [...new Set(top.map((t) => t.amount_range))].join(' and ');
  const unchecked = top.filter((t) => !isCheckedAgainstPage(t));
  const nextBand = h.bands.filter((b) => b.min >= 1_000_000 && b.min < LARGEST_FLOOR);

  const columns: DataTableColumn[] = [
    { key: 'date', header: 'Trade date', mobile: 'subtitle', sortKey: 'date' },
    { key: 'asset', header: 'Asset (as the report prints it)', mobile: 'title', sortable: false },
    { key: 'type', header: 'Type' },
    { key: 'band', header: 'Amount (band)', sortable: false },
    { key: 'notified', header: 'Notification received over 30 days ago', sortable: false },
    { key: 'report', header: 'Report, page and line', sortable: false },
    { key: 'check', header: 'Compared with its page', sortable: false },
    { key: 'scan', header: 'Page in the OGE report', sortable: false, mobile: 'action' },
  ];
  const rows: DataTableRow[] = top.map((t) => {
    const f = byDoc.get(t.source_doc_id);
    const ok = isCheckedAgainstPage(t);
    return {
      id: t.id,
      values: { date: t.transaction_date, type: t.transaction_type, report: f ? reportLabel(f) : t.source_doc_id },
      cells: {
        date: <span className="whitespace-nowrap font-mono text-[13.5px]">{fmtDate(t.transaction_date)}</span>,
        asset: (
          <span className="block min-w-0 break-words">
            <span className="font-semibold">{displayAsset(t)}</span>
            {t.instrument_class && CLASS_LABEL[t.instrument_class] && (
              <span className="ml-1.5 whitespace-nowrap rounded-full bg-neutral-tint px-2 py-0.5 text-[11.5px] font-semibold text-muted">{CLASS_LABEL[t.instrument_class]}</span>
            )}
          </span>
        ),
        type: <span className="whitespace-nowrap">{t.transaction_type === 'purchase' ? 'Purchase' : t.transaction_type === 'sale' ? 'Sale' : t.transaction_type}</span>,
        band: <span className="font-mono text-[13.5px] sm:whitespace-nowrap">{t.amount_range ? t.amount_range.replace(/\s*-\s*/, ' to ') : 'Not stated'}</span>,
        notified: <span>{t.notification_over_30_days == null ? 'Not printed' : t.notification_over_30_days ? 'Yes' : 'No'}</span>,
        report: <span className="block text-[13px]">{f ? reportLabel(f) : 'Report'}, page {t.page_number ?? '?'}, line #{t.row_number_printed ?? '?'}</span>,
        check: ok
          ? <span className="text-[13px]">Yes, {fmtDate(LARGEST_CHECKED_ON)}</span>
          : <span className="rounded bg-stale-tint px-1.5 py-0.5 text-[12.5px] text-stale-ink" data-unchecked>Not yet compared with its page</span>,
        scan: <FilingLink href={scanHref(t)} source={`OGE Form 278-T, page ${t.page_number ?? ''}`} label={`View page ${t.page_number ?? ''}`.trim()} />,
      },
    };
  });

  return (
    <div data-v2>
      <PresidentBand
        current={PRESIDENT_LARGEST_PATH}
        title="The largest reported transactions"
        lead={<p>The form reports each transaction as an amount band, not a dollar figure. These are the transactions in the highest band the form offers{topBand ? `: ${topBand.replace(/\s*-\s*/, ' to ')}` : ''}.</p>}
      />
      <Wrap className="pb-12">
        <section className="pt-6" aria-labelledby="top">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="top" className="text-[24px] max-md:text-[22px]">{fmtCount(top.length)} transactions in the highest band</span>}
              sub="Listed by trade date, newest first. Two transactions in the same band cannot be ranked against each other: the report gives only the band."
            />
            {unchecked.length > 0 && (
              <p className="mb-3 rounded-xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink" data-section="unchecked">
                {fmtCount(unchecked.length)} of these rows have not yet been compared with their page image. They are marked below.
              </p>
            )}
            <DataTable columns={columns} rows={rows} initialSort={{ key: 'date', dir: 'desc' }} caption="The President's transactions in the highest amount band on OGE Form 278-T" emptyMessage="No transaction in the highest band." />
            <div className="mt-4 max-w-[860px] space-y-2 text-[13.5px] text-muted">
              <p>
                Each row above was compared with the page image of its report: the printed line number, the asset text, the type, the date, the notification answer and the amount band all matched the stored row on {fmtDate(LARGEST_CHECKED_ON)}. A row is marked &ldquo;Yes&rdquo; only while it still equals the line that was compared. The &ldquo;View page&rdquo; link opens the report at that page.
              </p>
              <p>The report does not show who decided a transaction. It reports lines for U.S. Treasury notes and for funds as well as for companies, and those lines are listed as printed.</p>
            </div>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="bands">
          <Card>
            <SectionHead as="h2" title={<span id="bands" className="text-[24px] max-md:text-[22px]">Transactions by amount band</span>} sub="Every transaction on the reports, grouped by the band the form prints. Counts of transactions, not money." />
            <HBars
              caption="Securities transactions by the amount band printed on the report"
              unit="Transactions"
              labelHeader="Amount band"
              rows={[...h.bands].reverse().map((b) => ({ key: b.band, label: b.band.replace(/\s*-\s*/, ' to '), value: b.count, display: fmtCount(b.count) ?? '' }))}
            />
            {nextBand.length > 0 && (
              <p className="mt-3 text-[14px]">
                {nextBand.map((b) => `${fmtCount(b.count)} transactions are in the band ${b.band.replace(/\s*-\s*/, ' to ')}`).join('; ')}. Those rows are not listed here. They are in <Link href={`${PRESIDENT_PATH}?sort=band#transactions`} className="font-semibold text-trades-ink underline">the full list, sorted by amount band</Link>, each with its report.
              </p>
            )}
            <p className="mt-2 text-[12.5px] text-muted">Adding the lowest or highest amount of every band gives only a range, never one figure; the full list page states that range and how it is worked out.</p>
          </Card>
        </section>
        <SourceLine />
      </Wrap>
    </div>
  );
}
