import { cn } from '@/lib/cn';

/** Search field for white surfaces (GET /search). */
export function HeaderSearchLight({ className, placeholder = 'Search members, companies, tickers' }: { className?: string; placeholder?: string }) {
  return (
    <form action="/search" method="get" role="search" className={cn('flex gap-2', className)}>
      <label className="sr-only" htmlFor="light-search">{placeholder}</label>
      <input
        id="light-search"
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-page px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-trades focus:outline-none"
      />
      <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:bg-deep">Search</button>
    </form>
  );
}
