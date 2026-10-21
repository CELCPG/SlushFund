/**
 * D13 visual themes, picked at build/run time by env SITE_THEME (current | t1 | t2 | t3). `current` (the default and
 * anything unrecognised) is Direction C exactly as shipped: no data-theme attribute, no extra font classes, no markup
 * change. The themes only swap design tokens and a few component hooks in globals.css; no wording changes with them.
 */
export const SITE_THEMES = ['current', 't1', 't2', 't3'] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];

export function siteTheme(): SiteTheme {
  const v = (process.env.SITE_THEME ?? '').trim().toLowerCase();
  return (SITE_THEMES as readonly string[]).includes(v) ? (v as SiteTheme) : 'current';
}

/** True for t1-t3: pages that place a figure differently (the homepage hero) read this. */
export function themed(): boolean {
  return siteTheme() !== 'current';
}
