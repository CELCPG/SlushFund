'use client';

/**
 * Plausible event helper. Renders nothing visible.
 *
 * Usage in a client component:
 *   <button onClick={() => trackEvent('loop_step_click', { step: 3 })}>
 *
 * Usage in a link:
 *   <PlausibleLink event="entity_page_view" data={{ slug: 'spacex' }} href="/entity/spacex">
 *
 * Plausible's `plausible()` is loaded by the script in the root layout, so we
 * just call it. If the script is not present (e.g. in tests), the call is a
 * no-op because the function is undefined.
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  if (typeof window.plausible !== 'function') return;
  try {
    window.plausible(name, props ? { props } : undefined);
  } catch {
    // Swallow — analytics should never break UX.
  }
}

import Link from 'next/link';
import { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type PlausibleEvent = {
  /** Plausible event name (e.g. 'entity_page_view'). */
  event: string;
  /** Optional key-value props attached to the event. */
  data?: Record<string, string | number | boolean>;
};

type LinkProps = PlausibleEvent & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type ButtonProps = PlausibleEvent & ButtonHTMLAttributes<HTMLButtonElement>;

/** <a> wrapper that fires a Plausible event on click. */
export function PlausibleLink({ event, data, onClick, ...rest }: LinkProps) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        trackEvent(event, data);
        onClick?.(e);
      }}
    />
  );
}

/** <button> wrapper that fires a Plausible event on click. */
export function PlausibleButton({ event, data, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type={rest.type ?? 'button'}
      {...rest}
      onClick={(e) => {
        trackEvent(event, data);
        onClick?.(e);
      }}
    />
  );
}
