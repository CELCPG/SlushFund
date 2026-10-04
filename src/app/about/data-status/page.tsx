import type { Metadata } from 'next';
import { DataStatusTable } from '@/components/v2/DataStatus';
import SimplePage from '@/components/v2/SimplePage';

export const metadata: Metadata = {
  title: 'Data status',
  description: 'Every dataset on SlushFund: its official source, coverage, last successful load and known caveats.',
};

export const revalidate = 600;

export default function DataStatusPage() {
  return (
    <SimplePage
      eyebrow="About the data"
      title="Data status"
      dek="Every dataset, where it comes from, what it covers and when it last loaded. A dataset turns amber when it falls behind and red when it can't be read; then its figures are hidden instead of guessed."
    >
      <DataStatusTable />
    </SimplePage>
  );
}
