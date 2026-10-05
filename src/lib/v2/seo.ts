import type { Metadata } from 'next';
import { HOME_HEADLINE_TEXT } from '@/lib/v2/home-copy';

/**
 * Per-page canonical URL, og:url, og:title/og:description and the matching Twitter text (A8 N1).
 *
 * Before D8d the root layout set `canonical: '/'` and `og:url` to the root, and every page that did not override them
 * told search engines it was the homepage. The root layout now sets neither; each page passes its own path here.
 * Pages shown under many addresses (the "being rebuilt" and "withdrawn" pages, reached by rewrite) pass `path: null`
 * and get no canonical and no og:url.
 *
 * Share image: a route with its own opengraph-image file passes `card: 'own'` and Next adds that file. Any other page
 * names its card explicitly, because a page-level openGraph replaces the inherited images. The default is the card
 * the page showed before D8d: the nearest one up its path (/about/*, /data/*, else the site card).
 */

export const SITE_TITLE = 'SlushFund: follow public money';
export const SITE_DESCRIPTION =
  'The stock trades members of Congress disclose and the federal contracts agencies award, from the official filings. Every number shows its source and when it was last updated.';

/** The section share cards (app/opengraph-image.tsx, app/about/…, app/data/…); their files take `alt` from here. */
export const SHARE_CARDS = {
  site: { url: '/opengraph-image', alt: `SlushFund: ${HOME_HEADLINE_TEXT.charAt(0).toLowerCase()}${HOME_HEADLINE_TEXT.slice(1)}` },
  about: { url: '/about/opengraph-image', alt: 'About SlushFund: methods, sources and corrections.' },
  data: { url: '/data/opengraph-image', alt: 'SlushFund data: congressional trades and federal contracts, each with its source and date.' },
} as const;
type Card = keyof typeof SHARE_CARDS;

export interface PageMeta {
  /** Site-relative path of this page ('/people/G000583'), or null for a page served under many addresses. */
  path: string | null;
  /** Page title; the root template adds " | SlushFund". Omit on the homepage. */
  title?: string;
  description?: string;
  robots?: Metadata['robots'];
  /** RSS feeds to advertise on this page. */
  feeds?: { url: string; title: string }[];
  /** 'own' when the route has an opengraph-image file; else a section card (default: the nearest up the path). */
  card?: Card | 'own';
}

function defaultCard(path: string | null): Card {
  if (path === '/about' || path?.startsWith('/about/')) return 'about';
  if (path === '/data' || path?.startsWith('/data/')) return 'data';
  return 'site';
}

export function pageMetadata({ path, title, description, robots, feeds, card = defaultCard(path) }: PageMeta): Metadata {
  const shareTitle = title ? `${title} | SlushFund` : SITE_TITLE;
  const text = description ?? SITE_DESCRIPTION;
  const images = card === 'own' ? undefined : [{ url: SHARE_CARDS[card].url, width: 1200, height: 630, alt: SHARE_CARDS[card].alt }];
  return {
    ...(title ? { title } : {}),
    description: text,
    alternates: {
      canonical: path,
      ...(feeds?.length ? { types: { 'application/rss+xml': feeds } } : {}),
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: 'SlushFund',
      ...(path ? { url: path } : {}),
      title: shareTitle,
      description: text,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: '@slushfund',
      creator: '@slushfund',
      title: shareTitle,
      description: text,
      ...(images ? { images } : {}),
    },
    ...(robots ? { robots } : {}),
  };
}
