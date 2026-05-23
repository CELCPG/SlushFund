import { NextRequest, NextResponse } from 'next/server';
import { fullBackfill } from '@/lib/sync';

// ─── FY Date Ranges (used by backfill + era-stats) ───────────────────────────
export const FY_DATE_RANGES: Record<number, { start: string; end: string }> = {
  2019: { start: '2018-10-01', end: '2019-09-30' },
  2020: { start: '2019-10-01', end: '2020-09-30' },
  2021: { start: '2020-10-01', end: '2021-09-30' },
  2022: { start: '2021-10-01', end: '2022-09-30' },
  2023: { start: '2022-10-01', end: '2023-09-30' },
  2024: { start: '2023-10-01', end: '2024-09-30' },
  2025: { start: '2024-10-01', end: '2025-09-30' },
  2026: { start: '2025-10-01', end: new Date().toISOString().split('T')[0] },
};

export const runtime = 'nodejs';
export const maxDuration = 800; // Vercel Pro max

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { fys } = body as { fys?: number[] };

    // Validate FYs
    const validFys = fys ?? [2024, 2025, 2026];
    const invalid = validFys.filter(f => !FY_DATE_RANGES[f]);
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid fiscal years: ${invalid.join(', ')}`,
          valid: Object.keys(FY_DATE_RANGES).map(Number),
        },
        { status: 400 }
      );
    }

    console.log(`[backfill] Starting backfill for FYs: ${validFys.join(', ')}`);

    // Run backfill sequentially per FY
    const results = await fullBackfill(validFys);

    return NextResponse.json({
      success: true,
      fys_backfilled: validFys,
      contracts: {
        synced: results.contracts.synced,
        flagged: results.contracts.flagged,
        errors: results.contracts.errors.slice(0, 20),
        duration_ms: results.contracts.duration_ms,
        page_count: results.contracts.page_count,
      },
      grants: {
        synced: results.grants.synced,
        flagged: results.grants.flagged,
        errors: results.grants.errors.slice(0, 20),
        duration_ms: results.grants.duration_ms,
      },
    });
  } catch (err) {
    console.error('[backfill] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    usage: 'POST /api/backfill with body: { fys: number[] }',
    example: 'POST /api/backfill { "fys": [2020, 2021, 2022] }',
    available_fys: Object.keys(FY_DATE_RANGES).map(Number),
    note: 'FY2021 backfill may take 4-6 hours. Run one FY at a time for large years.',
  });
}