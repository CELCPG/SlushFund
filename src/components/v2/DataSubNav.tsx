import Link from 'next/link';
import { cn } from '@/lib/cn';
import { lateFilersEnabled } from '@/lib/v2/flags';

export const DATA_TABS = [
  { href: '/data', label: 'Overview' },
  { href: '/data/trades', label: 'Trades' },
  { href: '/data/contracts', label: 'Contracts' },
  { href: '/data/late-filers', label: 'Filed 45+ days after' },
  { href: '/data/status', label: 'Status' },
] as const;

/** Tabs for the Data section, shown in the title band of /data and its explorers. */
export default function DataSubNav({ current }: { current: (typeof DATA_TABS)[number]['href'] }) {
  const tabs = DATA_TABS.filter((t) => t.href !== '/data/late-filers' || lateFilersEnabled());
  return (
    <nav aria-label="Data section" className="mt-5 flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-on-deep hover:bg-white/10 hover:text-white',
            t.href === current && 'bg-white/15 text-white',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
