import Link from 'next/link';
import ReportErrorLink from '@/components/v2/ReportErrorLink';
import SimplePage from '@/components/v2/SimplePage';

// D5: the old 404 advertised figures ("$17B in contracts", "926 live trades", "11 published
// articles") that were never verified. This one shows none. Next adds noindex to 404 pages.
const LINKS = [
  { href: '/search', label: 'Search members, companies and stocks' },
  { href: '/data', label: 'The data, with its sources' },
  { href: '/investigations', label: 'Investigations' },
  { href: '/about/methodology', label: 'How the data is built' },
];

export default function NotFound() {
  return (
    <SimplePage
      eyebrow="Page not found"
      title="We can't find that page"
      dek="The address may be wrong, or the page may have moved or been withdrawn while the site is rebuilt."
    >
      <section className="max-w-[720px] rounded-card bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">Try one of these</h2>
        <ul className="mt-2 grid gap-2">
          {LINKS.map((l) => (
            <li key={l.href}><Link href={l.href} className="font-semibold text-trades-ink hover:underline">{l.label} →</Link></li>
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-muted">
          Came from a link? <ReportErrorLink className="font-semibold text-trades-ink hover:underline">Tell us</ReportErrorLink> and we will look into it.
        </p>
      </section>
    </SimplePage>
  );
}
