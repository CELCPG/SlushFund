import { POSTS_BY_DATE } from '@/lib/blog';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE = 'https://slushfund.net';
const TITLE = 'SlushFund — Investigations';
const DESCRIPTION =
  'Original reporting on federal spending, congressional stock trading, and political money flows. Your taxes. Your 401k. Their slush fund.';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const items = POSTS_BY_DATE.map((post) => {
    const url = `${SITE}/blog/${post.slug}`;
    const pubDate = new Date(`${post.date}T12:00:00Z`).toUTCString();
    const categories = post.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('');
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(post.author)}</dc:creator>
      ${categories}
    </item>`;
  }).join('\n');

  const lastBuild = POSTS_BY_DATE.length
    ? new Date(`${POSTS_BY_DATE[0].date}T12:00:00Z`).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE}/blog</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
