import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, SectionHead, Wrap } from '@/components/v2/PageBand';
import { PresidentBand, PresidentUnavailable } from '@/components/v2/president/PresidentParts';
import { PRESIDENT_LARGEST_PATH, PRESIDENT_QUALITY_PATH, PRESIDENT_TIMING_PATH, presidentDeepDiveEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { AUDITS, HISTORY, SOURCE_NOTES } from '@/lib/v2/president-audit-record';
import { COMPLIANCE_SENTENCE, FEE_NOTE_SENTENCE } from '@/lib/v2/president-hub-core';
import { getHub } from '@/lib/v2/president-hub';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D15 /president/data-quality: how the data was built, read, audited and fixed, in plain language. Live figures come from the database
// (president-hub-core.ts); history figures come from the audit and fix records (president-audit-record.ts) and name their source.
// PERPETUALS RULE (A11b N5): this page never prints a maturity date for a perpetual security, and never writes "due 12/31/49".
export function generateMetadata(): Metadata {
  if (!presidentDeepDiveEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: PRESIDENT_QUALITY_PATH,
    title: 'The President: how the 278-T data was built and checked',
    description: 'Where the President’s transaction data comes from, how the scanned reports were read, what the two audits found, and what has not been checked.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const READ_CHECK: Record<string, string> = {
  agree: 'The line matches a line in the PDF’s own scan text (description, date and band).',
  differs: 'A line in the scan text matches the description but the date or band differs, or the description differs slightly. The scan text is often garbled, so this is a flag to look, not a finding of an error.',
  no_textlayer_line: 'No line in the scan text matched. Most pages have no usable scan text.',
  'not checked': 'No comparison with the scan text was recorded for the line.',
};
const REREAD: Record<string, string> = {
  'first read kept': 'Read once by the vision model; no reason to read it again.',
  strip_kept: 'Read again on a closer crop; the first reading was confirmed.',
  row_taken: 'Read again on a closer crop; the second reading was used.',
  hand_ok: 'Checked against the page image during review; no change needed.',
  hand_fixed: 'Checked against the page image during review and corrected.',
  hand_inserted: 'A line the vision model missed, added from the page image during review.',
};
const READ_CHECK_ORDER = ['agree', 'differs', 'no_textlayer_line', 'not checked'];
const REREAD_ORDER = ['first read kept', 'strip_kept', 'row_taken', 'hand_ok', 'hand_fixed', 'hand_inserted'];

export default async function PresidentDataQualityPage() {
  if (!presidentDeepDiveEnabled()) notFound();
  const h = await getHub();
  if (!h) return <PresidentUnavailable current={PRESIDENT_QUALITY_PATH} title="How the data was built and checked" />;

  const metaReport = h.perReport.find((r) => r.docId.startsWith(HISTORY.metaLine.doc));
  const feeCount = (h.covers ?? []).filter((c) => c.reviewer_comment_kind === 'late_fee_note' && c.reviewer_comment).length;
  const order = (order: string[]) => (a: { value: string }, b: { value: string }) => (order.indexOf(a.value) + 1 || 99) - (order.indexOf(b.value) + 1 || 99);
  const readCheck = [...h.readCheck].sort(order(READ_CHECK_ORDER));
  const reread = [...h.reread].sort(order(REREAD_ORDER));
  const h2 = (id: string, title: string) => <span id={id} className="text-[24px] max-md:text-[22px]">{title}</span>;

  return (
    <div data-v2>
      <PresidentBand
        current={PRESIDENT_QUALITY_PATH}
        title="How the data was built and checked"
        lead={<p>The Office of Government Ethics posts each report as a scanned PDF. Every transaction on this site was read off those scans. Here is how, what the audits found, and what has not been checked.</p>}
      />
      <Wrap className="pb-12">
        <section className="pt-6" aria-labelledby="source">
          <Card>
            <SectionHead as="h2" title={h2('source', 'Where it comes from')} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]">
              <p>
                The U.S. Office of Government Ethics (OGE) posts President Trump&rsquo;s periodic transaction reports (Form 278-T) at extapps2.oge.gov, one PDF per report. {fmtCount(h.reports)} reports are loaded here, holding {fmtCount(h.total)} printed transaction lines. There is no spreadsheet: each report is a stack of scanned table pages, up to {fmtCount(Math.max(...h.perReport.map((r) => r.transactions)))} lines in one report. Every transaction on this site links to its report and page.
              </p>
              <p>The same table also holds a few lines from the Vice President&rsquo;s annual report. They are in none of the President&rsquo;s figures.</p>
            </div>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="pipeline">
          <Card>
            <SectionHead as="h2" title={h2('pipeline', 'How the pages were read')} />
            <div className="max-w-[860px] space-y-3 text-[15.5px]">
              <p>
                Each page was turned into an image at 200 dots per inch and cut along the table&rsquo;s own printed rules into strips of eight rows. A vision model running on our own computer read each strip: the line number, the asset text, the type, the date, whether the notification was received over 30 days earlier, and the amount band. Lines the first reading doubted were read again on a closer crop. Where a page had a usable scan text layer, the reading was compared with it.
              </p>
              <p>The scans are skewed and uneven, and the model is not perfect. That is why the lines were then checked, and why the audits below matter.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-6 max-lg:grid-cols-1">
              <div data-section="how-settled">
                <h3 className="text-[15px] font-bold">How each of the {fmtCount(h.total)} lines was settled</h3>
                <dl className="mt-2 space-y-2 text-[14px]">
                  {reread.map((r) => (
                    <div key={r.value}><dt className="font-mono font-bold">{fmtCount(r.count)} <span className="font-sans font-normal text-muted">{r.value === 'first read kept' ? 'first read kept' : r.value.replace(/_/g, ' ')}</span></dt><dd className="text-muted">{REREAD[r.value] ?? 'As recorded.'}</dd></div>
                  ))}
                </dl>
              </div>
              <div data-section="text-layer">
                <h3 className="text-[15px] font-bold">Compared with the PDF&rsquo;s own scan text</h3>
                <dl className="mt-2 space-y-2 text-[14px]">
                  {readCheck.map((r) => (
                    <div key={r.value}><dt className="font-mono font-bold">{fmtCount(r.count)} <span className="font-sans font-normal text-muted">{r.value.replace(/_/g, ' ')}</span></dt><dd className="text-muted">{READ_CHECK[r.value] ?? 'As recorded.'}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="found">
          <Card>
            <SectionHead as="h2" title={h2('found', 'What the audits found and what changed')} sub="Two audits, both by a separate unit that did not build the data. Fixes to individual lines were made from the page image." />
            <ol className="max-w-[860px] list-decimal space-y-4 pl-5 text-[15.5px]" data-section="fixes">
              <li>
                <b>Bond lines in a broker&rsquo;s format.</b> {fmtCount(HISTORY.bondLineFixes)} lines were corrected ({fmtCount(HISTORY.bondLineFixesBroker)} broker-format lines and 2 municipal lines). In {fmtCount(HISTORY.bondLineCouponFixes)} of them the reading had dropped the leading digit of the coupon (a page that prints 05.375% had been read as a coupon under 1%). Maturity dates and issuer names were also repaired on some of these lines. All were re-read on 400 dots per inch crops.
              </li>
              <li>
                <b>One band that was wrong by a wide margin.</b> The Meta Platforms line (#{HISTORY.metaLine.printed}) on page {HISTORY.metaLine.page} of the {metaReport ? metaReport.label : 'June 25, 2026'} report was first stored at {HISTORY.metaLine.was}. The page prints {HISTORY.metaLine.now}. It was fixed, and it is one of the lines on <Link href={PRESIDENT_LARGEST_PATH} className="underline">the largest-transactions page</Link>.
              </li>
              <li>
                <b>Rows shifted by one.</b> On the same page, printed lines #{HISTORY.shiftedRows.from} to #{HISTORY.shiftedRows.to} ({HISTORY.shiftedRows.count} lines) had the band and type of the neighboring row. They were corrected from the page. A check of {fmtCount(HISTORY.bandCheckRows)} lines on {HISTORY.bandCheckPages} pages for the same kind of slip found no other, and the auditor&rsquo;s {HISTORY.a11bExtraPages} further pages ({fmtCount(HISTORY.a11bExtraRows)} lines) found none either.
              </li>
              <li>
                <b>Asset classes.</b> {fmtCount(HISTORY.reclassified)} lines changed class when the rules for stock, bond and fund were tightened, for example lines first labeled &ldquo;other&rdquo; that are stock or bonds. The table now has {fmtCount(h.classes.stock)} stock, {fmtCount(h.classes.bond)} bond and {fmtCount(h.classes.fund)} fund lines{h.classes.other === 0 ? ' and none unclassified' : `, and ${fmtCount(h.classes.other)} unclassified`}. A page never calls a bond line &ldquo;stock&rdquo;.
              </li>
              <li>
                <b>The 278-T exemption.</b> The form says U.S. Treasury securities and fund holdings need not be reported on a 278-T, so no gap is computed for them: {fmtCount(h.notComputed)} lines now carry a blank gap instead of a count. See <Link href={PRESIDENT_TIMING_PATH} className="underline">disclosure timing</Link>.
              </li>
              <li>
                <b>Perpetual securities.</b>{' '}{fmtCount(h.perpetuals)}{' '}bond lines are perpetual fixed-income securities, mostly capital securities issued by banks and insurers. A perpetual has no maturity. Brokers print a placeholder date for these lines; it is not a real maturity, so this site shows the word &ldquo;perpetual&rdquo; and no maturity for them.
              </li>
              <li>
                <b>Amended lines.</b> {fmtCount(h.restatedLines)} lines are the replacement lines of an amended report. The original lines they replace are not counted twice.
              </li>
              <li>
                <b>The covers.</b>{' '}Each report&rsquo;s cover page was read by eye, including the Comments of Reviewing Officials box and the dates on it. The notes in that box are quoted only as printed, and only beside the agency ethics official&rsquo;s signed opinion.{' '}
                {feeCount > 0 && <>{FEE_NOTE_SENTENCE(feeCount, h.reports)} {COMPLIANCE_SENTENCE}</>}
              </li>
            </ol>
            <p className="mt-3 text-[12.5px] text-muted" data-section="history-note">
              The counts in items 1 to 4, the {fmtCount(HISTORY.bandCheckRows)} lines on {HISTORY.bandCheckPages} pages, the auditor&rsquo;s {HISTORY.a11bExtraPages} further pages and {fmtCount(HISTORY.a11bExtraRows)} lines, the 46 of about 330 pages and the 60-line sample are not computed from the database: it holds the corrected lines, not a log of what each fix changed. They are taken from the fix record ({SOURCE_NOTES.r10f.split(' ')[0]}, Oct 19, 2026) and the two audit files named below. The other counts are computed from the database when the page loads.
            </p>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="audits">
          <Card>
            <SectionHead as="h2" title={h2('audits', 'The audit files')} />
            <ul className="space-y-3 text-[15px]" data-section="audits">
              {AUDITS.map((a) => (
                <li key={a.id} className="max-w-[860px]">
                  <p><b>{a.id}</b>, {fmtDate(a.date)}: <span className="font-mono text-[13.5px]">{a.file}</span></p>
                  <p className="text-[14px] text-muted">{a.what} Result: {a.verdict}.</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="pt-8" aria-labelledby="limits">
          <Card>
            <SectionHead as="h2" title={h2('limits', 'What has not been checked')} />
            <ul className="max-w-[860px] list-disc space-y-2 pl-5 text-[15px]" data-section="limits">
              <li>
                {fmtCount(HISTORY.pagesReadRowByRow)} of about {fmtCount(HISTORY.tablePagesApprox)} table pages in the large reports have been compared with the page image row by row. The one-row shift described above has not reappeared on any of them, but it is not ruled out on the pages not read that way. The rest were checked by a random sample of {fmtCount(HISTORY.a11Sample)} lines, by arithmetic checks on every line, and by the line-number sequence of every report.
              </li>
              <li>Every line on <Link href={PRESIDENT_LARGEST_PATH} className="underline">the largest-transactions page</Link> was compared with its page image before this section was published.</li>
              <li>Asset names can carry small spelling slips from the reading. The linked report is the record. If a line does not match its page, <Link href="/report-an-error" className="underline">report the error</Link>.</li>
              <li>Whether the filer was granted a filing extension is not on the posted report, so it is not in these records.</li>
            </ul>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
