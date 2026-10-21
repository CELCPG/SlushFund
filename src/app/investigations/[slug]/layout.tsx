import { Source_Serif_4 } from 'next/font/google';

// D12: the reading serif for long stories (Direction B's layout, decision 109), as on /design/story.
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
