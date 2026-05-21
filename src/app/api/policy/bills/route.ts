import { NextRequest, NextResponse } from 'next/server';
import { BILLS, ROLL_CALL_VOTES, REGULATORY_ACTIONS } from '@/lib/policy-data';
import { getLiveBillStatus, congressGovConfigured } from '@/lib/congress-gov';

// GET /api/policy/bills            → all curated bills + votes + regulatory actions
// GET /api/policy/bills?id=HR-4763-118  → one bill, with live Congress.gov status merged in
//
// Always returns curated data. When CONGRESS_GOV_API_KEY is set, each bill is
// enriched with a `live` block; otherwise `live` is null and `configured` is false.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim();

  if (id) {
    const bill = BILLS.find((b) => b.bill_id === id);
    if (!bill) {
      return NextResponse.json({ error: 'Unknown bill id' }, { status: 404 });
    }
    let live = null;
    try {
      live = await getLiveBillStatus(id);
    } catch (err) {
      console.error('Congress.gov enrichment failed:', err);
    }
    return NextResponse.json({
      configured: congressGovConfigured,
      bill,
      votes: ROLL_CALL_VOTES.filter((v) => v.bill_id === id),
      live,
    });
  }

  return NextResponse.json({
    configured: congressGovConfigured,
    bills: BILLS,
    votes: ROLL_CALL_VOTES,
    regulatory_actions: REGULATORY_ACTIONS,
  });
}
