import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Wrap } from '@/components/v2/PageBand';
import { HBars, type BarRow } from '@/components/v2/president/PresidentParts';
import { SERIF } from '@/components/v2/story/Story';
import { StoryFigure } from '@/components/v2/story/StoryTables';
import {
  fmtDate,
  fmtInt,
  fmtMonth,
  usd,
  type Disclosure,
  type FeeCover,
  type FundRow,
  type GroupTable,
  type MemberRow,
  type PostingMonth,
  type SicRow,
  type WindowKey,
} from '@/lib/v2/iran-war-core';
import {
  COMPLIANCE_SENTENCE,
  FEE_LABEL,
  feeOpinion,
  feeRows,
  postingLine,
  type RuleQuote,
} from '@/lib/v2/iran-war-copy';

/** A story section whose figure needs the full page width: the heading and text stay in the reading column, the figure breaks out of it. */
export function StoryWide({ kicker, title, intro, children }: { kicker?: ReactNode; title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line py-9 max-md:py-7">
      <Wrap>
        <div className="max-w-[680px]">
          {kicker && <p className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-trades-ink">{kicker}</p>}
          <h2 style={{ fontFamily: SERIF }} className="mt-1.5 text-[32px] font-bold leading-[1.15] tracking-[-0.3px] max-md:text-[25px]">{title}</h2>
          {intro && <div style={{ fontFamily: SERIF }} className="mt-4 space-y-4 text-[19px] leading-[1.7] max-md:text-[17.5px] max-md:leading-[1.65]">{intro}</div>}
        </div>
        <div className="mt-6 min-w-0">{children}</div>
      </Wrap>
    </section>
  );
}

const TH = 'whitespace-nowrap px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.05em] text-muted';
const THR = cn(TH, 'text-right');
const TD = 'whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums';
const ROWH = 'min-w-[200px] px-3 py-2 text-left font-sans text-[13.5px] font-semibold';
const link = 'font-semibold text-trades-ink underline-offset-2 hover:underline';

export { link as iranLink };

type Cols = readonly { key: WindowKey; head: string }[];

/** The windows side by side: counts, band ranges, kinds of asset, groups. */
export function WindowsTable({ id, title, cols, tables, disclosure, note, showOptions, lateLabel }: { id: string; title: string; cols: Cols; tables: Partial<Record<WindowKey, GroupTable>>; disclosure?: Partial<Record<WindowKey, Disclosure>>; note?: ReactNode; /** Congress: option lines get their own row, and the Stocks row leaves them out (AW1 P1). */ showOptions?: boolean; /** Replaces the "Not computed" row label (the members' table has no 278-T rule). */ lateLabel?: string }) {
  const rows: { label: string; sub?: boolean; get: (t: GroupTable, k: WindowKey) => string }[] = [
    { label: 'Securities transactions', get: (t) => fmtInt(t.all.n) },
    { label: 'Purchases', sub: true, get: (t) => fmtInt(t.all.purchases) },
    { label: 'Sales', sub: true, get: (t) => fmtInt(t.all.sales) },
    { label: 'Amount bands: sum of the bottoms', get: (t) => usd(t.all.minSum) },
    { label: 'Amount bands: sum of the tops', get: (t) => usd(t.all.maxSum) },
    { label: 'Stocks', get: (t) => fmtInt(t.byInstrument.stock.n) },
    ...(showOptions ? [{ label: 'Options', get: (t: GroupTable) => fmtInt(t.options.n) }] : []),
    { label: 'Bonds', get: (t) => fmtInt(t.byInstrument.bond.n) },
    { label: 'Funds', get: (t) => fmtInt(t.byInstrument['fund/ETF'].n) },
    { label: 'In our energy or defense groups', get: (t) => fmtInt(t.ED.n) },
    { label: 'Energy (SEC industry code, or a fund named for it)', sub: true, get: (t) => fmtInt(t.E.n) },
    { label: 'Defense by industry code', sub: true, get: (t) => fmtInt(t.DSic.n) },
    { label: 'Defense by federal money', sub: true, get: (t) => fmtInt(t.DDod.n) },
    { label: 'Other issuers', get: (t) => fmtInt(t.other.n) },
    { label: 'Unclassified issuers', get: (t) => fmtInt(t.unclassified.n) },
  ];
  return (
    <StoryFigure id={id} title={title} note={note}>
      <table className="w-full border-collapse text-[13.5px]" data-windows-table={id}>
        <thead className="bg-neutral-tint">
          <tr>
            <th scope="col" className={TH}>Measure</th>
            {cols.map((c) => <th key={c.key} scope="col" className={THR}>{c.head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <th scope="row" className={cn(ROWH, r.sub && 'pl-7 font-normal text-muted')}>{r.label}</th>
              {cols.map((c) => <td key={c.key} className={TD}>{tables[c.key] ? r.get(tables[c.key]!, c.key) : 'Figures unavailable'}</td>)}
            </tr>
          ))}
          {disclosure && (
            <>
              <tr className="border-t border-line">
                <th scope="row" className={ROWH}>Reported more than 45 days after the trade</th>
                {cols.map((c) => <td key={c.key} className={TD}>{disclosure[c.key] ? fmtInt(disclosure[c.key]!.over45) : 'Figures unavailable'}</td>)}
              </tr>
              <tr className="border-t border-line">
                <th scope="row" className={ROWH}>{lateLabel ?? 'Not computed (holding type not required on a 278-T)'}</th>
                {cols.map((c) => <td key={c.key} className={TD}>{disclosure[c.key] ? fmtInt(disclosure[c.key]!.notComputed) : 'Figures unavailable'}</td>)}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </StoryFigure>
  );
}

/** Securities transactions by trade month, as bars (2025 muted, 2026 solid) with the same figures in a screen-reader table. */
export function MonthBars({ months }: { months: { month: string; n: number }[] }) {
  const rows: BarRow[] = months.map((m) => ({ key: m.month, label: fmtMonth(m.month), value: m.n, display: fmtInt(m.n), muted: m.month < '2026-01' }));
  return (
    <div data-month-bars>
      <HBars rows={rows} caption="Securities transactions the reports list, by trade month" unit="Securities transactions" labelHeader="Trade month" />
    </div>
  );
}

export function SicTable({ id, title, rows, note }: { id: string; title: string; rows: SicRow[]; note?: ReactNode }) {
  return (
    <StoryFigure id={id} title={title} note={note}>
      <table className="w-full border-collapse text-[13.5px]" data-sic-table={id}>
        <thead className="bg-neutral-tint">
          <tr>
            <th scope="col" className={TH}>SIC major group</th>
            <th scope="col" className={TH}>Industry</th>
            <th scope="col" className={THR}>Purchases</th>
            <th scope="col" className={THR}>Sales</th>
            <th scope="col" className={THR}>Total</th>
            <th scope="col" className={TH}>Includes issuers in our groups</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.major} className="border-t border-line">
              <th scope="row" className={cn(ROWH, 'min-w-[90px] font-mono')}>{r.major === 'unclassified' ? 'None' : r.major}</th>
              <td className="min-w-[260px] px-3 py-2 text-[13.5px]">{r.label}</td>
              <td className={TD}>{fmtInt(r.purchases)}</td>
              <td className={TD}>{fmtInt(r.sales)}</td>
              <td className={cn(TD, 'font-semibold')}>{fmtInt(r.n)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-[13.5px]">{r.ed ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StoryFigure>
  );
}

export function FundsDetails({ summary, rows }: { summary: string; rows: FundRow[] }) {
  return (
    <details className="my-2 rounded-2xl bg-card p-4 font-sans shadow-card" data-funds-details>
      <summary className="cursor-pointer text-[15px] font-extrabold">{summary} ({fmtInt(rows.reduce((a, r) => a + r.n, 0))} lines, {fmtInt(rows.length)} names)</summary>
      <ul className="mt-3 space-y-1 text-[13.5px]">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-wrap gap-x-3">
            <span className="min-w-0 font-semibold">{r.name}</span>
            <span className="text-muted">{fmtInt(r.purchases)} purchases, {fmtInt(r.sales)} sales{r.energyName ? '; name contains energy, oil, gas or petroleum' : ''}{r.enrgySpelling ? '; printed name spelled ENRGY; not counted by the name rule' : ''}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Per trade month: the OGE posting dates and how many of the month's transactions each one made public. */
export function PostingBars({ posting }: { posting: PostingMonth[] }) {
  return (
    <div className="space-y-6" data-posting>
      {posting.map((m) => (
        <div key={m.month} data-posting-month={m.month}>
          <h4 className="font-sans text-[16px] font-extrabold">{fmtMonth(m.month)}: {fmtInt(m.total)} transactions</h4>
          <p className="mb-2 font-sans text-[14px] text-muted">{postingLine(m)}</p>
          <HBars
            rows={m.byPosting.map((b) => ({ key: b.date, label: `Posted ${fmtDate(b.date)}`, value: b.count, display: fmtInt(b.count) }))}
            caption={`Transactions from ${fmtMonth(m.month)} by the OGE posting date of their report`}
            unit="Transactions made public"
            labelHeader="OGE posting date"
          />
        </div>
      ))}
    </div>
  );
}

export function BinsTable({ id, title, cols, bins, note, markOver45 }: { id: string; title: string; cols: Cols; bins: Partial<Record<WindowKey, Disclosure['signBins']>>; note?: ReactNode; /** The 45-day mark belongs to the filer-signature measure only, not to the OGE-posting bins. */ markOver45?: boolean }) {
  const first = bins[cols[0].key] ?? [];
  return (
    <StoryFigure id={id} title={title} note={note}>
      <table className="w-full border-collapse text-[13.5px]" data-bins-table={id}>
        <thead className="bg-neutral-tint">
          <tr>
            <th scope="col" className={TH}>Days</th>
            {cols.map((c) => <th key={c.key} scope="col" className={THR}>{c.head}</th>)}
          </tr>
        </thead>
        <tbody>
          {first.map((b, i) => (
            <tr key={b.key} className={cn('border-t border-line', markOver45 && b.over45 && 'font-semibold')}>
              <th scope="row" className={ROWH}>{b.label}{markOver45 && b.over45 ? ' (more than 45)' : ''}</th>
              {cols.map((c) => <td key={c.key} className={TD}>{bins[c.key] ? fmtInt(bins[c.key]![i].count) : 'Figures unavailable'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </StoryFigure>
  );
}

/** One cover note as stored, ALWAYS followed by the signed compliance opinion in the same block (A11). */
export function FeeBlock({ cover }: { cover: FeeCover }) {
  return (
    <div className="rounded-xl bg-neutral-tint px-3.5 py-3 font-sans text-[14px]" data-cover-note="late_fee_note" data-doc={cover.docId}>
      <p className="font-semibold">{feeRows(cover)}</p>
      <p className="mt-1.5">
        <span className="text-muted">{FEE_LABEL}</span>
        <q className="font-semibold">{cover.comment}</q>
      </p>
      <p className="mt-1.5" data-compliance>
        {COMPLIANCE_SENTENCE}
        {feeOpinion(cover.opinionDate)}
      </p>
      <p className="mt-1.5">
        <a href={`${cover.url}#page=${cover.coverPage ?? 1}`} target="_blank" rel="noopener noreferrer" className={link} aria-label={`View the cover page of ${cover.label}, opens the official document in a new tab`}>
          View the cover page
        </a>
      </p>
    </div>
  );
}

export function OilList({ rows }: { rows: { id: string; date: string; text: string; sourceUrl: string; archiveUrl: string | null }[] }) {
  return (
    <ul className="space-y-3 font-sans" data-oil-list>
      {rows.map((r) => (
        <li key={r.id} className="border-l-4 border-line pl-3" data-chron={r.id}>
          <p className="text-[13px] font-bold uppercase tracking-[0.05em] text-muted">{fmtDate(r.date)}</p>
          <p className="mt-0.5 text-[15px] leading-snug">{r.text}</p>
          <p className="mt-1 text-[13.5px]">
            <a href={r.sourceUrl} className={link} rel="noreferrer">Source</a>
            {r.archiveUrl ? <> · <a href={r.archiveUrl} className={link} rel="noreferrer">Archive copy</a></> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RulesBox({ title, lead, quotes, found }: { title: string; lead: string; quotes: readonly RuleQuote[]; found: readonly string[] }) {
  return (
    <aside className="rounded-2xl border-2 border-line bg-card p-5 font-sans text-[15px] leading-relaxed max-md:p-4" data-rules-box aria-labelledby="rules-title">
      <h3 id="rules-title" className="text-[18px] font-extrabold leading-tight">{title}</h3>
      <p className="mt-2 text-muted">{lead}</p>
      <ul className="mt-3 space-y-3">
        {quotes.map((q) => (
          <li key={q.cite}>
            <blockquote className="border-l-4 border-line pl-3" data-verbatim>{q.text}</blockquote>
            <p className="mt-0.5 pl-3 text-[13px] font-semibold text-muted">{q.cite}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        {found.map((p) => <p key={p}>{p}</p>)}
      </div>
    </aside>
  );
}

export function MembersTable({ rows, caption }: { rows: MemberRow[]; caption: string }) {
  return (
    <StoryFigure id="members" title="Every member, in alphabetical order" note={<p>{caption}</p>}>
      <table className="w-full border-collapse text-[13.5px]" data-members-table>
        <thead className="bg-neutral-tint">
          <tr>
            <th scope="col" className={TH}>Member</th>
            <th scope="col" className={TH}>Chamber</th>
            <th scope="col" className={TH}>Party</th>
            <th scope="col" className={TH}>State</th>
            <th scope="col" className={THR}>Jan 2 to Feb 27</th>
            <th scope="col" className={THR}>Feb 28 to Mar 31</th>
            <th scope="col" className={THR}>Apr 1 to Jul 31</th>
            <th scope="col" className={THR}>In energy or defense groups</th>
            <th scope="col" className={THR}>Purchases</th>
            <th scope="col" className={THR}>Sales</th>
            <th scope="col" className={THR}>Reported more than 45 days after the trade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.memberId} className="border-t border-line" data-member={m.memberId}>
              <th scope="row" className={cn(ROWH, 'whitespace-nowrap')}>
                {m.bioguide ? <Link href={`/people/${m.bioguide}`} className={link}>{m.name}</Link> : m.name}
              </th>
              <td className="whitespace-nowrap px-3 py-2">{m.chamber}</td>
              <td className="whitespace-nowrap px-3 py-2">{m.party}</td>
              <td className="whitespace-nowrap px-3 py-2">{m.state}</td>
              <td className={TD}>{fmtInt(m.byWindow.P1)}</td>
              <td className={TD}>{fmtInt(m.byWindow.P2)}</td>
              <td className={TD}>{fmtInt(m.byWindow.P3)}</td>
              <td className={TD}>{fmtInt(m.edByWindow.P1 + m.edByWindow.P2 + m.edByWindow.P3)}</td>
              <td className={TD}>{fmtInt(m.purchases)}</td>
              <td className={TD}>{fmtInt(m.sales)}</td>
              <td className={TD}>{fmtInt(m.over45)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StoryFigure>
  );
}
