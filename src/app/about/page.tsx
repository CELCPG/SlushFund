import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { MoneyLegend } from '@/components/v2/MoneyChip';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import DraftBlock from '@/components/v2/trust/DraftBlock';
import { reportErrorHref } from '@/lib/v2/error-reports';

// D5 About. The founder note is Colin's to write (DraftBlock renders it everywhere except Vercel production).
// Do not name the founder anywhere else. Error reports go to the built-in form (F1, HQ A-089): no email address.
export const metadata: Metadata = pageMetadata({
  path: '/about',
  card: 'own',
  title: 'About',
  description: 'SlushFund is a free, cross-party site built only on public records, where every number links to the official filing.',
});

const LINKS = [
  { href: '/about/methodology', label: 'Methodology', text: 'Where each dataset comes from, what is loaded, and its known limits.' },
  { href: '/data/status', label: 'Data status', text: 'When each dataset last loaded, and whether it is behind.' },
  { href: '/about/corrections', label: 'Corrections', text: 'What we changed, and when.' },
];

export default function AboutPage() {
  return (
    <SimplePage
      eyebrow="About"
      title="A free, cross-party look at public money"
      dek="SlushFund follows federal contracts and congressional stock trades through the people, companies and agencies involved. Campaign money and lobbying are planned and not loaded yet. Every number links to the official record it came from."
    >
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
        <div className="grid gap-4">
          <Card as="section">
            <h2 className="font-display text-[24px] font-extrabold">What this site is</h2>
            <p className="mt-3 max-w-[680px] text-[16px] leading-relaxed">
              A free public tool for looking up where public money goes and how elected officials&rsquo; finances connect to it. You can look up a member of Congress, a contractor or an agency and see the filings behind every figure.
            </p>
          </Card>

          <Card as="section">
            <h2 className="font-display text-[24px] font-extrabold">Cross-party, by rule</h2>
            <ul className="mt-3 max-w-[680px] list-disc space-y-2 pl-5 text-[16px] leading-relaxed">
              <li>The same standard applies to every member, whichever party they belong to. Party appears as a word, never as a chart color.</li>
              <li><b>Public records only.</b> The House Clerk, the Senate and USAspending.gov, plus the public congress-legislators dataset for who sits where. No leaked documents and no third-party data aggregators.</li>
              <li>Data is loaded by code on a schedule and checked against the source documents. If a source is down, the figure is hidden, not guessed.</li>
              <li>A pattern we flag is &ldquo;worth a look&rdquo;, never an accusation. A sequence of events is not proof of wrongdoing.</li>
            </ul>
          </Card>

          <Card as="section">
            <h2 className="font-display text-[24px] font-extrabold">Who is behind it</h2>
            <div className="mt-3">
              <DraftBlock title="Founder note: Colin to write">
                Who runs SlushFund, why it exists, and who publishes it (the publisher entity, once there is one). Left blank on purpose: the founder is not named anywhere else on the site. Delete this block and write the paragraph here.
              </DraftBlock>
            </div>
          </Card>

          <Card as="section">
            <h2 id="report-an-error" className="scroll-mt-6 font-display text-[24px] font-extrabold">Report an error</h2>
            <p className="mt-3 max-w-[680px] text-[16px] leading-relaxed">
              If a figure, a name or a date on this site is wrong, tell us with the{' '}
              <Link href={reportErrorHref('/about')} className="font-semibold text-trades-ink hover:underline">error-report form</Link>. Please include the page address, the number or sentence you think is wrong, and the official record that differs (a link is best). Every &ldquo;Report an error&rdquo; link on the site opens the form with that page&rsquo;s address filled in.
            </p>
            <ul className="mt-3 max-w-[680px] list-disc space-y-2 pl-5 text-[16px] leading-relaxed">
              <li>Each report is saved and read by a person, who checks it against the official record it points to.</li>
              <li>If you leave a way to reach you, we reply within 2 business days. A contact is optional.</li>
              <li>
                We fix confirmed errors and log them on the{' '}
                <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections page</Link>. We never edit a story silently.
              </li>
            </ul>
            <p className="mt-4">
              <Link href={reportErrorHref('/about')} className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-deep">Report an error</Link>
            </p>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <h2 className="mb-3 font-display text-[24px] font-extrabold">The color code</h2>
            <MoneyLegend />
          </Card>
          <Card>
            <h2 className="font-display text-[24px] font-extrabold">Read the details</h2>
            <ul className="mt-3 grid gap-3">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="font-semibold text-trades-ink hover:underline">{l.label} →</Link>
                  <span className="block text-[14px] text-muted">{l.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </SimplePage>
  );
}
