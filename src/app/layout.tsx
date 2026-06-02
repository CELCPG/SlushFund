import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'SlushFund — Federal Spending Tracker',
    template: '%s | SlushFund',
  },
  description: 'Tracking federal contracts, grants, and congressional stock trades linked to political connections. Your taxes. Your 401k. Their slush fund.',
  metadataBase: new URL('https://slushfund.net'),
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'SlushFund — Investigations' }],
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://slushfund.net',
    siteName: 'SlushFund',
    title: 'SlushFund — Federal Spending Tracker',
    description: 'Tracking federal contracts, grants, and congressional stock trades linked to political connections.',
    images: [
      {
        url: 'https://slushfund.net/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SlushFund — Federal Spending Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@slushfund',
    creator: '@slushfund',
    title: 'SlushFund — Federal Spending Tracker',
    description: 'Tracking federal contracts, grants, and congressional stock trades linked to political connections.',
    images: ['https://slushfund.net/og-image.png'],
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
      { url: '/favicon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/favicon-256.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const snipcartKey = process.env.NEXT_PUBLIC_SNIPCART_API_KEY;
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        {snipcartKey && (
          <link rel="stylesheet" href="https://cdn.snipcart.com/themes/v3.7.1/default/snipcart.css" />
        )}
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        <Navbar />
        <main className="min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
        <Footer />
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