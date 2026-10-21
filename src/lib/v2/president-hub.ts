import 'server-only';
import { supabase } from '@/lib/supabase';
import { memo } from '@/lib/v2/reads';
import { getPresidentTrades, type ExecFiling, type ExecTrade } from '@/lib/v2/president';
import { COVER_COLS, computeHub, type ExecCover, type HubFigures } from '@/lib/v2/president-hub-core';

/** Cover data of the 19 reports (executive_filings). null = the table did not answer: nothing about fees or opinions is then shown. */
export const getCovers = memo(async (): Promise<ExecCover[] | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('executive_filings').select(COVER_COLS).order('filer_signed_date', { ascending: true });
  if (error || !data) return null;
  return data as unknown as ExecCover[];
});

/** null = the trade database did not answer (the page shows "figures unavailable"). */
export const getHub = memo(async (): Promise<(HubFigures & { trades: ExecTrade[]; filings: ExecFiling[] }) | null> => {
  const [data, covers] = await Promise.all([getPresidentTrades(), getCovers()]);
  if (!data) return null;
  return { ...computeHub(data.trades, data.filings, covers), trades: data.trades, filings: data.filings };
});
