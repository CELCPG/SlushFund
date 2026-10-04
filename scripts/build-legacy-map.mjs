// Builds src/lib/v2/legacy-map.generated.ts: the lookups the proxy needs to send pre-redesign URLs
// to their new homes (D2). Read-only: it reads the public tables with the anon key.
//
//   node scripts/build-legacy-map.mjs
//
//  people    old member slugs → bioguide id. /congress/members/<slug> was built from the trade row's
//            member_name (lowercase, spaces → "-", other characters dropped) and /score/<slug> from the
//            senator's name. We generate every plausible spelling from the official roster (full name,
//            first + last, without middle initials or suffix). A spelling two members share maps to
//            null, so the proxy sends it to /people?q=<name> instead of guessing.
//  agencies  old /agency/<awarding agency name> → toptier code, from contract_spending_summary.
//  vendors   old /vendor/<slug> (src/lib/vendors.ts) → D3 company slug, only when exactly one
//            USAspending parent record carries the vendor's name or alias (normalized); else /companies.
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
async function all(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${BASE}/rest/v1/${path}&offset=${from}&limit=1000`, { headers: H });
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    const d = await r.json();
    out.push(...d);
    if (d.length < 1000) return out;
  }
}

// ---- people
const legacySlug = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const ascii = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const roster = await all('congress_members?select=bioguide_id,name,first_name,last_name,suffix&bioguide_id=not.is.null&order=bioguide_id');
const people = new Map();
const add = (slug, id) => {
  if (!slug || slug.length < 3) return;
  if (people.has(slug) && people.get(slug) !== id) people.set(slug, null);
  else people.set(slug, id);
};
for (const m of roster) {
  const noSuffix = m.name.replace(/,?\s+(jr|sr|ii|iii|iv)\.?$/i, '');
  const noInitials = noSuffix.split(/\s+/).filter((t) => !/^[A-Z]\.?$/i.test(t.replace(/\.$/, '')) || t.length > 2).join(' ');
  const bare = noSuffix.split(/\s+/).filter((t) => !/^[A-Za-z]\.$/.test(t)).join(' ');
  const variants = new Set([
    m.name, noSuffix, noInitials, bare,
    `${m.first_name} ${m.last_name}`,
    m.suffix ? `${m.first_name} ${m.last_name} ${m.suffix}` : '',
  ].filter(Boolean));
  for (const v of variants) {
    add(legacySlug(v), m.bioguide_id);
    add(legacySlug(ascii(v)), m.bioguide_id);
  }
}

// ---- agencies
const agencyRows = await all('contract_spending_summary?select=agency_code,agency_name&order=agency_code');
const norm = (s) => ascii(String(s)).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const agencies = new Map();
for (const a of agencyRows) {
  if (!a.agency_name || ['ALL', 'UNATTRIBUTED'].includes(a.agency_code)) continue;
  agencies.set(norm(a.agency_name), a.agency_code);
}

// ---- vendors
const vendorSrc = readFileSync(new URL('../src/lib/political-entities.ts', import.meta.url), 'utf8');
const vendorSlug = (n) => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const entityBlocks = vendorSrc.split(/\n\s*\{\s*\n/).slice(1);
const vendors = [];
for (const b of entityBlocks) {
  const type = /entity_type:\s*'([a-z]+)'/.exec(b)?.[1];
  const name = /\bname:\s*'([^']+)'/.exec(b)?.[1];
  const aliases = [...(/aliases:\s*\[([^\]]*)\]/.exec(b)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (name && type && type !== 'person') vendors.push({ name, aliases, slug: vendorSlug(name) });
}
const SUFFIX = /\b(the|incorporated|inc|corp|corporation|company|co|llc|l l c|ltd|limited|plc|holdings?|group|lp|l p)\b/g;
const core = (s) => norm(s).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
const slugifyName = (name) => name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '') || 'company';
const vendorMap = {};
const vendorNotes = [];
for (const v of vendors) {
  const terms = [...new Set([v.name, ...v.aliases].map(core).filter((t) => t.length >= 3))];
  const groups = new Map();
  for (const t of terms) {
    const word = t.split(' ').sort((a, b) => b.length - a.length)[0];
    const rows = await all(`awards?select=recipient_parent_uei,recipient_parent_name,recipient_uei,recipient_name&or=(recipient_parent_name.ilike.*${encodeURIComponent(word)}*,recipient_name.ilike.*${encodeURIComponent(word)}*)&order=id`);
    for (const r of rows) {
      const key = r.recipient_parent_uei || r.recipient_uei;
      const gname = (r.recipient_parent_uei ? r.recipient_parent_name : null) || r.recipient_name;
      if (key && gname && core(gname) === t) groups.set(key, gname);
    }
  }
  if (groups.size === 1) {
    const [[key, gname]] = [...groups.entries()];
    vendorMap[v.slug] = `${slugifyName(gname)}-${key.toLowerCase()}`;
    vendorNotes.push(`${v.slug} -> ${vendorMap[v.slug]}`);
  } else {
    vendorNotes.push(`${v.slug} -> /companies (${groups.size} parent records match)`);
  }
}

const peopleObj = Object.fromEntries([...people.entries()].sort());
const ts = `// GENERATED by scripts/build-legacy-map.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand; re-run the script.
// Old URL spellings → new identities, used by src/proxy.ts. Plain data, no imports (the proxy and
// scripts/verify-gates.mjs both load it).

/** Legacy member slug → bioguide id; null = two members share the spelling (send to /people?q=). */
export const LEGACY_PEOPLE: Record<string, string | null> = ${JSON.stringify(peopleObj)};

/** Normalized awarding-agency name → toptier code (contract_spending_summary). */
export const LEGACY_AGENCIES: Record<string, string> = ${JSON.stringify(Object.fromEntries([...agencies.entries()].sort()))};

/** Legacy /vendor/<slug> → D3 company slug (exactly one USAspending parent record matched). */
export const LEGACY_VENDORS: Record<string, string> = ${JSON.stringify(vendorMap)};
`;
writeFileSync(new URL('../src/lib/v2/legacy-map.generated.ts', import.meta.url), ts);
const ambiguous = [...people.values()].filter((v) => v === null).length;
console.log(`roster ${roster.length} · people slugs ${people.size} (ambiguous ${ambiguous}) · agencies ${agencies.size} · vendors ${Object.keys(vendorMap).length}/${vendors.length} mapped · ${ts.length} bytes`);
console.log(vendorNotes.join('\n'));
