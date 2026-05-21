import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const memberName = id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    title: `${memberName} — Congressional Stock Trading Profile | SlushFund`,
    description: `Full stock trading history for ${memberName}. Every trade, ticker, volume, and federal contractor overlap. Complete disclosure data from Congress.`,
  };
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}