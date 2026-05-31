// Vendor landing-page helpers, built on the curated POLITICAL_ENTITIES data.
// Powers the programmatic-SEO routes at /vendor/[slug] and the /vendors index.
import { POLITICAL_ENTITIES, CONNECTION_LABELS, type PoliticalEntity, type ConnectionCategory } from './political-entities';

/** URL-safe slug from a vendor name. e.g. "The Boring Company" → "the-boring-company". */
export function vendorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Vendor extends PoliticalEntity {
  slug: string;
  connectionLabel: string;
  /** All names to match contracts against (primary + aliases). */
  searchTerms: string[];
}

function toVendor(e: PoliticalEntity): Vendor {
  return {
    ...e,
    slug: vendorSlug(e.name),
    connectionLabel: CONNECTION_LABELS[e.connection_category],
    searchTerms: [e.name, ...e.aliases],
  };
}

/** Only company/org entities make sense as "vendor" contract pages (skip persons). */
export const VENDORS: Vendor[] = POLITICAL_ENTITIES
  .filter((e) => e.entity_type !== 'person')
  .map(toVendor);

export function getVendorBySlug(slug: string): Vendor | undefined {
  return VENDORS.find((v) => v.slug === slug);
}

export type { ConnectionCategory };
