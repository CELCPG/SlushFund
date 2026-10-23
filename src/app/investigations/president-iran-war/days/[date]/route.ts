import { iranWarStoryLive } from '@/lib/v2/flags';
import { getDayPayloads, timelineDates } from '@/lib/v2/iran-war';
import { DRAFT_UNTIL_AW1 } from '@/lib/v2/iran-war-copy';

export const revalidate = 3600;
export const dynamicParams = false;

// W2: one day of the timeline (the chronology entries and the securities transactions for that date), fetched when a day is opened.
// Refuses like the page: flag off, or draft copy on the production deployment.
export function generateStaticParams() {
  return timelineDates().map((date) => ({ date }));
}

const NOT_FOUND = () => new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  if (!iranWarStoryLive(DRAFT_UNTIL_AW1)) return NOT_FOUND();
  const { date } = await params;
  const days = await getDayPayloads();
  if (!days) return new Response(JSON.stringify({ error: 'Figures unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  const day = days.get(date);
  if (!day) return NOT_FOUND();
  return new Response(JSON.stringify(day), { headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Robots-Tag': 'noindex' } });
}
