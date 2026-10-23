// Proves the trust gate (D5) against a running server and prints the route inventory.
//
//   node scripts/verify-gates.mjs inventory            route inventory only (no server)
//   node scripts/verify-gates.mjs http://localhost:3217  status-code table; exit 1 on any failure
//
// The lists come from src/lib/v2/redirect-map.ts (Node strips the types on import). Every route
// found under src/app must be classified here; an unclassified route fails the run, so a new
// legacy page cannot slip into a preview deploy unnoticed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
import {
  ANALYTICS_PATH, ELECTION_PATH, GRADE_METHOD_PATH, GRAPHIC_SLUGS, GRAPHICS_PATH, MOST_ACTIVE_PATH, PRESIDENT_PATH, SECTOR_HEATMAP_PATH, analyticsHubEnabled, campaignMoneyEnabled, designPagesEnabled, electionCenterEnabled, graphicEnabled, gradesEnabled, hiddenByFlag, infographicsEnabled, investigationsV2Enabled, lateFilersEnabled, lateFilersPreview,
  moneyTrailEnabled, mostActiveEnabled, presidentPageEnabled, readFailureInjected, sectorHeatmapEnabled, VOTER_PATH, voterPagesEnabled,
} from '../src/lib/v2/flags.ts';
import { GRADE_FIXED_LINE, NOT_GRADED_GROUP_LINE, activityOf, gradeClass, gradeOf, inWindow, notGradedLine, unreadCaveat, unreadInWindow, windowStart } from '../src/lib/v2/grade-method.ts';
import { ELECTION_DAY, MONEY_KEYS, averageLetter, daysUntil, moneyTotals } from '../src/lib/v2/election-calc.ts';
import { VOTER_NOT_FINDING, VOTER_SCOPE, VOTER_TITLE, voterWhat } from '../src/lib/v2/voter-copy.ts';
import { TRAIL_CAPTION, TRAIL_COUNTS_LINE, TRAIL_NO_TRADES } from '../src/lib/v2/money-trail-copy.ts';
import { hiddenPageMetadata } from '../src/lib/v2/hidden-page.ts';
import { HONEYPOT_FIELD, RATE_LIMIT, REPLY_PROMISE, normalizePageUrl, reportErrorHref } from '../src/lib/v2/error-reports.ts';
import { HOME_HEADLINE_TEXT, MEMBERS_TILE_COPY, MEMBERS_TILE_LEAD } from '../src/lib/v2/home-copy.ts';
import { DATE_FLAG_FALLBACK, DATE_FLAG_WORDING, LATENESS_BASIS_WORDING, dateFlagNote, latenessNote } from '../src/lib/v2/date-flags.ts';
import { ALLOWED_VERBATIM, FORBIDDEN_PHRASES } from '../src/lib/v2/forbidden-words.ts';
import { navItems, shellPath } from '../src/components/v2/shell/nav.ts';
import {
  IRAN_WAR_PATH, PRESIDENT_HUB_PATH, PRESIDENT_LARGEST_PATH, PRESIDENT_QUALITY_PATH, PRESIDENT_TIMING_PATH, iranWarDraftRefused, iranWarStoryEnabled, iranWarStoryLive, presidentDeepDiveEnabled,
} from '../src/lib/v2/flags.ts';
import * as IW from '../src/lib/v2/iran-war-core.ts';
import * as C from '../src/lib/v2/iran-war-copy.ts';
import { COMPLIANCE_SENTENCE, binOf, computeHub, displayAsset, isPerpetual } from '../src/lib/v2/president-hub-core.ts';
import { LARGEST_FLOOR, VERIFIED_LARGEST, isCheckedAgainstPage } from '../src/lib/v2/president-largest-verified.ts';
import { AUDITS, HISTORY } from '../src/lib/v2/president-audit-record.ts';
import { instrumentKind } from '../src/lib/v2/instruments.ts';
import { MONEY_TYPES } from '../src/lib/v2/money.ts';
import * as SF from '../src/lib/v2/story-figures.ts';
import { STORY_RESPONSES } from '../src/data/story-responses.ts';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const APP = join(ROOT, 'src', 'app');

// v2 pages and routes that stay reachable. Everything else under src/app must be gated,
// redirected or retired.
const KEEP_PAGES = new Set([
  '/', '/about', '/about/corrections', '/about/methodology', '/about/methodology/contracts',
  '/about/methodology/tickers', '/about/methodology/trades', '/companies', '/data', '/design', '/design/story',
  '/investigations', '/people', '/rebuilding', '/search', '/withdrawn', '/agencies',
  '/data/trades', '/data/contracts', '/data/late-filers', '/data/status', '/latest', '/report-an-error',
  // D9 / D10, each behind its flag (flags.ts)
  '/people/executive/donald-trump', '/data/most-active-traders', '/about/methodology/report-card',
  // D15 President section, behind SHOW_PRESIDENT_DEEPDIVE
  '/president', '/president/timing', '/president/largest', '/president/data-quality',
  // D19 analytics hub, behind SHOW_ANALYTICS_HUB
  '/analytics',
  // D18 sector heatmap, behind SHOW_SECTOR_HEATMAP
  '/data/what-congress-trades',
  // D11 voter pages, behind SHOW_VOTER_PAGES
  '/your-members',
  // D17 Election Center, behind SHOW_ELECTION_CENTER
  '/election-2026',
  // D20 infographic index, behind SHOW_INFOGRAPHICS
  '/graphics',
  // W2 Iran war story, behind SHOW_IRAN_WAR_STORY and refused on production while its copy is a draft (flags.ts)
  '/investigations/president-iran-war',
]);
// Dynamic v2 pages, each with a real sample URL that must answer 200.
const KEEP_DYNAMIC = new Map([
  ['/people/:bioguide', '/people/G000583'],
  ['/companies/:slug', '/companies/lockheed-martin-corp-zfn2jjxblzt3'],
  ['/agencies/:code', '/agencies/097'],
  ['/your-members/:state', '/your-members/vt'],
  // D20 graphics, behind SHOW_INFOGRAPHICS and the flag of the feature each one draws
  ['/graphics/:slug', '/graphics/grading-congress'],
  // D12 investigation posts, behind SHOW_INVESTIGATIONS_V2
  ['/investigations/:slug', '/investigations/federal-money-musk-companies-fy2024-2026'],
  // W2 Iran war story: one day of the timeline as JSON (the data route the day panel fetches)
  ['/investigations/president-iran-war/days/:date', '/investigations/president-iran-war/days/2026-03-02'],
]);
// Public data routes that return raw rows from the audited loaders, or no figures of ours at all.
const KEEP_ROUTES = new Map([
  ['/api/contracts', 'raw award rows (r5-v1)'],
  ['/api/contracts/:id', 'one raw award row'],
  ['/api/v1/contracts', 'raw award rows, documented API'],
  ['/api/v1/trades', 'raw trade rows, documented API (see issues: folded-lot sums in amount columns)'],
  ['/data/trades/export', 'CSV of the trades matching the explorer filters, row-capped (D4)'],
  ['/data/contracts/export', 'CSV of the non-competed awards matching the explorer filters, row-capped (D4)'],
  ['/api/report-an-error', 'F1: saves one error report with the anon key (INSERT only); honeypot and per-IP rate limit'],
  ['/api/stock/:ticker', 'price history from a public quote feed, no figures of ours'],
  ['/api/newsletter/subscribe', 'signup write; fails visibly until Buttondown is wired (D7)'],
  ['/feed.xml', 'valid RSS with no items'],
  ['/latest.xml', 'RSS of new trade reports and awards, data items only, each linking to the official record (D6b)'],
  ['/sitemap.xml', 'live URLs only'],
  ['/opengraph-image', 'site share card'],
  // W2 Iran war story downloads (the frozen chronology with its sha256, the pre-registration, the issuer map), behind the story's flag
  ['/investigations/president-iran-war/chronology.csv', 'frozen chronology CSV, served byte for byte (W2)'],
  ['/investigations/president-iran-war/issuer-map.csv', 'issuer map CSV from issuer_classification (W2)'],
  ['/investigations/president-iran-war/preregistration.md', 'the pre-registration, embedded verbatim (W2)'],
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

// W2: is the server under test a production deployment? The shell always carries VERCEL_ENV=production (the flag rows need it), but the Iran war
// story refuses to render on production while its copy is a draft (flags.ts), so the draft is served by a NON-production server. Two things
// follow VERCEL_ENV alone, with no SHOW_ flag: /design (404 on production) and the late-filers "preview only" wording. Those rows, and the
// Iran war story rows, read SERVER_ENV: the shell's env when the server is a production build, an empty env when it is not. The mode is
// probed from the server (/design answers 404 only on production); GATE_SERVER_PRODUCTION=1|0 overrides the probe.
const SERVER_PRODUCTION = process.env.GATE_SERVER_PRODUCTION === '1' ? true : process.env.GATE_SERVER_PRODUCTION === '0' ? false : await fetch(base + '/design', { redirect: 'manual' }).then((r) => r.status === 404, () => true);
const SERVER_ENV = SERVER_PRODUCTION ? process.env : {};
const iranLive = iranWarStoryLive(C.DRAFT_UNTIL_AW1, SERVER_ENV);

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
if (lateFilersEnabled()) {
  await hit('/data/late-filers', 200, { bodyAll: ['asks for a report within 45 days', 'View filing', ...(lateFilersPreview(SERVER_ENV) ? ['Preview only'] : [])], noindex: lateFilersPreview(SERVER_ENV), notBody: ['violation', 'illegal', 'broke the law', 'guilty', 'crime', 'stock_act_late'], group: 'late filers (D4)' });
  await hit('/data/late-filers?chamber=Senate&over=365&msort=reports&members=all', 200, { notBody: ['unavailable right now'], group: 'late filers (D4)' });
  await hit('/data/late-filers?over=abc&chamber=x&page=-1&msort=zz', 200, { notBody: ['unavailable right now'], group: 'late filers (D4)' });
} else {
  await hit('/data/late-filers', 404, { group: 'late filers (D4)' }); // the board is off here (production without SHOW_LATE_FILERS=1)
}
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
  bodyAll: [MEMBERS_TILE_COPY[MEMBERS_TILE_LEAD].label, 'trades disclosed by members of Congress, on file', 'Non-competed contracts', 'not competed, $1 million or more', 'Source:', 'Coverage:', 'as of ',
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
  if (designPagesEnabled(SERVER_ENV)) await hit(p, 200, { noindex: true, group: 'launch blockers (D8d) L2' });
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
// A12 M4: awards are dated by date_signed and DoD posts ~90 days late, so the newest award can be older than the 40th-newest trade
// report (page 1) or the 50th (the feed). The merge in src/lib/v2/latest.ts is right either way, so an award is required on page 1 /
// in the feed only when the newest award is dated on or after that cut-off. /latest?type=awards below is the award render check.
// An award sorts before a trade of the same day, so "on or after the Nth-newest trade report's date" means it is inside the first N.
const latestCut = { page1: false, feed: false, note: '' };
try {
  const [aw] = await restAll('awards?select=date_signed&date_signed=not.is.null&order=date_signed.desc&limit=1');
  const trades = await restAll('congress_trades?select=original_filed_date&original_filed_date=not.is.null&order=original_filed_date.desc&limit=50');
  const awardDate = aw?.date_signed ?? null;
  const cut40 = trades[39]?.original_filed_date ?? null;
  const cut50 = trades[49]?.original_filed_date ?? null;
  latestCut.page1 = !!awardDate && (!cut40 || awardDate >= cut40);
  latestCut.feed = !!awardDate && (!cut50 || awardDate >= cut50);
  latestCut.note = `newest award ${awardDate}; 40th-newest trade report ${cut40}, 50th ${cut50}: award ${latestCut.page1 ? 'required' : 'not required'} on page 1, ${latestCut.feed ? 'required' : 'not required'} in the feed`;
  gateRow('/latest award expectation (data-aware)', true, latestCut.note, 'status and latest (D6b)');
} catch (e) {
  gateRow('/latest award expectation (data-aware)', false, `could not read newest award / trade dates: ${e.message}`, 'status and latest (D6b)');
}
await hit('/latest', 200, { bodyAll: ['New filings and awards', 'RSS feed', 'Awards have no chamber', 'data-kind="trade"', ...(latestCut.page1 ? ['data-kind="award"'] : []), 'first reported'], notBody: ['being rebuilt', 'risk score', 'high-risk', 'flagged contracts', 'unavailable right now'], group: 'status and latest (D6b)' });
await hit('/latest?chamber=House', 200, { body: 'data-kind="trade"', notBody: ['data-kind="award"', 'unavailable right now'], noindex: true, group: 'status and latest (D6b)' });
await hit('/latest?type=awards', 200, { body: 'data-kind="award"', notBody: ['data-kind="trade"', 'unavailable right now'], noindex: true, group: 'status and latest (D6b)' });
await hit('/latest?chamber=zz&type=zz&page=-3', 200, { notBody: ['unavailable right now'], group: 'status and latest (D6b) junk input' });
await hit('/latest?page=99999', 200, { notBody: ['unavailable right now'], group: 'status and latest (D6b) junk input' });
await hit('/latest.xml', 200, { ctype: 'rss', startsWith: '<?xml', bodyAll: ['<item>', 'slushfund:trade:', ...(latestCut.feed ? ['slushfund:award:', '<category>Contract award</category>'] : []), 'official record', '<category>Congressional trade report</category>'], notBody: ['withdrawn', '/investigations', '/blog', 'risk score', 'suspicious', 'stale_2y'], group: 'status and latest (D6b) rss' });
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
    bodyAll: ['Reports with a trade over 45 days', 'Transactions in them', 'transactions in', 'The gap is not computed for', 'below the $1,000 reporting threshold', 'Dates are as the member filed them', 'asks for a report within 45 days'],
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
  if ((p === '/design' || p === '/design/story') && !designPagesEnabled(SERVER_ENV)) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D8d L2
  if (p === '/data/late-filers' && !lateFilersEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // the board is off (production without SHOW_LATE_FILERS=1)
  if (p === ELECTION_PATH && !electionCenterEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D17: off on production without SHOW_ELECTION_CENTER=1
  if (p === ANALYTICS_PATH && !analyticsHubEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D19: off on production without SHOW_ANALYTICS_HUB=1
  if (p === VOTER_PATH && !voterPagesEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D11: off on production without SHOW_VOTER_PAGES=1
  if ((p === PRESIDENT_HUB_PATH || p.startsWith(`${PRESIDENT_HUB_PATH}/`)) && !presidentDeepDiveEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D15: off on production without SHOW_PRESIDENT_DEEPDIVE=1
  if (p === SECTOR_HEATMAP_PATH && !sectorHeatmapEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D18: off on production without SHOW_SECTOR_HEATMAP=1
  if (p === GRAPHICS_PATH && !infographicsEnabled()) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // D20: off on production without SHOW_INFOGRAPHICS=1
  if (p === IRAN_WAR_PATH && !iranLive) { await hit(p, 404, { group: 'keep (v2)' }); continue; } // W2: off on production without SHOW_IRAN_WAR_STORY=1, and refused while the copy is a draft
  await hit(p, 200, { group: 'keep (v2)', noindex: p === '/design' || p === '/design/story' || p === '/rebuilding' });
}
// The draft corrections entry must not render while its status is 'draft' and the preview flag is off.
if (process.env.SHOW_DRAFT_CORRECTIONS !== '1') {
  await hit('/about/corrections', 200, { notBody: '17 stories withdrawn', group: 'corrections draft hidden' });
  await hit('/about/corrections', 200, { body: 'The corrections log opens with the rebuilt site', group: 'corrections draft hidden' });
  await hit('/sitemap.xml', 200, { notBody: '/about/corrections', group: 'corrections draft hidden' });
}
const dynamicOff = (route) => (route.startsWith(VOTER_PATH) && !voterPagesEnabled()) || (route.startsWith(GRAPHICS_PATH) && !graphicEnabled('grading-congress')) || (route.startsWith(`${IRAN_WAR_PATH}/`) ? !iranLive : route.startsWith('/investigations/') && !investigationsV2Enabled());
for (const [route, url] of KEEP_DYNAMIC) await hit(url, dynamicOff(route) ? 404 : 200, { group: `keep (v2) ${route}` });
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
// W2: the first element that carries `attr` (an attribute name, e.g. "data-our-view"), with its tags balanced; null when absent.
function elementWith(html, attr, from = 0) {
  const at = html.indexOf(` ${attr}`, from);
  if (at === -1) return null;
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-zA-Z][\w-]*)/.exec(html.slice(open))?.[1];
  if (!tag) return null;
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = open + 1;
  let depth = 1;
  for (let m; (m = re.exec(html)); ) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return { html: html.slice(open, m.index + m[0].length), start: open, end: m.index + m[0].length };
  }
  return null;
}
function withoutElements(html, attrs) {
  let out = html;
  for (const a of attrs) for (let el = elementWith(out, a); el; el = elementWith(out, a)) out = out.slice(0, el.start) + out.slice(el.end);
  return out;
}
// A small CSV reader (quoted cells, doubled quotes, CR/LF), for the downloads.
function csvRows(text) {
  const out = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; out.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
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
  // W2: the Colin-approved "Our view" box is the one element on the Iran war story where "insider trading" and "illegal" may print; it is
  // left out of this scan and has its own W2 row, which scans it against the rest of the list with only that approved sentence removed.
  const text = visibleText(path === IRAN_WAR_PATH ? withoutElements(html, ['data-our-view']) : html);
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
  ...[...KEEP_DYNAMIC.entries()].filter(([r]) => !dynamicOff(r) && r !== `${IRAN_WAR_PATH}/days/:date`).map(([, u]) => u), // W2: the day route is JSON (verbatim posts), checked by the W2 rows
  ...(voterPagesEnabled() ? [`${VOTER_PATH}?zip=00000`, `${VOTER_PATH}?zip=12ab`, `${VOTER_PATH}/ca?zip=94110`, `${VOTER_PATH}/dc`] : []),
  '/people/S001201', '/people/A000383', '/people/M001186',
  '/agencies', '/investigations', '/rebuilding', '/search?q=Warren', '/latest.xml',
  '/latest?type=awards', '/latest?chamber=Senate', '/data/trades?instrument=option', '/data/contracts?fy=2026',
  ...FLAG_ROWS.map(([, u]) => u),
  ...(infographicsEnabled() ? [GRAPHICS_PATH] : []),
  ...GRAPHIC_SLUGS.filter((g) => graphicEnabled(g)).flatMap((g) => [`${GRAPHICS_PATH}/${g}`, `${GRAPHICS_PATH}/${g}?card=1`]),
  '/analysis/conflicts',
  '/report-an-error', '/report-an-error?sent=1', '/report-an-error?from=%2Fpeople%2FG000583&error=message',
  ...(lateFilersEnabled() ? ['/data/late-filers?chamber=Senate&over=365&members=all', '/data/late-filers?msort=reports&rsort=recent&page=2'] : []),
  ...(presidentPageEnabled() ? [`${PRESIDENT_PATH}?class=bond&sort=band`, `${PRESIDENT_PATH}?class=fund`, `${PRESIDENT_PATH}?sort=band&page=2`] : []),
  ...(mostActiveEnabled() ? [`${MOST_ACTIVE_PATH}?sort=value`, `${MOST_ACTIVE_PATH}?sort=late&all=1`] : []),
  ...(analyticsHubEnabled() ? [ANALYTICS_PATH] : []),
  ...(sectorHeatmapEnabled() ? [`${SECTOR_HEATMAP_PATH}?months=6&measure=net`, `${SECTOR_HEATMAP_PATH}?months=12&sector=ai-tech`, `${SECTOR_HEATMAP_PATH}?sector=unclassified`] : []),
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
await hit('/about/methodology/contracts', 200, { bodyAll: ['A separate review on October 4, 2026'], notBody: ['independent audit is not finished'], group: D8E });
await hit('/about/methodology/tickers', 200, {
  bodyAll: ['hand-built map links to a committee the member sat on', 'publishes no overall match rate'],
  notBody: ['independent audit is not finished', 'whose business sits under a committee', 'committee the member serves on'], group: D8E });
await hit('/about/methodology', 200, { bodyAll: ['Official records first', 'labelled as ours'], notBody: ['nothing typed in by hand', 'the FEC, congress.gov'], group: D8E });
// D14: with the campaign-money flag on the dek says campaign money is shown and only lobbying is not loaded.
await hit('/about', 200, { bodyAll: [campaignMoneyEnabled() ? 'Campaign money is shown on member pages; lobbying is planned and not loaded yet' : 'Campaign money and lobbying are planned and not loaded yet', 'congress-legislators'], notBody: ['the FEC and congress.gov'], group: D8E });
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

// ---------------------------------------------------------------- F1: error-report form (L5), headline (N12), A8b items, L0
const F1 = 'last fixes (F1)';
function f1(path, ok, note, expect = 'ok') {
  if (!ok) failed++;
  rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: F1 });
}
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base.replace(/\/$/, ''));
async function postReport(body, { ip, form = false, accept = 'application/json' } = {}) {
  const headers = { 'x-real-ip': ip, 'x-forwarded-for': ip, 'user-agent': 'verify-gates-f1', Accept: accept };
  const init = { method: 'POST', redirect: 'manual', headers };
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; init.body = new URLSearchParams(body).toString(); }
  else { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const r = await fetch(base + '/api/report-an-error', init);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a redirect has no JSON */ }
  return { status: r.status, json, location: r.headers.get('location') || '' };
}

// The form page renders, prefilled from ?from=, with the honeypot and the reply promise; no email address.
await hit('/report-an-error?from=%2Fpeople%2FG000583', 200, {
  bodyAll: ['Report an error', 'name="page_url"', 'value="/people/G000583"', 'name="message"', 'name="contact"', `name="${HONEYPOT_FIELD}"`, 'action="/api/report-an-error"', 'within 2 business days'],
  notBody: ['mailto:', 'Colin to supply', 'unavailable right now'], group: F1 });
await hit('/report-an-error?sent=1', 200, { body: REPLY_PROMISE, group: F1 });
await hit('/report-an-error?from=%2Fx&error=message', 200, { body: 'Describe the error in 10 to 4,000 characters.', group: F1 });
// The address field stays empty for an off-site ?from= (the URL itself is echoed in the page payload, so read the input).
for (const q of ['https%3A%2F%2Fevil.example%2Fx', '%2F%2Fevil.example%2Fx', 'javascript%3Aalert(1)']) {
  const { status, html } = await fetchHtml(`/report-an-error?from=${q}`);
  const input = html.match(/<input[^>]*name="page_url"[^>]*>/)?.[0] ?? '';
  f1(`/report-an-error?from=${q} (address field)`, status === 200 && /value=""/.test(input), `${status} ${input.match(/value="[^"]*"/)?.[0] ?? 'no value'}`, '200, value=""');
}
for (const [raw, want] of [['/people/G000583', '/people/G000583'], [' /data/trades ', '/data/trades'], ['https://slushfund.net/companies', 'https://slushfund.net/companies'],
  ['//evil.example/x', null], ['https://evil.example/', null], ['https://slushfund.net.evil.example/', null], ['javascript:alert(1)', null], ['', null], [42, null]]) {
  const got = normalizePageUrl(raw);
  f1(`normalizePageUrl(${JSON.stringify(raw)})`, got === want, `got ${JSON.stringify(got)}`, String(want));
}
f1('reportErrorHref("/about/methodology/trades")', reportErrorHref('/about/methodology/trades') === '/report-an-error?from=%2Fabout%2Fmethodology%2Ftrades', reportErrorHref('/about/methodology/trades'));

// POSTs: a filled honeypot is refused (JSON and plain form), bad input is refused, nothing is stored.
{
  const ip = `10.250.${runId.length}.1-${runId}`;
  const valid = { page_url: '/people/G000583', message: `[verify-gates F1 ${runId}] automated check of the error-report form; deleted at once.` };
  let r = await postReport({ ...valid, [HONEYPOT_FIELD]: 'http://spam.example' }, { ip });
  f1('POST with the honeypot filled (JSON)', r.status === 400 && r.json?.error === 'rejected', `${r.status} ${JSON.stringify(r.json)}`, '400 rejected');
  r = await postReport({ ...valid, [HONEYPOT_FIELD]: 'x' }, { ip: `${ip}-form`, form: true, accept: 'text/html' });
  f1('POST with the honeypot filled (plain form, no JavaScript)', r.status === 303 && r.location.includes('error=rejected'), `${r.status} → ${r.location}`, '303 → ?error=rejected');
  r = await postReport({ page_url: '/x', message: 'short' }, { ip: `${ip}-short` });
  f1('POST with a 5-character message', r.status === 400 && r.json?.error === 'message', `${r.status} ${r.json?.error}`, '400 message');
  r = await postReport({ page_url: 'https://evil.example/x', message: valid.message }, { ip: `${ip}-url` });
  f1('POST with an off-site page address', r.status === 400 && r.json?.error === 'page_url', `${r.status} ${r.json?.error}`, '400 page_url');
  // Rate limit: RATE_LIMIT.max attempts (honeypot, so nothing is stored), then one more from the same address.
  const rl = `${ip}-rl`;
  for (let i = 0; i < RATE_LIMIT.max; i++) await postReport({ ...valid, [HONEYPOT_FIELD]: 'x' }, { ip: rl });
  r = await postReport({ ...valid, [HONEYPOT_FIELD]: 'x' }, { ip: rl });
  f1(`POST number ${RATE_LIMIT.max + 1} from one address in 10 minutes`, r.status === 429 && r.json?.error === 'rate_limited', `${r.status} ${r.json?.error}`, '429 rate_limited');
  r = await fetch(base + '/api/report-an-error').then((x) => ({ status: x.status }));
  f1('GET /api/report-an-error', r.status === 405, String(r.status), '405');

  // A valid POST is saved (local runs only), then removed at once with the service key, read from local files only.
  if (!isLocal) f1('valid POST saved and cleaned up', true, `skipped: ${base} is not a local server (no test rows on a deployment)`);
  else {
    let svc = process.env.SLUSHFUND_SUPABASE_SERVICE_ROLE_KEY || '';
    for (const [file, name] of [[join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', '.env'), 'SLUSHFUND_SUPABASE_SERVICE_ROLE_KEY'], [join(ROOT, '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY']]) {
      if (svc) break;
      try { svc = readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.match(new RegExp(`^${name}=(.*)$`))).find(Boolean)?.[1]?.replace(/^["']|["']$/g, '') || ''; } catch { /* no file */ }
    }
    const { url } = anonCreds();
    if (!svc || !url) f1('valid POST saved and cleaned up', false, 'no service key in ~/.openclaw/.env or .env.local: not posting a row that could not be removed');
    else {
      const sh = { apikey: svc, Authorization: `Bearer ${svc}` };
      const tagQ = `message=like.*${encodeURIComponent(`[verify-gates F1 ${runId}]`)}*`;
      r = await postReport({ ...valid, contact: 'verify-gates@localhost' }, { ip: `${ip}-ok` });
      const got = await fetch(`${url}/rest/v1/error_reports?select=page_url,contact,status,forwarded_at,user_agent_hash&${tagQ}`, { headers: sh }).then((x) => x.json()).catch(() => null);
      const del = await fetch(`${url}/rest/v1/error_reports?${tagQ}`, { method: 'DELETE', headers: { ...sh, Prefer: 'return=representation' } }).then((x) => x.json()).catch(() => null);
      const left = await fetch(`${url}/rest/v1/error_reports?select=id&message=like.*verify-gates%20F1*`, { headers: sh }).then((x) => x.json()).catch(() => null);
      const row = Array.isArray(got) ? got[0] : null;
      f1('valid POST (JSON) is saved', r.status === 201 && r.json?.ok === true && Array.isArray(got) && got.length === 1, `${r.status} ${JSON.stringify(r.json)}; ${Array.isArray(got) ? got.length : 'error'} row(s) found with the service key`, '201, 1 row');
      f1('saved row: page, contact, status new, not forwarded, hashed user agent', !!row && row.page_url === '/people/G000583' && row.contact === 'verify-gates@localhost' && row.status === 'new' && row.forwarded_at === null && /^[0-9a-f]{32}$/.test(row.user_agent_hash ?? ''), row ? `status ${row.status}, ua hash ${String(row.user_agent_hash).length} hex` : 'no row');
      f1('test row removed with the service key (local only)', Array.isArray(del) && del.length === 1 && Array.isArray(left) && left.length === 0, `${Array.isArray(del) ? del.length : 'error'} deleted; ${Array.isArray(left) ? left.length : 'error'} verify-gates rows left`, '1 deleted, 0 left');
    }
  }
}
// anon on error_reports: INSERT only. SELECT, UPDATE and DELETE answer 401 (or touch nothing); INSERT cannot read back.
{
  const { url, key } = anonCreds();
  const ah = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const none = '00000000-0000-0000-0000-000000000000';
  const verbs = [
    ['SELECT', () => fetch(`${url}/rest/v1/error_reports?select=*&limit=5`, { headers: ah })],
    ['UPDATE', () => fetch(`${url}/rest/v1/error_reports?id=neq.${none}`, { method: 'PATCH', headers: { ...ah, Prefer: 'return=representation' }, body: JSON.stringify({ status: 'closed' }) })],
    ['DELETE', () => fetch(`${url}/rest/v1/error_reports?id=neq.${none}`, { method: 'DELETE', headers: { ...ah, Prefer: 'return=representation' } })],
    ['INSERT read-back', () => fetch(`${url}/rest/v1/error_reports`, { method: 'POST', headers: { ...ah, Prefer: 'return=representation' }, body: JSON.stringify({ page_url: '/x', message: `[verify-gates F1 ${runId}] read-back test` }) })],
  ];
  for (const [verb, call] of verbs) {
    const res = await call();
    const t = (await res.text()).trim();
    const ok = res.status === 401 || res.status === 403 || (res.ok && (t === '' || t === '[]'));
    f1(`anon ${verb} on error_reports`, ok, `${res.status} ${t.slice(0, 60)}`, '401 or nothing');
  }
}
// Every "Report an error" link opens the form with ?from=<that page>; none points at the old /about anchor.
for (const p of ['/about/methodology/trades', '/about/methodology/contracts', '/about/methodology/tickers', '/about/corrections', '/investigations', '/about']) {
  await hit(p, 200, { body: `href="${reportErrorHref(p)}"`, notBody: ['/about#report-an-error', 'Colin to supply'], group: F1 });
}
await hit('/', 200, { bodyAll: ['data-report-link', 'href="/report-an-error"'], notBody: '/about#report-an-error', group: F1 }); // footer: ?from= is added in the browser
await hit('/withdrawn', 410, { body: 'data-report-link', group: F1 });
await hit('/no-such-page-f1', 404, { body: 'data-report-link', notBody: '/about#report-an-error', group: F1 });

// N12: Colin's headline and the Members tile led by the members with trades on file (= the database), in the h1, the card's alt.
{
  const { html } = await fetchHtml('/');
  const t = visibleText(html);
  const h1 = visibleText(html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? '').replace(/\s+([.,])/g, '$1').trim();
  f1('/ h1', h1 === HOME_HEADLINE_TEXT && HOME_HEADLINE_TEXT === 'See where public money goes, and who trades around it.', h1);
  const lead = t.match(new RegExp(`${MEMBERS_TILE_COPY[MEMBERS_TILE_LEAD].label}\\s+([\\d,]+)\\s+${MEMBERS_TILE_COPY[MEMBERS_TILE_LEAD].caption}`))?.[1];
  f1('/ Members tile = members with trades on file in the database', MEMBERS_TILE_LEAD === 'withTrades' && num(lead) === byMember.size, `page ${lead}, database ${byMember.size} members with a bioguide id on a trade`);
  f1('/ Members tile note keeps the full roster', /served from 2016 to today\./.test(t) && !/both ends/.test(t), 'small line present, old headline gone');
  const alt = metaContent(html, 'property', 'og:image:alt');
  f1('/ og:image:alt', alt === 'SlushFund: see where public money goes, and who trades around it.', String(alt));
}
// L0: no crons registered from vercel.json; /api/fec is gated.
{
  let v = null;
  try { v = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')); } catch { /* unreadable */ }
  f1('vercel.json has no crons', !!v && !('crons' in v), v ? `keys: ${Object.keys(v).join(', ') || 'none'}` : 'unreadable');
  await hit('/api/fec?committee_id=C00835959', 503, { group: F1 });
}
// Board switch: SHOW_LATE_FILERS=1 turns the board on in production; the preview note goes with it.
for (const [env, wantOn, wantPreview] of [[{}, true, true], [{ VERCEL_ENV: 'preview' }, true, true], [{ VERCEL_ENV: 'production' }, false, false],
  [{ VERCEL_ENV: 'production', SHOW_LATE_FILERS: '1' }, true, false], [{ VERCEL_ENV: 'production', SHOW_LATE_FILERS: '0' }, false, false],
  [{ VERCEL_ENV: 'production', SHOW_LATE_FILERS: 'true' }, false, false], [{ VERCEL_ENV: 'preview', SHOW_LATE_FILERS: '1' }, true, true]]) {
  const on = lateFilersEnabled(env);
  const pv = lateFilersPreview(env);
  f1(`lateFilersEnabled/Preview(${JSON.stringify(env)})`, on === wantOn && pv === wantPreview, `${on} / ${pv}`, `${wantOn} / ${wantPreview}`);
}
// W1 and B3: the board's title and tab, the /data card and the method sentence; "of N" says what N is.
if (lateFilersEnabled()) {
  await hit('/data/late-filers?members=all', 200, {
    bodyAll: ['Reports filed more than 45 days after the trade', 'Filed 45+ days after', 'with a computed gap)', '<title>Reports filed more than 45 days after the trade'],
    notBody: ['>Late filers<', 'Late filers:', 'unavailable right now'], group: F1 });
  await hit('/data', 200, { body: 'Reports filed more than 45 days after the trade', notBody: 'Late filers', group: F1 });
  await hit('/about/methodology/trades', 200, { body: 'reports filed more than 45 days after the trade</a>', notBody: ['late-filers board', 'Late filers'], group: F1 });
} else {
  await hit('/data/late-filers', 404, { group: F1 });
  await hit('/data', 200, { notBody: ['Reports filed more than 45 days after the trade', 'Filed 45+ days after'], group: F1 });
}
// N10b and the nit: the /latest card caption fits (no mid-word cut), and the unknown-member card says "Disclosed trades".
{
  const figs = readFileSync(join(ROOT, 'src', 'lib', 'v2', 'og-figures.ts'), 'utf8');
  const og = readFileSync(join(ROOT, 'src', 'lib', 'v2', 'og.tsx'), 'utf8');
  const labels = [...figs.matchAll(/statLabel: '([^']*)'/g)].map((m) => m[1]);
  const long = labels.filter((l) => l.length > 60);
  f1('share-card captions fit 60 characters; the clip is at a word', labels.length > 0 && long.length === 0 && og.includes('clipWords(opts.statLabel, 60)') && !og.includes('statLabel.slice('), `${labels.length} fixed captions, longest ${Math.max(...labels.map((l) => l.length))}${long.length ? `; too long: ${long.join(' | ')}` : ''}`);
  f1('unknown-member card pill', /title: 'Member of Congress', eyebrow: 'Disclosed trades'/.test(figs) && !figs.includes('Stock trades, from the filings'), 'Disclosed trades');
  await hit('/people/ZZ999999/opengraph-image', 200, { ctype: 'image/png', group: F1 });
  await hit('/latest/opengraph-image', 200, { ctype: 'image/png', group: F1 });
}
// Audit-status lines carry their dates and scope; the board line follows the switch.
await hit('/about/methodology/trades', 200, { bodyAll: ['on October 3 and 4, 2026', lateFilersEnabled() && !lateFilersPreview(SERVER_ENV) ? 're-checked against the filings on October 4, 2026' : 'stay preview-only until a review clears them'], group: F1 });
await hit('/about/methodology/tickers', 200, { body: 'a separate review on October 4, 2026', group: F1 });

// F2 (W2 and the cold read). W2: the board says what it measured, not that a limit was missed, and the calendar-day method line is
// on the board, the trades method page and the score definition. Cold read: the first fetch of the trades method page has its
// source bar (one read of trade_source_status, not 14 requests), never "temporarily unavailable".
const F2 = 'post-launch fixes (F2)';
{
  const M = 'We count calendar days from the trade date to the first report. We do not adjust for weekends or holidays, so a report filed on the next business day after a weekend deadline is included.';
  if (lateFilersEnabled()) {
    await hit('/data/late-filers', 200, {
      bodyAll: [M, 'calendar days, not adjusted for weekends or holidays', 'asks for a report within 45 days'],
      notBody: ['after the 45-day limit', 'sets a 45-day limit', 'missed the deadline', 'late filer', 'whose lateness we compute', 'count can start when the member learns', 'clock can start when the member learns', 'up to 30 days after it'], group: F2 });
    await hit('/data', 200, { bodyAll: ['Reports filed more than 45 days after the trade', 'in calendar days after the trade'], notBody: ['after the 45-day limit'], group: F2 });
    await hit('/about/methodology/trades', 200, { bodyAll: [M], notBody: ['after the 45-day limit', 'sets 45 days', 'count can start when the member learns', 'clock can start when the member learns', 'up to 30 days after it'], group: F2 });
  }
  await hit('/about/methodology', 200, { bodyAll: [M], notBody: ['after the 45-day limit'], group: F2 });
  const SRC = readFileSync(join(ROOT, 'src', 'lib', 'v2', 'datasets.ts'), 'utf8');
  const readTradesSrc = SRC.slice(SRC.indexOf('async function readTrades'), SRC.indexOf('async function readCommitteeHistory'));
  const oneRead = SRC.includes(".from('trade_source_status')") && !readTradesSrc.includes("count: 'exact'");
  if (!oneRead) failed++;
  rows.push({ path: 'trades source bar reads one view, not per-dataset counts', status: oneRead ? 'ok' : 'FAIL', expect: 'ok', ok: oneRead, note: 'trade_source_status', group: F2 });
  await hit('/about/methodology/trades', 200, { bodyAll: ['Source:', 'Coverage:'], notBody: ['temporarily unavailable', 'unavailable right now'], group: F2 });
}

// F3 (A9 N1 and the score label). N1: a page hidden on this deployment (the board with its flag off, /design and /design/story on
// production) answers 404 with the site's own 404 metadata: generic title, no canonical, no og:url, noindex, and a server-rendered
// "Page not found". Run it against a production build (VERCEL_ENV=production) to see the hidden state. Label: the signal-score
// component is "Reported 45+ days after the trade" (+15) in page text; "reported late" is on the wording list.
const F3 = 'post-launch fixes (F3)';
{
  const decode = (t) => t.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) ?? [])[1];
  const headOf = (html) => {
    const tags = (re) => [...html.matchAll(re)].map((m) => m[0]);
    const meta = (key, val) => tags(/<meta\b[^>]*>/g).filter((t) => attr(t, key) === val).map((t) => attr(t, 'content'));
    return {
      title: (html.match(/<title[^>]*>([^<]*)<\/title>/) ?? [])[1] ?? null,
      canonical: tags(/<link\b[^>]*>/g).filter((t) => attr(t, 'rel') === 'canonical').map((t) => attr(t, 'href')),
      ogUrl: meta('property', 'og:url'),
      ogTitle: meta('property', 'og:title'),
      description: meta('name', 'description'),
      robots: meta('name', 'robots'),
    };
  };
  const get = async (path) => { const res = await fetch(base + path, { redirect: 'manual' }); return { status: res.status, html: decode(await res.text()) }; };
  const hidden = [
    ...(lateFilersEnabled() ? [] : ['/data/late-filers', '/data/late-filers?page=2']),
    ...(designPagesEnabled(SERVER_ENV) ? [] : ['/design', '/design/story']),
  ];
  if (hidden.length) {
    const generic = await get('/f3-no-such-page');
    const g = headOf(generic.html);
    for (const path of hidden) {
      const { status, html } = await get(path);
      const h = headOf(html);
      const problems = [];
      if (status !== 404) problems.push(`status ${status}`);
      if (h.title !== g.title) problems.push(`title "${h.title}" (the 404 has "${g.title}")`);
      if (h.canonical.length) problems.push(`canonical ${h.canonical.join(',')}`);
      if (h.ogUrl.length) problems.push(`og:url ${h.ogUrl.join(',')}`);
      if (JSON.stringify(h.ogTitle) !== JSON.stringify(g.ogTitle)) problems.push(`og:title ${JSON.stringify(h.ogTitle)}`);
      if (JSON.stringify(h.description) !== JSON.stringify(g.description)) problems.push('description differs from the 404');
      // The 404 shell carries the root layout's "index, follow" beside Next's own "noindex" (the site's 404 does too). A hidden page may only
      // keep that or tighten it (a layout that returns hiddenPageMetadata() adds "noindex, nofollow"); it must keep a noindex and never add an index.
      if (!h.robots.some((r) => /noindex/.test(r)) || h.robots.some((r) => !g.robots.includes(r) && !/noindex/.test(r))) problems.push(`robots ${JSON.stringify(h.robots)} (the 404 has ${JSON.stringify(g.robots)})`);
      for (const t of ['Reports filed more than 45 days after the trade', 'Filed 45+ days after', 'Design system', 'Story template']) if (html.includes(t)) problems.push(`carries "${t}"`);
      if (!/<h1[^>]*>We can't find that page<\/h1>/.test(html)) problems.push('no server-rendered "Page not found" heading (markup, not the RSC payload)');
      const ok = problems.length === 0;
      if (!ok) failed++;
      rows.push({ path, status, expect: '404, the site 404 metadata', ok, note: ok ? `title "${h.title}", no canonical, robots ${h.robots.join(' + ')}` : problems.join('; '), group: F3 });
    }
  } else {
    rows.push({ path: 'hidden pages (N1)', status: 'n/a', expect: 'n/a', ok: true, note: 'every gated page is on in this run; run with VERCEL_ENV=production to see the hidden state', group: F3 });
  }
  // The helper itself, so the default run also covers it: noindex, and nothing of a page's own.
  const hm = hiddenPageMetadata();
  const hmOk = hm.robots?.index === false && !hm.title && !hm.alternates && !hm.openGraph && !hm.description;
  if (!hmOk) failed++;
  rows.push({ path: 'hiddenPageMetadata()', status: hmOk ? 'ok' : 'FAIL', expect: 'ok', ok: hmOk, note: 'noindex, no title, canonical, og or description', group: F3 });
  // hiddenByFlag(): the proxy's list follows the two flags.
  for (const [env, path, want] of [
    [{}, '/data/late-filers', false], [{}, '/design', false], [{}, '/design/story', false],
    [{ VERCEL_ENV: 'production' }, '/data/late-filers', true], [{ VERCEL_ENV: 'production' }, '/design', true], [{ VERCEL_ENV: 'production' }, '/design/story', true],
    [{ VERCEL_ENV: 'production', SHOW_LATE_FILERS: '1' }, '/data/late-filers', false], [{ VERCEL_ENV: 'production', SHOW_LATE_FILERS: '1' }, '/design', true],
    [{ VERCEL_ENV: 'production' }, '/data', false], [{ VERCEL_ENV: 'production' }, '/data/late-filers-x', false], [{ VERCEL_ENV: 'production' }, '/designs', false],
  ]) {
    const got = hiddenByFlag(path, env);
    if (got !== want) failed++;
    rows.push({ path: `hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)})`, status: String(got), expect: String(want), ok: got === want, note: '', group: F3 });
  }
  // Label.
  const L = 'reported 45+ days after the trade';
  await hit('/about/methodology', 200, { bodyAll: [`${L} +15`, 'Reported 45+ days after the trade:'], notBody: ['reported late'], group: F3 });
  await hit('/data/status', 200, { bodyAll: [`reported 45+ days after the trade, large position`], notBody: ['reported late'], group: F3 });
  const listed = FORBIDDEN_PHRASES.some((p) => p.from === 'F3' && new RegExp(p.re, 'gi').test('The signal is Reported late (+15).'));
  if (!listed) failed++;
  rows.push({ path: 'wording gate lists "reported late"', status: listed ? 'ok' : 'FAIL', expect: 'ok', ok: listed, note: 'forbidden-words.ts', group: F3 });
}

// ---------------------------------------------------------------- D15: the President section (/president and three sub-pages)
{
  const G = 'D15 President section';
  const row = (path, ok, note = '', expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  const PAGES = [PRESIDENT_HUB_PATH, PRESIDENT_TIMING_PATH, PRESIDENT_LARGEST_PATH, PRESIDENT_QUALITY_PATH];
  // Flag: off on production until SHOW_PRESIDENT_DEEPDIVE is exactly '1'; the D9 page keeps its own flag.
  for (const path of PAGES) {
    for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_PRESIDENT_DEEPDIVE: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_PRESIDENT_DEEPDIVE: 'true' }, true]]) {
      row(`hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)})`, hiddenByFlag(path, env) === want, '', String(want));
    }
  }
  row('hiddenByFlag(D9 page, production + SHOW_PRESIDENT_DEEPDIVE=1) stays on its own flag', hiddenByFlag('/people/executive/donald-trump', { VERCEL_ENV: 'production', SHOW_PRESIDENT_DEEPDIVE: '1' }) === true);
  row('hiddenByFlag("/presidential") is not caught by the /president prefix', hiddenByFlag('/presidential', { VERCEL_ENV: 'production' }) === false);
  // Nav: "The President" appears only with the flag, right after People; the five other sections are untouched.
  const navOff = navItems(false).map((n) => n.href);
  const navOn = navItems(true).map((n) => n.href);
  row('nav without the flag has the five sections and no /president', navOff.length === 5 && !navOff.includes('/president'), navOff.join(' '));
  row('nav with the flag adds "The President" right after People', navOn.length === 6 && navOn[navOn.indexOf('/people') + 1] === '/president' && navItems(true).find((n) => n.href === '/president')?.label === 'The President', navOn.join(' '));
  // Perpetuals rule (A11b N5): the display helper never prints the broker placeholder maturity.
  for (const [asset, want] of [
    ['Fifth 6.9802% 12/31/49', 'Fifth 6.9802% (perpetual)'], ['GOLDMAN SACHS GROUP INC PERP 7.5000% 12/31/49', 'GOLDMAN SACHS GROUP INC PERP 7.5000%'],
    ['US BANCORP ALT TIER I PERP 5.3000% 12/31/49', 'US BANCORP ALT TIER I PERP 5.3000%'], ['JPMORGAN CHASE & CO ALT TIER 3.6500%', 'JPMORGAN CHASE & CO ALT TIER 3.6500% (perpetual)'],
    ['US TREASUR NT 4% DUE 07/31/30', 'US TREASUR NT 4% DUE 07/31/30'],
  ]) {
    const got = displayAsset({ asset, instrument_class: 'bond' });
    row(`displayAsset(${JSON.stringify(asset)})`, got === want && !/12\/31\/(49|2049)/.test(got), got);
  }
  // The bin edges: 45 days or fewer vs more than 45 never share a bin.
  row('day bins split exactly at 45', binOf(45) === 'd45' && binOf(46) === 'd60' && binOf(30) === 'd30' && binOf(31) === 'd45' && binOf(181) === 'd181' && binOf(295) === 'd181');
  // D15 M1 (audit): the D9 list uses displayAsset too, so no rendered transaction row prints the broker placeholder maturity.
  if (presidentPageEnabled()) {
    try {
      const bonds = await restAll('executive_trades?select=asset,instrument_class&office=eq.President&report_type=eq.278-T&instrument_class=eq.bond');
      const placeholder = bonds.filter((r) => isPerpetual(r) && /12\/31\/(?:49|2049)/.test(r.asset));
      const pagesN = Math.max(1, Math.ceil(bonds.length / 50));
      let bad = 0; let perpShown = 0; let wells = false; let fetched = 0;
      for (let p = 1; p <= pagesN; p++) {
        const r = await fetch(`${base}${PRESIDENT_PATH}?class=bond${p > 1 ? `&page=${p}` : ''}`);
        const t = visibleText((await r.text()).replace(/<!-- -->/g, ''));
        fetched += r.status === 200 ? 1 : 0;
        if (/12\/31\/(?:49|2049)/.test(t)) bad += 1;
        perpShown += (t.match(/\(perpetual\)/g) ?? []).length;
        if (t.includes('WELLS FARGO & CO PERP GG NT 6.1250%')) wells = true;
      }
      row(`${PRESIDENT_PATH} (D9 list) never prints a perpetual's placeholder maturity: ${placeholder.length} such lines in the DB, ${pagesN} bond pages read`, fetched === pagesN && bad === 0 && placeholder.length > 0, `${bad} pages with 12/31/49, ${fetched}/${pagesN} fetched`);
      row(`${PRESIDENT_PATH} (D9 list) shows "(perpetual)" on perpetual lines whose text has no PERP, and the stripped PERP lines read as printed`, perpShown > 0 && wells, `${perpShown} "(perpetual)" labels; Wells Fargo PERP line without date: ${wells}`);
    } catch (e) { row(`${PRESIDENT_PATH} (D9 list) perpetual display`, false, String(e)); }
  }

  if (presidentDeepDiveEnabled()) {
    const visible = async (p) => { const r = await fetch(base + p); return { status: r.status, text: visibleText((await r.text()).replace(/<!-- -->/g, '')), html: '' }; };
    const htmlOf = async (p) => (await fetch(base + p)).text().then((t) => t.replace(/<!-- -->/g, ''));
    try {
      const et = (await restAll('executive_trades?select=*&office=eq.President&report_type=eq.278-T')).map((r) => ({ ...r }));
      const cov = await restAll('executive_filings?select=*');
      const byDoc = new Map();
      for (const r of et) {
        const f = byDoc.get(r.source_doc_id) ?? { docId: r.source_doc_id, url: r.disclosure_url, fileName: '', signed: null, amendedOn: null, transactions: 0, firstTrade: null, lastTrade: null, over45: 0, notComputed: 0, longestGap: null };
        f.transactions += 1; if (r.stock_act_late === true) f.over45 += 1; if (r.stock_act_late == null) f.notComputed += 1;
        if (r.days_to_file != null && (f.longestGap == null || r.days_to_file > f.longestGap)) f.longestGap = r.days_to_file;
        const s = r.original_filed_date ?? r.filed_date; if (s && (!f.signed || s < f.signed)) f.signed = s;
        byDoc.set(r.source_doc_id, f);
      }
      const hub = computeHub(et, [...byDoc.values()], cov);
      const feeCovers = cov.filter((c) => c.reviewer_comment_kind === 'late_fee_note' && c.reviewer_comment);
      const [hubV, timV, larV, qV] = await Promise.all(PAGES.map(visible));
      const texts = { [PRESIDENT_HUB_PATH]: hubV, [PRESIDENT_TIMING_PATH]: timV, [PRESIDENT_LARGEST_PATH]: larV, [PRESIDENT_QUALITY_PATH]: qV };
      for (const p of PAGES) {
        const v = texts[p];
        row(`${p} answers 200`, v.status === 200 && v.text.length > 500, `status ${v.status}`);
        row(`${p} has no "option(s)"`, !/\boptions?\b/i.test(v.text), '');
        // JSX can drop the space after an expression ("168bond lines"); a number glued to a word is a copy bug.
        const glued = /(?<![\w#.$%/-])\d[\d,]*[A-Za-z]{3,}\b/.exec(v.text);
        row(`${p} has no number glued to a word`, !glued, glued ? `"${glued[0]}" in "…${v.text.slice(Math.max(0, glued.index - 30), glued.index + 40)}…"` : '');
        row(`${p} no single dollar total`, !/\btotal(?:ing|led)? \$|\bworth \$/i.test(v.text), '');
        row(`${p} never prints a perpetual's placeholder maturity`, !/12\/31\/(?:49|2049)/.test(v.text) && !/\bdue 12\/31/i.test(v.text), '');
        row(`${p} says "securities transactions", never "stock trades" / "late filer" / "on time"`, !/stock trades|late filer|\bon[- ]time\b|\bfiled late\b|\bwere late\b/i.test(v.text), '');
        row(`${p} shows no internal column or Vice President name`, !/late_basis|not_required_on_278T|stock_act_late|\bVance\b/.test(v.text), '');
        // A11: a fee note is only ever next to the signed compliance opinion.
        const fees = (v.text.match(/Filer paid late fee/g) ?? []).length;
        const opinions = (v.text.split(COMPLIANCE_SENTENCE).length - 1);
        let adjacent = true;
        for (const c of feeCovers) {
          for (let i = v.text.indexOf(c.reviewer_comment); i !== -1; i = v.text.indexOf(c.reviewer_comment, i + 1)) {
            if (!v.text.slice(i, i + c.reviewer_comment.length + 420).includes('signed opinion that the filer is in compliance')) adjacent = false;
          }
        }
        row(`${p} fee notes are verbatim and each sits beside the compliance opinion`, adjacent && opinions >= (fees > 0 ? 1 : 0) && (p === PRESIDENT_HUB_PATH || p === PRESIDENT_TIMING_PATH ? feeCovers.every((c) => v.text.includes(c.reviewer_comment)) : true), `${fees} mentions of the note text, ${opinions} opinion sentences`);
      }
      // Audit round 2 (M3, S4): the generic fee-note quote is always followed by the compliance sentence within 300 characters, on every page that prints it.
      // W2: the Iran war story prints the same generic quote (its fee intro), so it is held to the same 300-character rule.
      for (const p of [...PAGES, ...(iranLive ? [IRAN_WAR_PATH] : [])]) {
        const t = (texts[p] ?? await visible(p)).text;
        const at = [...t.matchAll(/Filer paid late fee\(s\)/g)].map((m) => m.index);
        const ok = at.every((i) => t.slice(i, i + 300).includes(COMPLIANCE_SENTENCE));
        row(`${p} generic fee-note quote is followed by the compliance sentence within 300 characters`, ok && (p !== PRESIDENT_HUB_PATH && p !== PRESIDENT_TIMING_PATH && p !== IRAN_WAR_PATH || (p === IRAN_WAR_PATH ? at.length === 0 : at.length > 0)), `${at.length} generic quotes`);
      }
      // Audit round 2 (S5): "one report that day" only where the day has exactly one report; multi-report days say "1 of N reports that day".
      const dayCount = (d) => hub.perReport.filter((r) => r.signed === d).length;
      const singles = hub.perReport.filter((r) => dayCount(r.signed) === 1).length;
      const oneMentions = (timV.text.match(/one report that day/g) ?? []).length;
      const multiFirsts = hub.perReport.filter((r) => dayCount(r.signed) > 1 && !/\(\d\)/.test(r.label));
      row(`${PRESIDENT_TIMING_PATH} "one report that day" appears only for days with a single report`, (singles === 0 ? oneMentions === 0 : oneMentions > 0 && oneMentions % singles === 0 && oneMentions / singles <= 2) && multiFirsts.every((r) => timV.text.includes(`1 of ${dayCount(r.signed)} reports that day`)), `${oneMentions} mentions, ${singles} single-report days, ${multiFirsts.length} multi-report days`);
      // Hub: the live big number and its sentence, the stat band, the fee panel.
      const sig = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }) : '');
      row(`${PRESIDENT_HUB_PATH} figures vs DB: total, reports, over-45 sentence, classes`,
        [`President Trump reported ${nfmt(hub.total)} securities transactions in ${nfmt(hub.reports)} periodic transaction reports (OGE Form 278-T) signed between ${sig(hub.firstSigned)} and ${sig(hub.lastSigned)}`,
          `${nfmt(hub.over45)} transactions in ${nfmt(hub.over45Reports)} of the ${nfmt(hub.reports)} reports were reported more than 45 days after the trade date shown, counted to the date President Trump signed the report.`,
          `${nfmt(hub.classes.stock)} stock`, `${nfmt(hub.classes.bond)} bond`, `${nfmt(hub.classes.fund)} fund`,
          `On ${nfmt(feeCovers.length)} of the ${nfmt(hub.reports)} reports, the reviewing official wrote in the comments box:`].every((w) => hubV.text.includes(w)),
        `total ${hub.total}, over45 ${hub.over45} in ${hub.over45Reports} of ${hub.reports}, ${feeCovers.length} fee notes`);
      row(`${PRESIDENT_HUB_PATH} owners: printed as the data has them (${hub.owners.map((o) => `${o.value} ${o.count}`).join(', ')})`, hub.owners.every((o) => hubV.text.includes(`${o.value} ${nfmt(o.count)}`)));
      const hubHtml = await htmlOf(PRESIDENT_HUB_PATH);
      const oge = [...hubHtml.matchAll(/href="(https:\/\/extapps2\.oge\.gov\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      row(`${PRESIDENT_HUB_PATH} OGE source links: one per report (plus cover-page links on the fee notes)`, new Set(oge.map((u) => u.split('#')[0])).size === hub.reports && [PRESIDENT_TIMING_PATH, PRESIDENT_LARGEST_PATH, PRESIDENT_QUALITY_PATH, '/people/executive/donald-trump', '/about/methodology/trades'].every((p) => hubHtml.includes(`href="${p}`)), `${new Set(oge.map((u) => u.split('#')[0])).size} distinct reports linked`);
      // Timing: the same sentences, the 278-T exemption, histogram sums, one table row per report.
      const histSum = hub.hist.reduce((n, b) => n + b.count, 0);
      const histOver = hub.hist.filter((b) => b.over45).reduce((n, b) => n + b.count, 0);
      row(`${PRESIDENT_TIMING_PATH} histogram adds up to the computed rows and the over-45 bins to the over-45 count`, histSum === hub.computed && histOver === hub.over45 && histSum + hub.notComputed === hub.total, `bins ${histSum}, over 45 ${histOver}, not computed ${hub.notComputed}, total ${hub.total}`);
      row(`${PRESIDENT_TIMING_PATH} figures vs DB: over-45 sentence, 45-or-fewer, exemption`,
        [`${nfmt(hub.over45)} transactions in ${nfmt(hub.over45Reports)} of the ${nfmt(hub.reports)} reports were reported more than 45 days after the trade date shown`,
          `${nfmt(hub.atOrUnder45)} transactions were reported 45 days or fewer after the trade date shown`,
          `Why ${nfmt(hub.notComputed)} transactions have no gap`, 'Not computed: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.',
          'We count calendar days and do not adjust for weekends or holidays.'].every((w) => timV.text.includes(w)));
      row(`${PRESIDENT_TIMING_PATH} every one of the ${hub.reports} reports has a table row`, hub.perReport.every((r) => timV.text.includes(r.fileName ? r.fileName : sig(r.signed))) || hub.perReport.every((r) => timV.text.includes(sig(r.signed))));
      row(`all not-computed rows are the 278-T exemption (late_basis not_required_on_278T), none of them stock`, et.filter((r) => r.stock_act_late == null).every((r) => r.late_basis === 'not_required_on_278T' && r.instrument_class !== 'stock'), `${hub.notComputed} rows`);
      // Largest: the live rows, each compared with its page, each linking to its page.
      const topLive = et.filter((r) => Number(r.amount_min ?? 0) >= LARGEST_FLOOR);
      const unverified = topLive.filter((r) => !isCheckedAgainstPage({ ...r, asset: r.asset }));
      row(`${PRESIDENT_LARGEST_PATH} every displayed row equals a line compared with its page image (A11b hard rule)`, unverified.length === 0 && topLive.length === VERIFIED_LARGEST.length, `${topLive.length} live rows at the top band, ${VERIFIED_LARGEST.length} recorded, ${unverified.length} not compared`);
      const larHtml = await htmlOf(PRESIDENT_LARGEST_PATH);
      row(`${PRESIDENT_LARGEST_PATH} lists ${topLive.length} rows, none marked "not yet compared", each with a page link`,
        larV.text.includes(`${nfmt(topLive.length)} transactions in the highest band`) && !larHtml.includes('data-unchecked') && !larHtml.includes('data-section="unchecked"') && topLive.every((r) => larHtml.includes(`#page=${r.page_number}`) && larV.text.includes(`line #${r.row_number_printed}`)),
        topLive.map((r) => `${r.source_doc_id.slice(0, 8)} p${r.page_number} #${r.row_number_printed}`).join('; '));
      // The DataTable renders each row twice (table at 640px and up, card list below), so the table's row headers are the count.
      const larRows = (larHtml.slice(0, larHtml.indexOf('id="bands"')).match(/<th scope="row"/g) ?? []).length; // the table above the bands chart
      row(`${PRESIDENT_LARGEST_PATH} shows exactly ${topLive.length} transaction rows (no row below the top band)`, larRows === topLive.length && (larV.text.match(/page \d+, line #\d+/g) ?? []).length === 2 * topLive.length, `${larRows} table rows, ${(larV.text.match(/page \d+, line #\d+/g) ?? []).length} page-and-line mentions (table + phone cards)`);
      // Data quality: live counts, the audit files by name, the perpetual rule.
      const perp = et.filter((r) => isPerpetual(r)).length;
      row(`${PRESIDENT_QUALITY_PATH} figures vs DB: perpetual count, 278-T exemption count, classes, restated lines`,
        [`${nfmt(perp)} bond lines are perpetual fixed-income securities`, `${nfmt(hub.notComputed)} lines now carry a blank gap`, `${nfmt(hub.classes.stock)} stock, ${nfmt(hub.classes.bond)} bond and ${nfmt(hub.classes.fund)} fund lines`, `${nfmt(hub.restatedLines)} lines are the replacement lines`].every((w) => qV.text.includes(w)), `${perp} perpetuals`);
      row(`perpetual rule reproduces the 168 perpetual securities A11b counted`, perp === 168, `${perp} (PERP / ALT TIER / placeholder maturity, bond class)`);
      row(`${PRESIDENT_QUALITY_PATH} names both audit files and dates`, AUDITS.every((a) => qV.text.includes(a.file)) && qV.text.includes('Oct 19, 2026'), AUDITS.map((a) => a.file).join(', '));
      row(`${PRESIDENT_QUALITY_PATH} audit-record figures printed as recorded (39 / 1,379 / 8 shifted rows / Meta #42)`, [`${nfmt(HISTORY.bondLineFixes)} lines were corrected`, `${nfmt(HISTORY.reclassified)} lines changed class`, `printed lines #${HISTORY.shiftedRows.from} to #${HISTORY.shiftedRows.to} (${HISTORY.shiftedRows.count} lines)`, `Meta Platforms line (#${HISTORY.metaLine.printed})`].every((w) => qV.text.includes(w)));
      // Cross-link from the D9 page, and the people index card keeps working.
      if (presidentPageEnabled()) await hit(PRESIDENT_PATH, 200, { bodyAll: ['The President: disclosure timing, the largest transactions and how the data was built'], group: G });
    } catch (e) { row('D15 figures vs DB', false, `could not run: ${String(e.message).slice(0, 160)}`); }
    // Sub-page query strings and trailing noise answer the page, never an error.
    for (const q of ['?x=1', '?sort=zz&page=-3']) await hit(PRESIDENT_HUB_PATH + q, 200, { notBody: ['Figures unavailable'], group: G });
    // Header: the nav item shows on every page (desktop and phone menus render the same list).
    const home = await htmlOf('/');
    row('header nav shows "The President" while the flag is on', home.includes('href="/president"') && home.includes('The President'));
    await hit('/president/nope', 404, { group: G });
  } else {
    for (const p of PAGES) await hit(p, 404, { group: G });
    const home = await htmlOf0('/');
    row('header nav has no "The President" while the flag is off', !home.includes('href="/president"'));
  }
  async function htmlOf0(p) { return (await fetch(base + p)).text(); }
}
// ---------------------------------------------------------------- W2: the Iran war story (/investigations/president-iran-war)
// Behind SHOW_IRAN_WAR_STORY (off on production) and refused on production while the copy is DRAFT_UNTIL_AW1 (flags.ts). Style of the D15 block:
// pure flag rows first, then the page checked against the database with the same code the page runs: iran-war-core.ts and iran-war-copy.ts,
// fed by this script's OWN dump of the six tables (restAll), compared with every data-sentence the server rendered.
await (async () => {
  const G = 'W2 Iran war story';
  const row = (path, ok, note = '', expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note: String(note).slice(0, 700), group: G }); };
  const P = IRAN_WAR_PATH;
  const PROD = { VERCEL_ENV: 'production' };
  const PROD_ON = { VERCEL_ENV: 'production', SHOW_IRAN_WAR_STORY: '1' };
  const SUBPATHS = [P, `${P}/days/2026-03-02`, `${P}/chronology.csv`, `${P}/issuer-map.csv`, `${P}/preregistration.md`, `${P}/opengraph-image`, `${P}/anything-else`];
  const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

  // ---- the flag and the draft guard (pure)
  for (const [label, env, want] of [
    ['VERCEL_ENV unset', {}, true], ['preview', { VERCEL_ENV: 'preview' }, true], ['development', { VERCEL_ENV: 'development' }, true],
    ['VERCEL_ENV unset, SHOW_IRAN_WAR_STORY=0', { SHOW_IRAN_WAR_STORY: '0' }, true],
    ['production, flag unset', PROD, false], ['production, SHOW_IRAN_WAR_STORY=0', { ...PROD, SHOW_IRAN_WAR_STORY: '0' }, false],
    ['production, SHOW_IRAN_WAR_STORY=true', { ...PROD, SHOW_IRAN_WAR_STORY: 'true' }, false], ['production, SHOW_IRAN_WAR_STORY=1', PROD_ON, true],
  ]) row(`iranWarStoryEnabled(${label}) is ${want}`, iranWarStoryEnabled(env) === want, '', String(want));
  for (const [label, draft, env, want] of [
    ['draft, production', true, PROD, true], ['draft, production, flag on', true, PROD_ON, true], ['draft, VERCEL_ENV unset', true, {}, false],
    ['draft, preview', true, { VERCEL_ENV: 'preview' }, false], ['not draft, production, flag on', false, PROD_ON, false],
  ]) row(`iranWarDraftRefused(${label}) is ${want}`, iranWarDraftRefused(draft, env) === want, '', String(want));
  for (const [label, draft, env, want] of [
    ['draft, production, flag on', true, PROD_ON, false], ['draft, VERCEL_ENV unset', true, {}, true], ['draft, preview', true, { VERCEL_ENV: 'preview' }, true],
    ['not draft, production, flag on', false, PROD_ON, true], ['not draft, production, flag off', false, PROD, false],
  ]) row(`iranWarStoryLive(${label}) is ${want}`, iranWarStoryLive(draft, env) === want, '', String(want));
  row(`production + DRAFT_UNTIL_AW1 (now ${C.DRAFT_UNTIL_AW1}) refuses with the flag on: live on production is ${!C.DRAFT_UNTIL_AW1}`,
    iranWarDraftRefused(C.DRAFT_UNTIL_AW1, PROD_ON) === C.DRAFT_UNTIL_AW1 && iranWarStoryLive(C.DRAFT_UNTIL_AW1, PROD_ON) === !C.DRAFT_UNTIL_AW1, 'the page, day route, downloads, share card, index card and sitemap all follow iranWarStoryLive (source rows below)');
  for (const path of SUBPATHS) {
    for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [PROD, true], [PROD_ON, false], [{ ...PROD, SHOW_IRAN_WAR_STORY: 'true' }, true], [{ ...PROD, SHOW_INVESTIGATIONS_V2: '1' }, true]]) {
      row(`hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)}) is ${want}`, hiddenByFlag(path, env) === want, '', String(want));
    }
  }
  row('SHOW_IRAN_WAR_STORY=1 on production does not unhide another investigation', hiddenByFlag('/investigations/federal-money-musk-companies-fy2024-2026', PROD_ON) === true);
  // Every entry point follows the same function, so production + draft refuses everywhere without a second server (source rows).
  for (const [file, rx, what] of [
    ['src/app/investigations/president-iran-war/page.tsx', /if \(!iranWarStoryEnabled\(\)\) notFound\(\);[\s\S]{0,300}if \(iranWarDraftRefused\(C\.DRAFT_UNTIL_AW1\)\) notFound\(\);/, 'page: flag off or draft on production -> site 404'],
    ['src/app/investigations/president-iran-war/page.tsx', /if \(!iranWarStoryEnabled\(\) \|\| iranWarDraftRefused\(C\.DRAFT_UNTIL_AW1\)\) return hiddenPageMetadata\(\);/, 'page metadata: hidden'],
    ['src/app/investigations/president-iran-war/days/[date]/route.ts', /if \(!iranWarStoryLive\(DRAFT_UNTIL_AW1\)\) return NOT_FOUND\(\);/, 'day route'],
    ['src/app/investigations/president-iran-war/chronology.csv/route.ts', /if \(!iranWarStoryLive\(DRAFT_UNTIL_AW1\)\) return new Response\('Not found'/, 'chronology download'],
    ['src/app/investigations/president-iran-war/issuer-map.csv/route.ts', /iranWarStoryLive\(DRAFT_UNTIL_AW1\)/, 'issuer map download'],
    ['src/app/investigations/president-iran-war/preregistration.md/route.ts', /iranWarStoryLive\(DRAFT_UNTIL_AW1\)/, 'pre-registration download'],
    ['src/app/investigations/president-iran-war/opengraph-image.tsx', /if \(!iranWarStoryLive\(DRAFT_UNTIL_AW1\)\) notFound\(\);/, 'share card'],
    ['src/app/sitemap.ts', /if \(iranWarStoryLive\(DRAFT_UNTIL_AW1\)\) paths\.push\(\{ path: IRAN_WAR_PATH/, 'sitemap entry'],
    ['src/app/investigations/page.tsx', /const iran = iranWarStoryLive\(DRAFT_UNTIL_AW1\);/, 'index card'],
  ]) {
    let ok = false; try { ok = rx.test(read(file)); } catch { /* missing file */ }
    row(`source guard: ${what} follows the flag and the draft guard`, ok, file);
  }
  row('the day panel and the chart both print the fixed line (WarTimeline.tsx carries data-fixed-line twice)', (read('src/components/v2/iran-war/WarTimeline.tsx').match(/data-fixed-line/g) ?? []).length >= 2);
  // The D15 constants the copy module repeats equal the originals.
  const pres = read('src/lib/v2/president.ts');
  row('COMPLIANCE_SENTENCE, FORM_RULE_SENTENCE and NOT_REQUIRED_SENTENCE equal the D15 originals', C.COMPLIANCE_SENTENCE === COMPLIANCE_SENTENCE && pres.includes(C.FORM_RULE_SENTENCE) && pres.includes(C.NOT_REQUIRED_SENTENCE));

  // ---- the server under test
  const page = await fetch(base + P, { redirect: 'manual' });
  const html = (await page.text()).replace(/<!-- -->/g, '');
  const mapHtml = await (await fetch(base + '/investigations')).text();
  const homeHtml = await (await fetch(base + '/')).text();
  row(`${P} answers ${iranLive ? 200 : 404} (iranWarStoryLive on the server under test: ${iranLive})`, page.status === (iranLive ? 200 : 404), `status ${page.status}`);
  row(`/investigations index card [data-iran-war-card] appears iff the story is live (${iranLive})`, mapHtml.includes('data-iran-war-card') === iranLive && (!iranLive || (mapHtml.includes(`href="${P}"`) && mapHtml.includes(C.IRAN_WAR_HEADLINE))));
  row(`sitemap.xml lists ${P} iff the story is live (${iranLive})`, sitemapPaths.includes(P) === iranLive);
  row('no home-page or header link to the story', !homeHtml.includes('president-iran-war') && !navItems(true).some((n) => n.href.includes('iran')));
  if (!iranLive) {
    for (const path of SUBPATHS.slice(1, 6)) await hit(path.replace('/anything-else', ''), 404, { group: G });
    return;
  }
  // Draft guard, server row: this server is not in production mode, so the draft renders with its banner (a production server would 404).
  row('draft guard: the non-production server renders the draft with the "Draft: not audited" banner', (html.includes('data-draft-banner') && html.includes(C.DRAFT_BANNER) && html.includes('data-draft="true"')) === C.DRAFT_UNTIL_AW1, `DRAFT_UNTIL_AW1 ${C.DRAFT_UNTIL_AW1}`);
  row('non-production page carries noindex', /<meta name="robots" content="[^"]*noindex/.test(html) === (SERVER_ENV.VERCEL_ENV !== 'production'));
  row('page has one h1 with the headline and the kicker', (html.match(/<h1\b/g) ?? []).length === 1 && visibleText(html).includes(C.IRAN_WAR_HEADLINE) && visibleText(html).includes(C.IRAN_WAR_KICKER));

  // ---- the downloads and the data route
  const FREEZE_SHA = '323ef4531cf8cac0bae91a750a58916690df8a6f4b9f139a7d006abfac29a818'; // the A4 re-freeze (401 rows); the first freeze (399 rows) was 81f6f9c0...
  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, type: r.headers.get('content-type') || '', buf: Buffer.from(await r.arrayBuffer()) }; };
  const chronDl = await get(`${P}/chronology.csv`);
  const issuerDl = await get(`${P}/issuer-map.csv`);
  const preDl = await get(`${P}/preregistration.md`);
  const ogImg = await get(`${P}/opengraph-image`);
  row(`${P}/chronology.csv is the frozen file: sha256 ${FREEZE_SHA.slice(0, 12)}...`, chronDl.status === 200 && chronDl.type.includes('text/csv') && sha(chronDl.buf) === FREEZE_SHA, `${chronDl.status} ${sha(chronDl.buf).slice(0, 12)}`);
  row(`${P}/preregistration.md is the pre-registration with its dated amendments (A0 to A4-pending) and the chronology freeze section`, preDl.status === 200 && /^# W pre-registration/m.test(preDl.buf.toString('utf8')) && /^## Amendments/m.test(preDl.buf.toString('utf8')) && ['A0', 'A1', 'A2', 'A3', 'A4', 'A4-pending'].every((a) => new RegExp(`\\*\\*${a} `).test(preDl.buf.toString('utf8'))) && /^## Chronology freeze/m.test(preDl.buf.toString('utf8')), `${preDl.status} ${preDl.type} sha ${sha(preDl.buf).slice(0, 12)} ${preDl.buf.length} bytes`);
  row(`${P}/opengraph-image answers a PNG`, ogImg.status === 200 && ogImg.type.includes('image/png') && ogImg.buf.length > 5000, `${ogImg.status} ${ogImg.type} ${ogImg.buf.length} bytes`);

  // ---- the gate's own dump of the six tables (restAll), then the same-code rebuild
  let dump; let f;
  // The anon read path answers an occasional 500 (3 s statement timeout on a busy instance): retry each table read, then fail loudly, never read a zero.
  const dumpRead = async (path) => { for (let i = 0; ; i++) { try { return await restAll(path); } catch (e) { if (i >= 3) throw e; await new Promise((r) => setTimeout(r, 2000 * (i + 1))); } } };
  try {
    dump = {
      exec: await dumpRead(`executive_trades?select=${IW.EXEC_COLS}&office=eq.President&report_type=eq.278-T&order=id`),
      congress: await dumpRead(`congress_trades?select=${IW.CONGRESS_COLS}&transaction_date=gte.2026-01-02&transaction_date=lte.2026-07-31&order=id`),
      filings: await dumpRead(`executive_filings?select=${IW.FILING_COLS}&order=source_doc_id`),
      chron: await dumpRead(`story_chronology?select=${IW.CHRON_COLS}&order=id`),
      eia: await dumpRead(`eia_spot_prices?select=${IW.EIA_COLS}&order=series,price_date`),
      issuers: await dumpRead(`issuer_classification?select=${IW.ISSUER_COLS}&order=source_table,instrument,issuer_key`),
    };
    f = IW.computeIranWar(dump);
    row('gate dump: all six tables read and computeIranWar ran', Object.values(dump).every((r) => r.length > 0), Object.entries(dump).map(([k, v]) => `${k} ${v.length}`).join(', '));
  } catch (e) { row('gate dump of the six tables', false, `could not run: ${String(e.message).slice(0, 200)}`); return; }
  const p = f.president; const cg = f.congress;
  const fmt = IW.fmtInt;

  // rendered data-sentence values
  const S = new Map();
  for (const m of html.matchAll(/<([a-z0-9]+)\b[^>]*?\bdata-sentence="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) S.set(m[2], visibleText(m[3]).trim());
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const sentRow = (label, pairs) => {
    const bad = pairs.filter(([k, w]) => S.get(k) !== norm(w));
    row(label, bad.length === 0 && pairs.length > 0, bad.length ? bad.slice(0, 3).map(([k, w]) => `${k}: page "${(S.get(k) ?? '(absent)').slice(0, 100)}" vs rebuild "${norm(w).slice(0, 100)}"`).join(' | ') : `${pairs.length} data-sentence value(s) equal the same-code rebuild from the gate's own dump`);
  };
  const text = visibleText(html);
  const has = (s) => text.includes(norm(s));
  const hasAll = (label, list) => { const miss = list.filter((s) => !has(s)); row(label, miss.length === 0 && list.length > 0, miss.length ? `missing "${norm(miss[0]).slice(0, 110)}" (${miss.length} of ${list.length})` : `${list.length} present`); };

  // ---- sentences: sections 1 to 10
  sentRow('dek: trade count and first/last trade dates', [['dek', C.dek(f)]]);
  sentRow('accountLines (278-T, bands, the 45-day rule)', C.accountLines(f).map((t, i) => [`account-${i}`, t]));
  sentRow('beforeLines + volumeLine (P1 counts, band range, kinds, groups; 2025 context)', [...C.beforeLines(f).map((t, i) => [`before-${i}`, t]), ['volume', C.volumeLine(f)]]);
  sentRow('firstMonthLines + STRIKES_LINE (P2 counts, band range, kinds, groups)', [['strikes', C.STRIKES_LINE], ...C.firstMonthLines(f).map((t, i) => [`first-${i}`, t])]);
  sentRow('chronologyLines (entries by lane, labelled, outside the axis)', C.chronologyLines(f).map((t, i) => [`chron-${i}`, t]));
  sentRow('m3Result for the President', [['m3', C.m3Result(p.m3, '')]]);
  sentRow('m3Sales for the President (A7)', [['m3-sales', C.m3Sales(p.m3Sales, '')]]);
  // W3: the six required sentences and the allowed sentences A2, A3, A7, A8, A11 and A13 from AW1's audit (audit-2026-10-23-slushfund-aw1.md), character for character, on the rendered page.
  {
    const AUDIT = {
        "R1": "The President's reports list 10,093 securities transactions with trade dates from Jan 21, 2025 to Jul 31, 2026. This page sets out what they list, when the public could see them, and a dated chronology of the war from official sources for Dec 1, 2025 to Jul 31, 2026.",
        "R2": "By our pre-registered test, the share of energy and defense purchases in the war's first month was higher than in the two months before: 98 of 1,420 stock purchases in issuers we could classify (6.9 percent) against 33 of 734 (4.5 percent) (two-sided Fisher exact test, p = 0.029, significant at the 0.05 level); 136 stock purchases in issuers we could not classify sit out of the test, and if all of them are counted as not energy or defense, p = 0.029 and the result is still significant, while if all are counted as energy or defense, p = 0.063 and the result is not significant.",
        "R3I": "On 3 of the 8 reports that hold transactions from these windows, the reviewing official wrote a late-fee note in the comments box. Each note is quoted below exactly as printed.",
        "R4": "By our pre-registered test, the share of energy and defense purchases by members of Congress in the war's first month was not different from the two months before: 39 of 586 stock purchases in issuers we could classify (6.7 percent) against 23 of 316 (7.3 percent) (two-sided Fisher exact test, p = 0.783); 300 stock purchases in issuers we could not classify sit out of the test, and if all of them are counted as not energy or defense, p = 0.080 and the result is still not significant, while if all are counted as energy or defense, p < 0.001 and the difference would be significant at the 0.05 level, but 288 of those 300 are in one member's report (see the table).",
        "A2": "In the two months before the strikes (Jan 2 to Feb 27, 2026), the reports list 1,614 securities transactions: 925 purchases and 689 sales.",
        "A3": "In the war's first month (Feb 28 to Mar 31, 2026), the reports list 2,352 securities transactions: 1,731 purchases and 621 sales.",
        "A7": "The same test on sales, reported as a secondary result: 17 of 560 sales of stock in issuers we could classify (3.0 percent) in the first month against 22 of 647 (3.4 percent) in the two months before (p = 0.747, not significant at the 0.05 level).",
        "A8": "In the war's first month, 1,582 of the 2,279 transactions with a computed gap were reported more than 45 days after the trade.",
        "A11": "Together they reported 687 securities transactions in the two months before the strikes, 1,070 in the war's first month and 1,043 from Apr 1 to Jul 31, 2026.",
        "A13H": "The same test on sales by House members: 5 of 126 sales of stock in issuers we could classify (4.0 percent) in the first month against 27 of 259 (10.4 percent) in the two months before (p = 0.031; descriptive, not a test result)."
    };
    const lit = (label, key, want, prefixOnly = false) => row(label, prefixOnly ? (S.get(key) ?? '').startsWith(want) : S.get(key) === want, `page "${(S.get(key) ?? '(absent)').slice(0, 90)}"`);
    lit('AW1 R1 (the dek) is on the page character for character', 'dek', AUDIT.R1);
    lit('AW1 R2 (the President test, both A2 bounds) is on the page character for character', 'm3', AUDIT.R2);
    lit('AW1 R3 intro ("3 of the 8", no quoted paraphrase) is on the page character for character', 'fee-intro', AUDIT.R3I);
    lit('AW1 R4 (Congress pooled test, both bounds, the one-member clause) is on the page character for character', 'congress-test-0-0', AUDIT.R4);
    lit('AW1 A2 (P1 counts)', 'before-0', AUDIT.A2);
    lit('AW1 A3 (P2 counts)', 'first-0', AUDIT.A3);
    lit('AW1 A7 (President sales)', 'm3-sales', AUDIT.A7);
    lit('AW1 A8 (war first month, more than 45 days)', 'over45-P2', AUDIT.A8, true);
    lit('AW1 A11 (Congress window counts)', 'congress-1', AUDIT.A11);
    lit('AW1 A13 (House sales, descriptive)', 'congress-test-1-1', AUDIT.A13H);
    row('the retired sentences are gone: no "only significance test", no "less than 0.001", no "every one as energy or defense", no m3Unclassified sentence, no \'Filer paid late fee(s).\'', !/only significance test|less than 0\.001|counting every one|are left out of the test:|Filer paid late fee\(s\)/.test(text));
    const optsRaw = [0, 0, 0]; const wk = ['P1', 'P2', 'P3'];
    for (const r of dump.congress) { const w = IW.windowOf(r.transaction_date); const i = wk.indexOf(w); if (i >= 0 && r.instrument === 'option') optsRaw[i] += 1; }
    row(`Congress option lines by window equal the raw dump's instrument = 'option' counts (${optsRaw.join(' / ')}) and are not in the Stocks row`, JSON.stringify(wk.map((k) => cg.pooled.windows[k].options.n)) === JSON.stringify(optsRaw) && wk.every((k) => cg.pooled.windows[k].byInstrument.stock.n + cg.pooled.windows[k].options.n === cg.pooled.windows[k].all.n - cg.pooled.windows[k].byInstrument.bond.n - cg.pooled.windows[k].byInstrument['fund/ETF'].n - cg.pooled.windows[k].byInstrument.unmapped.n), optsRaw.join('/'));
    const ncRaw = wk.map((k) => cg.pooled.disclosure[k].notComputed);
    row('the Congress lateness note matches the data: exactly one line is not computed in each window', JSON.stringify(ncRaw) === '[1,1,1]' && has(C.CONGRESS_LATENESS_NOTE), ncRaw.join('/'));
    const inWinDocs = new Set(dump.exec.filter((r) => ['P1', 'P2', 'P3'].includes(IW.windowOf(r.transaction_date))).map((r) => r.source_doc_id));
    const feeDocs = dump.filings.filter((x) => x.reviewer_comment_kind === 'late_fee_note' && x.reviewer_comment && inWinDocs.has(x.source_doc_id));
    row(`the fee intro counts come from the dump, independent of the page code: ${feeDocs.length} of the ${inWinDocs.size} reports`, (S.get('fee-intro') ?? '').startsWith(`On ${feeDocs.length} of the ${inWinDocs.size} reports that hold transactions from these windows, the reviewing official wrote a late-fee note in the comments box.`), `${feeDocs.length} of ${inWinDocs.size}`);
  }

  sentRow('TEST_QUESTION, TEST_SCOPE and TEST_ONLY', [['test-question', C.TEST_QUESTION], ['test-scope', C.TEST_SCOPE], ['test-only', C.TEST_ONLY]]);
  sentRow('oilLines (the oversight count)', C.oilLines(f).map((t, i) => [`oil-${i}`, t]));
  row(`OIL_KICKER "${C.OIL_KICKER}" prints, and every oversight entry (${f.chronology.byLane.oversight ?? 0}) is listed with its source`, has(C.OIL_KICKER) && (elementWith(html, 'data-oil-list')?.html.match(/data-chron=/g) ?? []).length === (f.chronology.byLane.oversight ?? 0));
  sentRow('PUBLIC_INTRO and over45Line for all three windows', [['public-intro', C.PUBLIC_INTRO], ...['P1', 'P2', 'P3'].map((k) => [`over45-${k}`, C.over45Line(p.disclosure[k], k)])]);
  hasAll('postingLine for every trade month, and each month heading', [...p.posting.map((m) => C.postingLine(m)), ...p.posting.map((m) => `${IW.fmtMonth(m.month)}: ${fmt(m.total)} transactions`)]);
  // fee covers: feeIntro, the cover rows, verbatim comments, each followed by the signed compliance opinion
  sentRow('feeIntro', [['fee-intro', C.feeIntro(p.fees, p.reportsInWindows)]]);
  {
    const feeEl = elementWith(html, 'data-fee-covers');
    const t = visibleText(feeEl?.html ?? '');
    const fees = p.fees;
    const bad = [];
    for (const c of fees) {
      const i = t.indexOf(norm(C.feeRows(c)));
      if (i === -1) { bad.push(`no feeRows for ${c.label}`); continue; }
      const seg = t.slice(i, i + 700);
      if (!seg.includes(c.comment) || !seg.includes(C.FEE_LABEL.trim())) bad.push(`comment/label missing for ${c.label}`);
      const at = seg.indexOf(c.comment);
      if (!seg.slice(at, at + c.comment.length + 300).includes(C.COMPLIANCE_SENTENCE)) bad.push(`no compliance sentence beside ${c.label}`);
      if (C.feeOpinion(c.opinionDate) && !seg.includes(norm(C.feeOpinion(c.opinionDate)))) bad.push(`opinion date missing for ${c.label}`);
    }
    // Independent of feeCovers(): the late-fee-note covers whose report holds a transaction dated in a window (P1 to P3), straight from the dump.
    const inWin = (docId, ks) => dump.exec.some((r) => r.source_doc_id === docId && ks.includes(IW.windowOf(r.transaction_date)));
    const want = dump.filings.filter((x) => x.reviewer_comment_kind === 'late_fee_note' && x.reviewer_comment && inWin(x.source_doc_id, ['P1', 'P2', 'P3']));
    const want12 = want.filter((x) => inWin(x.source_doc_id, ['P1', 'P2']));
    row(`feeRows: the ${want.length} cover notes on reports that hold transactions from the windows (${want12.length} of them on reports with P1 or P2 lines, W1b section 1 "2 of 4") are printed verbatim, each followed within 300 characters by COMPLIANCE_SENTENCE`,
      fees.length === want.length && want.every((x) => fees.some((c) => c.docId === x.source_doc_id && c.comment === x.reviewer_comment)) && want12.length === 2 && bad.length === 0, bad.join('; ') || `${fees.length} cover notes: ${fees.map((c) => c.label).join(' | ').slice(0, 200)}`);
  }
  // Congress
  sentRow('congressLines (who is covered, window counts)', C.congressLines(f).map((t, i) => [`congress-${i}`, t]));
  {
    const groups = [cg.pooled, cg.house, cg.senate];
    sentRow('congressTestLines for pooled, House and Senate (m3Result + m3Sales each)', groups.flatMap((g, gi) => C.congressTestLines(g).map((t, i) => [`congress-test-${gi}-${i}`, t])));
    row('the three Congress test groups are headed All members / House / Senate', groups.every((g) => html.includes(`data-congress-test="${g.label}"`)));
  }
  sentRow('CONGRESS_NOTE', [['congress-note', C.CONGRESS_NOTE]]);
  {
    const tbl = elementWith(html, 'data-members-table');
    const ids = [...(tbl?.html.matchAll(/data-member="([^"]+)"/g) ?? [])].map((m) => m[1]);
    const distinct = [...new Set(dump.congress.map((r) => r.member_id))];
    const expectIds = f.congress.members.map((m) => m.memberId);
    const trs = [...(tbl?.html.matchAll(/<tr\b[^>]*data-member="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g) ?? [])];
    const badRows = f.congress.members.filter((m) => {
      const tr = trs.find((x) => x[1] === m.memberId);
      const want = norm([m.name, m.chamber, m.party, m.state, fmt(m.byWindow.P1), fmt(m.byWindow.P2), fmt(m.byWindow.P3), fmt(m.edByWindow.P1 + m.edByWindow.P2 + m.edByWindow.P3), fmt(m.purchases), fmt(m.sales), fmt(m.over45)].join(' '));
      return !tr || norm(visibleText(tr[2])) !== want;
    });
    row(`CONGRESS_TABLE_CAPTION prints and the members table has ${distinct.length} rows = the distinct members in the gate's dump window, in alphabetical order, every cell equal to the rebuild`,
      has(C.CONGRESS_TABLE_CAPTION) && ids.length === distinct.length && new Set(ids).size === ids.length && new Set(ids).size === new Set(distinct).size && distinct.every((id) => ids.includes(id)) && ids.join() === expectIds.join() && badRows.length === 0,
      `${ids.length} rows, ${distinct.length} distinct member_id in ${dump.congress.length} dumped rows, ${badRows.length} unequal rows${badRows[0] ? ` (${badRows[0].name})` : ''}`);
    const classes = new Set([...(tbl?.html.matchAll(/class="([^"]*)"/g) ?? [])].flatMap((m) => m[1].split(/\s+/)));
    row('party is a text label in the members table (no party colour classes)', !!tbl && ![...classes].some((c) => /(^|-)(dem|democrat|democratic|rep|republican|gop|party)(-|$)/i.test(c)), `${classes.size} distinct classes`);
    const alpha = f.congress.members.map((m) => IW.surnameKey(m.name));
    row('members are in alphabetical order by last name', alpha.every((k, i) => i === 0 || alpha[i - 1].localeCompare(k) <= 0));
  }
  // limits, method, downloads
  hasAll('LIMITS: all ten present (the tenth is the Route B "Not every government act" limit)', C.LIMITS);
  row('IRAN_WAR_FIXED_LINE is the last limit', C.LIMITS[C.LIMITS.length - 1] === C.IRAN_WAR_FIXED_LINE);
  sentRow('PREREG_LINE and CHRONOLOGY_LINES', [['prereg', C.PREREG_LINE], ...C.CHRONOLOGY_LINES.map((t, i) => [`method-chron-${i}`, t])]);
  hasAll('GROUPS_LINES and MEASURES_LINES', [...C.GROUPS_LINES, ...C.MEASURES_LINES]);
  {
    const dl = elementWith(html, 'data-downloads')?.html ?? '';
    const links = [[`${P}/preregistration.md`, C.DOWNLOADS.prereg], [`${P}/chronology.csv`, C.DOWNLOADS.chronology], [`${P}/issuer-map.csv`, C.DOWNLOADS.issuers]];
    row('DOWNLOADS: three links to the three routes, each with its label', links.every(([href, label]) => new RegExp(`<a [^>]*href="${href.replace(/[.\/]/g, '\\$&')}"[^>]*>${label.replace(/[.()\/]/g, '\\$&')}</a>`).test(dl.replace(/&amp;/g, '&'))), links.map(([h]) => h.split('/').pop()).join(', '));
    const shaText = visibleText(elementWith(html, 'data-chronology-sha')?.html ?? '').trim();
    row(`chronology sha row prints the freeze sha ${FREEZE_SHA.slice(0, 12)}... (and the download hashes to it)`, shaText === C.chronologyShaLine(FREEZE_SHA), shaText.slice(0, 90));
    const chronCsv = csvRows(chronDl.buf.toString('utf8').replace(/^\uFEFF/, ''));
    row(`chronology download has ${dump.chron.length} data rows = the story_chronology table, and the label says ${/ (\d+) rows/.exec(C.DOWNLOADS.chronology)?.[1]}`, chronCsv.length - 1 === dump.chron.length && C.DOWNLOADS.chronology.includes(`${dump.chron.length} rows`), `${chronCsv.length - 1} CSV rows, ${dump.chron.length} table rows`);
    const issuerCsv = csvRows(issuerDl.buf.toString('utf8').replace(/^\uFEFF/, ''));
    const issuerWant = dump.issuers.filter((r) => r.source_table === 'executive_trades' || r.source_table === 'congress_trades').length;
    const srcCol = issuerCsv[0].indexOf('source_table');
    const issuerOther = issuerCsv.slice(1).filter((r) => r[srcCol] !== 'executive_trades' && r[srcCol] !== 'congress_trades').length;
    row(`issuer map download has ${issuerWant} rows = the executive_trades and congress_trades rows of issuer_classification (the table holds ${dump.issuers.length}), and no other-officials row`, issuerDl.status === 200 && issuerDl.type.includes('text/csv') && issuerCsv.length - 1 === issuerWant && issuerOther === 0, `${issuerCsv.length - 1} CSV rows, ${issuerOther} rows from other source tables`);
  }
  // selection line, Our view box, asked lines (hard-coded approved text, so the page cannot drift)
  {
    // Colin's ruling of 2026-10-23 16:02 EDT (w3-colin-rulings.txt, option a): AW1's allowed sentences R5 and R6, verbatim from the audit file.
    const APPROVED_SELECTION = "SlushFund's founder asked for this story because the President's own disclosure reports list thousands of securities transactions in an account in his name while he was making decisions on war, oil and tariffs that move markets. We lay out what those reports list, day by day, beside what the government did and said, and apply the same yardstick to every member of Congress, of every party, who reported trades in these months.";
    const sel = visibleText(elementWith(html, 'data-selection-line')?.html ?? '').trim();
    row('IRAN_WAR_SELECTION_LINE equals AW1 R5 verbatim (Colin, 16:02 EDT), and prints (once) in the header', C.IRAN_WAR_SELECTION_LINE === APPROVED_SELECTION && sel === APPROVED_SELECTION && text.split(APPROVED_SELECTION).length === 2);
    const APPROVED_VIEW = [
      "The people who decide on war, tariffs and sanctions should not be trading individual stocks.",
      "When an official's own decisions can move markets, the public has no way to know whether that official's trades use information no one else has.",
      "On the other side of every trade are ordinary investors, including the retirement savings of millions of Americans.",
      "That is why we support a ban on individual stock trading by the President, the Vice President, members of Congress and senior officials, whatever their party.",
    ];
    const APPROVED_CARD_TAIL = " grades each member of Congress's own reported trading over the last 24 months against such a ban: an A means no individual-stock trades were reported.";
    const box = elementWith(html, 'data-our-view');
    const bt = visibleText(box?.html ?? '').trim();
    const want = `Our view ${APPROVED_VIEW.join(' ')} Our report card${APPROVED_CARD_TAIL}`;
    row('Our view box [data-our-view]: label, the four R6 sentences in order (AW1, Colin 16:02 EDT), then the report-card link sentence', !!box && bt === want && JSON.stringify(C.IRAN_WAR_OUR_VIEW_SENTENCES) === JSON.stringify(APPROVED_VIEW) && C.IRAN_WAR_OUR_VIEW_LABEL === 'Our view', bt.slice(0, 120));
    row(`Our view box links "Our report card" to ${GRADE_METHOD_PATH}`, !!box && new RegExp(`<a [^>]*href="${GRADE_METHOD_PATH.replace(/\//g, '\\/')}"[^>]*>Our report card</a>`).test(box.html));
    row('the Our view box is separate from the reporting: one box, after the method and right-of-reply sections', (() => { const dom = html.replace(/<script[\s\S]*?<\/script>/g, ''); const at = (a) => dom.indexOf(` ${a}`); return dom.split(' data-our-view').length === 2 && at('data-our-view') > at('data-responses') && at('data-our-view') > at('data-downloads'); })());
    row('R6 removed "insider": the Our view box holds neither "insider" nor "illegal", is clean against the whole A7b list, and neither word is anywhere else on the page', (() => {
      return !!box && !/insider|illegal/i.test(norm(bt)) && WORDING_RES.every((r) => !new RegExp(r.re, 'i').test(norm(bt))) && !/insider trading|illegal/i.test(norm(text.replace(bt, '')));
    })());
    const asked = C.IRAN_WAR_ASKED.map((who) => visibleText(elementWith(html, `data-response="${who.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')}"`)?.html ?? '').trim());
    row(`asked lines: one per recipient, "We asked ... for comment on ${C.IRAN_WAR_STORY_DATE}"`, C.IRAN_WAR_ASKED.length === 2 && C.IRAN_WAR_ASKED.every((who, i) => asked[i] === C.iranWarAskedLine(who)) && has(C.RESPONSES_INTRO), asked.join(' | ').slice(0, 220));
  }
  // the fixed line: above the chart, in the timeline's text object, again in the limits
  {
    const above = html.indexOf('data-above-chart');
    const chartAt = Math.min(...['data-timeline-svg', 'data-timeline-focus'].map((a) => html.indexOf(a)).filter((i) => i > -1));
    const fixedEl = visibleText(elementWith(html, 'data-above-chart')?.html ?? '').trim();
    row('IRAN_WAR_FIXED_LINE sits directly above the chart', above > -1 && above < chartAt && fixedEl === C.IRAN_WAR_FIXED_LINE, `fixed line at ${above}, chart at ${chartAt}`);
    row('IRAN_WAR_FIXED_LINE is in the timeline text object (the day panel prints it from there)', new RegExp(`fixedLine\\\\*":\\\\*"${C.IRAN_WAR_FIXED_LINE.replace(/[.]/g, '\\.')}`).test(html));
  }
  // timeline: no arrow/connector language, keyboard and table toggle present
  {
    const tl = elementWith(html, 'data-war-timeline')?.html ?? '';
    row('timeline [data-war-timeline] renders, with the table toggle, the keyboard line and the legend', !!tl && tl.includes('data-timeline-toggle') && visibleText(tl).includes(C.TABLE_TOGGLE_ON) && visibleText(tl).includes(C.TIMELINE_KEYBOARD.slice(0, 40)) && tl.includes('data-legend'));
    row('timeline draws no arrow, connector or annotation between a post and a trade (no marker/arrow/line elements outside the axes)', !/<marker\b|marker-end|marker-start|<line [^>]*data-link|data-connector|data-arrow/.test(tl));
  }

  // ---- tables: every figure vs the rebuild
  {
    const cellsOf = (attr) => { const el = elementWith(html, attr); return el ? [...el.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => visibleText(c[1]).trim())) : null; };
    const WROWS = [
      ['Securities transactions', (t) => fmt(t.all.n)], ['Purchases', (t) => fmt(t.all.purchases)], ['Sales', (t) => fmt(t.all.sales)],
      ['Amount bands: sum of the bottoms', (t) => IW.usd(t.all.minSum)], ['Amount bands: sum of the tops', (t) => IW.usd(t.all.maxSum)],
      ['Stocks', (t) => fmt(t.byInstrument.stock.n)], ['Bonds', (t) => fmt(t.byInstrument.bond.n)], ['Funds', (t) => fmt(t.byInstrument['fund/ETF'].n)],
      ['In our energy or defense groups', (t) => fmt(t.ED.n)], ['Energy (SEC industry code, or a fund named for it)', (t) => fmt(t.E.n)], ['Defense by industry code', (t) => fmt(t.DSic.n)],
      ['Defense by federal money', (t) => fmt(t.DDod.n)], ['Other issuers', (t) => fmt(t.other.n)], ['Unclassified issuers', (t) => fmt(t.unclassified.n)],
    ];
    const windowsCheck = (label, attr, cols, tables, disc, congress = false) => {
      const rowsWanted = congress ? [...WROWS.slice(0, 6), ['Options', (t) => fmt(t.options.n)], ...WROWS.slice(6)] : WROWS;
      const got = cellsOf(attr);
      const want = [['Measure', ...cols.map((c) => c.head)], ...rowsWanted.map(([l, g]) => [l, ...cols.map((c) => g(tables[c.key]))]),
        ['Reported more than 45 days after the trade', ...cols.map((c) => fmt(disc[c.key].over45))], [congress ? C.CONGRESS_LATENESS_LABEL : 'Not computed (holding type not required on a 278-T)', ...cols.map((c) => fmt(disc[c.key].notComputed))]];
      const bad = got ? want.filter((w, i) => JSON.stringify(w) !== JSON.stringify(got[i])) : want;
      row(label, !!got && got.length === want.length && bad.length === 0, bad.length ? `row "${bad[0][0]}": page ${JSON.stringify(got?.[want.indexOf(bad[0])] ?? null).slice(0, 120)} vs rebuild ${JSON.stringify(bad[0]).slice(0, 120)}` : `${want.length} rows x ${cols.length} windows equal the rebuild`);
    };
    const C4 = [['P0', '2025 (context)'], ['P1', 'Jan 2 to Feb 27'], ['P2', 'Feb 28 to Mar 31'], ['P3', 'Apr 1 to Jul 31']].map(([key, head]) => ({ key, head }));
    windowsCheck('windows table (President, 2025 context + 3 windows): every cell equals the rebuild', 'data-windows-table="windows"', C4, p.windows, p.disclosure);
    windowsCheck('windows table (all members of Congress, 3 windows): every cell equals the rebuild', 'data-windows-table="congress-windows"', C4.slice(1), cg.pooled.windows, cg.pooled.disclosure, true);
    for (const [id, kind] of [['bins-sign', 'signBins'], ['bins-post', 'postBins']]) {
      const got = cellsOf(`data-bins-table="${id}"`);
      const first = p.disclosure.P1[kind];
      const want = first.map((b, i) => [`${b.label}${b.over45 && id === 'bins-sign' ? ' (more than 45)' : ''}`, ...['P1', 'P2', 'P3'].map((k) => fmt(p.disclosure[k][kind][i].count))]); // W3 (AW1 should-fix 3): the 45-day mark belongs to the signature bins only
      row(`${id} table (days to the signature / OGE posting): every bin equals the rebuild`, !!got && JSON.stringify(got.slice(1)) === JSON.stringify(want), `${want.length} bins`);
    }
    for (const k of ['P1', 'P2']) {
      const got = cellsOf(`data-sic-table="sic-${k.toLowerCase()}"`);
      const want = p.sicMix[k].map((r) => [r.major === 'unclassified' ? 'None' : r.major, r.label, fmt(r.purchases), fmt(r.sales), fmt(r.n), r.ed ? 'Yes' : 'No']);
      row(`SIC table ${k}: every industry row equals the rebuild`, !!got && JSON.stringify(got.slice(1)) === JSON.stringify(want), `${want.length} rows`);
    }
    const monthEl = visibleText(elementWith(html, 'data-month-bars')?.html ?? '');
    row('trade-month bars: every month and its count (the 2025 months and the 2026 months) are printed', p.monthly.every((m) => monthEl.includes(IW.fmtMonth(m.month)) && monthEl.includes(fmt(m.table.all.n))), `${p.monthly.length} months`);
  }

  // ---- numbers spot rows (W1b record, figure for figure)
  {
    const m3t = S.get('m3') ?? '';
    row('P2 energy-or-defense lines after D1: 121 of the 2,352 securities transactions (AW1 D1; W1b section 3 said 112 before the nine issuer corrections)', p.windows.P2.ED.n === 121 && p.windows.P2.all.n === 2352 && (S.get('first-3') ?? '').startsWith('121 of the 2,352 are in issuers in our energy or defense groups.'), (S.get('first-3') ?? '').slice(0, 100));
    row('M3 primary after D1 (AW1 R2): P2 stock purchases 98 of 1,420 classified (6.9%) against 33 of 734 (4.5%), p = 0.029, significant; A2 lower bound p = 0.029 still significant, upper bound p = 0.063 not significant (W1b section 4.1 said 93/1,415 vs 31/732, p = 0.031, before D1)',
      m3t.includes('98 of 1,420 stock purchases in issuers we could classify (6.9 percent)') && m3t.includes('against 33 of 734 (4.5 percent)') && m3t.includes('p = 0.029, significant at the 0.05 level') && m3t.includes('p = 0.029 and the result is still significant') && m3t.includes('p = 0.063 and the result is not significant') && m3t.includes('higher than in the two months before') && Math.abs(p.m3.p - 0.02851) < 5e-5,
      m3t.slice(0, 260));
    const evDates = new Set(dump.chron.map((c) => c.event_date)); const labDates = new Set(dump.chron.filter((c) => c.labelled_marker).map((c) => c.event_date));
    row('chronology: 401 rows / 162 dates / 53 labelled-marker dates (story_chronology table, anon read; A4 adds two posts on existing dates)', dump.chron.length === 401 && evDates.size === 162 && labDates.size === 53 && f.chronology.total === 401 && (f.chronology.byLane.president_post ?? 0) === 340 && (f.chronology.byLane.government ?? 0) === 51 && (f.chronology.byLane.oversight ?? 0) === 10, `${dump.chron.length} rows, ${evDates.size} dates, ${labDates.size} labelled-marker dates, ${f.chronology.labelled} labelled rows`);
    row('President totals vs raw dump: transactions, reports, first/last trade date', p.total === dump.exec.length && p.reports === new Set(dump.exec.map((r) => r.source_doc_id)).size && p.firstTrade === dump.exec.map((r) => r.transaction_date).sort()[0], `${p.total} transactions in ${p.reports} reports, ${p.firstTrade} to ${p.lastTrade}`);
    row('every President trade date falls in a pre-registered window; unmapped issuers are counted, never guessed', p.outsideWindows === 0, `outside windows ${p.outsideWindows}, unmapped ${p.unmapped}, ambiguous ${p.ambiguous}, Congress unmapped ${cg.unmapped}`);
  }
  // day route
  {
    const day = await get(`${P}/days/2026-03-02`);
    let j = null; try { j = JSON.parse(day.buf.toString('utf8')); } catch { /* not JSON */ }
    const nTx = dump.exec.filter((r) => r.transaction_date === '2026-03-02').length;
    const nCh = dump.chron.filter((c) => c.event_date === '2026-03-02').length;
    const fd = f.days.find((d) => d.date === '2026-03-02');
    row(`day route 2026-03-02 returns JSON whose transaction count (${nTx}) and chronology count (${nCh}) equal the gate's dump and the rebuild`, day.status === 200 && day.type.includes('application/json') && j?.date === '2026-03-02' && j.tx.length === nTx && j.chron.length === nCh && fd?.total === nTx, `${day.status} tx ${j?.tx?.length} chron ${j?.chron?.length}, rebuild total ${fd?.total}`);
    const dates = IW.dateRange(IW.AXIS_START, IW.AXIS_END);
    let ok200 = 0; let txSum = 0; let chSum = 0; let badAsset = 0;
    for (let i = 0; i < dates.length; i += 25) {
      const batch = await Promise.all(dates.slice(i, i + 25).map((d) => get(`${P}/days/${d}`)));
      for (const r of batch) {
        if (r.status !== 200) continue;
        ok200++;
        const t = r.buf.toString('utf8'); const b = JSON.parse(t);
        txSum += b.tx.length; chSum += b.chron.length;
        if (/12\/31\/(?:49|2049)/.test(t)) badAsset++;
      }
    }
    const inAxis = (d) => d >= IW.AXIS_START && d <= IW.AXIS_END;
    row(`all ${dates.length} day routes answer 200; transactions (${dump.exec.filter((r) => inAxis(r.transaction_date)).length}) and chronology entries (${dump.chron.filter((c) => inAxis(c.event_date)).length}) sum to the dump's; none prints 12/31/49`, ok200 === dates.length && txSum === dump.exec.filter((r) => inAxis(r.transaction_date)).length && chSum === dump.chron.filter((c) => inAxis(c.event_date)).length && badAsset === 0, `${ok200}/${dates.length} ok, tx ${txSum}, chron ${chSum}, ${badAsset} with a placeholder maturity`);
    for (const bad of ['2026-08-01', '2025-11-30', 'not-a-date']) await hit(`${P}/days/${bad}`, 404, { group: G });
  }

  // ---- wording rows
  {
    const QUOTED = ['data-our-view', 'data-war-timeline', 'data-oil-list', 'data-rules-box'];
    const reporting = visibleText(withoutElements(html, QUOTED).replace(/<q\b[^>]*>[\s\S]*?<\/q>/g, ' '));
    const sentences = [...S.entries()].filter(([k]) => !k.startsWith('our-view')).map(([, v]) => v);
    // every string the copy module can print, with live slots filled by the rebuild (the verbatim 5 CFR quotes and the Our view lines are left out)
    const copy = [];
    const walk = (v) => { if (typeof v === 'string') copy.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    for (const [k, v] of Object.entries(C)) if (!/^(QUALIFIED_TRUST_QUOTES|IRAN_WAR_OUR_VIEW)/.test(k)) walk(v);
    copy.push(C.dek(f), ...C.accountLines(f), ...C.beforeLines(f), ...C.firstMonthLines(f), C.volumeLine(f), ...C.chronologyLines(f), C.m3Result(p.m3, ''), C.m3Sales(p.m3Sales, ''), ...C.oilLines(f),
      ...['P1', 'P2', 'P3'].map((k) => C.over45Line(p.disclosure[k], k)), ...p.posting.map((m) => C.postingLine(m)), C.feeIntro(p.fees, p.reportsInWindows), ...p.fees.map((c) => C.feeRows(c)), ...C.congressLines(f),
      ...[cg.pooled, cg.house, cg.senate].flatMap((g) => C.congressTestLines(g)));
    const corpora = { 'rendered reporting text': reporting, 'rendered data-sentence values': sentences.join(' \n '), 'copy module strings': copy.join(' \n ') };
    const deVerbatim = (s) => s.replace(/Filer paid late fee\(s\)\.?/g, ' ').replace(/wrote a late-fee note in the comments box/g, ' '); // the R3 intro (AW1 P12) is the one place the page says "late-fee note"
    const rx = (re, flags = 'i') => new RegExp(re, flags);
    const scan = (label, re, opts = {}) => {
      const hits = [];
      for (const [name, t] of Object.entries(corpora)) { const m = rx(re).exec(opts.verbatim ? deVerbatim(t) : t); if (m) hits.push(`${name}: "${t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}"`); }
      row(label, hits.length === 0, hits.join(' | '));
    };
    row('wording: reporting text uses "securities transactions"', reporting.includes('securities transactions'));
    scan('wording: no "stock trades" (it is "securities transactions")', String.raw`\bstock trades?\b`);
    scan('wording: no "late" or "on time" as a characterization (only the R3 intro "a late-fee note in the comments box" uses the word; the verbatim cover notes are quoted by element)', String.raw`\blate\b|\bon[- ]time\b|\bfiled late\b|\bwere late\b|\blate filers?\b`, { verbatim: true });
    scan('wording: no "manipulat..." in the reporting', String.raw`manipulat`);
    scan('wording: no "insider trading" in the reporting (it is allowed only inside the data-our-view box)', String.raw`insider trading`);
    // "all amounts are 'between X and Y'": a dollar figure in a sentence is a band bound or a range, never a point amount
    {
      const pointAmount = (s) => s.replace(/between \$[\d,]+ and \$[\d,]+/g, ' ').replace(/\$[\d,]+ to \$[\d,]+/g, ' ').replace(/below the \$1,000 reporting threshold/g, ' '); // A7b's allowed NULL text names the legal reporting threshold, which is not a transaction amount
      const hits = Object.entries(corpora).filter(([n]) => n !== 'rendered reporting text').map(([n, t]) => [n, /\$[\d]/.exec(pointAmount(t))]).filter(([, m]) => m);
      const total = /\btotal(?:ing|led)? \$|\bworth \$/i.test(reporting);
      row('wording: no dollar figure printed as a point amount in any sentence (every amount is "between X and Y" or a band), no "total $"', hits.length === 0 && !total, hits.map(([n, m]) => `${n}: "${m.input.slice(Math.max(0, m.index - 30), m.index + 30)}"`).join(' | '));
    }
    row('wording: no "12/31/49" or "due 12/31" anywhere in the rendered text (whole page, timeline included)', !/12\/31\/(?:49|2049)|\bdue 12\/31/.test(text));
    const glued = /(?<![\w#.$%/-])\d[\d,]*[A-Za-z]{3,}\b/.exec(reporting);
    row('wording: no number glued to a word in the reporting text', !glued, glued ? `"${glued[0]}" in "...${reporting.slice(Math.max(0, glued.index - 30), glued.index + 40)}..."` : '');
    row('no "Figures unavailable" and no raw column or enum name in the rendered page', !/Figures unavailable/.test(reporting) && !/stock_act_late|late_basis|not_required_on_278T|undefined|\[object|NaN\b/.test(reporting));
    const forbid = [];
    for (const r of WORDING_RES) { const m = new RegExp(r.re, 'i').exec(reporting); if (m) forbid.push(`"${m[0]}" (${r.from})`); }
    row('wording: the A7b forbidden list is absent from the reporting text (the Our view box and verbatim quotes are whitelisted by element)', forbid.length === 0, forbid.slice(0, 4).join(' · '));
  }
  // generic fee rule on this page (also run by the D15 loop above when that flag is on)
  {
    // W3 (AW1 P12 / R3): the intro no longer quotes a paraphrase; the generic 'Filer paid late fee(s).' must be absent, and every verbatim cover note
    // ('Filer paid late fee' / 'fees', as printed) is followed within the SAME 300-character limit by the signed compliance sentence.
    const generic = [...text.matchAll(/Filer paid late fee\(s\)/g)].length;
    const at = [...text.matchAll(/Filer paid late fee/g)].map((m) => m.index);
    const ends = at.map((i) => { const j = text.indexOf(C.COMPLIANCE_SENTENCE, i); return j === -1 ? -1 : j - i + C.COMPLIANCE_SENTENCE.length; });
    row(`the page prints no generic "Filer paid late fee(s)" paraphrase (${generic}), and each of the ${at.length} verbatim cover notes is followed within 300 characters by the signed compliance sentence`, generic === 0 && at.length === 3 && at.every((i) => text.slice(i, i + 300).includes(C.COMPLIANCE_SENTENCE)),
      `${generic} generic; ${at.length} verbatim note(s); the compliance sentence ends ${ends.join(', ')} characters after each note starts (limit 300)`);
  }
})();
// ---------------------------------------------------------------- D19: analytics hub (/analytics)
{
  const G = 'D19 analytics hub';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  // Flag: off on production until SHOW_ANALYTICS_HUB is exactly '1'; on in dev and previews.
  for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_ANALYTICS_HUB: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_ANALYTICS_HUB: 'true' }, true]]) {
    const got = hiddenByFlag(ANALYTICS_PATH, env);
    row(`hiddenByFlag(${JSON.stringify(ANALYTICS_PATH)}, ${JSON.stringify(env)})`, got === want, '', String(want));
  }
  const restCount = async (path) => {
    const { url, key } = anonCreds();
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
    if (!res.ok) throw new Error(`${path.split('?')[0]} -> ${res.status}`);
    return Number((res.headers.get('content-range') ?? '').split('/')[1]);
  };
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  if (analyticsHubEnabled()) {
    await hit(ANALYTICS_PATH, 200, {
      bodyAll: ['What we hold', 'Reports filed per month', 'Days from trade to report', 'Campaign receipts', 'Our own pipeline', 'Download the rows', 'Show the numbers', 'never zero', 'not a finding about any filer'],
      notBody: ['unavailable right now'],
      group: G,
    });
    row('sitemap lists /analytics', sm.includes(`slushfund.net${ANALYTICS_PATH}<`), '');
    const html = (await (await fetch(base + ANALYTICS_PATH)).text()).replace(/<!-- -->/g, '');
    const vis = visibleText(html);
    row(`${ANALYTICS_PATH} visible text has no NaN, undefined or null`, !/\b(?:NaN|undefined|null)\b/.test(vis), '');
    row(`${ANALYTICS_PATH} has an Analytics tab in the Data nav`, html.includes('href="/analytics"'), '');
    row(`${ANALYTICS_PATH} charts carry a text table each`, (html.match(/Show the numbers/g) ?? []).length >= 2, `${(html.match(/Show the numbers/g) ?? []).length} tables`);
    row(`${ANALYTICS_PATH} every focusable chart mark has an aria-label`, !/<(?:rect|div)(?![^>]*aria-label)[^>]*role="img"[^>]*tabindex="0"/.test(html) && !/<(?:rect|div)(?![^>]*aria-label)[^>]*tabindex="0"[^>]*role="img"/.test(html), '');
    // Figures against the database (anon): the coverage band counts.
    try {
      const want = [
        ['house_trades', await restCount('congress_trades?select=id&source_system=eq.House_Clerk')],
        ['senate_trades', await restCount('congress_trades?select=id&source_system=eq.Senate_EFD')],
        ['members', await restCount('congress_members?select=id&in_office=eq.true')],
        ['contracts', await restCount('awards?select=id')],
        ...(presidentPageEnabled() ? [['exec', await restCount('executive_trades?select=id')]] : []),
        ...(campaignMoneyEnabled() ? [['fec', await restCount('member_campaign_money?select=bioguide_id')]] : []),
        ...(investigationsV2Enabled() ? [['subject', await restCount('subject_award_transactions?select=transaction_key')]] : []),
      ];
      for (const [k, n] of want) {
        const m = new RegExp(`data-figure="${k}">([0-9,]+)<`).exec(html);
        row(`${ANALYTICS_PATH} coverage figure ${k} equals the database count (${nfmt(n)})`, !!m && num(m[1]) === n, m ? `page ${m[1]}` : 'figure not found');
      }
    } catch (e) { row('/analytics coverage figures vs DB', false, `could not run: ${String(e.message).slice(0, 120)}`); }
    // A section behind another feature's flag follows that flag.
    row('grades section follows SHOW_GRADES', gradesEnabled() === vis.includes('Stock Trading Grades: snapshot'), '');
    row('grades gated: "Not public yet." card present exactly when SHOW_GRADES is off', gradesEnabled() === !html.includes('data-figure="grades-gated"'), '');
    // Fix round: the no-date member is disclosed under the quarter bars; the current month is labelled partial.
    if (campaignMoneyEnabled()) {
      try {
        const { url, key } = anonCreds();
        const r = await fetch(`${url}/rest/v1/fec_member_money_mv?select=bioguide_id&coverage_end=is.null`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
        const nd = r.ok ? (await r.json()).length : -1;
        const shown = html.includes('data-figure="money-nodate"');
        row('campaign receipts: no-date members disclosed under the quarter bars when > 0', nd >= 0 && shown === (nd > 0), `no-date ${nd}, line ${shown ? 'shown' : 'absent'}`);
      } catch (e) { row('campaign receipts: no-date line', false, `could not run: ${String(e.message).slice(0, 120)}`); }
    }
    const curMon = new Date().toISOString().slice(0, 7);
    const monShort = new Date(`${curMon}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    row('disclosure table labels the current month "(partial)"', html.includes(`${monShort} (partial)`), monShort);
    row('campaign section follows SHOW_CAMPAIGN_MONEY', campaignMoneyEnabled() === !vis.includes('Campaign finance data is not public on this site yet'), '');
    row('President link follows SHOW_PRESIDENT_TRADES', presidentPageEnabled() === html.includes(`href="${PRESIDENT_PATH}"`), '');
  } else {
    await hit(ANALYTICS_PATH, 404, { notBody: ['What we hold'], group: G });
    row('sitemap has no /analytics', !sm.includes(`slushfund.net${ANALYTICS_PATH}`), '');
    const nav = await (await fetch(base + '/data/status')).text();
    row('Data nav has no Analytics tab', !nav.includes('href="/analytics"'), '');
  }
}

// ---------------------------------------------------------------- D9 / D10: President page, leaderboard, grades, who funds them
{
  const G = 'D9/D10 pages';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  // Flags: each page is off on production until its own switch is exactly '1'.
  for (const [path, sw] of [[PRESIDENT_PATH, 'SHOW_PRESIDENT_TRADES'], [MOST_ACTIVE_PATH, 'SHOW_MOST_ACTIVE'], [GRADE_METHOD_PATH, 'SHOW_GRADES'], [SECTOR_HEATMAP_PATH, 'SHOW_SECTOR_HEATMAP']]) {
    for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', [sw]: '1' }, false], [{ VERCEL_ENV: 'production', [sw]: 'true' }, true]]) {
      const got = hiddenByFlag(path, env);
      row(`hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)})`, got === want, '', String(want));
    }
  }
  for (const [fn, env, want] of [[campaignMoneyEnabled, { VERCEL_ENV: 'production' }, false], [campaignMoneyEnabled, { VERCEL_ENV: 'production', SHOW_CAMPAIGN_MONEY: '1' }, true], [gradesEnabled, { VERCEL_ENV: 'production' }, false], [gradesEnabled, {}, true]]) {
    const got = fn(env);
    row(`${fn.name}(${JSON.stringify(env)})`, got === want, '', String(want));
  }
  // Every A11 forbidden phrase is in the wording gate (one test sentence each).
  for (const s of ['He filed late.', 'three late filings', 'overdue', 'a delinquent filer', 'broke the STOCK Act', 'he was penalized', 'paid a fine', 'an insider', 'he profited', 'met the deadline', 'paid $1,000 in fees', 'Trump bought shares', 'stock_act_late', 'shortly after the tariff', 'the worst trader', 'lining their pockets', 'in the pocket of', 'cashing in', 'conflict of interest', 'missed the deadline', 'late filer', 'violated the STOCK Act', 'illegal', 'fined', 'penalty', 'hid', 'concealed', 'suspicious', 'on time', 'not late']) {
    const listed = FORBIDDEN_PHRASES.some((p) => new RegExp(p.re, 'gi').test(s));
    row(`wording gate lists "${s}"`, listed, 'forbidden-words.ts');
  }
  const visible = async (p) => { const r = await fetch(base + p); return { status: r.status, text: visibleText(await r.text()) }; };
  if (presidentPageEnabled()) {
    await hit(PRESIDENT_PATH, 200, {
      bodyAll: [
        'President Trump reported', 'periodic transaction reports (OGE Form 278-T) signed between', 'as posted by the U.S. Office of Government Ethics.',
        'The form asks for each transaction to be reported within 30 days of the filer learning of it, and no later than 45 days after it.',
        'counted to the date President Trump signed the report.',
        'We count calendar days and do not adjust for weekends or holidays. Filing extensions, if any were granted, are kept in the report file and are not shown on the posted report.',
        'transactions were not computed: this type of holding (U.S. Treasury securities, money-market and mutual funds) is not required on a 278-T.',
        'Reported values sum to', 'View report', 'Notification received over 30 days ago',
      ],
      notBody: ['JD Vance', 'Vance', 'late_basis', 'not_required_on_278T', 'stock trades'],
      group: G,
    });
    // A11: no "option(s)" anywhere on the page (M3), no single total; the fee note and the compliance opinion only together.
    const v = await visible(PRESIDENT_PATH);
    const opt = /\boptions?\b/i.exec(v.text);
    row(`${PRESIDENT_PATH} visible text has no "option(s)"`, v.status === 200 && !opt, opt ? `"…${v.text.slice(Math.max(0, opt.index - 40), opt.index + 20)}…"` : '');
    const fee = /Filer paid late fee/.test(v.text);
    const opinion = /Every report also carries the agency ethics official’s signed opinion that the filer is in compliance with applicable laws and regulations\./.test(v.text);
    row(`${PRESIDENT_PATH} fee note only beside the compliance opinion`, fee === opinion, `fee note ${fee ? 'shown' : 'absent'}, opinion ${opinion ? 'shown' : 'absent'}`);
    row(`${PRESIDENT_PATH} no single dollar total`, !/\btotal(?:ing|led)? \$|\bworth \$/i.test(v.text), '');
    for (const q of ['?class=bond&type=sale&sort=band', '?sort=date_asc&page=3', '?report=zz&type=x&class=y&sort=q&page=-9']) await hit(PRESIDENT_PATH + q, 200, { notBody: ['unavailable right now'], group: G });
    // Figures against the database (anon): N transactions, 19 reports, rows over 45 days and the reports holding them.
    try {
      const et = await restAll('executive_trades?select=source_doc_id,stock_act_late&office=eq.President&report_type=eq.278-T');
      const docs = new Set(et.map((r) => r.source_doc_id));
      const over = et.filter((r) => r.stock_act_late === true);
      const overDocs = new Set(over.map((r) => r.source_doc_id));
      const want = `${nfmt(over.length)} transactions in ${nfmt(overDocs.size)} of the ${nfmt(docs.size)} reports were reported more than 45 days after the trade date shown`;
      await hit(PRESIDENT_PATH, 200, { bodyAll: [`President Trump reported ${nfmt(et.length)} securities transactions in ${nfmt(docs.size)} periodic`, want], group: G });
    } catch (e) { row('President figures vs DB', false, `could not run: ${String(e.message).slice(0, 120)}`); }
  } else await hit(PRESIDENT_PATH, 404, { group: G });
  if (mostActiveEnabled()) {
    await hit(MOST_ACTIVE_PATH, 200, { bodyAll: ['Most active stock traders in Congress', 'at least $', 'All congressional trades per month', 'not a finding about the filer'], group: G });
    for (const q of ['?sort=value&chamber=Senate', '?sort=late&party=Democrat&state=CA&all=1', '?sort=zz&chamber=Mars&party=Green&state=ZZ']) await hit(MOST_ACTIVE_PATH + q, 200, { notBody: ['unavailable right now'], group: G });
  } else await hit(MOST_ACTIVE_PATH, 404, { group: G });
  // D18: sector heatmap. Flag on: the page, its filters, a sector drill-down and junk parameters; flag off: the site 404.
  if (sectorHeatmapEnabled()) {
    await hit(SECTOR_HEATMAP_PATH, 200, { bodyAll: ['What Congress is trading', 'Most-bought tickers', 'Most-sold tickers', 'Unclassified', 'Ranges, not amounts', 'not a finding about the filer', 'Purchases and sales per month'], notBody: ['unavailable right now'], group: G });
    for (const q of ['?months=3', '?months=6&measure=net', '?sector=unclassified', '?months=99&measure=zz&sector=zz']) await hit(SECTOR_HEATMAP_PATH + q, 200, { notBody: ['unavailable right now'], group: G });
    await hit(`${SECTOR_HEATMAP_PATH}?months=12&sector=ai-tech`, 200, { bodyAll: ['AI / Tech:', 'Members with the most transactions here'], group: G });
  } else await hit(SECTOR_HEATMAP_PATH, 404, { group: G });
  const member = '/people/G000583';
  if (gradesEnabled()) {
    await hit(GRADE_METHOD_PATH, 200, { bodyAll: [GRADE_FIXED_LINE, 'Would this member pass a congressional stock-trading ban today?'], group: G });
    await hit(member, 200, { bodyAll: ['Stock Trading Grade', GRADE_FIXED_LINE, 'Why this grade'], group: G });
    // A12 M1: single companies filed as "Other" are scored; fund names cut off at 50 characters are not.
    const cls = (asset_type, company_name, ticker = null) => gradeClass({ asset_type, company_name, ticker }, instrumentKind({ asset_type, company_name, transaction_type: 'BUY' }));
    for (const [at, name, tk, want] of [
      ['Other', 'Atlas Energy Solutions Inc. Common Stock', 'AESI', 'stock'], ['Other', 'SpaceX', 'SPCX', 'stock'], ['Other', 'Space Exploration Technologies Corp.', 'SPCX', 'stock'],
      ['Other', 'Annaly Capital Management Inc', 'NLY', 'stock'], ['Other', 'Yum! Brands', 'YUM', 'stock'], ['Other', 'FIGMA INC CLASS A', 'FIG', 'stock'],
      ['Other', 'Huntington Bancshares Incorporated - Depositary Shares L Preferred Stock', 'HBANZ', 'stock'], ['Other', 'Advanced Machine Intelligence Labs', 'AMI', 'stock'],
      ['Other', 'WaterBridge Infrastructure LLC CL A', 'WBI', 'stock'], ['Other', 'VERSANT MEDIA GROUP INC CL A', 'VSNT', 'stock'],
      ['Other', 'Gold bullion', null, 'excluded'], ['Other', 'Vanguard Total Stock Market ETF', 'VTI', 'excluded'],
      ['Stock', 'First Trust Global Tactical Commodity Strategy Fun', 'FTGC', 'excluded'], ['Stock', 'Goldman Sachs Access Investment Grade Corporate Bo', 'GIGB', 'excluded'],
      ['Stock', 'Invesco Optimum Yield Diversified Commodity Strate', 'PDBC', 'excluded'], ['Stock', 'Goldman Sachs Intl Small Cap Insights Fd Inst', 'GICIX', 'excluded'],
      ['Stock', 'First Trust North American Energy Infrastructure F', 'EMLP', 'excluded'], ['Stock', 'KKR Real Estate Select Trust Class U', 'KRSOX', 'excluded'],
      ['Stock', 'Apple Inc.', 'AAPL', 'stock'],
    ]) { const got = cls(at, name, tk); row(`gradeClass(${at}: ${name})`, got === want, `got ${got}`, want); }
    // A12 M2: an A with unread scanned/paper reports filed inside the window is "Not graded"; only the window's reports are counted.
    const uw = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'unread-window.json'), 'utf8'));
    const nKh = unreadInWindow(uw.K000389, windowStart(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })));
    await hit('/people/K000389', 200, { bodyAll: [notGradedLine('Ro Khanna', nKh), 'What the filings we have read show'], notBody: ['points of 100', 'it may be lower than the filings would give', 'Grade A'], group: G });
    const nDon = unreadInWindow(uw.D000032, windowStart(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })));
    await hit('/people/D000032', 200, { bodyAll: [unreadCaveat(nDon), 'Why this grade'], notBody: ['it may be lower than the filings would give', 'Not graded'], group: G });
    // A12 M3: the "Reported value" factor links the filings behind it (largest bands first, with the amount in the link name).
    const roy = await fetch(base + '/people/R000614').then((r) => r.text());
    const valueLinks = [...roy.matchAll(/aria-label="Filing: [^"]*, at least \$[\d,]+, opens/g)].length;
    row('/people/R000614 value factor has filing links', valueLinks > 0 && valueLinks <= 5, `${valueLinks} links`, '1 to 5');
  } else {
    await hit(GRADE_METHOD_PATH, 404, { group: G });
    await hit(member, 200, { notBody: ['Stock Trading Grade'], group: G });
  }
  // Who funds them: while F1's view is missing (or the flag is off) the panel says only "coming soon".
  let viewMissing = false;
  try { await restAll('member_campaign_money?select=bioguide_id&limit=1'); } catch { viewMissing = true; }
  if (viewMissing || !campaignMoneyEnabled()) { await hit(member, 200, { notBody: ['Who funds them', 'Campaign finance data: coming soon', 'corporate and trade-association PACs'], group: G }); if (gradesEnabled()) await hit(GRADE_METHOD_PATH, 200, { notBody: ['Who funds them', '2026 campaign money'], group: G }); }
  else {
    // A12 M5-M8 (f1b): one template for every member; never "2026 campaign"; no share when it cannot be printed.
    const FG = 'who funds them (F1b)';
    const TEMPLATE = ['campaign committee reported $', 'in total receipts in the 2025–26 FEC cycle (through '];
    const NEVER = ['2026 campaign', 'not available', 'reported no in total', 'NaN%', 'undefined%'];
    await hit(member, 200, { bodyAll: ['Who funds them', ...TEMPLATE, 'of those receipts came from corporate and trade-association PACs, by the PACs’ own reports (FEC, through '], notBody: NEVER, group: FG });
    await hit('/people/M001212', 200, { bodyAll: [...TEMPLATE, 'These figures are for the FEC candidate record for U.S. Senate.', 'also has an FEC record for U.S. House; it uses the same committee, whose receipts are in these figures.'], notBody: [...NEVER, 'that committee reported $'], group: FG }); // M5/M11: Barry Moore (his House record's committee is inside his Senate total)
    await hit('/people/P000614', 200, { bodyAll: [...TEMPLATE, 'also has an FEC record for U.S. House; it uses the same committee, whose receipts are in these figures.'], notBody: NEVER, group: FG });
    await hit('/people/S001203', 200, { bodyAll: [...TEMPLATE, 'Shares not shown: in this period, refunds or giver-side reports do not line up with the campaign’s own total receipts. See the FEC record.'], notBody: [...NEVER, 'came from corporate and trade-association PACs'], group: FG }); // M6: Tina Smith
    await hit('/people/B001328', 200, { bodyAll: ['No receipts reported for the 2025–26 FEC cycle (FEC).'], notBody: [...NEVER, 'in total receipts'], group: FG }); // M8: Everton Blair Jr.
    if (gradesEnabled()) await hit(GRADE_METHOD_PATH, 200, { bodyAll: ['Who funds them (not graded)', 'in the 2025–26 FEC cycle'], notBody: ['2026 campaign'], group: FG });
    // Data assertion on the live view: shares print only when none is negative and they add to at most 100.
    const mcm = await restAll('member_campaign_money?select=name,raised,pct_small_individual,pct_large_individual,pct_corporate_trade_pac,pct_labor_pac,pct_leadership_party_other,pct_self_funded,shares_ok');
    const SH = ['pct_small_individual', 'pct_large_individual', 'pct_corporate_trade_pac', 'pct_labor_pac', 'pct_leadership_party_other', 'pct_self_funded'];
    const wrong = mcm.filter((r) => { const v = SH.map((k) => Number(r[k] ?? 0)); const printable = Number(r.raised) > 0 && v.every((x) => x >= 0) && v.reduce((a, b) => a + b, 0) <= 100.0001; return r.shares_ok !== printable || SH.some((k) => r[k] == null && Number(r.raised) > 0); });
    gateRow('member_campaign_money shares_ok', wrong.length === 0, wrong.length ? `${wrong.length} rows disagree, e.g. ${wrong.slice(0, 3).map((r) => r.name).join(', ')}` : `${mcm.length} rows: shares_ok matches the negative/over-100 rule, no empty share where receipts > 0`, FG);

    // D14: the campaign-money tile says what the panel says; no "not loaded" label for campaign money anywhere while the flag is on.
    const DG = 'campaign-money labels (D14)';
    const usd = (n) => `$${Math.round(Number(n)).toLocaleString('en-US')}`;
    const byId = new Map(mcm.length ? (await restAll('member_campaign_money?select=bioguide_id,raised,coverage_end')).map((r) => [r.bioguide_id, r]) : []);
    for (const id of ['G000583', 'M001212', 'S001203']) {
      const r = byId.get(id);
      if (!r) { gateRow(`tile ${id}`, false, 'no member_campaign_money row to compare against', DG); continue; }
      await hit(`/people/${id}`, 200, { bodyAll: [`${usd(r.raised)}</strong>`, 'campaign committee receipts, 2025–26 FEC cycle, through ', 'href="#p-funds"'], notBody: ['Not loaded yet (FEC)'], group: DG });
    }
    await hit('/people/B001328', 200, { bodyAll: ['Campaign money', 'No receipts reported for the 2025–26 FEC cycle (FEC).'], notBody: ['Not loaded yet (FEC)'], group: DG });
    try {
      const mem = await restAll('congress_members?select=bioguide_id&in_office=eq.true');
      const none = mem.map((m) => m.bioguide_id).find((id) => !byId.has(id));
      if (none) await hit(`/people/${none}`, 200, { bodyAll: ['No FEC candidate record confirmed for ', 'yet, so no campaign figures are shown.'], notBody: ['Not loaded yet (FEC)', 'campaign committee receipts, 2025–26'], group: DG });
      else gateRow('tile for a member with no row', true, 'every sitting member has a row', DG);
    } catch (e) { gateRow('tile for a member with no row', false, `could not run: ${String(e.message).slice(0, 120)}`, DG); }
    const STALE = [/Not loaded yet \(FEC\)/i, /Campaign money\W{0,6}coming later/i, /Campaign money\W{0,6}not loaded yet/i, /Campaign money and lobbying are planned/i, /PAC and donor money to members \(not loaded yet\)/i];
    for (const p of ['/', '/data', '/about', '/your-members', '/your-members/ca', '/data/status', '/about/methodology', '/people', '/people/G000583', '/people/M001212', '/people/S001203', '/people/B001328']) {
      const v = await visible(p);
      const bad = STALE.find((rx) => rx.test(v.text));
      row(`${p} no stale campaign-money label`, v.status === 200 && !bad, bad ? `matches ${bad}` : `status ${v.status}`);
    }
    const home = await visible('/');
    row('/ lobbying legend still says coming later', /Lobbying\W{0,6}coming later/i.test(home.text), 'lobbying is not loaded');
  }
}

// ---------------------------------------------------------------- D21: "Follow the money" (member page graphic + compact voter-page variant)
{
  const G = 'money trail (D21)';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  const count = (s, needle) => s.split(needle).length - 1;
  const SHARES_NOT_SHOWN = 'Shares not shown: in this period, refunds or giver-side reports do not line up with the campaign’s own total receipts. See the FEC record.';
  const FUNDING_NO_RECEIPTS = 'No receipts reported for the 2025–26 FEC cycle (FEC).';
  // The page's HTML without the RSC payload scripts (they repeat every string), so counts are of what the page prints.
  const text = async (p) => (await fetch(base + p).then((r) => r.text())).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  // Flag: off on production until SHOW_MONEY_TRAIL is exactly '1'.
  for (const [env, want] of [[{}, true], [{ VERCEL_ENV: 'preview' }, true], [{ VERCEL_ENV: 'production' }, false], [{ VERCEL_ENV: 'production', SHOW_MONEY_TRAIL: '1' }, true], [{ VERCEL_ENV: 'production', SHOW_MONEY_TRAIL: 'true' }, false]]) {
    row(`moneyTrailEnabled(${JSON.stringify(env)})`, moneyTrailEnabled(env) === want, '', String(want));
  }
  row('caption is the exact sentence set in the brief', TRAIL_CAPTION === 'Money in and disclosed trades shown side by side from public records. Nothing here shows a payment to or from any company, or any coordination. Filings list assets, not reasons.', '');
  const MEMBERS = [
    ['G000583', 'a member with trades'],
    ['O000172', 'a zero-trade member (graded)'],
    ['K000389', 'a Not-graded member (zero trades, unread filings)'],
    ['S001203', 'a shares-suppressed member'],
    ['T000165', 'a shares-suppressed member with zero trades'],
    ['B001328', 'a member with no receipts'],
  ];
  if (moneyTrailEnabled()) {
    const moneyOn = campaignMoneyEnabled();
    for (const [id, what] of MEMBERS) {
      const t = await text(`/people/${id}`);
      const ok = t.includes('data-section="money-trail"') && count(t, TRAIL_CAPTION) === 1 && t.includes('The numbers behind this graphic') && t.includes('id="p-trail"');
      row(`/people/${id} ${what}: graphic + caption exactly once`, ok, `caption x${count(t, TRAIL_CAPTION)}`);
      const from = t.indexOf('data-section="money-trail"');
      row(`/people/${id} no accusation wording`, from >= 0 && !/\b(bribe|kickback|quid pro quo|corrupt|paid off|payoff|buy(?:ing)? influence)\b/i.test(t.slice(from, from + 60000)), '');
    }
    const trade = await text('/people/G000583');
    row('/people/G000583 right panel counts line + sector table', trade.includes(TRAIL_COUNTS_LINE) && trade.includes('Disclosed trades by sector') && /stock purchases and sales/.test(trade), '');
    const tt = trade.slice(trade.indexOf('Disclosed trades by sector,'));
    row('/people/G000583 ribbons are counts: no dollar figure in the sector table', tt.length > 0 && !tt.slice(0, tt.indexOf('</table>')).includes('$'), '');
    const zero = await text('/people/O000172');
    row('/people/O000172 zero-trade message', zero.includes(TRAIL_NO_TRADES), '');
    const ng = await text('/people/K000389');
    row('/people/K000389 zero trades + unread-filings caveat', ng.includes(TRAIL_NO_TRADES) && /scanned image or paper filing|scanned images or paper filings/.test(ng.slice(ng.indexOf('data-section="money-trail"'))), '');
    const sup = await text('/people/S001203');
    const supTrail = sup.slice(sup.indexOf('data-section="money-trail"'));
    if (moneyOn) row('/people/S001203 shares-suppressed: panel wording replaces the money-in ribbons', supTrail.includes(SHARES_NOT_SHOWN) && !supTrail.includes('Left ribbons are dollars'), '');
    const nr = await text('/people/B001328');
    if (moneyOn) row('/people/B001328 no receipts: the panel wording', nr.slice(nr.indexOf('data-section="money-trail"')).includes(FUNDING_NO_RECEIPTS), '');
    // Compact variant on the voter page: money in only, one caption per member card, no trade panel, link to the member page.
    if (voterPagesEnabled() && moneyOn) {
      const v = await text('/your-members/vt');
      const cards = count(v, 'data-member="');
      const compact = count(v, 'data-section="money-trail-compact"');
      row('/your-members/vt compact variant on every member card', cards > 0 && compact === cards, `${compact} of ${cards}`);
      row('/your-members/vt caption once per card', count(v, TRAIL_CAPTION) === cards, `${count(v, TRAIL_CAPTION)} captions`);
      row('/your-members/vt compact variant has no trade panel', !v.includes('Disclosed trades by sector') && /#p-trail"/.test(v), '');
      const ca = await text('/your-members/ca');
      row('/your-members/ca compact variant on every member card', count(ca, 'data-section="money-trail-compact"') === count(ca, 'data-member="') && count(ca, TRAIL_CAPTION) === count(ca, 'data-member="'), '');
    }
  } else {
    for (const [id, what] of MEMBERS.slice(0, 3)) {
      const t = await text(`/people/${id}`);
      row(`/people/${id} flag off: no graphic, no caption (${what})`, !t.includes('Follow the money') && !t.includes('data-section="money-trail"') && !t.includes(TRAIL_CAPTION), '');
    }
    if (voterPagesEnabled()) {
      const v = await text('/your-members/vt');
      row('/your-members/vt flag off: no compact variant, no caption', !v.includes('money-trail-compact') && !v.includes(TRAIL_CAPTION), '');
    }
  }
}

// ---------------------------------------------------------------- D11: voter pages ("Your members of Congress: the records")
{
  const G = 'D11 voter pages';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  // Flag: off on production until SHOW_VOTER_PAGES is exactly '1'; the index and every state page follow it.
  for (const path of [VOTER_PATH, `${VOTER_PATH}/ca`]) {
    for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_VOTER_PAGES: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_VOTER_PAGES: 'true' }, true]]) {
      const got = hiddenByFlag(path, env);
      row(`hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)})`, got === want, '', String(want));
    }
  }
  row(`hiddenByFlag("/your-membership", production)`, hiddenByFlag('/your-membership', { VERCEL_ENV: 'production' }) === false, 'prefix match is per path segment', 'false');
  // G10 wording: no ranking, endorsement or voting advice (one test sentence each); a company name as filed passes.
  for (const s of ['vote for him', 'Vote against her', 'voting for', 'the best record', 'Best in the state', 'we endorse', 'an endorsement', 'endorsed by']) {
    row(`wording gate lists "${s}"`, FORBIDDEN_PHRASES.some((p) => new RegExp(p.re, 'gi').test(s)), 'forbidden-words.ts');
  }
  row('"Best Buy" (BBY, as filed) is allowed verbatim', ALLOWED_VERBATIM.includes('Best Buy'), 'forbidden-words.ts');
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  const peopleHtml = await (await fetch(base + '/people')).text();
  if (!voterPagesEnabled()) {
    for (const p of [VOTER_PATH, `${VOTER_PATH}/ca`, `${VOTER_PATH}/vt`, `${VOTER_PATH}?zip=94110`]) await hit(p, 404, { group: G });
    row('sitemap has no voter pages', !sm.includes(`slushfund.net${VOTER_PATH}`), '');
    row('/people has no voter-page link', !peopleHtml.includes(`href="${VOTER_PATH}"`), '');
  } else {
    const head = [VOTER_TITLE, voterWhat(campaignMoneyEnabled()), VOTER_SCOPE, VOTER_NOT_FINDING];
    await hit(VOTER_PATH, 200, { bodyAll: [...head, 'Find my members', 'Pick your state', `href="${VOTER_PATH}/ca"`, `href="${VOTER_PATH}/vt"`], group: G });
    row('sitemap lists the index and 56 state pages', sm.includes(`slushfund.net${VOTER_PATH}<`) && sm.includes(`slushfund.net${VOTER_PATH}/vt<`) && (sm.match(new RegExp(`slushfund\\.net${VOTER_PATH}/[a-z]{2}<`, 'g')) ?? []).length === 56, '');
    row('/people links the voter pages', peopleHtml.includes(`href="${VOTER_PATH}"`), '');
    // ZIP lookup (D2): one state -> that state's page; a bad ZIP stays on the index with a message; the picker redirects.
    await hit(`${VOTER_PATH}?zip=05401`, 307, { location: `${VOTER_PATH}/vt?zip=05401#zip-note`, group: G });
    await hit(`${VOTER_PATH}?zip=00000`, 200, { body: 'We can', group: G });
    await hit(`${VOTER_PATH}?zip=12ab`, 200, { body: 'is not a 5-digit ZIP code', group: G });
    await hit(`${VOTER_PATH}?state=tx`, 307, { location: `${VOTER_PATH}/tx`, group: G });
    await hit(`${VOTER_PATH}/CA`, 308, { location: `${VOTER_PATH}/ca`, group: G });
    for (const p of [`${VOTER_PATH}/zz`, `${VOTER_PATH}/cal`, `${VOTER_PATH}/1a`]) await hit(p, 404, { group: G });
    await hit(`${VOTER_PATH}/ca?zip=94110`, 200, { bodyAll: ['This ZIP area lies in one district:', 'CA-11'], group: G });
    // A14 M12: DC delegate seat is coded 98 in the ZIP file and 0 in the roster; DC has no senators.
    {
      const dcHtml = (await (await fetch(`${base}${VOTER_PATH}/dc?zip=20001`)).text()).replace(/<!-- -->/g, '');
      const at = dcHtml.indexOf('id="zip-note"');
      const note = at < 0 ? '' : dcHtml.slice(at, dcHtml.indexOf('</section>', at));
      row(`${VOTER_PATH}/dc?zip=20001 ZIP note names the delegate, no "no current member", no "Both senators"`,
        note.includes('Eleanor Holmes Norton') && !note.includes('no current member in our roster') && !note.includes('Both senators'), `note ${note.length} chars`);
      const vtNote = (await (await fetch(`${base}${VOTER_PATH}/vt?zip=05401`)).text()).replace(/<!-- -->/g, '');
      row(`${VOTER_PATH}/vt?zip=05401 still says both senators`, vtNote.includes('Both senators below represent the whole state.'), '');
      // A14 M13: fec.gov drops non-ASCII letters from q, so the FEC search link folds accents (Barragán -> Barragan).
      const caHtml = (await (await fetch(`${base}${VOTER_PATH}/ca`)).text()).replace(/<!-- -->/g, '');
      const bs = caHtml.indexOf('data-member="B001300"');
      const block = bs < 0 ? '' : caHtml.slice(bs, caHtml.indexOf('</article>', bs));
      row(`${VOTER_PATH}/ca Barragán FEC search link is q=Barragan`, /href="https:\/\/www\.fec\.gov\/data\/candidates\/\?q=Barragan&(amp;)?state=CA"/.test(block), block ? '' : 'B001300 not on page');
    }
    // Every state page: the fixed header, current members only, alphabetical by last name, identical panels for everyone.
    const roster = await restAll('congress_members?select=bioguide_id,last_name,first_name,name,state,chamber&in_office=eq.true');
    const key = (m) => (m.last_name ?? m.name).trim();
    const sortName = (a, b) => key(a).localeCompare(key(b), 'en', { sensitivity: 'base' }) || (a.first_name ?? a.name).localeCompare(b.first_name ?? b.name, 'en', { sensitivity: 'base' }) || a.bioguide_id.localeCompare(b.bioguide_id);
    const gradesOn = gradesEnabled();
    const moneyOn = campaignMoneyEnabled();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const since = (() => { const [y, m, d] = today.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 30)).toISOString().slice(0, 10); })();
    for (const st of ['CA', 'VT', 'DC', 'TX']) {
      const path = `${VOTER_PATH}/${st.toLowerCase()}`;
      const html = (await (await fetch(base + path)).text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
      const want = roster.filter((m) => m.state === st);
      const wantOrder = [...want.filter((m) => m.chamber === 'Senate').sort(sortName), ...want.filter((m) => m.chamber !== 'Senate').sort(sortName)].map((m) => m.bioguide_id);
      const got = [...html.matchAll(/data-member="([A-Z]\d{6})"/g)].map((m) => m[1]);
      row(`${path} header text`, head.every((s) => html.includes(s)) && (!gradesOn || html.includes(GRADE_FIXED_LINE)), head.find((s) => !html.includes(s)) ?? '');
      row(`${path} members = current roster, senators then House, each by last name`, got.join(',') === wantOrder.join(','), `${got.length} on page, ${wantOrder.length} in roster${got.join(',') !== wantOrder.join(',') ? `; first difference at #${got.findIndex((g, i) => g !== wantOrder[i]) + 1}` : ''}`);
      const count = (re) => (html.match(re) ?? []).length;
      row(`${path} identical panels`, count(/data-panel="trading"/g) === got.length && count(/data-panel="grade"/g) === (gradesOn ? got.length : 0) && count(/data-panel="funding"/g) === (moneyOn ? got.length : 0),
        `trading ${count(/data-panel="trading"/g)}, grade ${count(/data-panel="grade"/g)}, funding ${count(/data-panel="funding"/g)} for ${got.length} members`);
      row(`${path} "Who funds them" only with SHOW_CAMPAIGN_MONEY`, moneyOn || !html.includes('Who funds them'), '');
      row(`${path} FEC, filings, member-page links per member`, count(/href="https:\/\/www\.fec\.gov\/data\/candidates\/\?q=/g) === got.length && got.every((id) => html.includes(`href="/people/${id}"`) && html.includes(`href="/data/trades?member=${id}"`)), '');
      // What's new: the number of rows equals the database's count of first reports dated in the last 30 days.
      try {
        const ids = want.map((m) => m.bioguide_id).join(',');
        const news = ids ? await restAll(`congress_trades?select=id&bio_guide_id=in.(${ids})&original_filed_date=gte.${since}&original_filed_date=lte.${today}`) : [];
        const shown = /data-whats-new="(\d+)"/.exec(html)?.[1];
        row(`${path} What's new count vs DB (first report ${since} to ${today})`, Number(shown) === news.length, `page ${shown}, DB ${news.length}`);
      } catch (e) { row(`${path} What's new vs DB`, false, `could not run: ${String(e.message).slice(0, 120)}`); }
    }
    // Trading figures re-derived from REST for Vermont's members (same window and classification as the leaderboard).
    try {
      const vt = roster.filter((m) => m.state === 'VT');
      const start = windowStart(today);
      const tr = await restAll(`congress_trades?select=id,bio_guide_id,ticker,company_name,asset_type,option_type,transaction_type,transaction_date,amount_min,date_flag,stock_act_late,committee_conflict,has_federal_contract,disclosure_url,original_disclosure_url,original_source_doc_id,source_doc_id&bio_guide_id=in.(${vt.map((m) => m.bioguide_id).join(',')})&transaction_date=gte.${start}&transaction_date=lte.${today}`);
      const html = (await (await fetch(`${base}${VOTER_PATH}/vt`)).text()).replace(/<!-- -->/g, '');
      for (const m of vt) {
        const list = tr.filter((r) => r.bio_guide_id === m.bioguide_id && inWindow(r, start, today)).map((r) => ({ ...r, cls: gradeClass(r, instrumentKind(r)) }));
        const a = activityOf(m.bioguide_id, list);
        const block = html.slice(html.indexOf(`data-member="${m.bioguide_id}"`), html.indexOf('</article>', html.indexOf(`data-member="${m.bioguide_id}"`)));
        const tx = `${a.transactions.toLocaleString('en-US')} individual-stock`;
        const val = a.transactions ? `at least $${Math.round(a.valueMin).toLocaleString('en-US')}` : '$0';
        row(`/your-members/vt ${m.name}: transactions and value vs DB`, block.includes(tx) && block.includes(val), `want "${tx}", "${val}"`);
      }
    } catch (e) { row('/your-members/vt figures vs DB', false, `could not run: ${String(e.message).slice(0, 120)}`); }
  }
}

// ---------------------------------------------------------------- D17: Election Center (/election-2026)
{
  const G = 'D17 election center';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  // Flag: off on production until SHOW_ELECTION_CENTER is exactly '1'.
  for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_ELECTION_CENTER: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_ELECTION_CENTER: 'true' }, true]]) {
    row(`hiddenByFlag(${JSON.stringify(ELECTION_PATH)}, ${JSON.stringify(env)})`, hiddenByFlag(ELECTION_PATH, env) === want, '', String(want));
  }
  row('hiddenByFlag("/election-2026-results", production)', hiddenByFlag('/election-2026-results', { VERCEL_ENV: 'production' }) === false, 'exact path only', 'false');
  row('navItems(false) is the five sections; navItems(true) adds Election 2026 before About', navItems(false).length === 5 && !navItems(false).some((i) => i.href === ELECTION_PATH) && navItems(false, true).map((i) => i.href).join(',') === ['/investigations', '/people', '/companies', '/data', ELECTION_PATH, '/about'].join(','), '');
  // Pure arithmetic.
  row('daysUntil(Nov 3, Oct 20) = 14, same day 0, after -1', daysUntil(ELECTION_DAY, '2026-10-20') === 14 && daysUntil(ELECTION_DAY, ELECTION_DAY) === 0 && daysUntil(ELECTION_DAY, '2026-11-04') === -1, '');
  row('averageLetter: A,A,B = A; A,B = A (3.5 rounds up); B,C = B; all NG = none; NG left out', averageLetter(['A', 'A', 'B'])?.letter === 'A' && averageLetter(['A', 'B'])?.letter === 'A' && averageLetter(['B', 'C'])?.letter === 'B' && averageLetter(['NG', 'NG']) === null && averageLetter(['F', 'NG'])?.letter === 'F', '');
  const homeHtml = await (await fetch(base + '/')).text();
  const smx = await (await fetch(base + '/sitemap.xml')).text();
  const hasNav = homeHtml.includes(`href="${ELECTION_PATH}"`);
  if (!electionCenterEnabled()) {
    await hit(ELECTION_PATH, 404, { group: G });
    await hit(`${ELECTION_PATH}?party=Democrat`, 404, { group: G });
    row('sitemap has no election page', !smx.includes(`slushfund.net${ELECTION_PATH}`), '');
    row('header has no Election 2026 link', !hasNav, '');
  } else {
    const page = await fetch(base + ELECTION_PATH);
    const html = (await page.text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
    const text = visibleText(html);
    const gradesOn = gradesEnabled();
    const moneyOn = campaignMoneyEnabled();
    const activeOn = mostActiveEnabled();
    const voterOn = voterPagesEnabled();
    const presOn = presidentPageEnabled();
    row(`${ELECTION_PATH} answers 200`, page.status === 200, `status ${page.status}`);
    row('sitemap lists the election page', smx.includes(`slushfund.net${ELECTION_PATH}<`), '');
    row('header links Election 2026', hasNav && homeHtml.includes('Election 2026'), '');
    row('title, scope line and countdown present', ['Election 2026: the records', 'it does not tell you how to vote', 'makes no claim about who is on your ballot', 'data-field="countdown"'].every((s) => text.includes(s) || html.includes(s)), '');
    // Countdown = calendar days from today (New York) to Nov 3.
    const todayNY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const dd = daysUntil(ELECTION_DAY, todayNY);
    const cdText = /data-field="countdown"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') ?? '';
    row(`countdown reads ${dd} days (today ${todayNY})`, dd > 1 ? cdText.includes(`${dd} days`) : dd === 1 ? cdText.includes('1 day') : dd === 0 ? cdText.includes('Election Day is today') : cdText.includes('Election Day was'), cdText.trim());
    // Flag-off sections are left out and never linked.
    row('grade spread only with SHOW_GRADES', gradesOn === html.includes('data-section="grade-spread"'), '');
    row('money chart only with SHOW_CAMPAIGN_MONEY', moneyOn === html.includes('data-section="money"'), '');
    row('leaderboard teaser only with SHOW_MOST_ACTIVE; no link to it otherwise', activeOn === html.includes('data-section="traders"') && (activeOn || !html.includes(`href="${MOST_ACTIVE_PATH}"`)), '');
    row('President band only with SHOW_PRESIDENT_TRADES; no link otherwise', presOn === html.includes('data-section="president"') && (presOn || !html.includes(`href="${PRESIDENT_PATH}"`)), '');
    row('state tiles link to voter pages only with SHOW_VOTER_PAGES', voterOn ? (html.match(new RegExp(`href="${VOTER_PATH}/[a-z]{2}"`, 'g')) ?? []).length === 56 : !html.includes(`href="${VOTER_PATH}`), '');
    row('state grid has 56 tiles', (html.match(/data-state="[A-Z]{2}"/g) ?? []).length === 56 && /data-state-count="56"/.test(html), '');
    row('no partisan colors: no red/blue party coding in the page markup', !/(?:republican|democrat)[^<]{0,40}(?:#(?:ff0000|0000ff|d62728|1f77b4)|text-(?:red|blue)-)/i.test(html), '');
    try {
      const today = todayNY;
      const start = windowStart(today);
      const roster = await restAll('congress_members?select=bioguide_id,party,state,chamber,name,in_office&in_office=eq.true&order=bioguide_id.asc');
      const sitting = new Set(roster.map((m) => m.bioguide_id));
      const tr = await restAll(`congress_trades?select=id,bio_guide_id,ticker,company_name,asset_type,option_type,transaction_type,transaction_date,amount_min,date_flag,stock_act_late,committee_conflict,has_federal_contract,disclosure_url,original_disclosure_url,original_source_doc_id,source_doc_id&transaction_date=gte.${start}&transaction_date=lte.${today}&order=id.asc`);
      const inWin = tr.filter((r) => inWindow(r, start, today));
      const unread = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'unread-window.json'), 'utf8'));
      const by = new Map();
      for (const r of inWin) { if (!r.bio_guide_id) continue; const l = by.get(r.bio_guide_id) ?? []; l.push({ ...r, cls: gradeClass(r, instrumentKind(r)) }); by.set(r.bio_guide_id, l); }
      const graded = roster.map((m) => { const l = by.get(m.bioguide_id) ?? []; const a = activityOf(m.bioguide_id, l); return { ...m, letter: gradeOf(l, a, unreadInWindow(unread[m.bioguide_id], start)).letter, a }; });
      row(`${ELECTION_PATH} trades KPI = all disclosed rows dated ${start} to ${today} (not date-noted)`, text.includes(`${inWin.length.toLocaleString('en-US')} transactions of every kind`), `DB ${inWin.length}`);
      if (gradesOn) {
        const L = ['A', 'B', 'C', 'D', 'F', 'NG'];
        const want = (pred) => L.map((l) => `${l}:${graded.filter((m) => pred(m) && m.letter === l).length}`).join(',');
        row('grade spread (All) = recomputed from the database', html.includes(`data-spread="${want(() => true)}"`), want(() => true));
        for (const p of ['Democrat', 'Republican']) {
          const h = (await (await fetch(`${base}${ELECTION_PATH}?party=${p}`)).text()).replace(/<!-- -->/g, '');
          row(`grade spread (${p}) = recomputed`, h.includes(`data-spread="${want((m) => m.party === p)}"`), want((m) => m.party === p));
        }
        const gc = graded.filter((m) => m.letter !== 'NG').length;
        row('Members graded KPI = sitting members with a letter', text.includes(`${gc.toLocaleString('en-US')} of ${graded.length.toLocaleString('en-US')} sitting members have a letter grade; ${(graded.length - gc).toLocaleString('en-US')} are not graded`), `${gc} of ${graded.length}`);
        row('Not graded caveat printed verbatim', html.includes(NOT_GRADED_GROUP_LINE) && html.includes(GRADE_FIXED_LINE), '');
        // State average letters.
        const bad = [];
        for (const st of [...new Set(roster.map((m) => m.state))]) {
          const al = averageLetter(graded.filter((m) => m.state === st).map((m) => m.letter));
          const blk = new RegExp(`data-state="${st}"[\\s\\S]*?data-avg-letter="([A-Z]|none)"`).exec(html)?.[1];
          if ((al?.letter ?? 'none') !== blk) bad.push(`${st}: page ${blk}, want ${al?.letter ?? 'none'}`);
        }
        row('state tile average letters = recomputed', bad.length === 0, bad.slice(0, 5).join('; '));
      }
      if (activeOn) {
        const rec = new Map();
        for (const [id, l] of by) { if (!sitting.has(id) && !roster.some((m) => m.bioguide_id === id)) { /* former members are on the board too */ } const a = activityOf(id, l); if (a.transactions > 0) rec.set(id, a.transactions); }
        const top = [...rec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([, n]) => n);
        const shown = [...html.matchAll(/class="sf-rank-value[^"]*">([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
        row('leaderboard teaser: top-10 transaction counts = recomputed', shown.length === 10 && shown.every((n, i) => n === top[i]), `page ${shown.join(',')} want ${top.join(',')}`);
      }
      if (presOn) {
        const pt = await restAll('executive_trades?select=id&office=eq.President&report_type=eq.278-T&order=id.asc');
        row('President count = DB rows (office President, 278-T)', new RegExp(`data-field="president-count"[^>]*>${pt.length.toLocaleString('en-US')}<`).test(html), `DB ${pt.length}`);
      }
      // What's new: sitting members' first reports dated in the last 30 days.
      const since = (() => { const [y, m, d] = today.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 30)).toISOString().slice(0, 10); })();
      const nw = (await restAll(`congress_trades?select=id,bio_guide_id&original_filed_date=gte.${since}&original_filed_date=lte.${today}&order=id.asc`)).filter((r) => r.bio_guide_id && sitting.has(r.bio_guide_id));
      const shownNew = /data-whats-new="(\d+)"/.exec(html)?.[1];
      row(`What's new count = DB (first report ${since} to ${today}, sitting members)`, Number(shownNew ?? 0) === nw.length, `page ${shownNew ?? 0}, DB ${nw.length}`);
      if (moneyOn) {
        const money = await restAll('member_campaign_money?select=raised,shares_ok,pct_small_individual,pct_large_individual,pct_corporate_trade_pac,pct_labor_pac,pct_leadership_party_other,pct_self_funded,outside_support,outside_oppose&order=bioguide_id.asc');
        const t = moneyTotals(money);
        row('Campaign receipts KPI caption = DB sum of raised', text.includes(`$${Math.round(t.raised).toLocaleString('en-US')} in total receipts reported by ${t.members.toLocaleString('en-US')} members`), `DB $${Math.round(t.raised).toLocaleString('en-US')} over ${t.members}`);
        const bad = MONEY_KEYS.filter((k) => !new RegExp(`data-money-part="${k}"[\\s\\S]*?<b[^>]*>${(t.byKey[k] / t.sharesRaised * 100).toFixed(1)}%<`).test(html));
        row('money category shares = recomputed (receipts x each member share)', bad.length === 0, bad.join(',') || `${t.sharesMembers} of ${t.members} members, $${Math.round(t.sharesRaised).toLocaleString('en-US')}`);
        row('outside spending = DB sums', text.includes(`${'$' + Math.round(t.outsideSupport).toLocaleString('en-US')} for these members, ${'$' + Math.round(t.outsideOppose).toLocaleString('en-US')} against`), '');
      }
    } catch (e) { row(`${ELECTION_PATH} figures vs DB`, false, `could not run: ${String(e.message).slice(0, 160)}`); }
  }
}

// ---------------------------------------------------------------- D12: the four investigation posts (two matched pairs, G8)
{
  const G = 'D12 investigation posts';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  const page = async (p) => { const r = await fetch(base + p); const raw = await r.text(); return { status: r.status, raw, html: raw.replace(/<!-- -->/g, ''), text: visibleText(raw) }; };
  const slugs = SF.STORIES.map((s) => s.slug);
  // Flag: off on production until SHOW_INVESTIGATIONS_V2 is exactly '1'; every /investigations/<path> follows it, /investigations does not.
  for (const path of [SF.storyPath(slugs[0]), SF.ENTITY_CSV_PATH]) {
    for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_INVESTIGATIONS_V2: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_INVESTIGATIONS_V2: 'true' }, true]]) {
      row(`hiddenByFlag(${JSON.stringify(path)}, ${JSON.stringify(env)})`, hiddenByFlag(path, env) === want, '', String(want));
    }
  }
  row('hiddenByFlag("/investigations", production)', hiddenByFlag('/investigations', { VERCEL_ENV: 'production' }) === false, 'the index stays', 'false');
  row('no story slug is a withdrawn slug', slugs.every((s) => !WITHDRAWN_SLUGS.includes(s)), '');
  row('slugs follow the neutral pattern federal-money-<subject>-fy2024-2026', slugs.every((s) => /^federal-money-[a-z-]+-fy2024-2026$/.test(s)), slugs.join(' '));
  row('two pairs, each story paired with the other in its pair', SF.STORY_PAIRS.length === 2 && SF.STORY_PAIRS.every(([a, b]) => SF.storyBySlug(a)?.pair === b && SF.storyBySlug(b)?.pair === a), '');
  // A13 / A13b forbidden phrasings are on the wording list (one test sentence each).
  for (const t of ['SpaceX won $4 billion', 'more than the $10B+ figure', 'a contract worth $26.9 billion', 'the sum of ceilings', "Ellison's company", "Bezos's companies received", 'nearly as much as Oracle', 'within 10% of each other', 'more than Oracle', 'AWS is mostly sold through resellers', 'mostly data and research subscriptions', 'a no-bid deal']) {
    row(`wording gate lists "${t}"`, FORBIDDEN_PHRASES.some((p) => new RegExp(p.re, 'gi').test(t)), 'forbidden-words.ts');
  }
  // Every audited sentence and fixed line is itself clean of the wording list.
  const fixed = [...Object.values(SF.AUDITED).flatMap((o) => Object.entries(o).filter(([k]) => !k.endsWith('check')).map(([, v]) => v)), SF.CONTEXT_LINE, SF.NOT_CAUSE_LINE, SF.SELECTION_LINE, SF.ENTITY_RULE_LINE, ...SF.STORIES.flatMap((s) => [s.headline, s.description, ...SF.caveats(s), ...SF.whyLines(s, SF.storyBySlug(s.pair)), SF.preregLine(s)])];
  const dirty = fixed.filter((t) => FORBIDDEN_PHRASES.some((p) => new RegExp(p.re, 'gi').test(t)));
  row('audited sentences and fixed lines carry no forbidden phrase', dirty.length === 0, dirty.slice(0, 2).join(' | '));
  // Live sentences rebuilt from REST with the pages' own code equal the audited text (a reload that moves a figure fails here).
  for (const s of SF.STORIES) {
    try {
      const txns = await restAll(`subject_award_transactions?select=${SF.TXN_COLUMNS}&subject_group=eq.${s.group}&order=transaction_key`);
      const summary = await restAll(`subject_money_summary?select=${SF.SUMMARY_COLUMNS}&subject_group=eq.${s.group}`);
      const live = SF.storySentences(s.group, txns);
      const drift = SF.driftOf(s.group, live);
      row(`${s.group}: sentences from REST = audited text`, drift.length === 0, drift.length ? `drift in ${drift.join(', ')}: ${live[drift[0]]}` : `${txns.length} rows, retrieved ${SF.retrievedOf(txns)}`);
      row(`${s.group}: subject_money_summary = transaction rows`, SF.viewMatches(txns, summary), `${summary.length} summary rows`);
      row(`${s.group}: retrieval date = audited (${SF.AUDITED_RETRIEVED})`, SF.retrievedOf(txns) === SF.AUDITED_RETRIEVED, String(SF.retrievedOf(txns)));
    } catch (e) { row(`${s.group}: sentences from REST`, false, `could not run: ${String(e.message).slice(0, 120)}`); }
  }
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  const index = await page('/investigations');
  if (!investigationsV2Enabled()) {
    for (const p of [...slugs.map(SF.storyPath), SF.ENTITY_CSV_PATH]) await hit(p, 404, { group: G });
    row('sitemap has no story pages', slugs.every((s) => !sm.includes(s)), '');
    row('/investigations shows the no-stories page and no story link', index.status === 200 && index.text.includes('No stories are published right now') && slugs.every((s) => !index.html.includes(s)), '');
  } else {
    row('sitemap lists the four story pages', slugs.every((s) => sm.includes(`slushfund.net${SF.storyPath(s)}<`)), '');
    // Index: both pairs, grouped, each story linked once.
    const pairs = [...index.html.matchAll(/data-story-pair="(\d)"([\s\S]*?)<\/ul>/g)].map((m) => [...m[2].matchAll(/href="\/investigations\/([^"]+)"/g)].map((x) => x[1]));
    row('/investigations lists the two pairs, grouped', JSON.stringify(pairs) === JSON.stringify(SF.STORY_PAIRS), JSON.stringify(pairs));
    const csv = await fetch(base + SF.ENTITY_CSV_PATH);
    const csvText = await csv.text();
    row(`${SF.ENTITY_CSV_PATH} 200, CSV with the decision columns`, csv.status === 200 && csvText.startsWith('subject_group,entity_name,uei,parent_uei') && csvText.split('\n').length > 70, `HTTP ${csv.status}, ${csvText.split('\n').length} lines`);
    for (const s of SF.STORIES) {
      const p = SF.storyPath(s.slug);
      const pair = SF.storyBySlug(s.pair);
      const pg = await page(p);
      const t = pg.text;
      const want = Object.entries(SF.AUDITED[s.group]).filter(([k]) => !k.endsWith('check')).map(([, v]) => v);
      const missing = want.filter((x) => !t.includes(x));
      row(`${p} 200`, pg.status === 200, `HTTP ${pg.status}`);
      row(`${p} prints every audited sentence`, missing.length === 0, missing.length ? `missing: ${missing[0].slice(0, 90)}` : `${want.length} sentences`);
      row(`${p} no "changed since the audit" note`, !pg.html.includes('Figures changed since the audit') && /data-drift=""/.test(pg.html), '');
      const lines = [s.headline, SF.CONTEXT_LINE, SF.NOT_CAUSE_LINE, SF.ENTITY_RULE_LINE, SF.preregLine(s), ...SF.caveats(s), ...SF.whyLines(s, pair).filter((l) => !l.includes(pair.phrase)), `By ${SF.STORY_BYLINE}`];
      const gone = lines.filter((x) => !t.includes(x));
      row(`${p} headline, caveats, context line, why-lines, method lines, byline`, gone.length === 0, gone.length ? `missing: ${gone[0].slice(0, 90)}` : '');
      row(`${p} links its matched counterpart`, pg.html.includes(`href="${SF.storyPath(pair.slug)}"`), pair.slug);
      // Option A: the fixed response line for every company asked, until a verbatim reply is added.
      for (const c of s.asked) {
        const reply = STORY_RESPONSES[c.name];
        row(`${p} response slot for ${c.name}`, reply ? t.includes(`${c.name} replied on ${reply.received}`) : t.includes(SF.askedLine(c.name)), reply ? 'reply printed' : SF.askedLine(c.name));
      }
      row(`${p} entity CSV linked as a download`, new RegExp(`href="${SF.ENTITY_CSV_PATH}" download`).test(pg.html), '');
      row(`${p} corrections line and report-an-error link`, t.includes('Corrections to this story') && [...pg.html.matchAll(/<a\b[^>]*data-report-link[^>]*>/g)].some((m) => /href="\/report-an-error(?:\?from=[^"]*)?"/.test(m[0])), '');
      row(`${p} the saved query names this group`, t.includes(`where subject_group = '${s.group}'`), '');
      // G1: every external link is an official record (USAspending, SEC EDGAR); nothing from news sources.
      const ext = [...pg.html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&')).host).filter((h) => h !== 'slushfund.net');
      const off = [...new Set(ext)].filter((h) => !SF.OFFICIAL_HOSTS.includes(h));
      row(`${p} external links are official records only`, off.length === 0, off.length ? off.join(', ') : `${ext.length} links`);
      // Every printed sentence carries a footnote marker, and every footnote exists with at least one record link.
      const sent = [...pg.html.matchAll(/data-sentence="([a-z0-9]+)"[^>]*>([\s\S]*?)<\/(?:p|span)>/g)];
      const bare = sent.filter((m) => !/href="#fn-\d+"/.test(m[2])).map((m) => m[1]);
      row(`${p} every sentence has a footnote marker`, sent.length > 0 && bare.length === 0, bare.length ? `no marker: ${[...new Set(bare)].join(', ')}` : `${sent.length} sentences`);
      const refs = [...new Set([...pg.html.matchAll(/href="#fn-(\d+)"/g)].map((m) => m[1]))];
      const noteHtml = (n) => { const i = pg.html.indexOf(`id="fn-${n}"`); if (i < 0) return ''; const j = pg.html.indexOf('id="fn-', i + 5); return pg.html.slice(i, j < 0 ? pg.html.indexOf('</ol>', i) : j); };
      const notesOk = refs.every((n) => /href="https:\/\//.test(noteHtml(n))) && refs.every((n) => pg.html.includes(`id="ref-${n}"`));
      row(`${p} each footnote has a record link and a back-link target`, refs.length > 0 && notesOk, `${refs.length} notes`);
      // G3: amounts as recorded; no ceiling figure; G2: no dated pair on the share card.
      row(`${p} no ceiling figure`, !/\$26\.9 billion|\$151 billion|ceiling of \$|ceilings? total/i.test(t), '');
      if (s.group === 'bezos' || s.group === 'oracle') {
        const other = s.group === 'bezos' ? 'Oracle' : 'Amazon';
        row(`${p} never ranks Oracle against Amazon and Blue Origin`, !new RegExp(`(?:more|less|larger|smaller|bigger) than (?:${other})`, 'i').test(t) && !t.includes(SF.storyBySlug(s.pair).group === 'oracle' ? '$4.19 billion' : '$3.81 billion'), '');
      }
      if (s.group === 'bezos') {
        const z5 = SF.AUDITED.bezos.z5;
        const at = (k) => t.indexOf(SF.AUDITED.bezos[k]);
        row(`${p} the novation sentence follows the dek and the not-competed split`, t.indexOf(z5) > at('z1') && t.indexOf(z5, at('z2')) > at('z2') && t.indexOf(z5, at('z2')) - at('z2') < SF.AUDITED.bezos.z2.length + 20, '');
        row(`${p} Blue Origin Manufacturing and Honeybee are separate lines, not in the totals`, t.includes(SF.AUDITED.bezos.z6) && !pg.html.includes('data-recipient="RAR2RMTVZYX3"'), '');
      }
      if (s.group === 'musk') row(`${p} Starlink Technologies LLC is not presented as a SpaceX entity`, !pg.html.includes('data-recipient="NMSEZBYT6N85"') && t.includes('We do not present Starlink Technologies LLC (Hazleton, Pa.) as a SpaceX entity.'), '');
      // D12c (A15 fixes). One date constant feeds the byline, the index cards and every "We asked ..." line.
      row(`${p} byline and asked lines read INVESTIGATIONS_V2_DATE`, SF.STORY_PUBLISHED === SF.INVESTIGATIONS_V2_DATE && SF.ASKED_ON === SF.INVESTIGATIONS_V2_DATE && t.includes(`By ${SF.STORY_BYLINE} · ${SF.INVESTIGATIONS_V2_DATE}`) && s.asked.every((c) => STORY_RESPONSES[c.name] || t.includes(`We asked ${c.name} for comment on ${SF.INVESTIGATIONS_V2_DATE}`)), SF.INVESTIGATIONS_V2_DATE);
      row(`${p} prints the G6 "why this subject" text`, t.includes(SF.SELECTION_LINE), 'pending Colin\'s OK');
      const fixedWeak = Object.entries(SF.EVIDENCE_URL_FIX).filter(([uei]) => pg.html.includes(`>${uei}<`));
      row(`${p} entity links for the A15 weak-link UEIs point at the parent's children list`, fixedWeak.every(([, url]) => pg.html.includes(`href="${url}"`)) && !/6d6462ae-83fb|2c023317-2253|0fe6fd21-17e1|9232b26d-789d|06e992bf-a6cf|9d3454b7-7047|bdd9b51c-085d|download\/transactions\/ \(/.test(pg.html), `${fixedWeak.length} UEIs`);
      row(`${p} no "other firms" / "are separate companies" / "added during our completeness check" wording (A15 S-5 to S-7)`, !/other firms|are separate companies|added during our completeness check/.test(t), '');
      if (s.group === 'musk') {
        row(`${p} the type-table note names the $11.2 billion exception (A15 S-1)`, t.includes('the only figure that adds them is the $11.2 billion above, which says so') && !t.includes('are not added together in any total on this page'), '');
        row(`${p} SpaceX Exhibit 21.1 sentence, linked to the SEC filing (A15 S-4)`, t.includes('lists X Corp., X.AI LLC, CTC Property LLC and SpaceX Services Inc. as significant subsidiaries') && pg.html.includes(`href="${SF.SPACEX_EX21}"`), '');
        row(`${p} states the tie and the covers line names Exhibit 21.1 (A15 S-3)`, t.includes(s.tie) && t.includes('which SpaceX\'s SEC Exhibit 21.1 lists as subsidiaries') && pg.html.includes(`href="${SF.SPACEX_S1}"`) && pg.html.includes(`href="${SF.TESLA_10K}"`), '');
      } else {
        row(`${p} the type-table note keeps the "not added together" wording`, t.includes('are not added together in any total on this page'), '');
      }
      if (s.group === 'oracle') row(`${p} prints the IDV and assistance line (A15 P-1)`, t.includes(SF.AUDITED.oracle.o5), '');
      const og = await fetch(base + p + '/opengraph-image');
      row(`${p}/opengraph-image 200 png`, og.status === 200 && (og.headers.get('content-type') || '').includes('image/png'), `HTTP ${og.status}`);
    }
    row('/investigations index lines (A15 I-1, I-2)', index.text.includes('Stories return only after every figure is checked') && index.text.includes('Each sentence with a figure carries a numbered note to the records behind it: an award page, a recipient record or an SEC filing.') && !index.text.includes('one at a time'), '');
    row('entity CSV carries the corrected links (no non-URL evidence)', !csvText.includes('(bezos_txn request') && Object.values(SF.EVIDENCE_URL_FIX).every((u) => csvText.includes(u)), '');
    // G8: the same caveats, context line and method lines on both pages of each pair.
    for (const [a, b] of SF.STORY_PAIRS) {
      const A = SF.storyBySlug(a); const B = SF.storyBySlug(b);
      const norm = (s) => SF.caveats(s).map((c) => c.replace(s.resold, '<resold>'));
      row(`pair ${A.group}/${B.group}: identical caveats (reseller noun aside), context and method lines`, JSON.stringify(norm(A)) === JSON.stringify(norm(B)), '');
    }
  }
}

// ---------------------------------------------------------------- D20: shareable infographics (/graphics)
{
  const G = 'D20 infographics';
  const row = (path, ok, note, expect = 'ok') => { if (!ok) failed++; rows.push({ path, status: ok ? 'ok' : 'FAIL', expect, ok, note, group: G }); };
  const UNDER = { 'grading-congress': 'SHOW_GRADES', 'where-the-money-comes-from': 'SHOW_CAMPAIGN_MONEY', 'trading-while-disclosing': 'SHOW_LATE_FILERS', 'the-presidents-trades': 'SHOW_PRESIDENT_TRADES' };
  const SRC = { 'grading-congress': 'Source: House/Senate PTRs via SlushFund.net', 'where-the-money-comes-from': 'Source: Federal Election Commission bulk data via SlushFund.net', 'trading-while-disclosing': 'Source: House/Senate PTRs via SlushFund.net', 'the-presidents-trades': 'Source: OGE Form 278-T reports' };
  // Flag matrix: SHOW_INFOGRAPHICS alone never opens a graphic whose own feature flag is off; each path, its card and its share image follow the same rule.
  for (const slug of GRAPHIC_SLUGS) {
    const paths = [GRAPHICS_PATH + '/' + slug, GRAPHICS_PATH + '/' + slug + '/opengraph-image'];
    for (const path of paths) {
      for (const [env, want] of [
        [{}, false], [{ VERCEL_ENV: 'preview' }, false], [{ VERCEL_ENV: 'production' }, true],
        [{ VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: '1' }, true], [{ VERCEL_ENV: 'production', [UNDER[slug]]: '1' }, true],
        [{ VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: '1', [UNDER[slug]]: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: 'true', [UNDER[slug]]: '1' }, true],
      ]) row('hiddenByFlag(' + JSON.stringify(path) + ', ' + JSON.stringify(env) + ')', hiddenByFlag(path, env) === want, '', String(want));
    }
  }
  for (const [env, want] of [[{}, false], [{ VERCEL_ENV: 'production' }, true], [{ VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: '1' }, false], [{ VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: 'true' }, true]]) {
    row('hiddenByFlag("/graphics", ' + JSON.stringify(env) + ')', hiddenByFlag(GRAPHICS_PATH, env) === want, '', String(want));
  }
  row('hiddenByFlag("/graphicsx", production) is false (prefix is per path segment)', hiddenByFlag('/graphicsx', { VERCEL_ENV: 'production' }) === false, '', 'false');
  row('an unknown /graphics/<slug> follows only SHOW_INFOGRAPHICS (then answers 404 itself)', hiddenByFlag('/graphics/nope', { VERCEL_ENV: 'production', SHOW_INFOGRAPHICS: '1' }) === false, '', 'false');

  const sm = await (await fetch(base + '/sitemap.xml')).text();
  const smHas = (p) => sm.includes('slushfund.net' + p + '<');
  const png = async (p) => { const r = await fetch(base + p); const b = Buffer.from(await r.arrayBuffer()); return { status: r.status, ctype: r.headers.get('content-type') || '', w: b.length > 24 ? b.readUInt32BE(16) : 0, h: b.length > 24 ? b.readUInt32BE(20) : 0, bytes: b.length }; };

  // Fix round: the footer carries one 'Graphics' link, rendered through the same flag function as the index, so it is on exactly when /graphics is.
  for (const fp of ['/', '/about']) {
    const fh = await (await fetch(base + fp)).text();
    const fm = /<nav aria-label="Footer">[\s\S]*?<\/nav>/.exec(fh);
    const hasLink = !!fm && fm[0].includes('href="' + GRAPHICS_PATH + '"');
    const inHeader = /<header[\s\S]*?<\/header>/.test(fh) && /<header[\s\S]*?<\/header>/.exec(fh)[0].includes('href="' + GRAPHICS_PATH + '"');
    row(fp + ' footer links ' + GRAPHICS_PATH + (infographicsEnabled() ? ' (flag on)' : ' only when SHOW_INFOGRAPHICS is on (flag off: absent)'), !!fm && hasLink === infographicsEnabled() && !inHeader, hasLink ? 'link present' : 'link absent');
  }

  if (!infographicsEnabled()) {
    for (const p of [GRAPHICS_PATH, GRAPHICS_PATH + '/', ...GRAPHIC_SLUGS.flatMap((g) => [GRAPHICS_PATH + '/' + g, GRAPHICS_PATH + '/' + g + '?card=1', GRAPHICS_PATH + '/' + g + '/opengraph-image'])]) await hit(p.replace(/\/$/, ''), 404, { group: G });
    row('sitemap has no graphics', !sm.includes('slushfund.net' + GRAPHICS_PATH), '');
  } else {
    const idx = await (await fetch(base + GRAPHICS_PATH)).text();
    await hit(GRAPHICS_PATH, 200, { bodyAll: ['Graphics', 'carries its source'], noindex: process.env.VERCEL_ENV !== 'production', group: G });
    row('sitemap lists /graphics', smHas(GRAPHICS_PATH), '');
    for (const slug of GRAPHIC_SLUGS) {
      const on = graphicEnabled(slug);
      const p = GRAPHICS_PATH + '/' + slug;
      row('index links ' + slug + ' only when that graphic is public', idx.includes('href="' + p + '"') === on, on ? 'on' : 'off');
      row('sitemap lists ' + slug + ' only when public; never the ?card=1 variant', smHas(p) === on && !sm.includes(p + '?card'), '');
      if (!on) {
        for (const x of [p, p + '?card=1', p + '/opengraph-image']) await hit(x, 404, { group: G });
        continue;
      }
      const page = await fetch(base + p);
      const html = (await page.text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
      const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      row(p + ' 200', page.status === 200, 'HTTP ' + page.status);
      row(p + ' has one h1, the Download PNG button, the embed code box and the data table', (html.match(/<h1[ >]/g) ?? []).length === 1 && html.includes('Download PNG') && html.includes('Embed code') && html.includes('The data behind this') && /<table/.test(html), '');
      row(p + ' graphic is one labelled svg (role=img, aria-label) with its own provenance: source, retrieval date, slushfund.net address', /<svg[^>]+id="gfx-svg"[^>]+role="img"[^>]+aria-label="[^"]{40,}/.test(html) && text.includes(SRC[slug]) && /Data retrieved [A-Z][a-z]{2} \d{1,2}, \d{4}/.test(text) && text.includes('slushfund.net/graphics/' + slug), '');
      row(p + ' embed code is an iframe of the ?card=1 address', html.includes('&lt;iframe src="https://slushfund.net/graphics/' + slug + '?card=1"') || html.includes('<iframe src="https://slushfund.net/graphics/' + slug + '?card=1"') || html.includes('iframe src=&quot;https://slushfund.net/graphics/' + slug + '?card=1&quot;'), '');
      row(p + ' prints no NaN, undefined, null or zero-for-missing', !/\b(NaN|undefined|null)\b/.test(text) && !/\$0(?![\d,.])/.test(text), '');
      row(p + ' og:image is its own square card route', html.includes('/graphics/' + slug + '/opengraph-image') && /property="og:image:width" content="1200"/.test(html) && /property="og:image:height" content="1200"/.test(html), '');
      row(p + ' canonical is the plain address', html.includes('<link rel="canonical" href="https://slushfund.net' + p + '"'), '');
      // The card variant: the graphic alone, noindex, same canonical, no page chrome, never in the sitemap.
      const cardRes = await fetch(base + p + '?card=1');
      const card = (await cardRes.text()).replace(/<!-- -->/g, '');
      row(p + '?card=1 200: the svg alone (data-gfx-card), no table, no button, noindex, canonical = plain address', cardRes.status === 200 && card.includes('data-gfx-card') && /<svg[^>]+id="gfx-svg"/.test(card) && !card.includes('The data behind this') && !card.includes('Download PNG') && /name="robots" content="noindex/.test(card) && card.includes('<link rel="canonical" href="https://slushfund.net' + p + '"'), 'HTTP ' + cardRes.status);
      const og = await png(p + '/opengraph-image');
      row(p + '/opengraph-image 200 png 1200x1200', og.status === 200 && og.ctype.includes('image/png') && og.w === 1200 && og.h === 1200 && og.bytes > 20000, og.status + ' ' + og.w + 'x' + og.h + ' ' + og.bytes + ' bytes');
    }
    if (graphicEnabled('where-the-money-comes-from')) {
      const mt = (await (await fetch(base + GRAPHICS_PATH + '/where-the-money-comes-from')).text()).replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      row('/graphics/where-the-money-comes-from: remainder footnote is in the page caption and inside the svg', (mt.match(/Last group is total receipts minus the six above; it is not an FEC category\./g) ?? []).length >= 2, '');
    }
    // Content rows tied to figures (recomputed independently in scripts/d20-recompute.mjs): the report's own sentences.
    if (graphicEnabled('the-presidents-trades')) {
      const t = (await (await fetch(base + GRAPHICS_PATH + '/the-presidents-trades')).text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      row('/graphics/the-presidents-trades: the fee-note quote uses curly double quotes (no backtick, no straight or single quote) in the page text and the svg aria-label', !t.includes('Filer paid late fee(s)') || (t.includes('“Filer paid late fee(s).”') && !/[`‘’]Filer paid late fee/.test(t)), '');
      row('/graphics/the-presidents-trades: "securities transactions", never "stock trades"; the fee-note quote sits next to the compliance sentence', t.includes('securities transactions') && !/stock trades/i.test(t) && (!t.includes('Filer paid late fee(s)') || /Filer paid late fee\(s\)\.[^.]{0,6}\s*(?:Every report also carries the agency ethics official|[^]{0,400}?Every report also carries the agency ethics official)/.test(t)), '');
    }
    if (graphicEnabled('trading-while-disclosing')) {
      const t = (await (await fetch(base + GRAPHICS_PATH + '/trading-while-disclosing')).text()).replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      row('/graphics/trading-while-disclosing: "reported more than 45 days after the trade" and the 30 and 45 marks, no "late"/"on time" verdicts', t.includes('reported more than 45 days after the trade') && t.includes('30 DAYS') && t.includes('45 DAYS') && !/\bon[- ]time\b|\bfiled late\b|\breported late\b/i.test(t), '');
    }
    if (graphicEnabled('grading-congress')) {
      const t = (await (await fetch(base + GRAPHICS_PATH + '/grading-congress')).text()).replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      row('/graphics/grading-congress: color is by grade only (no party word in the graphic or its caption)', !/\b(Democrat|Republican|Democratic|GOP)\b/.test(t), '');
    }
  }
}

const byGroup = {};
for (const r of rows) (byGroup[r.group] ??= []).push(r);
console.log('| Group | Request | Expected | Got | Result | Note |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.group} | \`${r.path}\` | ${r.expect} | ${r.status} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`);
console.log(`\n${rows.length} requests, ${failed} failed.`);
console.log('\n## Route inventory\n');
const invOk = printInventory();
process.exit(failed || !invOk ? 1 : 0);
