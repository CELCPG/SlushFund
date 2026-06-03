import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('federal-reserve-govt-trading');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
