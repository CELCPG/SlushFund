import type { ReactNode } from 'react';

/**
 * Marks text only Colin can write (founder note, contact route, legal wording).
 * It renders everywhere except Vercel production, so a placeholder can never reach the public
 * site, and so the preview shows exactly what is still missing.
 */
export default function DraftBlock({ title, children }: { title: string; children: ReactNode }) {
  if (process.env.VERCEL_ENV === 'production') return null;
  return (
    <aside
      role="note"
      aria-label={`Draft placeholder: ${title}`}
      className="rounded-2xl border-2 border-dashed border-stale bg-stale-tint p-4 text-stale-ink"
    >
      <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]">Draft placeholder · not shown on production</p>
      <p className="mt-1 font-display text-[18px] font-extrabold leading-tight">{title}</p>
      <div className="mt-1.5 text-[14.5px]">{children}</div>
    </aside>
  );
}
