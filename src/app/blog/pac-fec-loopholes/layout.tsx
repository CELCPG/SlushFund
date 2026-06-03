import type { Metadata } from 'next';
import { blogPostMetadata } from '@/lib/blog';

export const metadata: Metadata = blogPostMetadata('pac-fec-loopholes');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
