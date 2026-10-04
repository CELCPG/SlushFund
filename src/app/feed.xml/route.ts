export const dynamic = 'force-static';
export const revalidate = 3600;

// D5: all 17 stories are withdrawn pending re-verification (takedown.md), so the feed is valid
// but empty. When a story returns after an Auditor GO, list it here (the old post list is in
// src/legacy/blog.ts and describes withdrawn stories: do not reuse it).
const SITE = 'https://slushfund.net';
const TITLE = 'SlushFund: Investigations';
const DESCRIPTION =
  'Investigations from SlushFund. Stories are being re-verified against official records and return one at a time.';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE}/investigations</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
