import { NextResponse } from 'next/server';
import { FY_DATE_RANGES } from '@/lib/era';
// Re-exported for backwards-compatibility with any other route still
// importing it from this file.
export { FY_DATE_RANGES };

// RETIRED (R5, 2026-10-03). fullBackfill() in lib/sync.ts had no amount filter,
// upserted one award per request on the non-unique PIID, and would have walked
// millions of FY2024-26 awards. Use `python src/scripts/load_awards.py load --fy N`
// (openclaw-shared/projects/slushfund/r5-awards.md).
const retired = () =>
  NextResponse.json(
    {
      error: 'retired',
      detail: 'Backfill with `python src/scripts/load_awards.py load --fy <year>` (rule r5-v1).',
    },
    { status: 410 },
  );

export async function POST() {
  return retired();
}

export async function GET() {
  return retired();
}
