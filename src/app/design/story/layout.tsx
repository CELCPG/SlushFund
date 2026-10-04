import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';

// Reading serif for long stories (Direction B's layout). Loaded only for this segment, so the
// rest of the site does not pay for it. Stories that adopt the template reuse this layout.
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Story template',
  robots: { index: false, follow: false },
};

export default function StoryTemplateLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
