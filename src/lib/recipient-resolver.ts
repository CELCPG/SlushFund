// Maps a free-text recipient name from USAspending to a canonical entity
// slug from /lib/entities.ts, if one exists. Case-insensitive substring
// match against each entity's `spending.recipientPatterns`.

import { ENTITIES, type EntityConfig } from './entities';

interface ResolvedEntity {
  slug: string;
  name: string;
  connection: string;
}

const cache = new Map<string, ResolvedEntity | null>();

/**
 * Returns the canonical entity for a given recipient name, or null if
 * no entity in our 15-entity list matches. Result is memoized.
 */
export function resolveEntityFromRecipient(recipientName: string | null | undefined): ResolvedEntity | null {
  if (!recipientName) return null;
  const key = recipientName.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const result = doResolve(key);
  cache.set(key, result);
  return result;
}

function doResolve(recipientLower: string): ResolvedEntity | null {
  for (const e of ENTITIES) {
    for (const pattern of e.spending.recipientPatterns) {
      if (recipientLower.includes(pattern.toLowerCase())) {
        return { slug: e.slug, name: e.name, connection: e.connection };
      }
    }
  }
  return null;
}

/** Returns the URL a recipient name should link to. */
export function recipientHref(recipientName: string | null | undefined, contractId: string): string {
  const entity = resolveEntityFromRecipient(recipientName);
  return entity ? `/entity/${entity.slug}` : `/contract/${contractId}`;
}
