import { getLatest } from '@/lib/latest';

export const dynamic = 'force-dynamic';

const SITE = 'https://slushfund.net';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let items = '';
  try {
    const latest = await getLatest(50);
    items = latest
      .map((item) => {
        const url = `${SITE}${item.href}`;
        const pubDate = new Date(`${item.date}T12:00:00Z`).toUTCString();
        const cats = item.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('');
        return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${pubDate}</pubDate>
      ${cats}
    </item>`;
      })
      .join('\n');
  } catch (err) {
    console.error('latest.xml error:', err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SlushFund — Latest Activity</title>
    <link>${SITE}/latest</link>
    <description>The newest high-risk federal contracts and notable congressional stock trades.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/latest.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
