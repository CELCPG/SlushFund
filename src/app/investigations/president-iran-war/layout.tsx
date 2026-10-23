import { Source_Serif_4 } from 'next/font/google';

// W2: the reading serif for long stories, as /investigations/[slug] (this segment sits beside [slug], so it carries its own).
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export default function IranWarLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
