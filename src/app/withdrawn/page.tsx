import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import ReportErrorLink from '@/components/v2/ReportErrorLink';
import SimplePage from '@/components/v2/SimplePage';

// Served by src/proxy.ts at the address of each withdrawn story, with HTTP 410. The copy is
// deliberately neutral: it repeats no claim from the story and names no one. Needs Colin's OK and
// a lawyer read together with the corrections-log entry (src/data/corrections.ts).
export const metadata: Metadata = pageMetadata({
  path: null, // served under many addresses (rewrite): no canonical
  title: 'Story withdrawn pending re-verification',
  robots: { index: false, follow: false },
});

export default function WithdrawnPage() {
  return (
    <SimplePage
      eyebrow="Investigations"
      title="This story has been withdrawn pending re-verification"
      dek="We took it down while we check its figures against official public records again. It may return, corrected, once every figure has a cited source."
    >
      <section className="max-w-[720px] rounded-card bg-card p-6 shadow-card sm:p-8">
        <p className="text-[16px] leading-relaxed">
          Our earlier stories were audited against the official records. That audit found figures that did not match those records and figures we could not trace to a source, so we withdrew all of them rather than fix them one by one. Nothing from this story is shown here.
        </p>
        <p className="mt-3 text-[16px] leading-relaxed">
          What happened, and what we are changing, is on the corrections page. The data pages stay open, and each trade and contract on them links to the filing it came from.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/about/corrections" className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-deep">Read the corrections log</Link>
          <Link href="/investigations" className="inline-flex rounded-full bg-neutral-tint px-5 py-2.5 text-sm font-bold text-ink hover:bg-line">All investigations</Link>
          <Link href="/about/methodology" className="inline-flex rounded-full bg-neutral-tint px-5 py-2.5 text-sm font-bold text-ink hover:bg-line">How we verify</Link>
          <ReportErrorLink className="inline-flex rounded-full bg-neutral-tint px-5 py-2.5 text-sm font-bold text-ink hover:bg-line" />
        </div>
      </section>
    </SimplePage>
  );
}
