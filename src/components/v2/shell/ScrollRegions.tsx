'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const SCROLLERS = '.overflow-x-auto, .overflow-y-auto, .overflow-auto';

/** A name for a scroll box: its table caption, its chart's label, else the heading it sits under. */
function nameFor(el: HTMLElement): string {
  const caption = el.querySelector('caption')?.textContent?.trim();
  if (caption) return caption.slice(0, 120);
  const chart = el.querySelector('[role="img"][aria-label]')?.getAttribute('aria-label');
  if (chart) return chart.slice(0, 120);
  const heading = el.closest('section, article, [data-v2]')?.querySelector('h2, h3, h1')?.textContent?.trim();
  return heading ? heading.slice(0, 100) : 'Scrollable content';
}

/**
 * Makes every box that scrolls sideways (wide tables, charts) reachable and named for keyboard and
 * screen-reader users, only while it actually overflows: no extra tab stop when everything fits.
 * WCAG 2.1.1; axe rule scrollable-region-focusable. Boxes that already set a tabindex or role are left alone.
 */
export default function ScrollRegions() {
  const pathname = usePathname();
  useEffect(() => {
    const ours = new WeakSet<HTMLElement>();
    const watched = new WeakSet<Element>();
    const sync = (el: HTMLElement) => {
      const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (scrolls && !ours.has(el)) {
        if (el.hasAttribute('tabindex') || el.hasAttribute('role')) return;
        el.tabIndex = 0;
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', nameFor(el));
        ours.add(el);
      } else if (!scrolls && ours.has(el)) {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        ours.delete(el);
      }
    };
    const ro = new ResizeObserver((entries) => entries.forEach((e) => e.target instanceof HTMLElement && sync(e.target.closest<HTMLElement>(SCROLLERS) ?? e.target)));
    const scan = () => {
      for (const el of document.querySelectorAll<HTMLElement>(SCROLLERS)) {
        if (!watched.has(el)) {
          watched.add(el);
          ro.observe(el);
          if (el.firstElementChild) ro.observe(el.firstElementChild);
        }
        sync(el);
      }
    };
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', later);
    };
  }, [pathname]);
  return null;
}
