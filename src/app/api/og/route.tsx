import { renderOgCard } from '@/lib/v2/og';
import { MONEY_TYPE_ORDER, type MoneyType } from '@/lib/v2/money';

// Node runtime: the template reads its TTF fonts from disk.
export const runtime = 'nodejs';

/**
 * Branded 1200×630 share card (v2 template, src/lib/v2/og.tsx).
 *
 * Query params:
 *   title     headline
 *   eyebrow   small label (e.g. "Investigation", "Member profile")
 *   type      contracts | trades | campaign | lobbying (colors the card)
 *   stat, statLabel, source, asof
 *             a figure is drawn only with its source (and as-of date)
 *
 * Example: /api/og?title=Rep.%20X&eyebrow=Member%20profile&type=trades&stat=42&statLabel=trades%20disclosed&source=House%20Clerk&asof=Oct%203%2C%202026
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const t = p.get('type');
  return renderOgCard({
    title: p.get('title') || 'See where public money goes, and who’s on both ends of it.',
    eyebrow: p.get('eyebrow') ?? undefined,
    type: t && (MONEY_TYPE_ORDER as string[]).includes(t) ? (t as MoneyType) : undefined,
    stat: p.get('stat') ?? undefined,
    statLabel: p.get('statLabel') ?? undefined,
    source: p.get('source') ?? undefined,
    asOf: p.get('asof') ?? undefined,
  });
}
