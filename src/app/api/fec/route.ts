import { NextRequest, NextResponse } from 'next/server';
import { getCommittee, getCommitteeTotals, getTopDonors, fecConfigured } from '@/lib/fec';

// GET /api/fec?committee_id=C00835959&cycle=2024
// Returns live FEC committee identity + financial totals.
// Degrades gracefully: if FEC_API_KEY is unset or FEC errors, returns
// { configured: false } / { error } so the UI can fall back to curated data.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const committeeId = searchParams.get('committee_id')?.trim();
  const cycle = Number(searchParams.get('cycle') ?? '2024');

  if (!committeeId || !/^C\d{8}$/.test(committeeId)) {
    return NextResponse.json(
      { error: 'Provide a valid FEC committee_id (format: C00000000)' },
      { status: 400 },
    );
  }

  // ?donors=false skips the slower Schedule A lookup.
  const wantDonors = searchParams.get('donors') !== 'false';

  try {
    const [committee, totals, donors] = await Promise.all([
      getCommittee(committeeId),
      getCommitteeTotals(committeeId, cycle),
      wantDonors ? getTopDonors(committeeId, cycle).catch(() => []) : Promise.resolve([]),
    ]);

    if (!committee && !totals) {
      return NextResponse.json(
        { configured: fecConfigured, error: 'No FEC records for that committee' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      configured: fecConfigured,
      committee,
      totals,
      top_donors: donors,
      verified: fecConfigured && Boolean(totals),
    });
  } catch (err) {
    console.error('FEC API error:', err);
    return NextResponse.json(
      { configured: fecConfigured, error: 'Failed to fetch FEC data' },
      { status: 502 },
    );
  }
}
