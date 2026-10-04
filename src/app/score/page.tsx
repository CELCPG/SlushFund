import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowRight, AlertTriangle, BarChart3 } from 'lucide-react';

// Force dynamic — the leaderboard refreshes weekly via cron.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LeaderboardSenator {
  id: string;
  name_slug: string;
  full_name: string;
  state: string;
  party: string;
  photo_url: string | null;
  total_score: number;
  grade: string;
  pillar_stocks: number;
  pillar_productivity: number;
  pillar_attendance: number;
  pillar_constituency: number;
  pillar_lobbying: number;
  data_coverage_pct: number;
}

interface LeaderboardResponse {
  week: string | null;
  senators: LeaderboardSenator[];
}

const PARTY_COLOR: Record<string, string> = {
  D: 'text-blue-400',
  R: 'text-red-400',
  I: 'text-purple-400',
};

const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  B: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
  C: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  D: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  F: 'bg-red-500/20 text-red-300 border-red-500/40',
};

async function getLeaderboard(): Promise<LeaderboardResponse | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return null;
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('get_score_leaderboard');
    if (error) {
      console.error('get_score_leaderboard error:', error);
      return null;
    }
    return data as LeaderboardResponse;
  } catch (e) {
    console.error('get_score_leaderboard exception:', e);
    return null;
  }
}

export default async function ScorePage() {
  const data = await getLeaderboard();
  const senators = data?.senators ?? [];
  const week = data?.week;
  const hasData = senators.length > 0 && senators.some((s) => s.data_coverage_pct > 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Public Servant Score"
        title="How is your senator actually voting?"
        description="A 0–100 grade built from public records — STOCK Act trades, missed votes, lobbyist trips, and bill productivity. Updated weekly. Built only on data you can verify."
        sticky
      />

      <Container className="py-8">
        {/* Coverage callout — the honest-zero promise */}
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
            <div className="flex-1">
              <div className="font-semibold text-amber-200">
                {hasData
                  ? `Data coverage: ${senators[0]?.data_coverage_pct ?? 0}% — see methodology for what's pending`
                  : 'Data coverage: 0% — public Servant Score is in pre-launch state'}
              </div>
              <p className="mt-1 text-sm text-amber-100/80">
                At launch, we show the full Senate (100 members) with zero scores because the
                underlying data ingest is still being wired up. The leaderboard will populate
                as soon as the cron runs and pulls data. No scores are invented — missing data
                shows as 0 with this transparency callout.{' '}
                <Link href="/score/methodology" className="underline hover:text-amber-100">
                  See full methodology →
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Top 5 / Bottom 5 if there's data */}
        {hasData && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Top 5 — Best Grades
              </div>
              <ul className="space-y-2">
                {senators.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/score/${s.name_slug}`}
                      className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-800/60"
                    >
                      <span className="text-sm text-slate-200">{s.full_name}</span>
                      <span className="font-mono text-sm text-emerald-300">
                        {s.total_score.toFixed(0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-400">
                Bottom 5 — Worst Grades
              </div>
              <ul className="space-y-2">
                {senators.slice(-5).reverse().map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/score/${s.name_slug}`}
                      className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-800/60"
                    >
                      <span className="text-sm text-slate-200">{s.full_name}</span>
                      <span className="font-mono text-sm text-red-300">
                        {s.total_score.toFixed(0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Full leaderboard table */}
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-100">
              All 100 Senators
              {week && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  · Week of {week}
                </span>
              )}
            </h2>
          </div>
          {senators.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p>No senators loaded yet.</p>
              <p className="mt-1 text-xs">Run the cron to populate the leaderboard.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-right">Rank</th>
                    <th className="px-4 py-3">Senator</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Party</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3 text-right">Coverage</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {senators.map((s, i) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/score/${s.name_slug}`}
                          className="font-medium text-slate-200 hover:text-slush-red"
                        >
                          {s.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.state}</td>
                      <td className={`px-4 py-3 font-mono ${PARTY_COLOR[s.party] ?? 'text-slate-400'}`}>
                        {s.party}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-100">
                        {s.total_score.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block min-w-[2.5rem] rounded border px-2 py-0.5 font-mono text-sm font-bold ${
                            GRADE_BG[s.grade] ?? 'border-slate-700 text-slate-400'
                          }`}
                        >
                          {s.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {s.data_coverage_pct}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/score/${s.name_slug}`}
                          className="inline-flex items-center text-xs text-slate-500 hover:text-slush-red"
                        >
                          view <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Every score is traceable to its raw source.{' '}
          <Link href="/score/methodology" className="underline hover:text-slate-300">
            Read the methodology
          </Link>
          {' · '}
          <Link href="/congress/trades" className="underline hover:text-slate-300">
            Browse all trades
          </Link>
        </p>
      </Container>
    </div>
  );
}
