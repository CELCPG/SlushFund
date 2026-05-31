import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('koch-dark-money-machine');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
