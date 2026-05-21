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

// ── Quiver V2 bulk response shape ───────────────────────────────────────────────
interface QuiverBulkRow {
  Member?: string;
  Ticker?: string;
  Company?: string;
  Date?: string;
  Type?: string;
  Amount?: string;
  Owner?: string;
  Sector?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseAmountRange(rangeStr: string): [number | null, number | null] {
  if (!rangeStr) return [null, null];
  const numbers = rangeStr.match(/[\d,]+/g) ?? [];
  const cleaned = numbers.map((n) => parseInt(n.replace(/,/g, ''), 10));
  if (!cleaned.length) return [null, null];
  if (cleaned.length === 1) return [cleaned[0], cleaned[0]];
  return [cleaned[0], cleaned[cleaned.length - 1]];
}

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function inferChamber(memberName: string): 'House' | 'Senate' {
  const upper = memberName.toUpperCase();
  // Senators typically have "Sen." prefix or are known Senate titles
  if (upper.includes('SEN.') || upper.includes('SENATOR')) return 'Senate';
  // Representatives / House members
  return 'House';
}

function mapRowToTrade(row: QuiverBulkRow) {
  const ticker = (row.Ticker ?? '').trim().toUpperCase();
  const rawType = (row.Type ?? '').trim().toUpperCase();
  const txType = rawType.includes('BUY')
    ? 'BUY'
    : rawType.includes('SELL')
    ? 'SELL'
    : rawType;

  const [amountMin, amountMax] = parseAmountRange(row.Amount ?? '');
  const transactionDate = parseDate(row.Date ?? null);

  return {
    member_name: (row.Member ?? '').trim(),
    ticker,
    company_name: (row.Company ?? '').trim(),
    transaction_type: txType,
    transaction_date: transactionDate,
    amount_min: amountMin,
    amount_max: amountMax,
    amount_range: row.Amount ?? null,
    member_chamber: inferChamber(row.Member ?? ''),
    member_party: null,
    member_state: 'Unknown',
    asset_type: 'Stock',
    filed_date: null,
    disclosure_year: transactionDate
      ? parseInt(transactionDate.slice(0, 4), 10)
      : null,
    source_system: 'QuiverQuant',
    flags: [],
    signal_type: null,
    has_federal_contract: false,
    bio_guide_id: null,
  };
}

// ── Fetch with retry / rate-limit handling ────────────────────────────────────
async function fetchWithRetry(
  url: string,
  retries = 3,
  backoffMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${QUIVER_TOKEN}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 429) {
      if (attempt < retries) {
        console.log(`Rate limited (429). Waiting 30s before retry ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
    }

    if (!res.ok && attempt < retries) {
      const delay = backoffMs * Math.pow(2, attempt);
      console.log(`Fetch failed (${res.status}). Retry ${attempt + 1} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return res;
  }

  // Final attempt already made above; return whatever we got
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${QUIVER_TOKEN}`,
      Accept: 'application/json',
    },
  });
  return res;
}

// ── POST /api/sync/history ─────────────────────────────────────────────────────
export async function POST() {
  const supabase = getSupabase();

  const PAGE_SIZE = 500;
  let page = 1;
  let allTrades: ReturnType<typeof mapRowToTrade>[] = [];
  let pagesFetched = 0;
  let oldestDate: string | null = null;
  let newestDate: string | null = null;

  // Paginate through all historical data
  while (true) {
    const url = `https://api.quiverquant.com/beta/bulk/congresstrading?version=V2&page=${page}&page_size=${PAGE_SIZE}`;
    console.log(`Fetching page ${page}...`);

    const res = await fetchWithRetry(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Quiver API error: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    let raw: QuiverBulkRow[];
    try {
      raw = await res.json();
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse Quiver API response' },
        { status: 502 }
      );
    }

    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'Unexpected response shape from Quiver API' },
        { status: 502 }
      );
    }

    console.log(`Page ${page}: ${raw.length} records received.`);

    // Empty page means we've reached the end
    if (raw.length === 0) break;

    pagesFetched++;

    // Deduplicate within this page using a Set
    const seen = new Set<string>();
    for (const row of raw) {
      if (!row.Member || !row.Ticker) continue;
      const trade = mapRowToTrade(row);
      if (!trade.member_name || !trade.ticker || !trade.transaction_date) continue;

      const key = `${trade.member_name}|${trade.ticker}|${trade.transaction_date}|${trade.transaction_type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      allTrades.push(trade);

      // Track date range
      if (trade.transaction_date) {
        if (!oldestDate || trade.transaction_date < oldestDate) {
          oldestDate = trade.transaction_date;
        }
        if (!newestDate || trade.transaction_date > newestDate) {
          newestDate = trade.transaction_date;
        }
      }
    }

    // If we got fewer records than page size, we're done
    if (raw.length < PAGE_SIZE) break;

    page++;

    // Sanity cap — should never need more than a few hundred pages
    if (pagesFetched > 1000) {
      console.warn('Sanity cap hit at 1000 pages. Stopping pagination.');
      break;
    }
  }

  if (!allTrades.length) {
    // Record empty sync
    await supabase.from('sync_log').insert({
      sync_type: 'history_backfill',
      start_date: null,
      end_date: null,
      status: 'complete',
      records_synced: 0,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'ok',
      message: 'No trades found in historical backfill',
      total_synced: 0,
      pages_fetched: 0,
      date_range: { oldest: null, newest: null },
    });
  }

  // Upsert into congress_trades (idempotent — unique constraint on member_name, ticker, transaction_date, transaction_type)
  const { error } = await supabase
    .from('congress_trades')
    .upsert(allTrades, {
      onConflict: 'member_name,ticker,transaction_date,transaction_type',
    });

  if (error) {
    return NextResponse.json(
      { error: `Supabase upsert error: ${error.message}` },
      { status: 500 }
    );
  }

  // Log sync
  await supabase.from('sync_log').insert({
    sync_type: 'history_backfill',
    start_date: oldestDate,
    end_date: newestDate,
    status: 'complete',
    records_synced: allTrades.length,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    status: 'ok',
    total_synced: allTrades.length,
    pages_fetched: pagesFetched,
    date_range: { oldest: oldestDate, newest: newestDate },
  });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';