// Builds src/data/zcta-cd119.json: ZIP Code Tabulation Area (ZCTA5) → 119th Congress district(s).
//
//   node scripts/build-zcta-cd119.mjs [local-copy.txt]
//
// Source (official, U.S. Census Bureau, 2020 relationship files):
//   https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_zcta520_natl.txt
// One row per (district, ZCTA) piece. We keep pieces with land area (AREALAND_PART > 0) and store
// each district's share of the ZCTA's land area as a whole percent, so a ZIP that spans districts
// lists every candidate, largest land share first. Land area is not population: the page says so.
//
// Output format (compact, ~330 KB): { "<3-digit prefix>": "<last 2 digits><ST><DD>[@pct][,<ST><DD>[@pct]]|..." }
// DD is the district number ("00" = at-large, "98" = non-voting delegate seat). @pct is omitted when 100.
import { readFileSync, writeFileSync } from 'node:fs';

export const SOURCE_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_zcta520_natl.txt';
const FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};

const text = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SOURCE_URL)).text();
const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const head = lines.shift().split('|');
const col = (n) => head.indexOf(n);
const iCd = col('GEOID_CD119_20'), iZ = col('GEOID_ZCTA5_20'), iLand = col('AREALAND_PART');
if ([iCd, iZ, iLand].includes(-1)) throw new Error('unexpected header: ' + head.join('|'));

const byZip = new Map();
for (const l of lines) {
  const f = l.split('|');
  const zip = f[iZ], cd = f[iCd], land = Number(f[iLand]) || 0;
  if (!zip || !/^\d{5}$/.test(zip) || !/^\d{2}(\d{2})$/.test(cd)) continue; // skips ZZ (water-only) pieces
  const st = FIPS[cd.slice(0, 2)];
  if (!st) continue;
  const m = byZip.get(zip) ?? new Map();
  m.set(st + cd.slice(2), (m.get(st + cd.slice(2)) ?? 0) + land);
  byZip.set(zip, m);
}

const out = {};
let pairs = 0, multi = 0;
for (const zip of [...byZip.keys()].sort()) {
  const m = byZip.get(zip);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  let parts = [...m.entries()].filter(([, land]) => land > 0 || total === 0).sort((a, b) => b[1] - a[1]);
  const enc = parts.map(([d, land]) => {
    const pct = total ? Math.round((land / total) * 100) : null;
    return pct == null || pct >= 100 ? d : `${d}@${Math.max(pct, 0)}`;
  });
  pairs += parts.length;
  if (parts.length > 1) multi++;
  const p = zip.slice(0, 3);
  out[p] = (out[p] ? out[p] + '|' : '') + zip.slice(3) + enc.join(',');
}
const json = JSON.stringify(out);
writeFileSync(new URL('../src/data/zcta-cd119.json', import.meta.url), json + '\n');
console.log(`ZCTAs ${byZip.size} · pairs ${pairs} · spanning 2+ districts ${multi} · ${json.length} bytes`);
