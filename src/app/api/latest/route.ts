import { NextRequest, NextResponse } from 'next/server';
import { getLatest } from '@/lib/latest';

// GET /api/latest?limit=40 — newest flagged contracts + notable trades, merged.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '40'), 100);

  try {
    const items = await getLatest(limit);
    return NextResponse.json(
      { items, demo: items.length === 0 },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
    );
  } catch (err) {
    console.error('Latest feed error:', err);
    return NextResponse.json({ items: [], error: 'Failed to load latest activity' }, { status: 502 });
  }
}
