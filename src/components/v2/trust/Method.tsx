import Link from 'next/link';
import type { ReactNode } from 'react';
import { FlagChip, MoneyChip } from '@/components/v2/MoneyChip';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import SourceBar from '@/components/v2/SourceBar';
import type { DatasetKey } from '@/lib/v2/datasets';
import type { MoneyType } from '@/lib/v2/money';

/**
 * Template for one methodology page per dataset (D5). Sections, in order:
 * official source, what is loaded, how a row traces to its filing, caveats in plain English,
 * how we check. The source bar at the top is live (coverage and last load come from the database).
 */
export interface MethodToc { id: string; label: string }

export function MethodPage({
  title,
  dek,
  datasets,
  moneyType,
  toc,
  reviewed,
  children,
}: {
  title: string;
  dek: ReactNode;
  datasets: DatasetKey[];
  moneyType?: MoneyType;
  toc: MethodToc[];
  /** Date the method text was last reviewed, ISO. */
  reviewed: string;
  children: ReactNode;
}) {
  return (
    <SimplePage
      eyebrow="Methodology"
      title={title}
      dek={dek}
      sourceBar={<SourceBar datasets={datasets} methodologyHref="/about/methodology" />}
    >
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-muted">
        {moneyType && <MoneyChip type={moneyType} />}
        <span>Method text last reviewed <time dateTime={reviewed}>{new Date(`${reviewed}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time></span>
        <Link href="/about/methodology" className="font-semibold text-trades-ink hover:underline">← All methodology</Link>
      </div>
      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2">
        {toc.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-full bg-card px-3.5 py-1.5 text-[13.5px] font-semibold shadow-card hover:bg-neutral-tint">{t.label}</a>
        ))}
      </nav>
      <div className="grid max-w-[880px] gap-4">{children}</div>
    </SimplePage>
  );
}

export function MethodSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" className="scroll-mt-6">
      <h2 id={id} className="scroll-mt-6 font-display text-[26px] font-extrabold leading-tight max-md:text-[22px]">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed">{children}</div>
    </Card>
  );
}

/** One caveat: a short bold lead, then the plain-English explanation. */
export function Caveat({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <li className="rounded-xl bg-neutral-tint p-3.5">
      <b className="font-display text-[17px] font-extrabold">{lead}</b>
      <p className="mt-1 text-[15px] leading-relaxed">{children}</p>
    </li>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink hover:underline">{children} ↗</a>;
}

/** The standing "Worth a look" statement, repeated on every method page. */
export function WorthALookNote() {
  return (
    <div className="rounded-xl bg-highlight/30 p-3.5 text-[15px] leading-relaxed">
      <FlagChip /> <span className="ml-1">is a pattern, never an accusation.</span>{' '}
      It marks something a reader may want to look at, such as a trade in a company whose business sits under a committee the member serves on. A sequence of events is not proof of wrongdoing, and we do not say it is.
    </div>
  );
}

/** What has and has not been independently audited, so a method page never overstates. */
export function AuditNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line p-3.5 text-[14.5px] leading-relaxed text-muted">
      <b className="text-ink">Audit status.</b> {children}
    </p>
  );
}
