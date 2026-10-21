import Link from 'next/link';
import { Card, SectionHead } from '@/components/v2/PageBand';
import { fmtDate } from '@/lib/v2/format';
import { GRADE_FIXED_LINE, notGradedLine, unreadCaveat } from '@/lib/v2/grade-method';
import { GRADE_METHOD_PATH } from '@/lib/v2/flags';
import type { MemberCard } from '@/lib/v2/report-card';

/**
 * D10 Stock Trading Grade on a member page (G1 §1), behind gradesEnabled(). Every point is shown with its reason and
 * the filings behind it; a factor that can't be computed scores 0 and says "not computed", never "clean".
 */
export default function ReportCard({ card, name, inOffice, bioguide }: { card: MemberCard | null; name: string; inOffice: boolean; bioguide: string }) {
  const notGraded = card?.grade.letter === 'NG';
  return (
    <section className="pt-8" aria-labelledby="p-grade" data-section="report-card">
      <Card>
        <SectionHead
          as="h2"
          title={<span id="p-grade" className="text-[24px] max-md:text-[22px]">Stock Trading Grade</span>}
          sub="Would this member pass a congressional stock-trading ban today? One published method, the same for every member: individual-stock trades in the last 24 months and how long they took to report."
        />
        {!inOffice ? (
          <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">Grades are computed for sitting members only. {name} is not in office.</p>
        ) : card === null ? (
          <p className="rounded-2xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink">The grade is unavailable right now: the trade database did not answer.</p>
        ) : (
          <>
            {notGraded ? (
              <div className="flex flex-wrap items-center gap-5" data-grade="not-graded">
                <span aria-hidden className="grid h-[88px] min-w-[88px] place-items-center rounded-2xl bg-neutral-tint px-4 font-display text-[22px] font-extrabold leading-tight text-ink">Not graded</span>
                <p className="max-w-[640px] text-[16px]">
                  {notGradedLine(name, card.grade.unread)}
                </p>
              </div>
            ) : (
              <div className="sf-grade-row flex flex-wrap items-center gap-5">
                <span aria-hidden data-letter={card.grade.letter} className="sf-grade grid h-[88px] w-[88px] place-items-center rounded-2xl bg-ink font-display text-[52px] font-extrabold text-white">{card.grade.letter}</span>
                <p className="text-[16px]">
                  <span className="sr-only">Grade {card.grade.letter}. </span>
                  <b>{card.grade.score} points</b> of 100 (A = 0 points · B 1–20 · C 21–40 · D 41–60 · F 61 or more), for trades dated {fmtDate(card.win.start)} to {fmtDate(card.win.end)}.
                </p>
              </div>
            )}
            <h3 className="mt-5 text-[15px] font-bold">{notGraded ? 'What the filings we have read show' : 'Why this grade'}</h3>
            <ul className="mt-2 divide-y divide-line">
              {card.grade.factors.map((f) => (
                <li key={f.key} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="font-semibold">{f.label}: {f.value}</span>
                    <span className="whitespace-nowrap font-mono text-[14px]">{f.computed ? `+${f.points}` : '+0, not computed'} <span className="text-muted">of {f.max}</span></span>
                  </div>
                  <p className="mt-1 text-[13.5px] text-muted">{f.reason}</p>
                  {f.links.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                      {f.links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink underline-offset-2 hover:underline" aria-label={`Filing: ${l.label}, opens the official document in a new tab`}>
                          {l.label} ↗
                        </a>
                      ))}
                      {f.moreLinks > 0 && <Link href={`/data/trades?member=${bioguide}`} className="underline">+{f.moreLinks} more filings</Link>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted">
              Not scored: {card.activity.bonds} bond transaction{card.activity.bonds === 1 ? '' : 's'} (shown in the trade list, not scored in this version) and {card.activity.excluded} transaction{card.activity.excluded === 1 ? '' : 's'} in funds, ETFs, Treasuries, municipal securities and other assets a ban would allow.
              {card.win.flaggedOut ? ` Trades whose dates carry a date note are not scored.` : ''}
            </p>
            {!notGraded && card.grade.unread > 0 && (
              <p className="mt-3 rounded-2xl bg-stale-tint px-4 py-3 text-[14px] text-stale-ink">{unreadCaveat(card.grade.unread)}</p>
            )}
            <p className="mt-3 rounded-2xl bg-neutral-tint px-4 py-3 text-[14px] font-semibold">{GRADE_FIXED_LINE}</p>
            <p className="mt-2 text-[13px]"><Link href={GRADE_METHOD_PATH} className="underline">The method, thresholds and code</Link></p>
          </>
        )}
      </Card>
    </section>
  );
}
