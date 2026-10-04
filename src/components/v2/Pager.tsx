import Link from 'next/link';

const pill = 'rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint';

/** Previous / next links for a paged list. Each link is a permalink to that page. */
export default function Pager({ page, pages, href, label = 'Pages' }: { page: number; pages: number; href: (page: number) => string; label?: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
      {page > 2 && <Link href={href(1)} className={pill}>« First</Link>}
      {page > 1 && <Link href={href(page - 1)} rel="prev" className={pill}>← Previous</Link>}
      <span className="px-1 text-muted">Page {page.toLocaleString('en-US')} of {pages.toLocaleString('en-US')}</span>
      {page < pages && <Link href={href(page + 1)} rel="next" className={pill}>Next →</Link>}
      {page < pages - 1 && <Link href={href(pages)} className={pill}>Last »</Link>}
    </nav>
  );
}
