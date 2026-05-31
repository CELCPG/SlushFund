// Shared "Latest activity" feed — merges the newest flagged federal contracts
// and notable congressional trades into one chronological stream.
// Used by /api/latest, the /latest page, and /latest.xml (RSS).
import { supabaseAdmin, supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface LatestItem {
  id: string;
  kind: 'contract' | 'trade';
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  href: string;
  amount: number | null;
  tags: string[];
}

function fmtUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/**
 * Newest high-signal items across contracts + trades, merged newest-first.
 * Returns [] in demo mode (no Supabase) so callers can fall back gracefully.
 */
export async function getLatest(limit = 40): Promise<LatestItem[]> {
  const client = supabaseAdmin ?? supabase;
  if (!isSupabaseConfigured || !client) return [];

  const today = new Date().toISOString().slice(0, 10);

  // Recent flagged / politically-connected contracts.
  const contractsP = client
    .from('awards')
    .select('id, recipient_name, description, dollar_amount, awarding_agency, connection_type, flags, risk_score, posted_date')
    .gte('risk_score', 60)
    .lte('posted_date', today)
    .order('posted_date', { ascending: false })
    .limit(limit);

  // Recent notable trades (large or contractor-overlapping).
  const tradesP = client
    .from('congress_trades')
    .select('id, member_name, ticker, company_name, transaction_type, amount_max, transaction_date, has_federal_contract, flags')
    .lte('transaction_date', today)
    .order('transaction_date', { ascending: false })
    .limit(limit);

  const [contractsRes, tradesRes] = await Promise.all([contractsP, tradesP]);

  const contractItems: LatestItem[] = (contractsRes.data ?? []).map((a) => {
    const flags = (a.flags as string[]) ?? [];
    const amount = Number(a.dollar_amount ?? 0);
    return {
      id: `contract-${a.id}`,
      kind: 'contract',
      title: `${a.recipient_name} — ${fmtUSD(amount)}`,
      description: a.description || `${a.awarding_agency} award`,
      date: String(a.posted_date),
      href: `/contract/${a.id}`,
      amount,
      tags: [
        ...(a.connection_type && a.connection_type !== 'none' ? [String(a.connection_type)] : []),
        ...flags.slice(0, 2),
      ],
    };
  });

  const tradeItems: LatestItem[] = (tradesRes.data ?? []).map((t) => {
    const amount = t.amount_max != null ? Number(t.amount_max) : null;
    const verb = t.transaction_type === 'BUY' ? 'bought' : t.transaction_type === 'SELL' ? 'sold' : (t.transaction_type as string)?.toLowerCase();
    return {
      id: `trade-${t.id}`,
      kind: 'trade',
      title: `${t.member_name} ${verb} ${t.ticker}`,
      description: `${t.company_name || t.ticker}${amount ? ` · up to ${fmtUSD(amount)}` : ''}${t.has_federal_contract ? ' · federal contractor' : ''}`,
      date: String(t.transaction_date),
      href: `/congress/trades?ticker=${encodeURIComponent(t.ticker)}`,
      amount,
      tags: [
        t.transaction_type as string,
        ...(t.has_federal_contract ? ['contractor overlap'] : []),
      ].filter(Boolean),
    };
  });

  const clean = (arr: LatestItem[]) =>
    arr.filter((i) => i.date && i.date !== 'null').sort((a, b) => b.date.localeCompare(a.date));

  const contracts = clean(contractItems);
  const trades = clean(tradeItems);

  // Interleave so both categories are represented even when one source is much
  // fresher than the other (trades update continuously; contract sync lags).
  // Roughly half the feed from each, drawn newest-first within each kind.
  const half = Math.ceil(limit / 2);
  const merged = [...trades.slice(0, half), ...contracts.slice(0, limit - Math.min(half, trades.length))];
  return merged.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
