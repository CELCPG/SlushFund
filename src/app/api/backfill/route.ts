import { NextRequest, NextResponse } from 'next/server';
import { fullBackfill } from '@/lib/sync';
import { FY_DATE_RANGES } from '@/lib/era';
// Re-exported for backwards-compatibility with any other route still
// importing it from this file.
export { FY_DATE_RANGES };

// ─── Backfill endpoint ────────────────────────────────────────────────────────
//
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