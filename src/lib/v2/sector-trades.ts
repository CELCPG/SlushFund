import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo, readAll } from '@/lib/v2/reads';
import { GRADE_WINDOW_MONTHS, windowStart } from '@/lib/v2/grade-method';
import { todayNY } from '@/lib/v2/report-card';
import type { TradeRow } from '@/lib/v2/sector-agg';

const COLS = 'id, bio_guide_id, member_name, ticker, company_name, asset_type, option_type, transaction_type, transaction_date, date_flag';

/** D18: every congress_trades row dated in the last 24 months (anon read), memoized 30 min. null = unavailable. */
export const getSectorTradeRows = memo(async (): Promise<{ rows: TradeRow[]; end: string } | null> => {
  if (!supabase) return null;
  const end = todayNY();
  const start = windowStart(end, GRADE_WINDOW_MONTHS);
  const rows = await readAll<TradeRow>((from, to) =>
    supabase!
      .from('congress_trades')
      .select(COLS, { count: 'exact' })
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows ? { rows, end } : null;
});
