import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('no-bid-contracts');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
