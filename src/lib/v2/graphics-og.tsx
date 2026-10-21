import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { C, SIZE, type Scene } from '@/lib/v2/graphics-scene';

/**
 * Draws a graphics scene (graphics-scene.ts) as the 1200x1200 share image: the same rectangles and text as the page's SVG, laid
 * out as absolutely positioned boxes because the image renderer has no SVG text. Same two font files as the other share cards.
 */
const FONT_DIR = join(process.cwd(), 'src', 'assets', 'fonts');

async function fonts() {
  const [display, body] = await Promise.all([readFile(join(FONT_DIR, 'BricolageGrotesque-ExtraBold.ttf')), readFile(join(FONT_DIR, 'Inter-SemiBold.ttf'))]);
  return [
    { name: 'Bricolage', data: display, weight: 800 as const, style: 'normal' as const },
    { name: 'Inter', data: body, weight: 600 as const, style: 'normal' as const },
  ];
}

export async function renderSceneImage(scene: Scene): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: SIZE, height: SIZE, backgroundColor: C.bg }}>
        {scene.prims.map((p, i) => {
          if (p.k === 'rect') {
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, display: 'flex', boxSizing: 'border-box',
                  backgroundColor: p.fill ?? 'transparent', ...(p.stroke ? { border: `${p.sw ?? 1}px ${p.dash ? 'dashed' : 'solid'} ${p.stroke}` } : {}),
                }}
              />
            );
          }
          if (p.k === 'vline') {
            return <div key={i} style={{ position: 'absolute', left: p.x - p.sw / 2, top: p.y1, width: 0, height: p.y2 - p.y1, display: 'flex', borderLeft: `${p.sw}px dashed ${p.stroke}` }} />;
          }
          const top = p.y - p.size * 0.86;
          const base = {
            position: 'absolute' as const, top, display: 'flex', whiteSpace: 'nowrap' as const, fontSize: p.size, lineHeight: 1, color: p.fill, letterSpacing: p.ls,
            fontFamily: p.font === 'd' ? 'Bricolage' : 'Inter', fontWeight: p.font === 'd' ? 800 : 600,
          };
          const place = p.anchor === 'start' ? { left: p.x } : p.anchor === 'end' ? { right: SIZE - p.x } : { left: p.x - SIZE / 2, width: SIZE, justifyContent: 'center' as const };
          return <div key={i} style={{ ...base, ...place }}>{p.text}</div>;
        })}
      </div>
    ),
    { width: SIZE, height: SIZE, fonts: await fonts() },
  );
}
