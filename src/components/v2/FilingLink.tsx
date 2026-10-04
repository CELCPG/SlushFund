import { cn } from '@/lib/cn';

/**
 * "View filing" link to the official source document (PTR PDF, eFD report,
 * USAspending award). Every figure on the site should be one tap from its
 * filing. With no URL it says so rather than linking somewhere else.
 */
export default function FilingLink({
  href,
  source,
  label = 'View filing',
  className,
}: {
  href: string | null | undefined;
  /** Who publishes it, for the accessible name ("House Clerk PTR"). */
  source?: string;
  label?: string;
  className?: string;
}) {
  if (!href || !/^https?:\/\//.test(href)) {
    return <span className={cn('whitespace-nowrap text-[13px] text-muted', className)}>No filing link</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}${source ? ` (${source})` : ''}, opens the official document in a new tab`}
      className={cn('inline-flex min-h-6 items-center gap-1 whitespace-nowrap text-[13.5px] font-semibold text-trades-ink underline-offset-2 hover:underline', className)}
    >
      {label}
      <span aria-hidden className="text-[12px]">↗</span>
    </a>
  );
}
