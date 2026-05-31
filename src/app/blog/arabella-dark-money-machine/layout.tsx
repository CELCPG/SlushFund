import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('arabella-dark-money-machine');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
