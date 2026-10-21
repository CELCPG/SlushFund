import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import EmptyState from '@/components/v2/EmptyState';
import FilingLink from '@/components/v2/FilingLink';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import Pager from '@/components/v2/Pager';
import { buildHref, one, pageOf, type SP } from '@/lib/v2/explorer';
import { PRESIDENT_HUB_PATH, PRESIDENT_PATH, presidentDeepDiveEnabled, presidentPageEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate, fmtRange, fmtUsd } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import {
  CLASS_LABEL, DAYS_METHOD_SENTENCE, FORM_RULE_SENTENCE, NOT_REQUIRED_SENTENCE, getExecutiveFilings, getPresidentTrades, type ExecFiling, type ExecTrade,
} from '@/lib/v2/president';
import { displayAsset } from '@/lib/v2/president-hub-core';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D9. Behind presidentPageEnabled() (on in dev and previews, off on production unless SHOW_PRESIDENT_TRADES=1) until the
// Auditor's page check. Wording: A11 "Wording rules for the D9 President page" (allowed sentences used verbatim), A7b,
// A10 and investigations-scope G1-G10. No verbs that say who decided a trade, no timing beside events, bands only.
export function generateMetadata(): Metadata {
  if (!presidentPageEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: PRESIDENT_PATH,
    title: 'President Trump: securities transactions reported on OGE Form 278-T',
    description: 'Every securities transaction President Trump reported in his periodic transaction reports (OGE Form 278-T), as posted by the U.S. Office of Government Ethics, each linked to the report.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const PER_PAGE = 50;
const SORTS = [
  { value: 'date', label: 'Trade date, newest first' },
  { value: 'date_asc', label: 'Trade date, oldest first' },
  { value: 'band', label: 'Amount band, largest first' },
  { value: 'band_asc', label: 'Amount band, smallest first' },
] as const;
type Sort = (typeof SORTS)[number]['value'];
const field = 'h-11 w-full min-w-0 rounded-xl border border-line bg-page px-3 text-[15px] text-ink focus:border-trades focus:outline-none';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';

function reportLabel(f: Pick<ExecFiling, 'signed' | 'fileName'>): string {
  const n = /\((\d)\)/.exec(f.fileName)?.[1];
  return `278-T signed ${fmtDate(f.signed) ?? 'date not read'}${n ? ` (${n})` : ''}`;
}

export default async function PresidentPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!presidentPageEnabled()) notFound();
  const sp = await searchParams;
  const [data, notes] = await Promise.all([getPresidentTrades(), getExecutiveFilings()]);

  if (!data) {
    return (
      <div data-v2>
        <PageBand><h1 className="mt-8 font-display text-[40px] font-extrabold max-md:mt-5 max-md:text-[30px]">President Trump: securities transactions</h1></PageBand>
        <Wrap className="pb-12 pt-6">
          <EmptyState title="This page's data is unavailable right now" tone="warning">The database did not answer, so nothing is shown. Try again in a few minutes.</EmptyState>
        </Wrap>
      </div>
    );
  }

  const { trades, filings } = data;
  const byDoc = new Map(filings.map((f) => [f.docId, f]));
  const signedDates = filings.map((f) => f.signed).filter(Boolean).sort() as string[];
  const sum = (rows: ExecTrade[], k: 'amount_min' | 'amount_max') => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  const purchases = trades.filter((t) => t.transaction_type === 'purchase');
  const sales = trades.filter((t) => t.transaction_type === 'sale');
  const cls = (c: string) => trades.filter((t) => t.instrument_class === c).length;
  const over = trades.filter((t) => t.stock_act_late === true);
  const overReports = filings.filter((f) => f.over45 > 0);
  const notComputed = trades.filter((t) => t.stock_act_late == null).length;
  const notComputedAllNotRequired = trades.filter((t) => t.stock_act_late == null).every((t) => t.late_basis === 'not_required_on_278T');

  // Filters (GET, no JS): report, type, asset class; sort by date or band; 50 per page.
  const fReport = byDoc.has(one(sp.report)) ? one(sp.report) : '';
  const fType = ['purchase', 'sale'].includes(one(sp.type)) ? one(sp.type) : '';
  const fClass = ['stock', 'bond', 'fund'].includes(one(sp.class)) ? one(sp.class) : '';
  const sort: Sort = (SORTS.find((s) => s.value === one(sp.sort))?.value) ?? 'date';
  let rows = trades.filter((t) => (!fReport || t.source_doc_id === fReport) && (!fType || t.transaction_type === fType) && (!fClass || t.instrument_class === fClass));
  const byDate = (a: ExecTrade, b: ExecTrade) => b.transaction_date.localeCompare(a.transaction_date) || (a.row_number_printed ?? 0) - (b.row_number_printed ?? 0);
  const byBand = (a: ExecTrade, b: ExecTrade) => Number(b.amount_min ?? 0) - Number(a.amount_min ?? 0) || byDate(a, b);
  rows = [...rows].sort(sort === 'date' ? byDate : sort === 'date_asc' ? (a, b) => -byDate(a, b) : sort === 'band' ? byBand : (a, b) => -byBand(a, b));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = pageOf(sp.page, pages);
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const params = { report: fReport || undefined, type: fType || undefined, class: fClass || undefined, sort: sort === 'date' ? undefined : sort };
  const pageHref = (p: number) => buildHref(PRESIDENT_PATH, { ...params, page: p > 1 ? String(p) : undefined }) + '#transactions';

  const columns: DataTableColumn[] = [
    { key: 'date', header: 'Trade date', mobile: 'subtitle', sortable: false },
    { key: 'asset', header: 'Asset (from the report)', mobile: 'title', sortable: false },
    { key: 'type', header: 'Type', sortable: false },
    { key: 'band', header: 'Amount (band)', sortable: false },
    { key: 'notified', header: 'Notification received over 30 days ago', sortable: false },
    { key: 'days', header: 'Days from trade to report', sortable: false },
    { key: 'report', header: 'Report', mobile: 'action', sortable: false },
  ];
  const tableRows: DataTableRow[] = shown.map((t) => {
    const f = byDoc.get(t.source_doc_id);
    return {
      id: t.id,
      values: { date: t.transaction_date, asset: displayAsset(t), type: t.transaction_type, band: t.amount_min, notified: t.notification_over_30_days == null ? null : t.notification_over_30_days ? 'Yes' : 'No', days: t.days_to_file, report: f ? reportLabel(f) : t.source_doc_id },
      cells: {
        date: <span className="whitespace-nowrap font-mono text-[13.5px]">{fmtDate(t.transaction_date)}</span>,
        asset: (
          <span className="block min-w-0 break-words">
            <span className="font-semibold">{displayAsset(t)}</span>
            {t.instrument_class && CLASS_LABEL[t.instrument_class] && (
              <span className="ml-1.5 whitespace-nowrap rounded-full bg-neutral-tint px-2 py-0.5 text-[11.5px] font-semibold text-muted">{CLASS_LABEL[t.instrument_class]}</span>
            )}
            {t.restated && t.filed_date && (
              <span className="mt-1 block text-[12.5px] text-muted">
                The amount on this line was changed by an amendment signed {fmtDate(t.filed_date)}{t.restates_original?.amount_range ? ` (first reported as ${t.restates_original.amount_range.replace(/\s*-\s*/, '–')})` : ''}.
              </span>
            )}
          </span>
        ),
        type: <span className="whitespace-nowrap">{t.transaction_type === 'purchase' ? 'Purchase' : t.transaction_type === 'sale' ? 'Sale' : t.transaction_type}</span>,
        band: <span className="whitespace-nowrap font-mono text-[13.5px]">{fmtRange(t.amount_min, t.amount_max, t.amount_range) ?? 'Not stated'}</span>,
        notified: <span>{t.notification_over_30_days == null ? 'Not printed' : t.notification_over_30_days ? 'Yes' : 'No'}</span>,
        days: t.days_to_file == null ? (
          <span className="block max-w-[220px] text-[12.5px] text-muted">{t.late_basis === 'not_required_on_278T' ? NOT_REQUIRED_SENTENCE : 'Not computed.'}</span>
        ) : (
          <span className={`whitespace-nowrap font-mono text-[13.5px] ${t.stock_act_late ? 'rounded bg-stale-tint px-1.5 py-0.5 text-stale-ink' : ''}`}>{fmtCount(t.days_to_file)} days</span>
        ),
        report: (
          <span className="block">
            <span className="block whitespace-nowrap text-[13px]">{f ? reportLabel(f) : 'Report'}{t.page_number ? `, page ${t.page_number}` : ''}{t.row_number_printed ? `, line #${t.row_number_printed}` : ''}</span>
            <FilingLink href={t.disclosure_url} source="OGE Form 278-T" label="View report" />
          </span>
        ),
      },
    };
  });

  const feeNotes = notes.state === 'ok' ? notes.rows.filter((n) => n.reviewer_comment_kind === 'late_fee_note' && n.reviewer_comment) : [];

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">
          <Link href="/people" className="hover:underline">People</Link> · Executive branch
        </p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">President Trump: securities transactions</h1>
        <p className="mt-3 max-w-[860px] pb-8 text-[17px] text-on-deep max-md:text-[15.5px]">
          President Trump reported {fmtCount(trades.length)} securities transactions in {fmtCount(filings.length)} periodic transaction reports (OGE Form 278-T) signed between {fmtDate(signedDates[0])} and {fmtDate(signedDates[signedDates.length - 1])}, as posted by the U.S. Office of Government Ethics.
        </p>
        {presidentDeepDiveEnabled() && (
          <p className="-mt-5 pb-8 text-[15px] max-md:-mt-3">
            <Link href={PRESIDENT_HUB_PATH} className="font-semibold text-white underline">The President: disclosure timing, the largest transactions and how the data was built</Link>
          </p>
        )}
      </PageBand>

      <Wrap className="pb-12">
        <div className="mt-6 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <Card>
            <p className={lbl}>Transactions</p>
            <p className="font-display text-[34px] font-extrabold">{fmtCount(trades.length)}</p>
            <p className="text-[14px] text-muted">{fmtCount(purchases.length)} purchases, {fmtCount(sales.length)} sales. By the asset as printed: {fmtCount(cls('stock'))} listed as stock, {fmtCount(cls('bond'))} as bonds and other fixed-income securities (municipal, corporate, and perpetual or preferred), {fmtCount(cls('fund'))} as funds.</p>
          </Card>
          <Card>
            <p className={lbl}>Reported values sum to</p>
            <p className="font-display text-[22px] font-extrabold leading-tight">between {fmtUsd(sum(trades, 'amount_min'))} and {fmtUsd(sum(trades, 'amount_max'))}</p>
            <p className="mt-1 text-[14px] text-muted">
              Purchases between {fmtUsd(sum(purchases, 'amount_min'))} and {fmtUsd(sum(purchases, 'amount_max'))}; sales between {fmtUsd(sum(sales, 'amount_min'))} and {fmtUsd(sum(sales, 'amount_max'))}.
            </p>
          </Card>
          <Card>
            <p className={lbl}>How the range is worked out</p>
            <p className="text-[14px] text-muted">
              The form gives each transaction&rsquo;s value only as a band, such as between $15,001 and $50,000. We add the lowest amount of every band for the first figure and the highest for the second. The real sum lies somewhere in that range; no single figure can be stated from the reports.
            </p>
          </Card>
        </div>

        {/* ---------------------------------------------------------------- the reports */}
        <section className="pt-8" aria-labelledby="reports">
          <Card>
            <SectionHead as="h2" title={<span id="reports" className="text-[24px] max-md:text-[22px]">The {fmtCount(filings.length)} reports</span>} sub="Each report as the Office of Government Ethics posts it, in the order signed. The signature date is the date President Trump signed the report's cover." />
            <ol className="divide-y divide-line">
              {filings.map((f) => (
                <li key={f.docId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-0">
                    <Link href={buildHref(PRESIDENT_PATH, { report: f.docId }) + '#transactions'} className="font-semibold hover:underline">{reportLabel(f)}</Link>
                    <span className="block text-[13px] text-muted">
                      {fmtCount(f.transactions)} transaction{f.transactions === 1 ? '' : 's'}, trades dated {fmtDate(f.firstTrade)} to {fmtDate(f.lastTrade)}
                      {f.amendedOn ? `; amended ${fmtDate(f.amendedOn)}` : ''} · {f.fileName}
                    </span>
                  </span>
                  <FilingLink href={f.url} source="OGE Form 278-T" label="View report" />
                </li>
              ))}
            </ol>
          </Card>
        </section>

        {/* ---------------------------------------------------------------- 45 days (A11 wording only) */}
        <section className="pt-8" aria-labelledby="gaps">
          <Card>
            <SectionHead as="h2" title={<span id="gaps" className="text-[24px] max-md:text-[22px]">Reported more than 45 days after the trade</span>} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]">
              <p>{FORM_RULE_SENTENCE}</p>
              <p>
                <b>{fmtCount(over.length)} transactions in {fmtCount(overReports.length)} of the {fmtCount(filings.length)} reports were reported more than 45 days after the trade date shown, counted to the date President Trump signed the report.</b>
              </p>
              <p className="text-[14px] text-muted">{DAYS_METHOD_SENTENCE} A gap over 45 days is a measured fact about two dates as printed, not a finding about the filer.</p>
              {notComputed > 0 && (
                <p className="text-[14px] text-muted">
                  {notComputedAllNotRequired
                    ? <>{fmtCount(notComputed)} transactions were not computed: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.</>
                    : <>{fmtCount(notComputed)} transactions were not computed.</>}
                </p>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[14.5px]">
                <caption className="sr-only">Reports holding a transaction reported more than 45 days after the trade, longest gap first</caption>
                <thead className="text-[12px] uppercase tracking-[0.05em] text-muted">
                  <tr><th scope="col" className="py-2 pr-3">Report</th><th scope="col" className="py-2 pr-3">Longest gap</th><th scope="col" className="py-2 pr-3">Transactions over 45 days</th><th scope="col" className="py-2">Filing</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...overReports].sort((a, b) => (b.longestGap ?? 0) - (a.longestGap ?? 0)).map((f) => (
                    <tr key={f.docId}>
                      <th scope="row" className="py-2 pr-3 font-semibold">{reportLabel(f)}</th>
                      <td className="py-2 pr-3 font-mono">{fmtCount(f.longestGap)} days</td>
                      <td className="py-2 pr-3 font-mono">{fmtCount(f.over45)} of {fmtCount(f.transactions)}</td>
                      <td className="py-2"><FilingLink href={f.url} source="OGE Form 278-T" label="View report" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12.5px] text-muted">Reports ranked by the longest gap in days, never by the number of rows.</p>
            {notes.state === 'ok' && feeNotes.length > 0 && (
              <div className="mt-5 max-w-[860px] rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px]" data-section="reviewer-notes">
                <p>On {fmtCount(feeNotes.length)} of the {fmtCount(filings.length)} reports, the reviewing official wrote in the comments box: &ldquo;Filer paid late fee(s).&rdquo;</p>
                <ul className="mt-2 space-y-1 text-[13.5px]">
                  {feeNotes.map((n) => {
                    const f = byDoc.get(n.source_doc_id);
                    return (
                      <li key={n.source_doc_id}>
                        &ldquo;{String(n.reviewer_comment)}&rdquo; on {f ? reportLabel(f) : String(n.file_name ?? n.source_doc_id)}{n.reviewer_comment_date ? `, dated ${fmtDate(String(n.reviewer_comment_date))}` : ''}{' '}
                        <FilingLink href={f ? `${f.url}#page=1` : String(n.disclosure_url ?? '')} source="OGE Form 278-T, page 1" label="Page 1" />
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2">Every report also carries the agency ethics official&rsquo;s signed opinion that the filer is in compliance with applicable laws and regulations.</p>
              </div>
            )}
          </Card>
        </section>

        {/* ---------------------------------------------------------------- every transaction */}
        <section className="pt-8" aria-labelledby="transactions" id="transactions">
          <Card>
            <SectionHead as="h2" title={<span id="p-tx" className="text-[24px] max-md:text-[22px]">Every transaction, with its report</span>} sub="As printed on the report: the asset text, the type, the amount band and the notification answer. The report does not show who decided a transaction." />
            <form method="get" action={`${PRESIDENT_PATH}#transactions`} className="mb-4 grid grid-cols-5 items-end gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              <label className="block min-w-0">
                <span className={lbl}>Report</span>
                <select name="report" defaultValue={fReport} className={field}>
                  <option value="">All {fmtCount(filings.length)} reports</option>
                  {filings.map((f) => <option key={f.docId} value={f.docId}>{reportLabel(f)}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={lbl}>Type</span>
                <select name="type" defaultValue={fType} className={field}>
                  <option value="">Purchases and sales</option>
                  <option value="purchase">Purchases</option>
                  <option value="sale">Sales</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className={lbl}>Asset class</span>
                <select name="class" defaultValue={fClass} className={field}>
                  <option value="">All classes</option>
                  <option value="stock">Stock</option>
                  <option value="bond">Bond</option>
                  <option value="fund">Fund</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className={lbl}>Sort</span>
                <select name="sort" defaultValue={sort} className={field}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-[15px] font-bold text-white hover:bg-deep">Show</button>
            </form>
            <p className="mb-3 text-[13.5px] text-muted" aria-live="polite">
              {fmtCount(rows.length)} of {fmtCount(trades.length)} transactions{fReport || fType || fClass ? <> · <Link href={`${PRESIDENT_PATH}#transactions`} className="underline">Clear filters</Link></> : null}
            </p>
            <DataTable columns={columns} rows={tableRows} caption="President Trump's reported securities transactions, OGE Form 278-T" emptyMessage="No transactions match these filters." />
            <Pager page={page} pages={pages} href={pageHref} label="Transaction pages" />
            <p className="mt-3 text-[12.5px] text-muted">Shaded days: more than 45 days after the trade date.</p>
            <p className="mt-1 text-[12.5px] text-muted">
              Asset names are read from the report&rsquo;s text and can carry small spelling slips from that reading; the report linked on each row is the record. Source: OGE Form 278-T reports as posted by the U.S. Office of Government Ethics (extapps2.oge.gov), read line by line into our records and checked by eye on samples (A11). Asset classes are our reading of the asset text as printed. Lines on a 278-T marked as unsolicited or discretionary are shown as printed and not interpreted.
            </p>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
