import { SIZE, type Scene } from '@/lib/v2/graphics-scene';

/**
 * Draws a graphics scene as one responsive inline SVG (viewBox 1200x1200). Text uses the SFDisplay / SFBody faces declared in
 * globals.css (the same two files the share card uses), so the page, the PNG download and the share card match. The SVG is the
 * image; the data table next to it is its text alternative.
 */
export const FONT_D = "SFDisplay, Impact, 'Arial Black', sans-serif";
export const FONT_B = "SFBody, 'Helvetica Neue', Arial, sans-serif";

export default function SceneSvg({ scene, id, className }: { scene: Scene; id: string; className?: string }) {
  return (
    <svg id={id} className={className} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={scene.label} style={{ display: 'block', width: '100%', height: 'auto' }}>
      {scene.prims.map((p, i) => {
        if (p.k === 'rect') {
          return (
            <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash}>
              {p.title && <title>{p.title}</title>}
            </rect>
          );
        }
        if (p.k === 'vline') return <line key={i} x1={p.x} y1={p.y1} x2={p.x} y2={p.y2} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash} />;
        return (
          <text key={i} x={p.x} y={p.y} fontSize={p.size} fill={p.fill} textAnchor={p.anchor} fontFamily={p.font === 'd' ? FONT_D : FONT_B} fontWeight={p.font === 'd' ? 800 : 600} letterSpacing={p.ls || undefined}>
            {p.text}
          </text>
        );
      })}
    </svg>
  );
}
