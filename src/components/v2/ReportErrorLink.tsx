'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';
import { reportErrorHref } from '@/lib/v2/error-reports';

const noSubscribe = () => () => {};

/**
 * "Report an error", opening the form with ?from=<the address in the browser> (F1). The server renders the plain
 * form link and the browser adds ?from= right after hydration, so pages served under many addresses (/withdrawn,
 * /rebuilding) carry the address the reader actually sees, with no server/browser mismatch. The footer outlives a
 * client-side navigation, so usePathname() re-renders it and the address is read again.
 */
export default function ReportErrorLink({ children = 'Report an error', className }: { children?: ReactNode; className?: string }) {
  usePathname();
  const from = useSyncExternalStore(noSubscribe, () => window.location.pathname, () => null);
  return <Link href={reportErrorHref(from)} className={className} data-report-link>{children}</Link>;
}
