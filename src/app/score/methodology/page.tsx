import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const metadata = {
  title: 'Methodology — Public Servant Score',
  description:
    'How SlushFund scores every U.S. Senator 0–100 on public-record data only. Full rubric, data sources, and known gaps.',
};

const PILLARS = [
  {
    name: 'Constituency Alignment',
    weight: 20,
    phase: 2,
    what: 'How often the senator votes with the majority of constituents in their state on major bills.',
    sources: ['YouGov', 'Marist', 'Quinnipiac', 'Pew', 'Monmouth', 'Suffolk (scraped)'],
    rubric: 'For each major bill (≥1,000 cosponsors or cloture vote) where the senator voted, we look up state-level polling on the same question. Score = sum(aligned_votes × bill_weight) / total_bills × 20. Only bills with ≥2 polls (n≥500) are scored.',
    status: 'Phase 2 — currently shows 0 with a transparency callout. Ingestion scripts in development.',
  },
  {
    name: 'Stock Trading Integrity',
    weight: 20,
    phase: 1,
    what: 'Whether STOCK Act trades conflict with committee assignments.',
    sources: ['Senate eopds financial disclosures (eopds.senate.gov)'],
    rubric: 'For each trade in the last 24 months, check if the traded asset\'s sector overlaps with a committee the senator sits on. Start at 20, subtract 2 per conflicting trade (cap: -20), subtract 0.5 per non-conflicting trade (pattern signal). Diversified index funds (SPY, VTI) are excluded; sector ETFs (XLE, XLF) are counted.',
    status: 'Phase 1 — live at launch.',
  },
  {
    name: 'Lobbyist Influence',
    weight: 20,
    phase: 2,
    what: 'Total estimated value of lobbyist-funded trips, gifts, and honoraria in the last 24 months.',
    sources: ['Senate LDA filings (lda.senate.gov)'],
    rubric: 'Score based on total dollar value: <$1K → 20, $1K–$5K → 16, $5K–$15K → 12, $15K–$50K → 8, $50K–$100K → 4, >$100K → 0.',
    status: 'Phase 2 — currently shows 0 with a transparency callout. Ingestion scripts in development.',
  },
  {
    name: 'Bipartisan Productivity',
    weight: 20,
    phase: 1,
    what: 'Bills sponsored, cosponsored, and passed, with a bonus for bipartisan cosponsors.',
    sources: ['ProPublica Congress API (api.propublica.org)'],
    rubric: 'Score = 0.5 × log(1 + sponsored_passed) + 0.3 × log(1 + bipartisan_cosponsors) + 0.2 × log(1 + cosponsored), normalized against chamber max, × 20.',
    status: 'Phase 1 — live at launch.',
  },
  {
    name: 'Attendance & Engagement',
    weight: 20,
    phase: 1,
    what: 'Missed votes percentage and floor speech count.',
    sources: ['ProPublica Congress API', 'senate.gov (Phase 2)'],
    rubric: '12 points: missed_votes_pct_inverse × 12. Senators with 0% missed votes = 12, 50%+ missed = 0. 8 points: floor speeches, normalized against chamber median (top quartile → 8, median → 4, bottom → 0).',
    status: 'Phase 1 — attendance live. Speech counts populated in Phase 2 from senate.gov speech log.',
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Methodology"
        title="How the Public Servant Score is calculated"
        description="The full rubric, data sources, known gaps, and what we're building next. If anything is unclear, the answer should be here."
        actions={
          <Link href="/score" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to scoreboard
          </Link>
        }
      />

      <Container className="py-8">
        {/* Honest-zero promise */}
        <div className="mb-8 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-emerald-200">Our commitment</h2>
          <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
            <li>
              <strong>Every score is traceable.</strong> Click any pillar to see the raw data
              and the source link. No black-box math.
            </li>
            <li>
              <strong>Honest zero is the default.</strong> If we don&apos;t have data, we show
              0 with a transparency callout. We never impute, estimate, or average to inflate a
              total.
            </li>
            <li>
              <strong>Methodology is versioned.</strong> Every grade is stamped with the scoring
              version it was computed under. We can reproduce any historical grade.
            </li>
            <li>
              <strong>Corrections are public.</strong> Senators (or anyone) can flag a factual
              error. We review within 48 hours and publish the fix.
            </li>
          </ul>
        </div>

        {/* The five pillars */}
        <h2 className="mb-4 text-xl font-semibold text-slate-100">The five pillars</h2>
        <p className="mb-6 text-sm text-slate-400">
          Each pillar is scored 0–20. The total is a simple sum. There is no normalization
          across senators — a high total means a high score. Grade bands are A (90–100), B
          (80–89), C (70–79), D (60–69), F (0–59).
        </p>

        <div className="space-y-4">
          {PILLARS.map((p, i) => (
            <div
              key={p.name}
              className={`rounded-lg border p-6 ${
                p.phase === 1
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">Pillar {i + 1}</span>
                    <h3 className="text-lg font-semibold text-slate-100">{p.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{p.what}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-mono ${
                      p.phase === 1
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {p.weight} pts · Phase {p.phase}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Rubric
                  </div>
                  <p className="mt-1 text-slate-300">{p.rubric}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Data sources
                  </div>
                  <ul className="mt-1 space-y-0.5 text-slate-300">
                    {p.sources.map((s) => (
                      <li key={s} className="font-mono text-xs">
                        · {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      p.phase === 1 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {p.status}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What's not in the score */}
        <div className="mt-10 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-slate-100">What we deliberately do NOT score</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>
              · <strong>Personal conduct or character.</strong> This is a public-records score,
              not a moral judgment.
            </li>
            <li>
              · <strong>Ideology or party-line voting.</strong> A senator who votes with their
              party 100% of the time is not penalized if their constituents agree.
            </li>
            <li>
              · <strong>Donor overlap on bills.</strong> This signal is too noisy to score
              defensibly at launch. It&apos;s on the Phase 3+ roadmap.
            </li>
            <li>
              · <strong>Single-incident events.</strong> One trade, one trip, one vote is
              signal, not a pattern. We aggregate over 24 months.
            </li>
          </ul>
        </div>

        {/* How to challenge a score */}
        <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Disagree with a score?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Email{' '}
            <a
              href="mailto:score@slushfund.net"
              className="text-slush-red hover:underline"
            >
              score@slushfund.net
            </a>{' '}
            with the senator&apos;s name, the pillar, and the source for your correction. We
            review within 48 hours and publish the fix on the changelog.
          </p>
        </div>

        {/* External links */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Public Servant Score v0.1.0 · Source code & changelog coming soon</p>
          <div className="mt-2 flex justify-center gap-4">
            <a
              href="https://api.congress.gov"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center hover:text-slate-300"
            >
              Congress.gov <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            <a
              href="https://eopds.senate.gov"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center hover:text-slate-300"
            >
              Senate eopds <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            <a
              href="https://lda.senate.gov"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center hover:text-slate-300"
            >
              Senate LDA <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            <a
              href="https://api.propublica.org/congress/v1"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center hover:text-slate-300"
            >
              ProPublica API <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
          </div>
        </div>
      </Container>
    </div>
  );
}
