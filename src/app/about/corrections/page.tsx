import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v2/seo';
import Link from 'next/link';
import { reportErrorHref } from '@/lib/v2/error-reports';
import EmptyState from '@/components/v2/EmptyState';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import { visibleCorrections, type CorrectionKind } from '@/data/corrections';
import { fmtDate } from '@/lib/v2/format';

// Read at request time: the draft preview flag (SHOW_DRAFT_CORRECTIONS=1) is a runtime env var.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  path: '/about/corrections',
  title: 'Corrections',
  description: 'Every correction to SlushFund stories and data, with dates.',
});

const KIND_LABEL: Record<CorrectionKind, string> = {
  withdrawal: 'Withdrawal',
  'story-fix': 'Story correction',
  'data-fix': 'Data correction',
};

export default function CorrectionsPage() {
  const entries = visibleCorrections();
  const previewing = entries.some((e) => e.status === 'draft');

  return (
    <SimplePage
      eyebrow="About"
      title="Corrections"
      dek="When we get something wrong, we fix it and say so here, with the date and what changed. We never edit a story silently."
    >
      {previewing && (
        <div role="note" className="mb-5 rounded-2xl border-2 border-dashed border-stale bg-stale-tint p-4 text-stale-ink">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]">Draft preview · local only</p>
          <p className="mt-1 text-[14.5px]">
            You are seeing entries marked DRAFT because <code className="font-mono">SHOW_DRAFT_CORRECTIONS=1</code> is set on this server. Without it, this page shows only published entries.
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState title="The corrections log opens with the rebuilt site" icon="✎">
          Every correction to a story or a dataset will be listed here, newest first, with the date and what changed.
        </EmptyState>
      ) : (
        <ol className="grid gap-4">
          {entries.map((e) => (
            <li key={e.id}>
              <Card as="article" className={e.status === 'draft' ? 'shadow-[0_0_0_2px_#C77700]' : undefined}>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {e.status === 'draft' && (
                    <span className="rounded-full bg-highlight px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-highlight-ink">Draft</span>
                  )}
                  <span className="rounded-full bg-neutral-tint px-2.5 py-0.5 font-bold text-muted">{KIND_LABEL[e.kind]}</span>
                  <time dateTime={e.date} className="font-mono text-muted">{fmtDate(e.date)}</time>
                </div>
                <h2 className="mt-2 font-display text-[26px] font-extrabold leading-tight max-md:text-[22px]">{e.title}</h2>
                <p className="mt-2 max-w-[760px] text-[16px] leading-relaxed">{e.summary}</p>
                <h3 className="mt-4 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">What changed</h3>
                <ul className="mt-1.5 max-w-[760px] list-disc space-y-1.5 pl-5 text-[15px]">
                  {e.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
                {e.affects && (
                  <p className="mt-3 text-[13.5px] text-muted">Applies to: {e.affects.map((p, i) => (
                    <span key={p}>{i > 0 && ', '}<code className="font-mono">{p}</code></span>
                  ))}</p>
                )}
                {e.status === 'draft' && e.draftNotes && (
                  <div role="note" className="mt-4 rounded-xl bg-stale-tint p-3.5 text-stale-ink">
                    <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]">Before this can be published</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px]">
                      {e.draftNotes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 max-w-[760px] text-[14px] text-muted">
        Spotted something wrong? See <Link href={reportErrorHref('/about/corrections')} className="font-semibold text-trades-ink hover:underline">how to report an error</Link>. How each dataset is built is on the <Link href="/about/methodology" className="font-semibold text-trades-ink hover:underline">methodology page</Link>.
      </p>
    </SimplePage>
  );
}
