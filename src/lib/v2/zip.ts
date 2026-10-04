import 'server-only';
import zctaData from '@/data/zcta-cd119.json';

/**
 * ZIP → 119th Congress district(s), from the Census ZCTA relationship file (built by
 * scripts/build-zcta-cd119.mjs into src/data/zcta-cd119.json, ~307 KB, server only).
 * ZCTAs approximate ZIP codes; PO-box-only ZIPs have no tabulation area.
 */

export const ZCTA_SOURCE = {
  name: 'U.S. Census Bureau, 119th Congressional District to 2020 ZCTA relationship file',
  url: 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_zcta520_natl.txt',
};

export interface DistrictCandidate {
  state: string;
  /** "5", "0" (at-large) or "98" (non-voting delegate seat). */
  district: string;
  /** Share of the ZIP area's land in this district, whole percent. */
  landPct: number;
}

/** Districts a 5-digit ZIP's tabulation area falls in, largest land share first; [] if not in the file. */
export function lookupZip(zip: string): DistrictCandidate[] | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const block = (zctaData as Record<string, string>)[zip.slice(0, 3)];
  if (!block) return [];
  const tail = zip.slice(3);
  const entry = block.split('|').find((e) => e.startsWith(tail));
  if (!entry) return [];
  return entry.slice(2).split(',').map((p) => {
    const [code, pct] = p.split('@');
    return { state: code.slice(0, 2), district: String(Number(code.slice(2))), landPct: pct ? Number(pct) : 100 };
  });
}

