import { Metadata } from 'next';
import SchemaMarkup from '@/components/SchemaMarkup';
import { websiteSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Blog & Investigations — SlushFund',
  description: 'Original reporting on federal spending, congressional stock trading, and political money flows. No agenda except the truth.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SchemaMarkup schema={websiteSchema} />
      {children}
    </>
  );
}