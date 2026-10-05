import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/v2/seo';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import ReportErrorForm from '@/components/v2/ReportErrorForm';
import { ERROR_TEXT, normalizePageUrl, type ReportError } from '@/lib/v2/error-reports';

// F1 (A8 L5, Colin's answer to HQ A-089): a built-in form. Reports are saved to the site's database (anon INSERT
// only), Apex forwards each one to Colin, and we reply within 2 business days when there is a contact. No email
// address is published. Every "Report an error" link on the site opens this page with ?from=<that page's path>.
export const metadata: Metadata = pageMetadata({
  path: '/report-an-error',
  title: 'Report an error',
  description: 'Tell us about a figure, a name or a date on SlushFund that differs from the official record. We check every report against the source filing.',
});

type SP = { from?: string | string[]; sent?: string | string[]; error?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReportAnErrorPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const from = normalizePageUrl(one(sp.from)) ?? '';
  const err = one(sp.error);
  const error = err && err in ERROR_TEXT ? (err as ReportError) : undefined;
  return (
    <SimplePage
      eyebrow="About"
      title="Report an error"
      dek="If a figure, a name or a date on this site differs from the official record, tell us here. We check every report against the source filing."
    >
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
        <Card as="section">
          <h2 id="re-form" className="mb-4 font-display text-[24px] font-extrabold">Your report</h2>
          <ReportErrorForm from={from} sent={one(sp.sent) === '1'} error={error} />
        </Card>
        <div className="grid content-start gap-4">
          <Card as="section">
            <h2 id="re-next" className="font-display text-[22px] font-extrabold">What happens next</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>We read every report and check it against the official record it points to.</li>
              <li>If you leave a way to reach you, we reply within 2 business days.</li>
              <li>
                Confirmed errors are fixed and listed on the{' '}
                <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections page</Link>. We never change a page silently.
              </li>
            </ul>
          </Card>
          <Card as="section">
            <h2 id="re-kept" className="font-display text-[22px] font-extrabold">What we keep</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              The page address, your message, your contact if you give one, and a one-way hash of your browser&rsquo;s name (not the name itself). Nothing else is saved with the report.
            </p>
          </Card>
        </div>
      </div>
    </SimplePage>
  );
}
