// Donation tiers for the /support page.
//
// Each tier links to a Stripe Payment Link you create in the Stripe Dashboard
// (Products → Payment Links). Paste each URL into the matching env var in
// Vercel. Any tier without its own URL falls back to NEXT_PUBLIC_STRIPE_SUPPORT_URL
// (a single general donate link), so you can launch with one link and add the
// rest later. Tiers with no URL at all render but point at the fallback (or "#").

export interface DonationTier {
  id: string;
  amount: string;
  /** Short caption under the amount. */
  blurb: string;
  url?: string;
  featured?: boolean;
}

const FALLBACK = process.env.NEXT_PUBLIC_STRIPE_SUPPORT_URL;

export const ONE_TIME_TIERS: DonationTier[] = [
  { id: 'once-5', amount: '$5', blurb: 'Buy us a coffee', url: process.env.NEXT_PUBLIC_STRIPE_ONCE_5 ?? FALLBACK },
  { id: 'once-25', amount: '$25', blurb: 'Fund a data refresh', url: process.env.NEXT_PUBLIC_STRIPE_ONCE_25 ?? FALLBACK, featured: true },
  { id: 'once-100', amount: '$100', blurb: 'Back an investigation', url: process.env.NEXT_PUBLIC_STRIPE_ONCE_100 ?? FALLBACK },
];

export const MONTHLY_TIERS: DonationTier[] = [
  { id: 'mo-5', amount: '$5/mo', blurb: 'Supporter', url: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_5 ?? FALLBACK },
  { id: 'mo-15', amount: '$15/mo', blurb: 'Watchdog', url: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_15 ?? FALLBACK, featured: true },
  { id: 'mo-50', amount: '$50/mo', blurb: 'Whistleblower', url: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_50 ?? FALLBACK },
];

/** Resolve a tier's checkout href, falling back to the general link or "#". */
export function tierHref(tier: DonationTier): string {
  return tier.url ?? '#';
}
