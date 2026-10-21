import { notFound } from 'next/navigation';
import { GRAPHIC_SLUGS, graphicEnabled } from '@/lib/v2/flags';
import { getDelayGraphic, getFundingGraphic, getGradeGraphic, getPresidentGraphic } from '@/lib/v2/graphics-data';
import { renderSceneImage } from '@/lib/v2/graphics-og';
import { C, SIZE, delayScene, fundingScene, gradeScene, presidentScene, type Scene } from '@/lib/v2/graphics-scene';
import { graphicBySlug } from '@/lib/v2/graphics-meta';

export const alt = 'SlushFund graphic: one story from the public records, with its source and the date the figures were retrieved.';
export const size = { width: SIZE, height: SIZE };
export const contentType = 'image/png';
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return GRAPHIC_SLUGS.map((slug) => ({ slug }));
}

// D20 share card: the square (1200x1200) version of the page's own graphic, drawn from the same live figures. When the database does
// not answer it is the title alone ("figures unavailable"), never a number.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = graphicBySlug(slug);
  if (!g || !graphicEnabled(slug)) notFound();
  let scene: Scene | null = null;
  switch (g.slug) {
    case 'grading-congress': { const d = await getGradeGraphic(); scene = d && gradeScene(d); break; }
    case 'where-the-money-comes-from': { const d = await getFundingGraphic(); scene = d && fundingScene(d); break; }
    case 'trading-while-disclosing': { const d = await getDelayGraphic(); scene = d && delayScene(d); break; }
    case 'the-presidents-trades': { const d = await getPresidentGraphic(); scene = d && presidentScene(d); break; }
  }
  return renderSceneImage(
    scene ?? {
      slug,
      label: g.title,
      prims: [
        { k: 'rect', x: 0, y: 0, w: SIZE, h: SIZE, fill: C.bg },
        { k: 'rect', x: 0, y: 0, w: SIZE, h: 12, fill: C.acc },
        { k: 'text', x: 60, y: 66, size: 28, fill: C.acc, text: 'SLUSHFUND.NET', font: 'd', anchor: 'start', ls: 3 },
        { k: 'text', x: 60, y: 560, size: 76, fill: C.ink, text: g.title.toUpperCase().slice(0, 28), font: 'd', anchor: 'start', ls: 0 },
        { k: 'text', x: 60, y: 640, size: 32, fill: C.muted, text: 'Figures unavailable right now.', font: 'b', anchor: 'start', ls: 0 },
        { k: 'text', x: 1140, y: 1166, size: 26, fill: C.acc, text: `slushfund.net/graphics/${slug}`, font: 'd', anchor: 'end', ls: 0 },
      ],
    },
  );
}
