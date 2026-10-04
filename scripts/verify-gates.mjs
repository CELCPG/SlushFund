// Proves the trust gate (D5) against a running server and prints the route inventory.
//
//   node scripts/verify-gates.mjs inventory            route inventory only (no server)
//   node scripts/verify-gates.mjs http://localhost:3217  status-code table; exit 1 on any failure
//
// The lists come from src/lib/v2/redirect-map.ts (Node strips the types on import). Every route
// found under src/app must be classified here; an unclassified route fails the run, so a new
// legacy page cannot slip into a preview deploy unnoticed.
import { readdirSync, statSync } from 'node:fs';
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
import { lateFilersEnabled } from '../src/lib/v2/flags.ts';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const APP = join(ROOT, 'src', 'app');

// v2 pages and routes that stay reachable. Everything else under src/app must be gated,
// redirected or retired.
const KEEP_PAGES = new Set([
  '/', '/about', '/about/corrections', '/about/data-status', '/about/methodology', '/about/methodology/contracts',
  '/about/methodology/tickers', '/about/methodology/trades', '/companies', '/data', '/design', '/design/story',
  '/investigations', '/people', '/rebuilding', '/search', '/withdrawn', '/agencies',
  '/data/trades', '/data/contracts', '/data/late-filers',
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
  ['/api/og', 'share-card image; draws a figure only when its source comes with it'],
  ['/feed.xml', 'valid RSS with no items'],
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
async function hit(path, expect, extra = {}) {
  const res = await fetch(base + path, { redirect: 'manual', method: extra.method ?? 'GET' });
  // React puts <!-- --> between text and interpolated values; strip them so phrases match as a reader sees them.
  const body = extra.body || extra.bodyAll || extra.notBody || extra.noindex || extra.startsWith ? (await res.text()).replace(/<!-- -->/g, '') : '';
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
  rows.push({ path, status: res.status, expect, ok, note: loc ? `→ ${loc}` : robots ? `robots: ${robots}` : '', group: extra.group });
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
await hit('/data/trades', 200, { bodyAll: ['Stock trades by members of Congress', 'Download CSV', 'View filing'], notBody: ['days to file', 'noindex'], group: 'explorers (D4)' });
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
await hit('/data/late-filers', 200, { bodyAll: ['the STOCK Act asks for 45', 'View filing', 'Preview only'], noindex: true, notBody: ['violation', 'illegal', 'broke the law', 'guilty', 'crime', 'stock_act_late'], group: 'late filers (D4)' });
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

// 6. Kept v2 pages
for (const p of KEEP_PAGES) {
  if (p === '/withdrawn') { await hit(p, 410, { group: 'keep (v2)' }); continue; }
  if (p === '/search') { await hit('/search?q=Warren', 200, { group: 'keep (v2)' }); continue; }
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

const byGroup = {};
for (const r of rows) (byGroup[r.group] ??= []).push(r);
console.log('| Group | Request | Expected | Got | Result | Note |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.group} | \`${r.path}\` | ${r.expect} | ${r.status} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`);
console.log(`\n${rows.length} requests, ${failed} failed.`);
console.log('\n## Route inventory\n');
const invOk = printInventory();
process.exit(failed || !invOk ? 1 : 0);
