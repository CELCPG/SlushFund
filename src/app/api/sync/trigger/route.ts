import { NextResponse } from 'next/server';

// RETIRED (R5, 2026-10-03): it ran lib/sync.ts fullBackfill(). See src/app/api/backfill/route.ts.
export async function POST() {
  return NextResponse.json(
    {
      error: 'retired',
      detail: 'Backfill with `python src/scripts/load_awards.py load --fy <year>` (rule r5-v1).',
    },
    { status: 410 },
  );
}
