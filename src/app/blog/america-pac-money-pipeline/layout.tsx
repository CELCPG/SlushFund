import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('america-pac-money-pipeline');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
