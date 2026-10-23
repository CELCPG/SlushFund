import { iranWarStoryLive } from '@/lib/v2/flags';
import { getIssuerCsv } from '@/lib/v2/iran-war';
import { DRAFT_UNTIL_AW1 } from '@/lib/v2/iran-war-copy';

export const revalidate = 3600;

// W2: the issuer map, read live from issuer_classification (every issuer, its group, the evidence link and who decided it).
export async function GET() {
  if (!iranWarStoryLive(DRAFT_UNTIL_AW1)) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  const csv = await getIssuerCsv();
  if (!csv) return new Response('Figures unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  return new Response(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="iran-war-issuer-map.csv"', 'Cache-Control': 'public, max-age=3600' },
  });
}
