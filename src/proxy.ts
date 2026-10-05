import { NextResponse, type NextRequest } from 'next/server';
import { matchGatedApi, matchGatedPage, matchRetiredApi, matchWithdrawn } from '@/lib/v2/redirect-map';
import { resolveLegacyRedirect } from '@/lib/v2/legacy-redirects';
import { hiddenByFlag } from '@/lib/v2/flags';

/**
 * Trust gate (D5). Runs after the 301s in next.config.ts and before any page renders.
 *
 *  - A withdrawn story  -> /withdrawn, HTTP 410 (a rewrite, so the URL stays what the visitor asked for).
 *  - A page whose flag is off (the board, /design on production) -> the site's own 404 (a rewrite to an unmatched path; A9 N1).
 *  - A gated legacy page -> /rebuilding?from=<path>, HTTP 200, noindex.
 *  - A gated legacy API  -> HTTP 503 JSON, never the old data.
 *  - A retired write API -> HTTP 410 JSON.
 *  - An old member, senator-score, agency or vendor URL -> 301 to its new page after a lookup (D2).
 *
 * The lists live in src/lib/v2/redirect-map.ts. The old page code does not run for any of these.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /withdrawn itself is the destination of the rewrite; a direct visit is also a withdrawn page.
  if (matchWithdrawn(pathname) || pathname === '/withdrawn') {
    return NextResponse.rewrite(new URL('/withdrawn', request.url), {
      status: 410,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  // A9 N1: the page's own notFound() left a 404 with the page's title and canonical and no server-rendered body.
  if (hiddenByFlag(pathname)) {
    return NextResponse.rewrite(new URL('/_hidden-by-flag', request.url));
  }

  if (matchRetiredApi(pathname)) {
    return NextResponse.json(
      { error: 'retired', message: 'This endpoint has been retired. Data loads from official sources through scheduled loaders.' },
      { status: 410, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    );
  }

  if (matchGatedApi(pathname)) {
    return NextResponse.json(
      {
        error: 'unavailable',
        message: 'This endpoint is being rebuilt. Its figures have not been verified against official records yet.',
        status: 'https://slushfund.net/data/status',
      },
      { status: 503, headers: { 'Retry-After': '86400', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    );
  }

  const moved = resolveLegacyRedirect(pathname);
  if (moved) {
    return NextResponse.redirect(new URL(moved, request.url), 301);
  }

  const gated = matchGatedPage(pathname);
  if (gated) {
    const url = new URL('/rebuilding', request.url);
    url.searchParams.set('from', gated.path);
    return NextResponse.rewrite(url, { headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  return NextResponse.next();
}

export const config = {
  // Everything except build assets and image/font files. .xml routes stay in (the feeds are gated).
  matcher: ['/((?!_next/static|_next/image|favicon|apple-touch|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|txt|json)$).*)'],
};
