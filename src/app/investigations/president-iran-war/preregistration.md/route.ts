import { iranWarStoryLive } from '@/lib/v2/flags';
import { DRAFT_UNTIL_AW1 } from '@/lib/v2/iran-war-copy';
import { PREREG_MD_B64 } from '@/lib/v2/iran-war-prereg-file';

export const dynamic = 'force-static';

// W2: the pre-registration (w1-iran-war-preregistration.md) with its dated amendments, as written.
export function GET() {
  if (!iranWarStoryLive(DRAFT_UNTIL_AW1)) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  return new Response(new Uint8Array(Buffer.from(PREREG_MD_B64, 'base64')), {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': 'inline; filename="iran-war-preregistration.md"', 'Cache-Control': 'public, max-age=3600' },
  });
}
