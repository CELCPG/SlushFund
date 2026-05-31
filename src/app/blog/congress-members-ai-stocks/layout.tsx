import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('congress-members-ai-stocks');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
