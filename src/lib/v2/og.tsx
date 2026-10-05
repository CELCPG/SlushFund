import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { MONEY_TYPES, type MoneyType } from '@/lib/v2/money';

/**
 * OG / share card template (1200×630), Direction C.
 *
 * A figure is drawn only when it comes with its source and as-of date
 * (design rule 3): pass stat without source and the stat is dropped.
 */
export interface OgCardOptions {
  title: string;
  eyebrow?: string;
  stat?: string;
  statLabel?: string;
  type?: MoneyType;
  source?: string;
  asOf?: string;
}

export const OG_SIZE = { width: 1200, height: 630 };

const FONT_DIR = join(process.cwd(), 'src', 'assets', 'fonts');

/** Cut a caption at a word boundary with an ellipsis, never mid-word (A8b N10b). */
export function clipWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

async function fonts() {
  const [display, body] = await Promise.all([
    readFile(join(FONT_DIR, 'BricolageGrotesque-ExtraBold.ttf')),
    readFile(join(FONT_DIR, 'Inter-SemiBold.ttf')),
  ]);
  return [
    { name: 'Bricolage', data: display, weight: 800 as const, style: 'normal' as const },
    { name: 'Inter', data: body, weight: 600 as const, style: 'normal' as const },
  ];
}

export async function renderOgCard(opts: OgCardOptions): Promise<ImageResponse> {
  const title = opts.title.slice(0, 120);
  const m = opts.type ? MONEY_TYPES[opts.type] : null;
  const showStat = Boolean(opts.stat && opts.source);
  const titleSize = title.length > 80 ? 54 : title.length > 50 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          backgroundColor: '#1D1A4E',
          backgroundImage: 'radial-gradient(900px 420px at 88% -10%, #3B2F9A 0%, rgba(29,26,78,0) 60%)',
          padding: '56px 64px', fontFamily: 'Inter', color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontFamily: 'Bricolage', fontSize: 44, letterSpacing: -1 }}>
            <span>Slush</span><span style={{ color: '#FF5A6E' }}>Fund</span>
          </div>
          {opts.eyebrow && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 24,
                padding: '8px 20px 8px 8px', borderRadius: 999,
                backgroundColor: m ? m.tintHex : 'rgba(255,255,255,0.14)', color: m ? '#14142B' : '#FFFFFF',
              }}
            >
              {m && (
                <span style={{ display: 'flex', width: 34, height: 34, borderRadius: 9, backgroundColor: m.hex, color: '#FFFFFF', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {m.letter}
                </span>
              )}
              <span>{opts.eyebrow.slice(0, 40)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div style={{ display: 'flex', fontFamily: 'Bricolage', fontSize: titleSize, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: showStat ? 700 : 1060 }}>
            {title}
          </div>
          {showStat && (
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginLeft: 'auto', width: 340, padding: '26px 28px',
                borderRadius: 28, backgroundColor: m ? m.hex : '#FFFFFF', color: m ? '#FFFFFF' : '#14142B',
              }}
            >
              {m && <div style={{ display: 'flex', fontSize: 20, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.95 }}>{m.label}</div>}
              <div style={{ display: 'flex', fontFamily: 'Bricolage', fontSize: 72, lineHeight: 1.05, marginTop: 6 }}>{opts.stat!.slice(0, 12)}</div>
              {opts.statLabel && <div style={{ display: 'flex', fontSize: 22, marginTop: 6, lineHeight: 1.25 }}>{clipWords(opts.statLabel, 60)}</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: '#D9D8F2' }}>
          <span style={{ display: 'flex' }}>
            {showStat ? `Source: ${opts.source!.slice(0, 60)}${opts.asOf ? ` · as of ${opts.asOf.slice(0, 24)}` : ''}` : 'Public records only. Every number links to its filing.'}
          </span>
          <span style={{ display: 'flex', color: '#FFFFFF' }}>slushfund.net</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
