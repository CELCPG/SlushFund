import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('ai-government-contracts');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
