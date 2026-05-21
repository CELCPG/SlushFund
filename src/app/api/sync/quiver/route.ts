import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const QUIVER_TOKEN =
  process.env.QUIVER_API_TOKEN ??
  'TyTJwjuEC7VV7mOqZ622haRaaUr0x0Ng4nrwSRFKQs7vdoBcJlK9qjAS69ghzhFu';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Known sector map for federal contractor tickers ────────────────────────────
const FED_CONTRACTOR_TICKERS: Record<string, { sector: string; company: string }> = {
  PLTR: { sector: 'AI/Defense', company: 'Palantir Technologies' },
  BA:   { sector: 'Defense',    company: 'Boeing' },
  RTX:  { sector: 'Defense',     company: 'Raytheon' },
  LMT:  { sector: 'Defense',     company: 'Lockheed Martin' },
  NOC:  { sector: 'Defense',     company: 'Northrop Grumman' },
  GD:   { sector: 'Defense',     company: 'General Dynamics' },
  LHX:  { sector: 'Defense',     company: 'L3Harris' },
  NVDA: { sector: 'AI/Chips',    company: 'NVIDIA' },
  AMD:  { sector: 'AI/Chips',    company: 'AMD' },
  INTC: { sector: 'AI/Chips',    company: 'Intel' },
  MSFT: { sector: 'AI/Tech',     company: 'Microsoft' },
  GOOGL:{ sector: 'AI/Tech',     company: 'Alphabet (Google)' },
  GOOG: { sector: 'AI/Tech',     company: 'Alphabet (Google)' },
  AMZN: { sector: 'AI/Tech',     company: 'Amazon' },
  META: { sector: 'AI/Tech',     company: 'Meta' },
  AAPL: { sector: 'AI/Tech',     company: 'Apple' },
  TSLA: { sector: 'Auto/Energy', company: 'Tesla' },
  XOM:  { sector: 'Energy',     company: 'Exxon Mobil' },
  CVX:  { sector: 'Energy',     company: 'Chevron' },
  GS:   { sector: 'Finance',     company: 'Goldman Sachs' },
  MS:   { sector: 'Finance',     company: 'Morgan Stanley' },
  JPM:  { sector: 'Finance',     company: 'JPMorgan Chase' },
  BAC:  { sector: 'Finance',     company: 'Bank of America' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseAmountRange(rangeStr: string): [number | null, number | null, string] {
  if (!rangeStr) return [null, null, rangeStr];
  const numbers = rangeStr.match(/[\d,]+/g) ?? [];
  const cleaned = numbers.map((n) => parseInt(n.replace(/,/g, ''), 10));
  if (!cleaned.length) return [null, null, rangeStr];
  if (cleaned.length === 1) return [cleaned[0], cleaned[0], rangeStr];
  return [cleaned[0], cleaned[cleaned.length - 1], rangeStr];
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

interface QuiverRow {
  Representative?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  Amount?: number;
  TickerType?: string;
  TransactionDate?: string;
  ReportDate?: string;
  House?: string;
  Party?: string;
  Description?: string;
  BioGuideID?: string;
}

function quiverToTradeRow(row: QuiverRow) {
  const ticker = (row.Ticker ?? '').trim().toUpperCase();
  const txType = (row.Transaction ?? 'BUY').trim().toUpperCase();
  const rangeStr = row.Range ?? '';

  const tickerType = (row.TickerType ?? 'ST').toUpperCase();
  const assetType =
    tickerType === 'OPT' ? 'Option' :
    tickerType === 'ETF' ? 'ETF' :
    'Stock';

  const [amtMin, amtMax] = parseAmountRange(rangeStr);

  const chamberRaw = String(row.House ?? 'Representatives').trim();
  const chamber = chamberRaw.toLowerCase() === 'senate' ? 'Senate' : 'House';

  const party = (row.Party ?? 'Unknown').trim();
  const validParty = ['Democrat', 'Republican', 'Independent'].includes(party) ? party : 'Unknown';

  const flags: string[] = [];
  if (ticker in FED_CONTRACTOR_TICKERS) flags.push('federal_contractor_overlap');
  if (amtMax && amtMax >= 500_000) flags.push('large_trade');
  flags.push(txType.includes('BUY') ? 'buy' : 'sell');

  const companyName =
    FED_CONTRACTOR_TICKERS[ticker]?.company ?? row.Description ?? ticker;

  return {
    member_name: (row.Representative ?? '').trim(),
    member_chamber: chamber,
    member_party: validParty,
    member_state: 'Unknown', // Enrich via member upsert
    ticker,
    company_name: companyName,
    transaction_type: txType.includes('BUY')
      ? 'BUY'
      : txType.includes('SELL')
      ? 'SELL'
      : txType,
    asset_type: assetType,
    amount_min: amtMin,
    amount_max: amtMax,
    amount_range: rangeStr || null,
    transaction_date: parseDate(row.TransactionDate ?? row.TransactionDate ?? null),
    filed_date: parseDate(row.ReportDate ?? null),
    disclosure_year: parseInt(
      String(row.ReportDate ?? row.TransactionDate ?? '').slice(0, 4)
    ) || null,
    source_system: 'QuiverQuant',
    flags,
    signal_type: amtMax && amtMax >= 500_000 ? 'suspicious' : 'routine',
    has_federal_contract: ticker in FED_CONTRACTOR_TICKERS,
    bio_guide_id: row.BioGuideID ?? null,
  };
}

// ── POST /api/sync/quiver ───────────────────────────────────────────────────────
export async function POST() {
  const supabase = getSupabase();
  // 1. Fetch recent trades from QuiverQuant (last 7 days)
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  let raw: QuiverRow[] | null = null;
  try {
    const res = await fetch(
      `https://api.quiverquant.com/beta/congress/trades?startdate=${startDate}`,
      {
        headers: {
          Authorization: `Token ${QUIVER_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) {
      raw = await res.json();
    } else {
      return NextResponse.json(
        { error: `Quiver API error: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: `Fetch failed: ${err}` }, { status: 502 });
  }

  if (!raw || !Array.isArray(raw)) {
    return NextResponse.json({ error: 'No data from Quiver API' }, { status: 502 });
  }

  // 2. Parse
  const seen = new Set<string>();
  const trades = [];
  for (const row of raw) {
    const trade = quiverToTradeRow(row);
    if (!trade.ticker || !trade.member_name) continue;
    const key = `${trade.member_name}|${trade.ticker}|${trade.transaction_date}|${trade.transaction_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    trades.push(trade);
  }

  if (!trades.length) {
    return NextResponse.json({
      status: 'ok',
      message: 'No new trades found',
      inserted: 0,
    });
  }

  // 3. Upsert into congress_trades (unique constraint on member_name, ticker, transaction_date, transaction_type)
  const { error } = await supabase
    .from('congress_trades')
    .upsert(trades, {
      onConflict: 'member_name,ticker,transaction_date,transaction_type',
    });

  if (error) {
    return NextResponse.json(
      { error: `Supabase upsert error: ${error.message}` },
      { status: 500 }
    );
  }

  // 4. Log sync
  await supabase.from('sync_log').insert({
    sync_type: 'quiver',
    start_date: startDate,
    end_date: new Date().toISOString().split('T')[0],
    status: 'complete',
    records_synced: trades.length,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    status: 'ok',
    message: `Synced ${trades.length} trades from QuiverQuant`,
    inserted: trades.length,
    start_date: startDate,
  });
}

// Disable body parsing for cron (GET would work but this is POST-only)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';