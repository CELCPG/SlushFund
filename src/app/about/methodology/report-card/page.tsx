import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Caveat, MethodPage, MethodSection } from '@/components/v2/trust/Method';
import { GRADE_METHOD_PATH, MOST_ACTIVE_PATH, gradesEnabled } from '@/lib/v2/flags';
import { GRADE_BANDS, GRADE_FIXED_LINE, GRADE_WINDOW_MONTHS } from '@/lib/v2/grade-method';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';

// D10: the published method for the Stock Trading Grade (g1-report-card-method.md v0.1), behind gradesEnabled() like the
// grades themselves. The method and thresholds are published before any grade appears.
export function generateMetadata(): Metadata {
  if (!gradesEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: GRADE_METHOD_PATH,
    title: 'Methodology: the Stock Trading Grade',
    description: 'How SlushFund grades members of Congress on reported individual-stock trading and disclosure timing: the factors, the points, the thresholds and what the grade does not say.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}
export const revalidate = 600;

const TOC = [
  { id: 'question', label: 'The question' },
  { id: 'counts', label: 'What counts' },
  { id: 'points', label: 'Points' },
  { id: 'grades', label: 'Grades' },
  { id: 'nulls', label: 'Not computed' },
  { id: 'funding', label: 'Who funds them' },
  { id: 'limits', label: 'What it does not say' },
];

const POINTS: [string, string, string][] = [
  ['Individual-stock transactions in the window', '0 / 1–10 / 11–50 / 51–200 / over 200', '0 / 15 / 30 / 45 / 55'],
  ['Reported value: the sum of the lowest amount in each disclosed band', 'under $250,000 / $250,000–$1 million / $1–5 million / $5 million or more', '0 / 5 / 10 / 15'],
  ['Any stock option trade', 'yes', '+5'],
  ['Share of trades matching our committee signal on the trade date', '0% / over 0–25% / over 25%', '0 / 5 / 10'],
  ['Reports filed more than 45 days after the trade (distinct reports, never transactions)', '0 / 1 / 2–4 / 5 or more', '0 / 3 / 6 / 10'],
  ['Trades in companies with a listed federal contract signed on or before the trade', 'any', '+5'],
];

export default function ReportCardMethodology() {
  if (!gradesEnabled()) notFound();
  return (
    <MethodPage
      title="The Stock Trading Grade"
      dek="A grade from A to F for each sitting member of Congress, built from their own periodic transaction reports. One method, the same for every member, published before any grade appears."
      datasets={['house_trades', 'senate_trades']}
      moneyType="trades"
      toc={TOC}
      reviewed="2026-10-19"
    >
      <MethodSection id="question" title="The question it answers">
        <p>
          <b>Would this member pass a congressional stock-trading ban today?</b> Bills to ban members from trading individual stocks have been introduced by members of both parties, so the grade uses that as a neutral yardstick. An A means no individual-stock trades were reported in the window: the member already lives by such a rule.
        </p>
        <p className="mt-3 font-semibold">{GRADE_FIXED_LINE}</p>
      </MethodSection>

      <MethodSection id="counts" title="What counts">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Window:</b> trades dated in the last {GRADE_WINDOW_MONTHS} months, up to the day the page is computed, from House Clerk and Senate eFD periodic transaction reports, dates as filed.</li>
          <li><b>Owner:</b> the member, a spouse and a dependent child are all included, as filed.</li>
          <li><b>Counted:</b> stocks, stock options and other single-company securities.</li>
          <li><b>Shown, not scored (this version):</b> bonds.</li>
          <li><b>Excluded:</b> mutual funds, ETFs and other pooled funds (by the name as filed or a broad-fund ticker), Treasuries, municipal securities, cash, crypto and other assets: the instruments a ban would allow.</li>
          <li><b>Rows with a date note</b> (dates that look wrong in the filing) are not scored.</li>
          <li><b>Reports</b> are counted once per first report: an amendment that restates lines does not make a second report.</li>
        </ul>
      </MethodSection>

      <MethodSection id="points" title="Points">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14.5px]">
            <caption className="sr-only">Factors, thresholds and points</caption>
            <thead className="text-[12px] uppercase tracking-[0.05em] text-muted"><tr><th scope="col" className="py-2 pr-3">Factor</th><th scope="col" className="py-2 pr-3">Thresholds</th><th scope="col" className="py-2">Points</th></tr></thead>
            <tbody className="divide-y divide-line">
              {POINTS.map(([f, t, p]) => <tr key={f}><th scope="row" className="py-2 pr-3 font-semibold">{f}</th><td className="py-2 pr-3">{t}</td><td className="py-2 font-mono">{p}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          The committee signal: the member held a seat, on the trade date, on a committee that our hand-built map links to the company&rsquo;s sector, per the congress-legislators record. The contract signal: the company had an award in our listed set (not competed and at least $1 million, or any contract of at least $10 million, signed from 2023-10-01, USAspending) signed on or before the trade date.
          The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade; a gap over 45 days is a measured fact about two dates as the member filed them, not a finding about the filer.
        </p>
        <p className="mt-3">Every point is shown on the member&rsquo;s card with its reason and links to the filings behind it.</p>
      </MethodSection>

      <MethodSection id="grades" title="From points to a grade">
        <ul className="space-y-1">
          {GRADE_BANDS.map((g) => <li key={g.letter}><b className="font-display text-[18px]">{g.letter}</b> · {g.range}{g.meaning ? `: ${g.meaning}` : ''}</li>)}
        </ul>
        <p className="mt-3">The thresholds were set before anyone looked at where members land. The distribution by party and chamber is reported as it comes out and the thresholds are never tuned to it.</p>
      </MethodSection>

      <MethodSection id="nulls" title="When a factor can't be computed">
        <p>A factor that cannot be computed scores 0 and is labelled &ldquo;not computed&rdquo; on the card. It is never described as a clean result. Examples: committee data is not available for some dates (a new Congress had not yet published committee rosters), and our contract data starts on 2023-10-01.</p>
      </MethodSection>

      <MethodSection id="funding" title="Who funds them (not graded)">
        <p>
          Member pages also show where a member&rsquo;s 2026 campaign money came from, from the Federal Election Commission: small donors, larger individual gifts, corporate and trade-association PACs, labor PACs, leadership, party and other committees, and self-funding, plus outside spending for and against them. It is not graded: taking legal PAC money is not misconduct, and grading it would be an editorial verdict.
        </p>
      </MethodSection>

      <MethodSection id="limits" title="What the grade does not say">
        <ul className="grid gap-3">
          <Caveat lead="Not a finding.">The grade measures reported trading and disclosure timing. It says nothing about why a member traded, what they knew, or whether any rule was broken.</Caveat>
          <Caveat lead="Filings we have not read.">Some House reports are scanned images and some Senate reports were filed on paper; member pages say when that applies, and those trades are not in the grade, so it can be lower than the filings would give.</Caveat>
          <Caveat lead="Bands, not amounts.">Reported value adds the lowest amount of each disclosed range, so it is a floor.</Caveat>
        </ul>
        <p className="mt-3">See the grades in context on the <Link href={MOST_ACTIVE_PATH} className="underline">most active traders</Link> page and on each member&rsquo;s page.</p>
      </MethodSection>
    </MethodPage>
  );
}
