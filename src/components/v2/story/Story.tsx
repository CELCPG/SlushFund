import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wrap } from '@/components/v2/PageBand';
import { cn } from '@/lib/cn';

/**
 * Reading layout for long stories (Direction B's layout inside the C system, D5).
 * A measured text column with a margin rail beside each section; on phones the rail drops under
 * its section. Footnoted citations, a source list and a "last verified" line are part of the
 * template, not optional extras. Serif comes from the --font-serif variable that the story
 * layout loads (src/app/design/story/layout.tsx); UI chrome stays in the C sans.
 */
export const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';

export interface StoryMeta {
  published: ReactNode;
  updated: ReactNode;
  /** The date every figure was last checked against its source. */
  verified: ReactNode;
  /** Auditor sign-off line. */
  audit: ReactNode;
}

export function StoryHeader({ kicker, headline, dek, meta }: { kicker: ReactNode; headline: ReactNode; dek: ReactNode; meta: StoryMeta }) {
  return (
    <header className="pb-8 pt-10 max-md:pt-6">
      <Wrap>
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-brand">{kicker}</p>
        <h1 style={{ fontFamily: SERIF }} className="mt-2 max-w-[900px] text-[48px] font-bold leading-[1.08] tracking-[-0.5px] max-md:text-[31px]">{headline}</h1>
        <p style={{ fontFamily: SERIF }} className="mt-4 max-w-[760px] text-[22px] leading-[1.45] text-muted max-md:text-[18px]">{dek}</p>
        <dl className="mt-6 grid max-w-[900px] grid-cols-4 gap-x-6 gap-y-3 border-y border-line py-3.5 text-[13.5px] max-md:grid-cols-2">
          {[
            ['Published', meta.published],
            ['Updated', meta.updated],
            ['Last verified', meta.verified],
            ['Audit', meta.audit],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Wrap>
    </header>
  );
}

/** One section: text column plus margin rail. */
export function StorySection({ kicker, title, rail, children, className }: { kicker?: ReactNode; title: ReactNode; rail?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-line py-9 max-md:py-7', className)}>
      <Wrap>
        <div className="grid grid-cols-[minmax(0,680px)_minmax(0,280px)] justify-between gap-14 max-lg:grid-cols-1 max-lg:gap-6">
          <div className="min-w-0">
            {kicker && <p className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-trades-ink">{kicker}</p>}
            <h2 style={{ fontFamily: SERIF }} className="mt-1.5 text-[32px] font-bold leading-[1.15] tracking-[-0.3px] max-md:text-[25px]">{title}</h2>
            <div style={{ fontFamily: SERIF }} className="mt-4 space-y-4 text-[19px] leading-[1.7] max-md:text-[17.5px] max-md:leading-[1.65]">{children}</div>
          </div>
          {rail && <aside className="min-w-0 space-y-5 border-l border-line pl-5 text-[14px] leading-relaxed max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-4">{rail}</aside>}
        </div>
      </Wrap>
    </section>
  );
}

export function RailNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">{title}</h3>
      <div className="mt-1.5 text-[14.5px] text-ink">{children}</div>
    </div>
  );
}

/** Footnote marker in the text: links down to the numbered source and back. */
export function Cite({ n }: { n: number }) {
  return (
    <sup id={`ref-${n}`} className="font-sans text-[0.62em] font-bold">
      <a href={`#fn-${n}`} className="px-0.5 text-trades-ink hover:underline" aria-label={`Footnote ${n}`}>[{n}]</a>
    </sup>
  );
}

/** The yellow highlighter on the one phrase that matters. */
export function Highlight({ children }: { children: ReactNode }) {
  return <mark className="rounded-[3px] bg-highlight px-0.5 text-highlight-ink">{children}</mark>;
}

/** A figure or table slot: states what will go here and that it carries its own source line. */
export function FigureSlot({ title, children, source }: { title: string; children?: ReactNode; source: ReactNode }) {
  return (
    <figure className="my-2 rounded-2xl bg-card p-5 shadow-card max-md:p-4">
      <figcaption className="font-sans text-[16px] font-extrabold">{title}</figcaption>
      <div className="mt-3 grid min-h-[140px] place-items-center rounded-xl border-2 border-dashed border-line bg-neutral-tint p-4 text-center font-sans text-[14px] text-muted">
        {children}
      </div>
      <p className="mt-3 border-t border-line pt-2.5 font-sans text-[13px] text-muted">{source}</p>
    </figure>
  );
}

export interface FootnoteItem {
  n: number;
  /** What the figure or sentence is, as cited. */
  text: ReactNode;
  /** The official record: publisher, record ID, retrieval date. */
  record: ReactNode;
  href?: string;
}

export function Footnotes({ items }: { items: FootnoteItem[] }) {
  return (
    <section className="border-t border-line py-9 max-md:py-7" aria-labelledby="footnotes">
      <Wrap>
        <div className="max-w-[680px]">
          <h2 id="footnotes" style={{ fontFamily: SERIF }} className="text-[28px] font-bold max-md:text-[24px]">Footnotes</h2>
          <ol className="mt-4 space-y-3 font-sans text-[14.5px]">
            {items.map((f) => (
              <li key={f.n} id={`fn-${f.n}`} className="flex gap-3 scroll-mt-6">
                <span className="w-6 flex-none text-right font-mono font-medium text-muted">{f.n}.</span>
                <div className="min-w-0">
                  <p>{f.text}</p>
                  <p className="mt-0.5 text-muted">
                    {f.record}
                    {f.href && <> · <a href={f.href} className="font-semibold text-trades-ink hover:underline">Open the record ↗</a></>}
                    {' '}<a href={`#ref-${f.n}`} className="font-semibold text-trades-ink hover:underline" aria-label={`Back to footnote ${f.n} in the text`}>↩</a>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Wrap>
    </section>
  );
}

export interface SourceItem {
  title: ReactNode;
  publisher: ReactNode;
  id: ReactNode;
  retrieved: ReactNode;
  href?: string;
}

export function SourceList({ items, verified }: { items: SourceItem[]; verified: ReactNode }) {
  return (
    <section className="border-t border-line py-9 max-md:py-7" aria-labelledby="sources">
      <Wrap>
        <div className="max-w-[880px]">
          <h2 id="sources" style={{ fontFamily: SERIF }} className="text-[28px] font-bold max-md:text-[24px]">Sources</h2>
          <p className="mt-1 font-sans text-[14px] text-muted">Every figure above comes from one of these records. Last verified: {verified}.</p>
          <ul className="mt-4 grid gap-2.5 font-sans">
            {items.map((s, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 rounded-xl bg-card p-3.5 text-[14.5px] shadow-card">
                <span className="font-mono font-medium text-muted">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold">{s.title}</p>
                  <p className="text-muted">{s.publisher} · Record {s.id} · Retrieved {s.retrieved}</p>
                  {s.href && <a href={s.href} className="font-semibold text-trades-ink hover:underline">Open the record ↗</a>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Wrap>
    </section>
  );
}

/** Closing block: corrections to this story and how to report an error. */
export function StoryFooter({ corrections }: { corrections: ReactNode }) {
  return (
    <section className="border-t border-line py-9 max-md:py-7">
      <Wrap>
        <div className="max-w-[680px] font-sans text-[15px]">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">Corrections to this story</h2>
          <div className="mt-1.5">{corrections}</div>
          <p className="mt-4 text-[14px] text-muted">
            Something wrong? <Link href="/about#report-an-error" className="font-semibold text-trades-ink hover:underline">Report an error</Link>. All changes are in the <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections log</Link>.
          </p>
        </div>
      </Wrap>
    </section>
  );
}
