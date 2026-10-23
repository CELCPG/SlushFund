import { iranWarStoryLive } from '@/lib/v2/flags';
import { DRAFT_UNTIL_AW1 } from '@/lib/v2/iran-war-copy';
import { chronologyFile } from '@/lib/v2/iran-war-files';

export const dynamic = 'force-static';

// W2: the frozen chronology (pre-registration "Chronology freeze"), served byte for byte so its sha256 is the one the page prints.
export function GET() {
  if (!iranWarStoryLive(DRAFT_UNTIL_AW1)) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  const { bytes, ok } = chronologyFile();
  if (!ok) return new Response('Figures unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="iran-war-chronology.csv"', 'Cache-Control': 'public, max-age=3600' },
  });
}
