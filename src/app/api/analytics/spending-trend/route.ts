import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Edge runtime: reads from a view (no Node deps).
export const runtime = 'edge';

const MONTH_NAMES = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// GET /api/analytics/spending-trend
//
// Returns the last 18 months of spending, aggregated by month.
//
// Performance: reads from the existing `monthly_spending_trend` view which
// is GROUP BY (month, award_category) — i.e. one row per (month, category).
// The view aggregates in Postgres; we collapse across categories in JS.
// A 2-year window produces ~50 rows total. Replaces the prior implementation
// that pulled every row of the awards table just to do a JS month groupBy.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ months: [], error: 'DB not configured' });
  }

  // Date range: 18 months back from today
  const today = new Date();
  const minDate = new Date(today);
  minDate.setMonth(minDate.getMonth() - 18);
  const minMonth = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('monthly_spending_trend')
    .select('month, award_category, award_count, total_dollars, connected_dollars, non_competitive_dollars')
    .gte('month', minMonth)
    .order('month', { ascending: true });

  if (error) {
    return NextResponse.json({ months: [], error: error.message });
  }

  // Collapse by month across categories
  const monthMap: Record<string, { total: number; connected: number; count: number }> = {};
  for (const row of data ?? []) {
    if (!row.month) continue;
    if (!monthMap[row.month]) monthMap[row.month] = { total: 0, connected: 0, count: 0 };
    monthMap[row.month].total += Number(row.total_dollars) || 0;
    monthMap[row.month].connected += Number(row.connected_dollars) || 0;
    monthMap[row.month].count += Number(row.award_count) || 0;
  }

  const months = Object.keys(monthMap)
    .sort()
    .map((m) => {
      const [, mon] = m.split('-');
      return {
        month: m,
        label: `${MONTH_NAMES[parseInt(mon, 10)]} ${m.substring(0, 4)}`,
        total: Math.round(monthMap[m].total),
        connected: Math.round(monthMap[m].connected),
        count: monthMap[m].count,
      };
    });

  return NextResponse.json({ months });
}
