// Proves the trust gate (D5) against a running server and prints the route inventory.
//
//   node scripts/verify-gates.mjs inventory            route inventory only (no server)
//   node scripts/verify-gates.mjs http://localhost:3217  status-code table; exit 1 on any failure
//
// The lists come from src/lib/v2/redirect-map.ts (Node strips the types on import). Every route
// found under src/app must be classified here; an unclassified route fails the run, so a new
// legacy page cannot slip into a preview deploy unnoticed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  GATED_APIS,
  GATED_PAGES,
  LIVE_REDIRECTS,
  LOOKUP_REDIRECTS,
  PENDING_REDIRECTS,
  RETIRED_APIS,
  WITHDRAWN_SLUGS,
  matchGatedApi,
  matchGatedPage,
  matchRetiredApi,
} from '../src/lib/v2/redirect-map.ts';
import { LEGACY_AGENCIES, LEGACY_PEOPLE, LEGACY_VENDORS } from '../src/lib/v2/legacy-map.generated.ts';
import { designPagesEnabled, lateFilersEnabled, readFailureInjected } from '../src/lib/v2/flags.ts';
import { DATE_FLAG_FALLBACK, DATE_FLAG_WORDING, LATENESS_BASIS_WORDING, dateFlagNote, latenessNote } from '../src/lib/v2/date-flags.ts';
import { ALLOWED_VERBATIM, FORBIDDEN_PHRASES } from '../src/lib/v2/forbidden-words.ts';
import { shellPath } from '../src/components/v2/shell/nav.ts';
import { instrumentKind } from '../src/lib/v2/instruments.ts';
import { MONEY_TYPES } from '../src/lib/v2/money.ts';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const APP = join(ROOT, 'src', 'app');

// v2 pages and routes that stay reachable. Everything else under src/app must be gated,
// redirected or retired.
const KEEP_PAGES = new Set([
  '/', '/about', '/about/corrections', '/about/methodology', '/about/methodology/contracts',
  '/about/methodology/tickers', '/about/methodology/trades', '/companies', '/data', '/design', '/design/story',
  '/investigations', '/people', '/rebuilding', '/search', '/withdrawn', '/agencies',
  '/data/trades', '/data/contracts', '/data/late-filers', '/data/status', '/latest',
]);
// Dynamic v2 pages, each with a real sample URL that must answer 200.
const KEEP_DYNAMIC = new Map([
  ['/people/:bioguide', '/people/G000583'],
  ['/companies/:slug', '/companies/lockheed-martin-corp-zfn2jjxblzt3'],
  ['/agencies/:code', '/agencies/097'],
]);
// Public data routes that return raw rows from the audited loaders, or no figures of ours at all.
const KEEP_ROUTES = new Map([
  ['/api/contracts', 'raw award rows (r5-v1)'],
  ['/api/contracts/:id', 'one raw award row'],
  ['/api/v1/contracts', 'raw award rows, documented API'],
  ['/api/v1/trades', 'raw trade rows, documented API (see issues: folded-lot sums in amount columns)'],
  ['/data/trades/export', 'CSV of the trades matching the explorer filters, row-capped (D4)'],
  ['/data/contracts/export', 'CSV of the non-competed awards matching the explorer filters, row-capped (D4)'],
  ['/api/fec', 'live FEC lookup, no stored figures'],
  ['/api/stock/:ticker', 'price history from a public quote feed, no figures of ours'],
  ['/api/newsletter/subscribe', 'signup write; fails visibly until Buttondown is wired (D7)'],
  ['/feed.xml', 'valid RSS with no items'],
  ['/latest.xml', 'RSS of new trade reports and awards, data items only, each linking to the official record (D6b)'],
  ['/sitemap.xml', 'live URLs only'],
  ['/opengraph-image', 'site share card'],
]);
const SELF_RETIRED = new Map([
  ['/api/sync', '410 from its own code (R5)'],
  ['/api/backfill', '410 from its own code (R5)'],
  ['/api/sync/trigger', '410 from its own code (R5)'],
]);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/^(page|route)\.tsx?$/.test(n) || n === 'sitemap.ts' || n === 'opengraph-image.tsx') out.push(p);
  }
  return out;
}

function routeOf(file) {
  let r = '/' + relative(APP, file).split(sep).slice(0, -1).join('/');
  const base = file.split(sep).pop();
  if (base === 'sitemap.ts') r = '/sitemap.xml';
  if (base === 'opengraph-image.tsx') r = '/opengraph-image';
  return r.replace(/\[([^\]]+)\]/g, ':$1').replace(/\/$/, '') || '/';
}

function classify(route) {
  const sample = route.replace(/:[a-z]+/g, 'sample');
  if (KEEP_PAGES.has(route)) return ['keep', 'v2 page'];
  if (KEEP_ROUTES.has(route)) return ['keep', KEEP_ROUTES.get(route)];
  if (KEEP_DYNAMIC.has(route)) return ['keep', 'v2 page'];
  if (SELF_RETIRED.has(route)) return ['retired', SELF_RETIRED.get(route)];
  if (matchRetiredApi(sample)) return ['retired', RETIRED_APIS.find((g) => sample.startsWith(g.path))?.why ?? ''];
  if (matchGatedApi(sample)) return ['gated', GATED_APIS.find((g) => sample.startsWith(g.path))?.why ?? ''];
  // A page that a live 301 catches before it renders.
  const redirected = LIVE_REDIRECTS.find((r) => new RegExp('^' + r.source.replace(/:[a-z]+/g, '[^/]+') + '$').test(sample));
  if (redirected) return ['redirected', `301 to ${redirected.destination}`];
  // A gated path that a lookup pattern would also match (/score/methodology vs /score/:slug) stays gated.
  const exactGate = GATED_PAGES.find((g) => g.path === route);
  if (exactGate) return ['gated', exactGate.why];
  // A page the proxy 301s after a lookup (legacy-redirects.ts).
  const looked = LOOKUP_REDIRECTS.find((r) => new RegExp('^' + r.source.replace(/:[a-z]+/g, '[^/]+') + '$').test(sample));
  if (looked) return ['redirected', `301 to ${looked.destination} (${looked.note})`];
  const g = matchGatedPage(sample);
  if (g) return ['gated', g.why];
  return ['UNCLASSIFIED', ''];
}

const files = walk(APP).sort();
const routes = [...new Set(files.map(routeOf))].sort();
const inventory = routes.map((r) => ({ route: r, ...(([status, note]) => ({ status, note }))(classify(r)) }));

function printInventory() {
  const counts = {};
  for (const i of inventory) counts[i.status] = (counts[i.status] ?? 0) + 1;
  console.log('| Route | Status | Why |\n|---|---|---|');
  for (const i of inventory) console.log(`| \`${i.route}\` | ${i.status} | ${i.note} |`);
  console.log(`\nTotals: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')} (${inventory.length} routes under src/app)`);
  console.log(`Withdrawn stories (410): ${WITHDRAWN_SLUGS.length} slugs × 2 addresses. Pending redirects: ${PENDING_REDIRECTS.length}. Lookup redirects: ${LOOKUP_REDIRECTS.length}.`);
  return !counts.UNCLASSIFIED;
}

const base = process.argv[2];
if (!base || base === 'inventory') {
  process.exit(printInventory() ? 0 : 1);
}

const sample = (p) => p.replace(':id', 'abc123').replace(':code', '097').replace(':slug', 'spacex').replace(':name', 'Pelosi').replace(':c', 'House');
const rows = [];
let failed = 0;

// D8c (A7c B1, B2): the late-filers board is checked against the database with the same anon key the pages use.
function anonCreds() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    try {
      for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
        const m = l.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/);
        if (m) { if (m[1].endsWith('URL')) url ||= m[2].replace(/^["']|["']$/g, ''); else key ||= m[2].replace(/^["']|["']$/g, ''); }
      }
    } catch { /* no .env.local */ }
  }
  return { url, key };
}
async function restAll(path) {
  const { url, key } = anonCreds();
  if (!url || !key) throw new Error('no anon credentials (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    if (!res.ok) throw new Error(`${path.split('?')[0]} -> ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
function gateRow(path, ok, note, group) {
  if (!ok) failed++;
  rows.push({ path, status: ok ? 200 : 0, expect: 200, ok, note, group });
}
const num = (t) => Number(String(t).replace(/,/g, ''));

async function hit(path, expect, extra = {}) {
  const res = await fetch(base + path, { redirect: 'manual', method: extra.method ?? 'GET' });
  // React puts <!-- --> between text and interpolated values; strip them so phrases match as a reader sees them.
  const body = extra.body || extra.bodyAll || extra.notBody || extra.noindex || extra.startsWith ? (await res.text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'") : '';
  const loc = res.headers.get('location');
  const robots = res.headers.get('x-robots-tag') || '';
  let ok = res.status === expect;
  if (ok && extra.location) ok = loc === extra.location || (loc ?? '').endsWith(extra.location);
  if (ok && extra.body) ok = body.includes(extra.body);
  if (ok && extra.noindex) ok = /noindex/.test(robots) || /<meta name="robots" content="[^"]*noindex/.test(body || '');
  if (ok && extra.notBody) ok = [].concat(extra.notBody).every((w) => !body.toLowerCase().includes(String(w).toLowerCase()));
  if (ok && extra.ctype) ok = (res.headers.get('content-type') || '').includes(extra.ctype);
  if (ok && extra.startsWith) ok = body.startsWith(extra.startsWith);
  if (ok && extra.bodyAll) ok = extra.bodyAll.every((w) => body.includes(w));
  if (!ok) failed++;
  // D8c: a failed row says which check failed (a flaky read looked like a wording failure before).
  let why = '';
  if (!ok) {
    const all = [...(extra.bodyAll ?? []), ...(extra.body ? [extra.body] : [])];
    const bad = [].concat(extra.notBody ?? []).find((w) => body.toLowerCase().includes(String(w).toLowerCase()));
    if (res.status !== expect) why = `status ${res.status}`;
    else if (all.some((w) => !body.includes(w))) why = `missing "${all.find((w) => !body.includes(w))}"`;
    else if (bad) why = `contains "${bad}"`;
    else if (extra.noindex) why = 'noindex missing';
  }
  rows.push({ path, status: res.status, expect, ok, note: why || (loc ? `→ ${loc}` : robots ? `robots: ${robots}` : ''), group: extra.group });
}

// 1. Withdrawn stories
for (const s of WITHDRAWN_SLUGS) {
  await hit(`/investigations/${s}`, 410, { body: 'withdrawn pending re-verification', noindex: true, group: 'withdrawn' });
  await hit(`/blog/${s}`, 301, { location: `/investigations/${s}`, group: 'withdrawn (old /blog address)' });
}
// 2. Live 301s
for (const r of LIVE_REDIRECTS) {
  if (r.source === '/blog/:slug') continue; // covered above
  await hit(sample(r.source), 301, { location: sample(r.destination), group: 'live 301' });
}
await hit('/blog/some-other-slug', 301, { location: '/investigations/some-other-slug', group: 'live 301' });
// 3. Pending redirects: the old URL must be gated, never the old page
const seen = new Set();
for (const r of PENDING_REDIRECTS) {
  const path = sample(r.source.split('?')[0]);
  if (seen.has(path)) continue;
  seen.add(path);
  await hit(path, 200, { body: 'being rebuilt', noindex: true, group: `pending → ${r.destination}` });
}
// 4. Gated pages not already covered
const liveRedirected = (path) => LIVE_REDIRECTS.some((r) => new RegExp('^' + r.source.replace(/:[a-z]+/g, '[^/]+') + '$').test(path));
for (const g of GATED_PAGES) {
  if (seen.has(g.path) || liveRedirected(g.path)) continue; // a live 301 answers before the gate
  seen.add(g.path);
  await hit(g.path, 200, { body: 'being rebuilt', noindex: true, group: 'gated page' });
}
// 5. Gated and retired APIs
for (const g of GATED_APIS) await hit(g.path, 503, { group: 'gated api' });
for (const g of RETIRED_APIS) await hit(g.path, 410, { group: 'retired api' });
for (const p of SELF_RETIRED.keys()) await hit(p, 410, { method: p === '/api/sync/trigger' ? 'POST' : 'GET', group: 'retired api (own code)' });
// 5b. Lookup redirects (D2): old member, senator-score, agency and vendor URLs. Expected targets come
// from the generated tables, and every target is then requested and must answer 200.
const anyVendor = Object.entries(LEGACY_VENDORS)[0];
const agencyName = Object.keys(LEGACY_AGENCIES).find((k) => k === 'department of defense') ?? Object.keys(LEGACY_AGENCIES)[0];
const lookups = [
  ['/congress/members/josh-gottheimer', `/people/${LEGACY_PEOPLE['josh-gottheimer']}`],
  ['/congress/members/nancy-pelosi', `/people/${LEGACY_PEOPLE['nancy-pelosi']}`],
  ['/congress/members/tommy-tuberville', `/people/${LEGACY_PEOPLE['tommy-tuberville']}`],
  ['/congress/members/Pelosi', '/people?q=pelosi'],
  ['/congress/members/no-such-member-d2', '/people?q=no%20such%20member%20d2'],
  ['/congress/members', '/people'],
  ['/score/elizabeth-warren', `/people/${LEGACY_PEOPLE['elizabeth-warren']}`],
  ['/agency/097', '/agencies/097'],
  [`/agency/${encodeURIComponent(agencyName.replace(/\b\w/g, (c) => c.toUpperCase()))}`, `/agencies/${LEGACY_AGENCIES[agencyName]}`],
  ['/agency/not-an-agency', '/agencies'],
  ['/agency', '/agencies'],
  [`/vendor/${anyVendor[0]}`, `/companies/${anyVendor[1]}`],
  ['/vendor/tesla', '/companies'],
  ['/vendor', '/companies'],
];
for (const [from, to] of lookups) {
  if (to.includes('undefined')) { failed++; rows.push({ path: from, status: 0, expect: 301, ok: false, note: 'no expected target in the generated table', group: 'lookup 301 (D2)' }); continue; }
  await hit(from, 301, { location: to, group: 'lookup 301 (D2)' });
}
for (const to of new Set(lookups.map(([, t]) => t).filter((t) => !t.includes('undefined')))) {
  await hit(to, 200, { group: 'lookup 301 target answers (D2)' });
}
await hit('/score', 301, { location: '/people?chamber=Senate', group: 'live 301' });
await hit('/score/methodology', 200, { body: 'being rebuilt', noindex: true, group: 'gated page' });
// 5c. People pages (D2)
await hit('/people/g000583', 308, { location: '/people/G000583', group: 'people (D2)' });
await hit('/people/Z999999', 404, { group: 'people (D2)' });
await hit('/people/not-a-bioguide', 404, { group: 'people (D2)' });
await hit('/people/G000583', 200, { body: 'Self (incl. trusts/accounts)', notBody: 'days to file', group: 'people (D2)' });
await hit('/people/T000278', 200, { body: 'Options and other instruments', group: 'people (D2)' });
await hit('/people?zip=07450', 200, { body: 'NJ-5', group: 'people (D2)' });
await hit('/people?zip=00000', 200, { body: 'place this ZIP', group: 'people (D2)' });
await hit('/people?chamber=Senate&sort=name', 200, { group: 'people (D2)' });

// 5d. Data explorers (D4). Filters live in the URL; junk values are ignored, never an error.
const JUNK = 'chamber=Mars&party=Green&state=ZZ&page=-4&from=garbage&to=2026-13-45&sort=bad&band=zz&instrument=x&direction=y&owner=z&by=q';
await hit('/data/trades', 200, { bodyAll: ['Trades by members of Congress', 'Download CSV', 'View filing'], notBody: ['days to file', 'noindex'], group: 'explorers (D4)' });
await hit('/data/trades?member=G000583', 200, { bodyAll: ['Gottheimer', 'match'], noindex: true, group: 'explorers (D4)' });
await hit('/data/trades?chamber=Senate&direction=SELL&instrument=option&band=b1&sort=traded&from=2025-01-01&to=2025-12-31&by=filed', 200, { body: 'Senate', noindex: true, group: 'explorers (D4)' });
await hit('/data/trades?' + JUNK, 200, { notBody: ['No trades match', 'unavailable right now'], group: 'explorers (D4) junk input' });
await hit('/data/trades?from=2026-09-01&to=2026-01-01', 200, { notBody: 'unavailable right now', group: 'explorers (D4) junk input' });
await hit('/data/trades?member=%27%3B%20drop%20table%20congress_trades%3B--&ticker=%22%2C%29%28', 200, { notBody: 'unavailable right now', group: 'explorers (D4) junk input' });
await hit('/search?q=%27%20drop%20table%20congress_trades%20--', 200, { notBody: 'unavailable right now', group: 'explorers (D4) junk input' }); // a quote then "--" is rejected by the database gateway unless collapsed
await hit('/data/trades?member=%27%20drop%20table%20congress_trades%20--', 200, { notBody: 'unavailable right now', group: 'explorers (D4) junk input' });
await hit('/data/trades?ticker=ZZZZZZ9', 200, { body: 'No trades match', group: 'explorers (D4)' });
await hit('/data/trades?page=99999999', 200, { body: 'Previous', group: 'explorers (D4)' });
await hit('/data/trades?has_contract=true', 200, { body: 'not available here yet', group: 'explorers (D4)' });
await hit('/data/trades/export?chamber=Senate&from=2025-01-01&to=2025-01-31', 200, { ctype: 'text/csv', startsWith: 'Member,Bioguide ID,Chamber,Party', bodyAll: ['efdsearch.senate.gov', 'Filing URL'], group: 'explorers (D4) csv' });
await hit('/data/trades/export?' + JUNK, 200, { ctype: 'text/csv', startsWith: 'Member,Bioguide ID', group: 'explorers (D4) csv' });
await hit('/data/contracts', 200, { bodyAll: ['Non-competed federal contracts', 'Obligated to date', 'USAspending', 'Download CSV'], notBody: ['spent in FY', 'FY2025 spending', 'noindex'], group: 'explorers (D4)' });
await hit('/data/contracts?fy=2025&agency=097&amt=100m&sort=signed', 200, { body: 'Department of Defense', noindex: true, group: 'explorers (D4)' });
await hit('/data/contracts?fy=2030&agency=%27%22&amt=zzz&sort=bad&parent=nope&page=0&q=%25%27%22', 200, { notBody: 'unavailable right now', group: 'explorers (D4) junk input' });
await hit('/data/contracts?parent=ZFN2JJXBLZT3', 200, { body: 'Only awards to the company group', group: 'explorers (D4)' });
await hit('/data/contracts/export?fy=2026&agency=097&amt=1b', 200, { ctype: 'text/csv', startsWith: 'PIID,Parent IDV PIID', bodyAll: ['https://www.usaspending.gov/award/', 'Obligated to date (USD)'], group: 'explorers (D4) csv' });
await hit('/data/contracts/export?fy=2030&agency=%27', 200, { ctype: 'text/csv', startsWith: 'PIID,Parent IDV PIID', group: 'explorers (D4) csv' });
// Late filers: factual wording only (no verdict words), the STOCK Act's 45 days named, the filing linked.
await hit('/data/late-filers', 200, { bodyAll: ['the STOCK Act sets a 45-day limit', 'View filing', 'Preview only'], noindex: true, notBody: ['violation', 'illegal', 'broke the law', 'guilty', 'crime', 'stock_act_late'], group: 'late filers (D4)' });
await hit('/data/late-filers?chamber=Senate&over=365&msort=reports&members=all', 200, { notBody: ['unavailable right now'], group: 'late filers (D4)' });
await hit('/data/late-filers?over=abc&chamber=x&page=-1&msort=zz', 200, { notBody: ['unavailable right now'], group: 'late filers (D4)' });
// The flag: ON in dev and preview, OFF on the production deployment (VERCEL_ENV === 'production').
for (const [env, want] of [[{}, true], [{ VERCEL_ENV: 'preview' }, true], [{ VERCEL_ENV: 'development' }, true], [{ VERCEL_ENV: 'production' }, false]]) {
  const got = lateFilersEnabled(env);
  if (got !== want) failed++;
  rows.push({ path: `lateFilersEnabled(${JSON.stringify(env)})`, status: String(got), expect: String(want), ok: got === want, note: '', group: 'late filers flag (D4)' });
}
await hit('/sitemap.xml', 200, { bodyAll: ['/data/trades', '/data/contracts'], group: 'explorers (D4)' });
if (lateFilersEnabled()) await hit('/sitemap.xml', 200, { body: '/data/late-filers', group: 'late filers (D4)' });
else await hit('/sitemap.xml', 200, { notBody: '/data/late-filers', group: 'late filers (D4)' });
// Legacy URLs that now land on an explorer (the target must answer 200 too).
await hit('/dashboard', 301, { location: '/data/contracts', group: 'explorer redirects (D4)' });
await hit('/compare', 301, { location: '/data/contracts', group: 'explorer redirects (D4)' });
await hit('/defense', 301, { location: '/data/contracts?agency=097', group: 'explorer redirects (D4)' });
await hit('/congress/trades', 301, { location: '/data/trades', group: 'explorer redirects (D4)' });
await hit('/congress/trades?chamber=House', 301, { location: '/data/trades?chamber=House', group: 'explorer redirects (D4)' });
await hit('/congress/trades/trump', 200, { body: 'being rebuilt', noindex: true, group: 'explorer redirects (D4)' });

// 5e. Homepage (D6a): live counts with source, coverage and as-of; the latest filings, linked to the member
// and the filing; three ways in; the rebuilding note. No late-filers module, no verdict words, and no
// failed-load state (a dataset that didn't load fails this check instead of passing quietly).
await hit('/', 200, {
  bodyAll: ['Members tracked', 'trades disclosed by members of Congress, on file', 'Non-competed contracts', 'not competed, $1 million or more', 'Source:', 'Coverage:', 'as of ',
    'Latest filings', 'First report filed', 'View filing', 'href="/people/', 'Three ways in', 'Find your members', 'Rebuilding: stories return after audit'],
  notBody: ['/data/late-filers', 'late filer', 'filed late', 'violation', 'illegal', 'broke the law', 'guilty', 'crime', 'corrupt', 'insider trading', 'stock_act_late',
    'The source did not load', 'Data temporarily unavailable', 'unavailable right now', 'campaign money and lobbying, linked'],
  group: 'homepage (D6a)',
});
await hit('/opengraph-image', 200, { ctype: 'image/png', group: 'homepage (D6a)' });

// 5f. A8 launch blockers (D8d).
// L1: no open card generator. /api/og is gone; a title in the query string must not come back as an image.
{
  const r = await fetch(base + '/api/og?title=TEST&stat=47&statLabel=STOCK%20ACT%20VIOLATIONS&source=House%20Clerk', { redirect: 'manual' });
  const ctype = r.headers.get('content-type') || '';
  const b = await r.text();
  const ok = r.status === 404 && !ctype.startsWith('image/') && !b.includes('STOCK ACT VIOLATIONS');
  if (!ok) failed++;
  rows.push({ path: '/api/og?title=TEST…', status: `${r.status} ${ctype.split(';')[0]}`, expect: '404, no image', ok, note: ok ? '' : 'the route renders query text', group: 'launch blockers (D8d) L1' });
}
for (const p of ['/opengraph-image?title=TEST', '/data/opengraph-image?title=TEST']) await hit(p, 200, { ctype: 'image/png', group: 'launch blockers (D8d) L1' });
// L2: the design gallery and story template are 404 on the production deployment (flag), noindex elsewhere.
for (const [env, want] of [[{}, true], [{ VERCEL_ENV: 'preview' }, true], [{ VERCEL_ENV: 'development' }, true], [{ VERCEL_ENV: 'production' }, false]]) {
  const got = designPagesEnabled(env);
  if (got !== want) failed++;
  rows.push({ path: `designPagesEnabled(${JSON.stringify(env)})`, status: String(got), expect: String(want), ok: got === want, note: '', group: 'launch blockers (D8d) L2' });
}
for (const p of ['/design', '/design/story']) {
  if (designPagesEnabled()) await hit(p, 200, { noindex: true, group: 'launch blockers (D8d) L2' });
  else await hit(p, 404, { group: 'launch blockers (D8d) L2' });
}
await hit('/sitemap.xml', 200, { notBody: '/design', group: 'launch blockers (D8d) L2' });
// L3: member pages carry no "companies with federal contracts this member traded" claim while the join is off.
if (process.env.SHOW_MEMBER_CONTRACTS !== '1') {
  for (const id of ['G000583', 'M001186', 'T000278']) {
    await hit(`/people/${id}`, 200, {
      bodyAll: ['Coming later: trades paired with contractors’ awards.', 'See the method', 'Trades and awards'],
      notBody: ['Companies with federal contracts this member traded', 'worth a look, not an accusation', 'companies with federal contracts whose stock this member traded', 'unavailable right now'],
      group: 'launch blockers (D8d) L3',
    });
  }
}
// L4: the failure-injection hook is off unless its variable is set, never on production, and only until its time.
{
  const soon = String(Date.now() + 60_000);
  const past = String(Date.now() - 1000);
  for (const [env, want] of [[{}, false], [{ SLUSHFUND_TEST_FAIL_READS_UNTIL: soon }, true], [{ SLUSHFUND_TEST_FAIL_READS_UNTIL: past }, false],
    [{ SLUSHFUND_TEST_FAIL_READS_UNTIL: soon, VERCEL_ENV: 'production' }, false], [{ SLUSHFUND_TEST_FAIL_READS_UNTIL: 'garbage' }, false]]) {
    const got = readFailureInjected(env);
    if (got !== want) failed++;
    rows.push({ path: `readFailureInjected(${JSON.stringify(env).replace(/\d{13}/, (m) => (m === soon ? 'now+60s' : 'now-1s'))})`, status: String(got), expect: String(want), ok: got === want, note: '', group: 'launch blockers (D8d) L4' });
  }
  // N8: the shell renders the homepage for '/index' too (Vercel's ISR path for /), so server and browser agree.
  for (const [p, want] of [['/index', '/'], ['/', '/'], [null, '/'], ['/people', '/people'], ['/indexes', '/indexes']]) {
    const got = shellPath(p);
    if (got !== want) failed++;
    rows.push({ path: `shellPath(${JSON.stringify(p)})`, status: got, expect: want, ok: got === want, note: '', group: 'launch blockers (D8d) N8' });
  }
  // This run itself must not be injecting failures.
  const ok = !readFailureInjected();
  if (!ok) failed++;
  rows.push({ path: 'readFailureInjected(process.env)', status: String(!ok), expect: 'false', ok, note: '', group: 'launch blockers (D8d) L4' });
}

// D6b: /data/status, /latest, latest.xml and the reader wording for date flags.
// Visible text (scripts and tags stripped) must never read "NaN", "undefined" or "[object Object]".
async function visibleClean(path) {
  const html = await (await fetch(base + path)).text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const bad = [/\bNaN\b/, /\bundefined\b/, /\[object Object\]/].filter((re) => re.test(text)).map(String);
  if (bad.length) failed++;
  rows.push({ path, status: 'visible text', expect: 'no NaN/undefined', ok: bad.length === 0, note: bad.join(' '), group: 'visible text (D6b)' });
}
for (const p of ['/data/status', '/latest', '/latest?type=awards', '/data/late-filers']) await visibleClean(p);
await hit('/data/status', 200, {
  bodyAll: ['House trades', 'Senate trades', 'Contract awards', 'Ticker links', 'Committee history', 'Signal scores', 'Score bands:', 'a prompt to look closer, not a finding', 'below the $1,000 reporting threshold', 'Known gaps', 'Last loaded', 'scanned House filings were not read', 'from the newest'],
  notBody: ['being rebuilt'],
  group: 'status and latest (D6b)',
});
await hit('/about/data-status', 301, { location: '/data/status', group: 'status and latest (D6b)' });
await hit('/latest', 200, { bodyAll: ['New filings and awards', 'RSS feed', 'Awards have no chamber', 'data-kind="trade"', 'data-kind="award"', 'first reported'], notBody: ['being rebuilt', 'risk score', 'high-risk', 'flagged contracts', 'unavailable right now'], group: 'status and latest (D6b)' });
await hit('/latest?chamber=House', 200, { body: 'data-kind="trade"', notBody: ['data-kind="award"', 'unavailable right now'], noindex: true, group: 'status and latest (D6b)' });
await hit('/latest?type=awards', 200, { body: 'data-kind="award"', notBody: ['data-kind="trade"', 'unavailable right now'], noindex: true, group: 'status and latest (D6b)' });
await hit('/latest?chamber=zz&type=zz&page=-3', 200, { notBody: ['unavailable right now'], group: 'status and latest (D6b) junk input' });
await hit('/latest?page=99999', 200, { notBody: ['unavailable right now'], group: 'status and latest (D6b) junk input' });
await hit('/latest.xml', 200, { ctype: 'rss', startsWith: '<?xml', bodyAll: ['<item>', 'slushfund:trade:', 'slushfund:award:', 'official record', '<category>Contract award</category>', '<category>Congressional trade report</category>'], notBody: ['withdrawn', '/investigations', '/blog', 'risk score', 'suspicious', 'stale_2y'], group: 'status and latest (D6b) rss' });
await hit('/api/latest', 503, { group: 'status and latest (D6b)' });
// Reader wording for date_flag: one map, no raw token on a page. One real row per flag value.
const FLAG_ROWS = [
  ['stale_2y_corroborated', '/data/trades?member=S001201&from=2017-01-05&to=2017-01-05'],
  ['stale_2y', '/data/trades?member=S001229&from=2015-05-08&to=2015-05-08'],
  ['after_filing', '/data/trades?member=L000579&from=2021-02-22&to=2021-02-22'],
  ['future', '/data/trades?member=C001068&from=2026-12-26&to=2026-12-26'],
];
for (const [flag, url] of FLAG_ROWS) {
  await hit(url, 200, { body: DATE_FLAG_WORDING[flag], notBody: ['stale_2y', 'stale 2y', 'after_filing', 'corroborated'], group: 'date flag wording (D6b)' });
}
for (const [flag, want] of [
  ['stale_2y_corroborated', "Reported more than two years after the trade. The report's own dates agree with each other."],
  ['stale_2y', 'Trade dated more than two years before this report; lateness not computed.'],
  [null, null], ['', null], ['made_up_token_x', DATE_FLAG_FALLBACK],
]) {
  const got = dateFlagNote(flag);
  const ok = got === want && (got == null || !/[a-z]+_[a-z0-9_]+/.test(got));
  if (!ok) failed++;
  rows.push({ path: `dateFlagNote(${JSON.stringify(flag)})`, status: String(got), expect: String(want), ok, note: '', group: 'date flag wording (D6b)' });
}
if (lateFilersEnabled()) {
  await hit('/data/late-filers', 200, { bodyAll: ['Trades, by report', 'Report filed', 'Largest gap', DATE_FLAG_WORDING.stale_2y_corroborated, '<details'], notBody: ['stale_2y', 'stale 2y', 'Date flag in our data', 'unavailable right now'], group: 'late filers by report (D6b)' });
  await hit('/data/late-filers?chamber=Senate&over=90&rsort=recent', 200, { body: 'Report filed', notBody: ['unavailable right now'], group: 'late filers by report (D6b)' });
  await hit('/data/late-filers?rsort=trades&over=365&page=2', 200, { notBody: ['unavailable right now'], group: 'late filers by report (D6b)' });
  // D8a: reports first, transactions second; ranked by reports or days only; every NULL has its lateness_basis reason.
  await hit('/data/late-filers', 200, {
    bodyAll: ['Reports with a trade over 45 days', 'Transactions in them', 'transactions in', 'Lateness is not computed for', 'below the $1,000 reporting threshold', 'Dates are as the member filed them', 'sets a 45-day limit'],
    notBody: ['Most trades over', 'In how many reports', 'unavailable right now'],
    group: 'late filers semantics (D8a)',
  });
  await hit('/data/late-filers?rsort=zz&page=99999&over=7', 200, { notBody: ['unavailable right now'], group: 'late filers by report (D6b) junk input' });
  await lateBoardGates();
}
// D8c. B1: no row below the $1,000 reporting threshold on the board, and the board counts only stock_act_late rows.
// B2: reports are first reports: the page's totals equal the database's own roll-up (member_conflict_scores), and every
// member's report count on the page equals late_report_count. A restated first report must say where it was restated.
async function lateBoardGates() {
  const G = 'late filers first reports (D8c)';
  try {
    const late = await restAll('congress_trades?select=id,member_name,amount_max,stock_act_late,lateness_basis,source_doc_id,original_source_doc_id,original_disclosure_url&lateness_basis=eq.computed&order=id');
    const small = late.filter((r) => r.amount_max != null && r.amount_max <= 1000);
    gateRow('board pool: rows with amount_max <= 1000', small.length === 0, `${small.length} of ${late.length} computed rows (the board's pool)`, G);
    const lateRows = late.filter((r) => r.stock_act_late === true);
    gateRow('board pool: every over-limit row has a first report', lateRows.every((r) => r.original_source_doc_id && r.original_disclosure_url), `${lateRows.length} rows`, G);
    const roll = await restAll('member_conflict_scores?select=member_name,late_transaction_count,late_report_count&order=member_name');
    const dbReports = roll.reduce((n, m) => n + m.late_report_count, 0);
    const dbTx = roll.reduce((n, m) => n + m.late_transaction_count, 0);
    const dbMembers = roll.filter((m) => m.late_report_count > 0).length;
    const mine = new Map();
    for (const r of lateRows) { const s = mine.get(r.member_name) ?? new Set(); s.add(r.original_source_doc_id); mine.set(r.member_name, s); }
    const rollMismatch = roll.filter((m) => (mine.get(m.member_name)?.size ?? 0) !== m.late_report_count);
    gateRow('member_conflict_scores.late_report_count = distinct first reports of the late rows', rollMismatch.length === 0 && dbTx === lateRows.length, `${roll.length} members; ${rollMismatch.length} differ; ${dbTx} transactions vs ${lateRows.length}`, G);
    const res = await fetch(`${base}/data/late-filers?members=all`);
    const html = (await res.text()).replace(/<!-- -->/g, '');
    const m = html.match(/<b>([\d,]+)<\/b> transactions in <b>([\d,]+)<\/b> reports were filed more than 45 days after the trade, by <b>([\d,]+)<\/b> members/);
    gateRow('board headline = database roll-up (transactions, first reports, members)', !!m && num(m[1]) === dbTx && num(m[2]) === dbReports && num(m[3]) === dbMembers,
      m ? `page ${m[1]} / ${m[2]} / ${m[3]}; database ${dbTx} / ${dbReports} / ${dbMembers}` : 'summary sentence not found (no summary rendered?)', G);
    // per member: the row on the page (name, then the report count cell) equals late_report_count
    const bad = [];
    let seen = 0;
    for (const mem of roll.filter((x) => x.late_report_count > 0)) {
      const esc = mem.member_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '(?:\'|&#x27;)');
      const row = html.match(new RegExp(`${esc}</(?:a|b)>[\\s\\S]{0,900}?font-mono text-\\[15px\\] font-semibold">([\\d,]+)</b>`));
      if (!row) { bad.push(`${mem.member_name}: not on the page`); continue; }
      seen++;
      if (num(row[1]) !== mem.late_report_count) bad.push(`${mem.member_name}: page ${row[1]}, database ${mem.late_report_count}`);
    }
    gateRow('every member row on the page = late_report_count', bad.length === 0, bad.length ? bad.slice(0, 6).join('; ') : `${seen} member rows compared`, G);
    // Meijer's sub-$1,000 sales (B1) are not on the board: the three late rows above $1,000 are, in one report
    const mj = roll.find((x) => x.member_name === 'Peter Meijer');
    gateRow('Peter Meijer: 3 late transactions in 1 report (the 11 sub-$1,000 rows are not counted)', !!mj && mj.late_transaction_count === 3 && mj.late_report_count === 1, mj ? `${mj.late_transaction_count} / ${mj.late_report_count}` : 'member not found', G);
    // first report named, restated filing named: a Suozzi report (restated by a 2022 filing) shows both
    const restated = lateRows.filter((r) => r.source_doc_id !== r.original_source_doc_id).length;
    gateRow('restated rows exist and the page names the first report and the restating filing', restated > 0 && /restated in/.test(html) && /View first report/.test(html), `${restated} late rows are stored under a later filing`, G);
  } catch (e) {
    gateRow('late-filers first-report gates', false, `could not run: ${String(e.message).slice(0, 160)}`, G);
  }
}

await hit('/sitemap.xml', 200, { bodyAll: ['/latest', '/data/status'], notBody: '/about/data-status', group: 'status and latest (D6b)' });

// 6. Kept v2 pages
for (const p of KEEP_PAGES) {
  if (p === '/withdrawn') { await hit(p, 410, { group: 'keep (v2)' }); continue; }
  if (p === '/search') { await hit('/search?q=Warren', 200, { group: 'keep (v2)' }); continue; }
  if ((p === '/design' || p === '/design/story') && !designPagesEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D8d L2
  await hit(p, 200, { group: 'keep (v2)', noindex: p === '/design' || p === '/design/story' || p === '/rebuilding' });
}
// The draft corrections entry must not render while its status is 'draft' and the preview flag is off.
if (process.env.SHOW_DRAFT_CORRECTIONS !== '1') {
  await hit('/about/corrections', 200, { notBody: '17 stories withdrawn', group: 'corrections draft hidden' });
  await hit('/about/corrections', 200, { body: 'The corrections log opens with the rebuilt site', group: 'corrections draft hidden' });
  await hit('/sitemap.xml', 200, { notBody: '/about/corrections', group: 'corrections draft hidden' });
}
for (const [route, url] of KEEP_DYNAMIC) await hit(url, 200, { group: `keep (v2) ${route}` });
await hit('/no-such-page-d5', 404, { body: 'find that page', notBody: 'live trades', group: 'keep (v2)' });
await hit('/feed.xml', 200, { notBody: '<item>', group: 'keep (v2)' });
await hit('/sitemap.xml', 200, { notBody: '/dashboard', group: 'keep (v2)' });
await hit('/sitemap.xml', 200, { notBody: '/vendor/', group: 'keep (v2)' });

// D8a: lateness_basis wording, one sentence per value and never a raw token.
for (const [basis, want] of [
  ...Object.entries(LATENESS_BASIS_WORDING),
  ['computed', null], [null, null], ['made_up_basis_x', 'Lateness not computed for this trade.'],
]) {
  const got = latenessNote(basis);
  const ok = got === want && (got == null || (/^Lateness not computed/.test(got) && !/[a-z]+_[a-z0-9_]+/.test(got)));
  if (!ok) failed++;
  rows.push({ path: `latenessNote(${JSON.stringify(basis)})`, status: String(got), expect: String(want), ok, note: '', group: 'lateness basis wording (D8a)' });
}
// D8a: kept APIs read the R6e columns (risk_score dropped; no invented verdict labels).
await hit('/api/contracts?limit=2&flag=no_bid&risk_min=50', 200, { body: '"competition_status"', notBody: ['risk_score', 'column', 'suspicious'], group: 'kept api semantics (D8a)' });
{
  // /api/v1/trades reads with the service key; an anon-only run gets its own 503 "Database not configured".
  const r = await fetch(base + '/api/v1/trades?limit=25');
  const b = await r.text();
  const noKey = r.status === 503 && b.includes('Database not configured');
  const ok = noKey || (r.status === 200 && b.includes('"contract_basis"') && b.includes('"lateness_basis"') && !/insider_trading|suspicious/i.test(b));
  if (!ok) failed++;
  rows.push({ path: '/api/v1/trades?limit=25', status: r.status, expect: '200 with R6e columns (503 without a service key)', ok, note: noKey ? 'skipped: no service key in this run' : '', group: 'kept api semantics (D8a)' });
}

// D8a wording gate: every sitemap URL plus the dynamic samples and the views a reader reaches from
// them, tags stripped, must carry none of A7b's forbidden phrases (src/lib/v2/forbidden-words.ts),
// case-insensitive. Verbatim source names pass (ALLOWED_VERBATIM, or all-capital recipient names as
// USAspending prints them) and are listed in the note.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ');
}
function verbatimSource(text, start, end) {
  for (const a of ALLOWED_VERBATIM) {
    for (let i = text.indexOf(a); i !== -1; i = text.indexOf(a, i + 1)) if (i <= start && end <= i + a.length) return a;
  }
  const word = text.slice(start, end);
  if (word !== word.toUpperCase()) return null;
  // The all-capital run around the hit (letters, digits, & . , ' - and spaces): two or more words.
  let a = start; while (a > 0 && /[A-Z0-9&.,'\- ]/.test(text[a - 1])) a--;
  let b = end; while (b < text.length && /[A-Z0-9&.,'\- ]/.test(text[b])) b++;
  const run = text.slice(a, b).trim();
  return run.split(/\s+/).filter((w) => /[A-Z]{2,}/.test(w)).length >= 2 ? run : null;
}
const WORDING_RES = FORBIDDEN_PHRASES.map((p) => ({ ...p, rx: new RegExp(p.re, 'gi') }));
async function wordingGate(path) {
  let res;
  try { res = await fetch(base + path); } catch { res = null; }
  const status = res ? res.status : 'error';
  const html = res && res.ok ? await res.text() : '';
  const text = visibleText(html);
  if (!path.endsWith('.xml')) seoGate(path, html);
  const hits = [];
  const allowed = new Set();
  for (const p of WORDING_RES) {
    for (const m of text.matchAll(p.rx)) {
      const v = verbatimSource(text, m.index, m.index + m[0].length);
      if (v) { allowed.add(v.slice(0, 60)); continue; }
      hits.push(`"${m[0]}" (${p.from}) in "…${text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30).trim()}…"`);
    }
  }
  const ok = status === 200 && text.length > 0 && hits.length === 0;
  if (!ok) failed++;
  rows.push({
    path, status: 'wording', expect: '0 forbidden phrases', ok,
    note: (status !== 200 ? `HTTP ${status} ` : '') + hits.slice(0, 4).join(' · ') + (hits.length > 4 ? ` · +${hits.length - 4} more` : '') + (allowed.size ? ` verbatim source text allowed: ${[...allowed].join(' | ')}` : ''),
    group: 'wording gate (D8a)',
  });
}
// A8 N1 (D8d): each page's canonical and og:url are its own address (query string dropped), never the homepage;
// og:title is the page's own. Pages served under many addresses by rewrite (rebuilding, withdrawn) carry neither.
const SITE = 'https://slushfund.net';
const NO_CANONICAL = new Set(['/rebuilding', '/withdrawn']);
function metaContent(html, attr, name) {
  const tag = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`${attr}="${name}"`).test(t));
  if (!tag) return null;
  const v = /(?:content|href)="([^"]*)"/.exec(tag);
  return v ? v[1].replace(/&amp;/g, '&') : null;
}
function seoGate(path, html) {
  if (!html) return; // the wording row already fails on a non-200
  const pathname = new URL(base + path).pathname;
  const gated = matchGatedPage(pathname);
  const want = NO_CANONICAL.has(pathname) || gated ? null : SITE + (pathname === '/' ? '' : pathname);
  const canonical = metaContent(html, 'rel', 'canonical');
  const ogUrl = metaContent(html, 'property', 'og:url');
  const ogTitle = metaContent(html, 'property', 'og:title');
  const same = (a, b) => (a ?? '').replace(/\/$/, '') === (b ?? '').replace(/\/$/, '') && (a === null) === (b === null);
  const titleOk = pathname === '/' || want === null || (ogTitle !== null && ogTitle !== 'SlushFund: follow public money');
  // A page-level openGraph replaces the inherited image, so every page must still name one.
  const ogImage = metaContent(html, 'property', 'og:image');
  const ok = same(canonical, want) && same(ogUrl, want) && titleOk && ogImage !== null;
  if (!ok) failed++;
  rows.push({
    path, status: `canonical ${canonical ?? 'none'} · og:url ${ogUrl ?? 'none'}`, expect: want ?? 'none', ok,
    note: [titleOk ? '' : `og:title "${ogTitle}"`, ogImage ? `og:image ${ogImage.replace(SITE, '').replace(/\?.*$/, '')}` : 'no og:image'].filter(Boolean).join(' · '),
    group: 'canonical and og:url (D8d N1)',
  });
}
const sitemapXml = await (await fetch(base + '/sitemap.xml')).text();
const sitemapPaths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname || '/');
const WORDING_PATHS = [...new Set([
  ...sitemapPaths,
  ...KEEP_DYNAMIC.values(),
  '/people/S001201', '/people/A000383', '/people/M001186',
  '/agencies', '/investigations', '/rebuilding', '/search?q=Warren', '/latest.xml',
  '/latest?type=awards', '/latest?chamber=Senate', '/data/trades?instrument=option', '/data/contracts?fy=2026',
  ...FLAG_ROWS.map(([, u]) => u),
  '/analysis/conflicts',
  ...(lateFilersEnabled() ? ['/data/late-filers?chamber=Senate&over=365&members=all', '/data/late-filers?msort=reports&rsort=recent&page=2'] : []),
])];
if (sitemapPaths.length < 10) { failed++; rows.push({ path: '/sitemap.xml', status: sitemapPaths.length, expect: '>= 10 URLs', ok: false, note: 'sitemap read for the wording gate', group: 'wording gate (D8a)' }); }
for (const p of WORDING_PATHS) await wordingGate(p);

// ---------------------------------------------------------------- D8e (A8 N2-N6, N9-N11): copy and labels
// Checks that need a count run against the database with the same anon key the pages use (restAll).
const D8E = 'copy and labels (D8e)';
function d8e(path, ok, note, expect = 'ok') {
  if (!ok) failed++;
  rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: D8E });
}
const fetchHtml = async (p) => { const r = await fetch(base + p); return { status: r.status, html: (await r.text()).replace(/<!-- -->/g, '') }; };
const nfmt = (n) => Number(n).toLocaleString('en-US');

// N2, N3, N11: method copy, committee wording and copy nits (absent and present phrases).
await hit('/about/methodology/trades', 200, {
  bodyAll: ['Options are shown with their terms', 'strike price', 'second link beside it', 'hand-built map links to a committee the member sat on', 'publishes no match rate'],
  notBody: ['but not whether it was a call or a put', 'We do not show days-to-file yet', 'audit of this dataset is not finished', 'committee the member serves on'], group: D8E });
await hit('/about/methodology/contracts', 200, { bodyAll: ['A separate review the same month'], notBody: ['independent audit is not finished'], group: D8E });
await hit('/about/methodology/tickers', 200, {
  bodyAll: ['hand-built map links to a committee the member sat on', 'publishes no overall match rate'],
  notBody: ['independent audit is not finished', 'whose business sits under a committee', 'committee the member serves on'], group: D8E });
await hit('/about/methodology', 200, { bodyAll: ['Official records first', 'labelled as ours'], notBody: ['nothing typed in by hand', 'the FEC, congress.gov'], group: D8E });
await hit('/about', 200, { bodyAll: ['Campaign money and lobbying are planned and not loaded yet', 'congress-legislators'], notBody: ['the FEC and congress.gov'], group: D8E });
await hit('/latest', 200, { bodyAll: ['are not checked one by one before they appear here'], notBody: ['Everything here is unaudited'], group: D8E });
await hit('/companies', 200, { bodyAll: ['foreign governments, funds and other organisations'], group: D8E });
await hit('/people/T000278', 200, { bodyAll: ['An option is a contract tied to a stock'], notBody: ['An option is a bet', 'Self (incl. trusts/accounts)', 'a bet on'], group: D8E });
await hit('/people/G000583', 200, { bodyAll: ['Disclosed trades', 'Self (incl. trusts/accounts)'], notBody: ['An option is a bet'], group: D8E });
await hit('/people/M001203', 200, { bodyAll: ['Past seats are not shown yet'], notBody: ['Past seats are not in our records yet'], group: D8E });
{
  // A count of 1 reads "is a scanned image" / "was filed on paper", never "1 of ... are".
  let bad = [];
  for (const p of ['/people/M001203', ...KEEP_DYNAMIC.values()].filter((p) => p.startsWith('/people/'))) {
    const t = visibleText((await fetchHtml(p)).html);
    if (/(?:^|\D)1 of this (?:member|senator)\S* (?:House|Senate) reports[^.]*\b(?:are|were)\b/.test(t)) bad.push(p);
  }
  d8e('/people/M001203 (singular report count)', bad.length === 0, bad.length ? `plural verb after "1 of": ${bad.join(', ')}` : 'agrees');
}

// N4: /data/status prints the newest period end, as the database holds it.
{
  const [latest] = await restAll('contract_spending_summary?select=period_end&period_end=not.is.null&order=period_end.desc&limit=1').then((r) => r.slice(0, 1)).catch(() => []);
  const want = latest ? new Date(`${latest.period_end}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
  const t = visibleText((await fetchHtml('/data/status')).html);
  const got = t.match(/Latest period ends\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/)?.[1] ?? null;
  d8e('/data/status "Latest period ends"', !!want && got === want, `page ${got}, database ${want}`);
  d8e('/data/status static unread-filings count', /In our count of Oct 3, 2026/.test(t) && !/unaudited/i.test(t), 'dated count, no "unaudited"');
}

// N5: purchases + sales + exchanges + options and other = disclosed trades, on /people, company pages and member pages.
const trows = await restAll('congress_trades?select=bio_guide_id,transaction_type,asset_type,company_name,option_type&order=id.asc');
const byMember = new Map();
for (const r of trows) {
  if (!r.bio_guide_id) continue;
  const s = byMember.get(r.bio_guide_id) ?? { t: 0, b: 0, s: 0, x: 0, o: 0 };
  s.t++;
  if (instrumentKind(r) !== 'stock') s.o++;
  else if (r.transaction_type === 'BUY') s.b++;
  else if (r.transaction_type.startsWith('SELL')) s.s++;
  else s.x++;
  byMember.set(r.bio_guide_id, s);
}
function tableSums(html) {
  // Every table with an Exchanges column: each body row's cells must add up (header names pick the columns).
  const out = [];
  for (const tb of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const head = [...(tb[0].match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => visibleText(m[1]).replace(/[▲▼↑↓]/g, '').trim());
    const ix = (re) => head.findIndex((h) => re.test(h));
    const c = { t: ix(/^(Disclosed|Reported) trades/), b: ix(/purchases/i), s: ix(/sales/i), x: ix(/^Exchanges/), o: ix(/Options and other/) };
    if (Object.values(c).some((i) => i < 0)) continue;
    for (const tr of (tb[0].match(/<tbody[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const cells = [...tr[0].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/g)].map((m) => visibleText(m[1]).trim());
      const n = (i) => Number((cells[i] ?? '').replace(/,/g, ''));
      if ([c.t, c.b, c.s, c.x, c.o].some((i) => !Number.isFinite(n(i)))) continue;
      out.push({ who: cells[0], t: n(c.t), sum: n(c.b) + n(c.s) + n(c.x) + n(c.o), x: n(c.x) });
    }
  }
  return out;
}
for (const p of ['/people', '/people?chamber=Senate', '/people?q=Hern', '/people?status=former', '/companies/lockheed-martin-corp-zfn2jjxblzt3']) {
  const rowsSum = tableSums((await fetchHtml(p)).html);
  const bad = rowsSum.filter((r) => r.t !== r.sum);
  d8e(`${p} (columns add up)`, rowsSum.length > 0 && bad.length === 0, `${rowsSum.length} rows checked${bad.length ? `, ${bad.length} do not add up, e.g. ${bad[0].who}: ${bad[0].t} vs ${bad[0].sum}` : `, ${rowsSum.filter((r) => r.x > 0).length} with exchanges`}`);
}
{
  const top = [...byMember.entries()].filter(([, s]) => s.x > 0).sort((a, b) => b[1].x - a[1].x).slice(0, 4);
  for (const [id, s] of top) {
    const t = visibleText((await fetchHtml(`/people/${id}`)).html);
    const m = t.match(/disclosed transactions: ([\d,]+) stock purchases?, ([\d,]+) sales?(?:, ([\d,]+) exchanges?)?(?:, ([\d,]+) options and other)?/);
    const n = (v) => (v == null ? 0 : Number(v.replace(/,/g, '')));
    const total = t.match(/Disclosed trades\s+([\d,]+)/)?.[1];
    const got = m ? { b: n(m[1]), s: n(m[2]), x: n(m[3]), o: n(m[4]) } : null;
    const ok = !!got && got.b === s.b && got.s === s.s && got.x === s.x && got.o === s.o && n(total) === s.t && got.b + got.s + got.x + got.o === n(total);
    d8e(`/people/${id} (member header adds up)`, ok, ok ? `${nfmt(s.t)} = ${nfmt(s.b)} + ${nfmt(s.s)} + ${nfmt(s.x)} exchanges + ${nfmt(s.o)} options and other` : `page ${JSON.stringify(got)} total ${total}, database ${JSON.stringify(s)}`);
  }
}

// N6: labels say what is counted.
d8e('MONEY_TYPES.trades.label', MONEY_TYPES.trades.label === 'Disclosed trades', MONEY_TYPES.trades.label);
await hit('/', 200, { bodyAll: ['Disclosed trades', 'trades disclosed by members of Congress, on file: stocks, options and other assets'], notBody: ['stock trades disclosed by members'], group: D8E });
await hit('/data', 200, { bodyAll: ['Disclosed trades', 'stocks, options and other assets'], group: D8E });

// N9: a row links its first report; the amendment is a second link. CSV: filing_url is the first report.
{
  const rowsF = await restAll('congress_trades?select=id,disclosure_url,original_disclosure_url,filed_date,original_filed_date&bio_guide_id=eq.F000246&order=id.asc');
  const am = rowsF.find((r) => r.original_disclosure_url && r.disclosure_url && r.original_disclosure_url !== r.disclosure_url);
  if (!am) d8e('/people/F000246 (amendment links)', false, 'no amended row found for the sample member');
  else {
    const { html } = await fetchHtml('/people/F000246?show=all');
    // Both links sit in one table row. The amendment's address can also be another row's first report, so read the row.
    const trHtml = [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]).find((r) => r.includes(`href="${am.original_disclosure_url}"`) && r.includes(`href="${am.disclosure_url}"`));
    const labelIn = (r, url) => [...(r ?? '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => m[1] === url).map((m) => visibleText(m[2]).trim());
    const first = labelIn(trHtml, am.original_disclosure_url);
    const amend = labelIn(trHtml, am.disclosure_url);
    const ok = !!trHtml && first.length === 1 && /^View filing/.test(first[0]) && amend.length === 1 && /^Amended report/.test(amend[0]);
    d8e('/people/F000246 (amendment links)', ok, `first report ${am.original_disclosure_url.slice(-20)} labelled "${first[0]}"; amendment ${am.disclosure_url.slice(-20)} labelled "${amend[0]}"`);
    const csv = (await (await fetch(`${base}/data/trades/export?member=F000246`)).text()).split(/\r?\n/);
    const cells = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"'));
    const hd = cells(csv[0]);
    const iF = hd.indexOf('Filing URL (first report)');
    const iA = hd.indexOf('Amendment URL (blank if none)');
    const body = csv.slice(1).filter(Boolean).map(cells);
    const amended = body.filter((r) => r[iA]);
    const okCsv = iF > 0 && iA > 0 && amended.length > 0 && amended.every((r) => r[iF] && r[iF] !== r[iA]) && amended.some((r) => r[iA] === am.disclosure_url && r[iF] === am.original_disclosure_url);
    d8e('/data/trades/export?member=F000246 (first report, amendment)', okCsv, `${amended.length} amended rows of ${body.length}; header has ${hd.length} columns`);
  }
}

// N10: the /latest share card counts by first report. The card is an image, so the query is read from source.
{
  const src = readFileSync(join(ROOT, 'src', 'lib', 'v2', 'og-figures.ts'), 'utf8');
  const card = src.slice(src.indexOf('export async function latestCard'), src.indexOf('// ---------------------------------------------------------------- /about'));
  const ok = /gte\('original_filed_date'/.test(card) && !/gte\('filed_date'/.test(card) && /newest\?\.\[0\]\?\.original_filed_date/.test(card);
  const flat = trows.length ? await restAll('congress_trades?select=filed_date,original_filed_date&date_flag=is.null&original_filed_date=not.is.null&order=id.asc') : [];
  const newest = flat.reduce((m, r) => (r.original_filed_date > m ? r.original_filed_date : m), '');
  const since = new Date(new Date(`${newest}T00:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const byFirst = flat.filter((r) => r.original_filed_date >= since).length;
  const byFiled = flat.filter((r) => r.filed_date >= since).length;
  d8e('og-figures.ts latestCard (first report)', ok, `query reads original_filed_date; by first report ${byFirst} trades since ${since}, by filed_date ${byFiled}`);
}

const byGroup = {};
for (const r of rows) (byGroup[r.group] ??= []).push(r);
console.log('| Group | Request | Expected | Got | Result | Note |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.group} | \`${r.path}\` | ${r.expect} | ${r.status} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`);
console.log(`\n${rows.length} requests, ${failed} failed.`);
console.log('\n## Route inventory\n');
const invOk = printInventory();
process.exit(failed || !invOk ? 1 : 0);
