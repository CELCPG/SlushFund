import Link from 'next/link';
import { cn } from '@/lib/cn';

/** The red-and-white wordmark (kept from today's brand). */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="SlushFund home" className={cn('whitespace-nowrap font-display text-[28px] font-extrabold leading-none tracking-[-0.5px] text-white max-md:text-[24px]', className)}>
      Slush<span className="text-wordmark">Fund</span>
    </Link>
  );
}
