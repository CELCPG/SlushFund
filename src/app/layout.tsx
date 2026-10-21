import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@/lib/v2/seo';
import Script from 'next/script';
import { Anton, Bricolage_Grotesque, DM_Mono, Inter, JetBrains_Mono, Oswald, Space_Grotesk } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import AppShell from '@/components/v2/shell/AppShell';
import { siteTheme } from '@/lib/v2/theme';

// Direction C type: Bricolage Grotesque (headlines), Inter (body), DM Mono (figures).
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono', display: 'swap' });

// D13 theme faces (SIL OFL 1.1, self-hosted by next/font). Not preloaded and only attached when SITE_THEME picks a theme.
// display 'optional': unpreloaded, a 'swap' face arrives after first paint and re-wraps the uppercase headline (CLS 0.22
// on the t1 homepage). Once a theme is picked: keep only its faces, set preload: true and display: 'swap'.
const t1Display = Oswald({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-oswald', display: 'optional', preload: false });
const t2Display = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'optional', preload: false });
const t3Display = Space_Grotesk({ subsets: ['latin'], weight: ['700'], variable: '--font-space-grotesk', display: 'optional', preload: false });
const t3Mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-jetbrains', display: 'optional', preload: false });
const THEME_FONTS = { t1: t1Display.variable, t2: t2Display.variable, t3: `${t3Display.variable} ${t3Mono.variable}` } as const;

const DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  title: {
    default: 'SlushFund: follow public money',
    template: '%s | SlushFund',
  },
  description: DESCRIPTION,
  metadataBase: new URL('https://slushfund.net'),
  // No canonical and no og:url here (A8 N1): each page sets its own with pageMetadata() (src/lib/v2/seo.ts).
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'SlushFund. Investigations' }],
    },
  },
  // og:image comes from app/opengraph-image.tsx (v2 template).
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'SlushFund',
    title: 'SlushFund: follow public money',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    site: '@slushfund',
    creator: '@slushfund',
    title: 'SlushFund: follow public money',
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const snipcartKey = process.env.NEXT_PUBLIC_SNIPCART_API_KEY;
  const theme = siteTheme();
  const themeFonts = theme === 'current' ? '' : ` ${THEME_FONTS[theme]}`;
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}${themeFonts}`} data-theme={theme === 'current' ? undefined : theme}>
      <head>
        {snipcartKey && (
          <link rel="stylesheet" href="https://cdn.snipcart.com/themes/v3.7.1/default/snipcart.css" />
        )}
      </head>
      <body className="bg-page font-sans text-ink antialiased">
        <AppShell>{children}</AppShell>
        <Analytics />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            src={`https://plausible.io/js/script.js`}
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            strategy="afterInteractive"
          />
        )}
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}');
              `}
            </Script>
          </>
        )}
        {snipcartKey && (
          <>
            <Script
              id="snipcart-settings"
              strategy="afterInteractive"
            >{`window.SnipcartSettings = { publicApiKey: "${snipcartKey}", loadStrategy: "on-user-interaction" };`}</Script>
            <Script src="https://cdn.snipcart.com/themes/v3.7.1/default/snipcart.js" strategy="afterInteractive" />
            <div id="snipcart" data-api-key={snipcartKey} hidden />
          </>
        )}
      </body>
    </html>
  );
}
