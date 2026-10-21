'use client';

import { useId, useState } from 'react';

/**
 * Download PNG (the page's own SVG, drawn on a 1200x1200 canvas in the browser: nothing is uploaded) and the embed-code box.
 * The fonts are fetched from /fonts and inlined as data URLs so the PNG matches what is on screen.
 */
const FACES: [string, string, number][] = [
  ['SFDisplay', '/fonts/BricolageGrotesque-ExtraBold.ttf', 800],
  ['SFBody', '/fonts/Inter-SemiBold.ttf', 600],
];

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function GraphicActions({ svgId, filename, embedCode, cardHref }: { svgId: string; filename: string; embedCode: string; cardHref: string }) {
  const [status, setStatus] = useState('');
  const ta = useId();

  async function download() {
    setStatus('Preparing the image…');
    try {
      const svg = document.getElementById(svgId) as SVGSVGElement | null;
      if (!svg) throw new Error('graphic not found');
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '1200');
      clone.setAttribute('height', '1200');
      clone.removeAttribute('style');
      const css = await Promise.all(
        FACES.map(async ([family, url, weight]) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error('font');
          return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${b64(await res.arrayBuffer())}) format('truetype');}`;
        }),
      );
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = css.join('');
      clone.insertBefore(style, clone.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise<void>((ok, bad) => {
        img.onload = () => ok();
        img.onerror = () => bad(new Error('image'));
        img.src = url;
      });
      await img.decode().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 150)); // let the inlined faces finish loading before the first draw
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(img, 0, 0, 1200, 1200);
      URL.revokeObjectURL(url);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('png');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus('Saved as ' + filename);
    } catch {
      setStatus('The image could not be made in this browser. Use the 1200×1200 card link instead.');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setStatus('Embed code copied.');
    } catch {
      (document.getElementById(ta) as HTMLTextAreaElement | null)?.select();
      setStatus('Select the code and copy it.');
    }
  }

  return (
    <div className="gfx-actions gfx-hide-print" data-section="graphic-actions">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={download} className="h-11 rounded-xl bg-brand px-5 text-[15px] font-bold text-white hover:brightness-110">Download PNG</button>
        <a href={cardHref} className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-[15px] font-bold hover:bg-neutral-tint">Open the 1200&times;1200 card</a>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-[20px] text-[13px] text-muted">{status}</p>
      <label htmlFor={ta} className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Embed code</label>
      <textarea id={ta} readOnly rows={4} value={embedCode} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-xl border border-line bg-page p-3 font-mono text-[12.5px] text-ink" />
      <button type="button" onClick={copy} className="mt-2 h-10 rounded-xl border border-line px-4 text-[14px] font-bold hover:bg-neutral-tint">Copy embed code</button>
    </div>
  );
}
