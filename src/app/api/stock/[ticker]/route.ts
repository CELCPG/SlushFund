import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? '3mo';

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${upper}?interval=1d&range=${range}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      return NextResponse.json({ error: 'No data for ticker' }, { status: 404 });
    }

    const timestamps = result.timestamp as number[];
    const closes = result.indicators.quote[0].close as (number | null)[];
    const volumes = result.indicators?.quote?.[0]?.volume ?? [];

    const data = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        price: closes[i] ?? 0,
        volume: volumes[i] ?? 0,
      }))
      .filter(d => d.price > 0);

    const meta = result.meta;

    return NextResponse.json({
      ticker: upper,
      currency: meta.currency ?? 'USD',
      currentPrice: meta.regularMarketPrice ?? data[data.length - 1]?.price ?? 0,
      marketCap: meta.marketCap ?? null,
      data,
    });
  } catch (err) {
    console.error('Stock API error:', err);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}