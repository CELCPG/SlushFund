import { NextResponse } from 'next/server';

// RETIRED (R5, 2026-10-03). This route kept only a hand-picked "notable" sample of
// awards (political-connection match, risk score >= 55, ...), never received the
// extent-competed field from USAspending's search API (so every row was labelled
// open competition), and upserted on the PIID, which is not unique.
// Awards now load with src/scripts/load_awards.py under a documented selection rule
// (openclaw-shared/projects/slushfund/r5-awards.md); the daily incremental is
// `load_awards.py incremental`, meant for a GitHub Actions job.
// It returns 410 so the Vercel cron in vercel.json fails loudly instead of writing.
export async function GET() {
  return NextResponse.json(
    {
      error: 'retired',
      detail: 'Awards are loaded by src/scripts/load_awards.py (rule r5-v1). Run `python src/scripts/load_awards.py incremental` instead.',
    },
    { status: 410 },
  );
}
