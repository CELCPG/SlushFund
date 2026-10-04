import { sentence } from '@/components/v2/AwardsTable';
import { fmtDate, fmtRange, fmtUsd } from '@/lib/v2/format';
import { dateFlagNote } from '@/lib/v2/date-flags';
import { instrumentKind, optionDetail, ownerLabel, tradeSentence } from '@/lib/v2/instruments';
import { getLatestForFeed, type LatestItem } from '@/lib/v2/latest';

// D6b: the feed carries data items only (new trade reports and new awards), each linking to the
// official record. No stories, no rankings. When the database does not answer it is valid but empty.
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

function itemXml(item: LatestItem): string {
  const pubDate = new Date(`${item.date}T12:00:00Z`).toUTCString();
  if (item.kind === 'trade') {
    const t = item.trade;
    const range = fmtRange(t.amount_min, t.amount_max, t.amount_range);
    const kind = instrumentKind(t);
    const owner = ownerLabel(t.owner);
    const flag = dateFlagNote(t.date_flag);
    const title = `${t.member_name} (${t.member_chamber}): ${tradeSentence(t)}`;
    const parts = [
      `${t.ticker} ${t.company_name}`.trim() + (kind === 'option' ? ` (${optionDetail(t) ?? 'options'})` : ''),
      range ? `Amount: ${range}` : 'Amount not disclosed',
      owner ? `Owner: ${owner}` : null,
      `Traded ${fmtDate(t.transaction_date)}; first reported ${fmtDate(item.date)}`,
      flag,
      t.bio_guide_id ? `Member page: ${SITE}/people/${t.bio_guide_id}` : null,
    ].filter(Boolean);
    const link = t.disclosure_url ?? `${SITE}/latest`;
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">slushfund:trade:${escapeXml(t.id)}</guid>
      <description>${escapeXml(parts.join('. ').replace(/\.\.+/g, '.') + '.')}</description>
      <category>Congressional trade report</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  }
  const a = item.award;
  const extent = sentence(a.extent_competed);
  const title = `${a.recipient_name ?? 'Recipient not stated'}: contract award${a.obligated_amount != null ? `, ${fmtUsd(a.obligated_amount)} obligated to date` : ''}`;
  const parts = [
    a.description,
    a.awarding_agency ? `Agency: ${a.awarding_agency}` : null,
    extent,
    `Signed ${fmtDate(item.date)}${a.fiscal_year ? ` (FY${a.fiscal_year})` : ''}`,
    a.award_id ? `Award ID ${a.award_id}` : null,
  ].filter(Boolean);
  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(a.usaspending_url ?? `${SITE}/latest`)}</link>
      <guid isPermaLink="false">slushfund:award:${escapeXml(a.id)}</guid>
      <description>${escapeXml(parts.join('. ').replace(/\.\.+/g, '.') + '.')}</description>
      <category>Contract award</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
}

export async function GET() {
  let items = '';
  try {
    const latest = await getLatestForFeed(50);
    items = (latest ?? []).map(itemXml).join('\n');
  } catch (err) {
    console.error('latest.xml error:', err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SlushFund: latest filings and awards</title>
    <link>${SITE}/latest</link>
    <description>New stock-trade reports filed by members of Congress (House Clerk, Senate eFD) and new federal contract awards (USAspending.gov), newest first. Every item links to the official record.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/latest.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900',
    },
  });
}
