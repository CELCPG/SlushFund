import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const MONTH_NAMES = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ months: [], error: 'DB not configured' });
  }

  const { data, error } = await supabaseAdmin
    .from('awards')
    .select('posted_date, dollar_amount, connection_type');

  if (error) {
    return NextResponse.json({ months: [], error: error.message });
  }

  // Aggregate by month
  const monthMap: Record<string, { total: number; connected: number; count: number }> = {};
  for (const row of (data ?? [])) {
    const d = String(row.posted_date ?? '');
    if (!d) continue;
    const m = d.substring(0, 7); // "YYYY-MM"
    if (!monthMap[m]) monthMap[m] = { total: 0, connected: 0, count: 0 };
    const amt = Number(row.dollar_amount) || 0;
    monthMap[m].total += amt;
    monthMap[m].count += 1;
    if (row.connection_type && row.connection_type !== 'none' && row.connection_type !== 'None' && row.connection_type !== null) {
      monthMap[m].connected += amt;
    }
  }

  const months = Object.keys(monthMap)
    .sort()
    .filter(m => m >= '2024-06')
    .slice(-18) // last 18 months of available data
    .map(m => {
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
