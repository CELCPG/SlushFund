import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ReportCard {
  senator: {
    id: string;
    name_slug: string;
    full_name: string;
    state: string;
    party: string;
    photo_url: string | null;
    term_start: string | null;
    committees: string[];
  };
  score: null | {
    week_of: string;
    total: number;
    grade: string;
    pillar_constituency: number;
    pillar_stocks: number;
    pillar_lobbying: number;
    pillar_productivity: number;
    pillar_attendance: number;
    data_coverage_pct: number;
    has_constituency_data: boolean;
    has_stocks_data: boolean;
    has_lobbying_data: boolean;
    has_productivity_data: boolean;
    has_attendance_data: boolean;
    scoring_version: string;
  };
  top_conflicts: Array<{
    transaction_date: string;
    ticker: string | null;
    asset_description: string;
    transaction_type: string;
    amount_low: number | null;
    amount_high: number | null;
    committee_overlap_sectors: string[];
  }>;
}

const PARTY_FULL: Record<string, string> = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const PARTY_COLOR: Record<string, string> = { D: 'text-blue-400', R: 'text-red-400', I: 'text-purple-400' };
const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  B: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
  C: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  D: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  F: 'bg-red-500/20 text-red-300 border-red-500/40',
};

async function getReportCard(slug: string): Promise<ReportCard | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    // Try the RPC first (supabaseAdmin if available, fallback to anon).
    const rpcClient = supabaseAdmin ?? supabase;
    const { data, error } = await rpcClient.rpc('get_senator_report_card', {
      p_slug: slug,
    });
    if (error) {
      console.error('get_senator_report_card error:', error);
    } else if (data) {
      // supabase-js may unwrap single-object JSONB RPCs to the top level.
      const card: any = (data as any).senator
        ? data
        : (data as any).get_senator_report_card && (data as any).get_senator_report_card.senator
        ? (data as any).get_senator_report_card
        : null;
      if (card && card.senator) return card as ReportCard;
    }

    // Fallback: build the card from direct table queries. This is the same
    // shape as the RPC, just assembled in the app. Used when the PostgREST
    // schema cache is stale (rare) or the function is not yet visible to the
    // client. Falls back gracefully so the page is never empty.
    // Use supabase (anon) first since the senators table has RLS off.
    const client = supabase || supabaseAdmin;
    const { data: senator, error: senErr } = await client
      .from('senators')
      .select('id, name_slug, full_name, state, party, photo_url, term_start, committees')
      .eq('name_slug', slug)
      .maybeSingle();
    if (senErr || !senator) {
      console.error('[score/slug] senator query failed', { slug, senErr, senator });
      return null;
    }

    const { data: score } = await client
      .from('senator_scores')
      .select(
        'week_of, pillar_constituency, pillar_stocks, pillar_lobbying, pillar_productivity, pillar_attendance, data_coverage_pct, has_constituency_data, has_stocks_data, has_lobbying_data, has_productivity_data, has_attendance_data, scoring_version'
      )
      .eq('senator_id', senator.id)
      .order('week_of', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: top_conflicts } = await client
      .from('senator_trades')
      .select('transaction_date, ticker, asset_description, transaction_type, amount_low, amount_high, committee_overlap_sectors')
      .eq('senator_id', senator.id)
      .eq('conflict_flag', true)
      .order('transaction_date', { ascending: false })
      .limit(5);

    const total =
      (score?.pillar_constituency ?? 0) +
      (score?.pillar_stocks ?? 0) +
      (score?.pillar_lobbying ?? 0) +
      (score?.pillar_productivity ?? 0) +
      (score?.pillar_attendance ?? 0);

    const grade =
      total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';

    return {
      senator,
      score: score
        ? {
            week_of: score.week_of,
            total,
            grade,
            pillar_constituency: score.pillar_constituency ?? 0,
            pillar_stocks: score.pillar_stocks ?? 0,
            pillar_lobbying: score.pillar_lobbying ?? 0,
            pillar_productivity: score.pillar_productivity ?? 0,
            pillar_attendance: score.pillar_attendance ?? 0,
            data_coverage_pct: score.data_coverage_pct ?? 0,
            has_constituency_data: score.has_constituency_data ?? false,
            has_stocks_data: score.has_stocks_data ?? false,
            has_lobbying_data: score.has_lobbying_data ?? false,
            has_productivity_data: score.has_productivity_data ?? false,
            has_attendance_data: score.has_attendance_data ?? false,
            scoring_version: score.scoring_version ?? '0.1.0',
          }
        : null,
      top_conflicts: top_conflicts ?? [],
    } as ReportCard;
  } catch (e) {
    console.error('get_senator_report_card exception:', e);
    return null;
  }
}

const PILLAR_META = [
  { key: 'pillar_constituency', label: 'Constituency Alignment', has_data: 'has_constituency_data' as const, phase: 2 },
  { key: 'pillar_stocks', label: 'Stock Trading Integrity', has_data: 'has_stocks_data' as const, phase: 1 },
  { key: 'pillar_lobbying', label: 'Lobbyist Influence', has_data: 'has_lobbying_data' as const, phase: 2 },
  { key: 'pillar_productivity', label: 'Bipartisan Productivity', has_data: 'has_productivity_data' as const, phase: 1 },
  { key: 'pillar_attendance', label: 'Attendance & Engagement', has_data: 'has_attendance_data' as const, phase: 1 },
];

function formatAmount(low: number | null, high: number | null): string {
  if (low == null && high == null) return '—';
  if (low != null && high != null) {
    const fmt = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
    return `${fmt(low)} – ${fmt(high)}`;
  }
  return `$${(low ?? high ?? 0).toLocaleString()}`;
}

export default async function SenatorReportCard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = await getReportCard(slug);
  if (!card) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Container className="py-16">
          <h1 className="mb-2 text-2xl font-bold text-slate-100">Senator not found</h1>
          <p className="text-slate-400">
            No senator with slug <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm text-slate-200">{slug}</code> exists in our database.
          </p>
          <Link href="/score" className="mt-6 inline-flex items-center text-sm text-slush-red hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to scoreboard
          </Link>
        </Container>
      </div>
    );
  }
  const { senator, score, top_conflicts } = card;
  const grade = score?.grade ?? 'F';
  const total = score?.total ?? 0;
  const coverage = score?.data_coverage_pct ?? 0;
  const week = score?.week_of ?? '—';

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        eyebrow="Public Servant Score"
        title={senator.full_name}
        description={
          <span>
            U.S. Senator · {senator.state} ·{' '}
            <span className={PARTY_COLOR[senator.party] ?? 'text-slate-400'}>
              {PARTY_FULL[senator.party] ?? senator.party}
            </span>
          </span>
        }
        sticky
        actions={
          <Link href="/score" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All senators
          </Link>
        }
      />

      <Container className="py-8">
        {/* Coverage callout (if any pillar is missing) */}
        {coverage < 100 && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
              <div className="flex-1">
                <div className="font-semibold text-amber-200">
                  Data coverage: {coverage}% — {5 - Math.round(coverage / 20)} of 5 pillars pending
                </div>
                <p className="mt-1 text-sm text-amber-100/80">
                  Pillar scores marked &ldquo;Phase 2&rdquo; will populate when polling and lobbyist-filing
                  ingestion lands. Until then we show 0 — we do not estimate or impute.{' '}
                  <Link href="/score/methodology" className="underline hover:text-amber-100">
                    See methodology →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Score + Grade hero */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Public Servant Score
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <div className="text-6xl font-bold text-slate-100">
                {total.toFixed(0)}
                <span className="ml-1 text-2xl text-slate-500">/100</span>
              </div>
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 text-3xl font-bold ${
                  GRADE_BG[grade] ?? 'border-slate-700 text-slate-400'
                }`}
              >
                {grade}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Week of {week} · Scoring v{score?.scoring_version ?? '0.1.0'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pillar Breakdown
            </div>
            <div className="mt-3 space-y-2">
              {PILLAR_META.map((p) => {
                const v = (score as any)?.[p.key] ?? 0;
                const hasData = (score as any)?.[p.has_data] ?? false;
                return (
                  <div key={p.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{p.label}</span>
                      <span className="font-mono text-slate-200">
                        {hasData ? `${v.toFixed(1)}/20` : `0/20 — Phase ${p.phase}`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
                      <div
                        className={`h-full transition-all ${
                          hasData
                            ? v >= 16
                              ? 'bg-emerald-500'
                              : v >= 12
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${(v / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top conflicts (Pillar 2 detail) */}
        {top_conflicts && top_conflicts.length > 0 && (
          <div className="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-red-400">
              Top Stock-Trade Conflicts
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              Trades in assets tied to committees this senator sits on. Data: STOCK Act
              disclosures.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Ticker</th>
                    <th className="pb-2">Asset</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2">Conflict sectors</th>
                  </tr>
                </thead>
                <tbody>
                  {top_conflicts.map((t, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 font-mono text-slate-400">
                        {t.transaction_date}
                      </td>
                      <td className="py-2 font-mono text-slate-200">
                        {t.ticker ?? '—'}
                      </td>
                      <td className="py-2 text-slate-300">{t.asset_description}</td>
                      <td className="py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-mono ${
                            t.transaction_type === 'buy'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {t.transaction_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-slate-300">
                        {formatAmount(t.amount_low, t.amount_high)}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {(t.committee_overlap_sectors ?? []).map((s) => (
                            <span
                              key={s}
                              className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Full disclosure history →{' '}
              <Link
                href={`https://eopds.senate.gov/search/home/?senator=${encodeURIComponent(
                  senator.full_name
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-slush-red hover:underline"
              >
                eopds.senate.gov <ExternalLink className="ml-0.5 h-3 w-3" />
              </Link>
            </p>
          </div>
        )}

        {/* Methodology footer */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">
            How this grade was calculated
          </h3>
          <p className="text-sm text-slate-400">
            Five equally-weighted pillars, each scored 0–20. Pillar scores are derived from
            public records (STOCK Act, ProPublica, LDA, senate.gov). The total is a simple sum
            with no normalization. Missing data shows as 0 with a transparency callout — never
            estimated.{' '}
            <Link href="/score/methodology" className="text-slush-red hover:underline">
              Read the full methodology →
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
