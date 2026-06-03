import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SLUSH_RED = '#E63946';

// Category → accent color, matching the on-site badge palette.
const CATEGORY_COLOR: Record<string, string> = {
  Investigation: '#10b981',
  'Dark Money': '#a855f7',
  'Insider Trading': '#ef4444',
  'Trump Trades': '#f97316',
};

/**
 * Reusable branded 1200×630 OG image generator.
 *
 * Query params:
 *   title    — main headline (required-ish; falls back to brand tagline)
 *   eyebrow  — small label above the title (e.g. category or "Investigation")
 *   stat     — optional big number/figure to feature (e.g. "$10B+")
 *   statLabel— caption under the stat
 *
 * Example: /api/og?title=The%20DOGE%20Contract%20Pipeline&eyebrow=Investigation&stat=$10B%2B&statLabel=to%20Musk%20companies
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'Your taxes. Your 401k. Their slush fund.').slice(0, 140);
  const eyebrow = (searchParams.get('eyebrow') || 'SlushFund Investigation').slice(0, 40);
  const stat = searchParams.get('stat')?.slice(0, 16);
  const statLabel = searchParams.get('statLabel')?.slice(0, 48);
  const accent = CATEGORY_COLOR[eyebrow] ?? SLUSH_RED;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0f',
          backgroundImage: `radial-gradient(circle at 80% 0%, ${accent}22 0%, transparent 45%)`,
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top: wordmark + eyebrow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                backgroundColor: SLUSH_RED,
                color: 'white',
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '34px',
                padding: '6px 16px',
                borderRadius: '8px',
              }}
            >
              SlushFund
            </div>
            <div style={{ display: 'flex', color: '#8a8a9a', fontSize: '24px' }}>slushfund.net</div>
          </div>
          <div
            style={{
              display: 'flex',
              color: accent,
              fontSize: '24px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '3px',
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: title.length > 80 ? '52px' : '66px',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-1.5px',
          }}
        >
          {title}
        </div>

        {/* Bottom: optional featured stat + accent bar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {stat ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', color: accent, fontSize: '72px', fontWeight: 900 }}>{stat}</div>
              {statLabel && (
                <div style={{ display: 'flex', color: '#aaaabc', fontSize: '26px' }}>{statLabel}</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', color: '#8a8a9a', fontSize: '26px' }}>
              Follow the money. It&apos;s all public.
            </div>
          )}
          <div style={{ display: 'flex', width: '180px', height: '10px', backgroundColor: accent, borderRadius: '5px' }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
