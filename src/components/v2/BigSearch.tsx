import Link from 'next/link';

const EXAMPLES = ['Warren', 'Johnson', 'Lockheed Martin', 'NVDA'];

/** The hero search ("member, company or ticker"). Plain GET form: works without JS. */
export default function BigSearch({ defaultValue }: { defaultValue?: string }) {
  return (
    <div>
      <form action="/search" method="get" role="search" className="flex max-w-[820px] items-center gap-3 rounded-[18px] bg-white py-2 pl-5 pr-2 shadow-search max-md:gap-2 max-md:rounded-[14px] max-md:py-1.5 max-md:pl-3.5 max-md:pr-1.5">
        <label htmlFor="big-search" className="sr-only">Look up a member of Congress, company or ticker</label>
        <span aria-hidden className="text-lg text-muted">⌕</span>
        <input
          id="big-search"
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Look up a member of Congress, company or ticker"
          autoComplete="off"
          className="min-w-0 flex-1 self-stretch bg-transparent text-lg text-ink placeholder:text-muted focus:outline-none max-md:text-[15px]"
        />
        <button type="submit" className="rounded-xl bg-brand px-[22px] py-3.5 text-base font-bold text-white hover:bg-[#B5172F] max-md:px-3.5 max-md:py-3 max-md:text-sm">
          Search
        </button>
      </form>
      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-sm text-on-deep">
        Try
        {EXAMPLES.map((q) => (
          <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="whitespace-nowrap rounded-full bg-white/12 px-3 py-[5px] text-[13px] font-semibold text-white hover:bg-white/20">
            {q}
          </Link>
        ))}
      </div>
    </div>
  );
}
