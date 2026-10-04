/**
 * One file decides what happens to every pre-redesign URL (D5).
 *
 *   LIVE_REDIRECTS     301s whose target exists on this branch. next.config.ts reads them.
 *   PENDING_REDIRECTS  the rest of ia-audit 5.6, with the unit that builds the target. Until it
 *                      ships, the old URL is gated (see GATED_PAGES) so nothing unaudited renders.
 *                      When a target page lands, MOVE its row into LIVE_REDIRECTS and delete the
 *                      matching GATED_PAGES entry.
 *   WITHDRAWN_SLUGS    the 17 stories taken down for re-verification. proxy.ts answers 410.
 *   GATED_PAGES        legacy pages that still carry unaudited figures. proxy.ts rewrites them to
 *                      /rebuilding (noindex, HTTP 200) so the old code never runs.
 *   GATED_APIS         legacy JSON/RSS routes that serve derived, hand-entered or unaudited data.
 *                      proxy.ts answers 503 with a JSON body.
 *   LOOKUP_REDIRECTS   301s whose target needs a lookup (old member name → bioguide id, agency name →
 *                      code, vendor slug → company). proxy.ts answers them via legacy-redirects.ts;
 *                      this list only describes them (route inventory, verify-gates).
 *
 * Plain TypeScript with no imports: next.config.ts and proxy.ts both load it.
 */

export interface RedirectRow {
  source: string;
  destination: string;
}

export interface PendingRedirect extends RedirectRow {
  /** Unit that builds the destination. */
  unit: string;
  /** Extra detail: query-string matches and anchors the config redirect can't carry yet. */
  note?: string;
}

/** The 17 withdrawn stories (takedown.md). Served at /investigations/<slug> and /blog/<slug>. */
export const WITHDRAWN_SLUGS = [
  'doge-100-day-no-bid',
  'doge-contract-pipeline',
  'no-bid-contracts',
  'ai-government-contracts',
  'defense-contractors-own-congress',
  'military-contractors-dod-budget',
  'congress-bought-dip',
  'congress-members-ai-stocks',
  'congress-stock-act-exposed',
  'navy-seal-contractor-corruption',
  'federal-reserve-govt-trading',
  'trump-govt-crypto-holdings',
  'america-pac-money-pipeline',
  'arabella-dark-money-machine',
  'koch-dark-money-machine',
  'trump-world-liberties-magazine',
  'pac-fec-loopholes',
] as const;

export const WITHDRAWN_SET: ReadonlySet<string> = new Set(WITHDRAWN_SLUGS);

/** ia-audit 5.6 rows whose destination exists on this branch. All 301. */
export const LIVE_REDIRECTS: RedirectRow[] = [
  { source: '/blog', destination: '/investigations' },
  { source: '/blog/:slug', destination: '/investigations/:slug' }, // withdrawn slugs then answer 410
  { source: '/analysis', destination: '/investigations' },
  { source: '/about/data-status', destination: '/data/status' }, // D6b: the data status table lives under Data
  { source: '/analysis/companies', destination: '/companies' },
  { source: '/vendors', destination: '/companies' },
  { source: '/score', destination: '/people?chamber=Senate' }, // D2: the old score was senators-only; cut for v1
  // D4: the data explorers. The IA called them /trades and /contracts; the Data section hosts them.
  { source: '/dashboard', destination: '/data/contracts' }, // the old dashboard summed a sample; the explorer lists the non-competed set
  { source: '/compare', destination: '/data/contracts' },
  { source: '/defense', destination: '/data/contracts?agency=097' }, // 097 = Department of Defense
  { source: '/congress/trades', destination: '/data/trades' }, // ?chamber=House|Senate carries over; ?has_contract=true shows a notice
];

/** 301s answered by proxy.ts after a lookup (src/lib/v2/legacy-redirects.ts). Described here for the inventory. */
export const LOOKUP_REDIRECTS: (RedirectRow & { unit: string; note: string })[] = [
  { source: '/congress/members/:name', destination: '/people/:bioguide', unit: 'D2', note: 'old name slug → bioguide via the roster; no single match → /people?q=<name>' },
  { source: '/score/:slug', destination: '/people/:bioguide', unit: 'D2', note: 'old senator score card; same lookup (methodology stays gated)' },
  { source: '/agency/:code', destination: '/agencies/:code', unit: 'D3 (wired in D2)', note: 'toptier code as is; old agency-name URLs → code; unknown → /agencies' },
  { source: '/vendor/:slug', destination: '/companies/:slug', unit: 'D3 (wired in D2)', note: 'only when one USAspending parent record carries the vendor name; else /companies' },
];

/** 5.6 rows still waiting on their destination. Dynamic segments use :param. */
export const PENDING_REDIRECTS: PendingRedirect[] = [
  { source: '/tech', destination: '/data/contracts?sector=tech-ai', unit: 'D4 follow-up', note: 'the explorer has no sector filter yet' },
  { source: '/contract/:id', destination: '/data/contracts/:id', unit: 'D4 follow-up', note: 'no single-award record page yet; rows link to USAspending' },
  { source: '/covid', destination: '/investigations/covid-spending', unit: 'story re-verification' },
  { source: '/doge', destination: '/investigations/doge', unit: 'story re-verification', note: 'keep #savings #conflicts #winners anchors' },
  { source: '/analysis/cost-overruns', destination: '/investigations/cost-overruns', unit: 'story re-verification' },
  { source: '/loop', destination: '/investigations/the-loop', unit: 'story re-verification' },
  { source: '/congress/trades/trump', destination: '/people/donald-trump#trades', unit: 'executive filers (OGE 278-T), not D2', note: 'Trump is not in the congress roster; /people/[bioguide] cannot host him' },
  { source: '/analysis/conflicts', destination: '/trades/conflicts', unit: 'D4/R6' },
  { source: '/analysis/history', destination: '/trades/trends', unit: 'trends view (not in D4)' },
  { source: '/score/methodology', destination: '/about/methodology/score', unit: 'cut for v1', note: 'no score in v1; stays gated' },
  { source: '/entity/donald-trump', destination: '/people/donald-trump', unit: 'executive filers (OGE 278-T), not D2' },
  { source: '/entity/elon-musk', destination: '/people/elon-musk', unit: 'not a filer; decide (D2 has no target)' },
  { source: '/entity/:slug', destination: '/companies/:slug', unit: 'D3', note: 'spacex, palantir, tesla, anduril, xai; palantir becomes palantir-technologies, anduril becomes anduril-industries' },
  { source: '/influence', destination: '/pacs', unit: 'PACs explorer (after FEC load)' },
  { source: '/influence?tab=pacs', destination: '/pacs', unit: 'PACs explorer (after FEC load)', note: 'query-string match' },
  { source: '/pacs', destination: '/pacs', unit: 'PACs explorer (after FEC load)', note: 'same URL; becomes the explorer, gated until then' },
  { source: '/crypto', destination: '/investigations/crypto-and-government', unit: 'story re-verification' },
  { source: '/influence?tab=crypto', destination: '/investigations/crypto-and-government', unit: 'story re-verification', note: 'query-string match' },
  { source: '/influence?tab=policy', destination: '/bills', unit: 'bills explorer' },
  { source: '/influence?tab=network', destination: '/investigations/the-loop', unit: 'story re-verification', note: 'query-string match' },
  { source: '/explain/network', destination: '/investigations/the-loop', unit: 'story re-verification' },
  { source: '/healthcare', destination: '/lobbying?sector=health', unit: 'lobbying explorer (after LDA load)' },
  { source: '/explain', destination: '/about/glossary', unit: 'glossary page (not in D5)' },
  { source: '/connect', destination: '/subscribe', unit: 'D7' },
  { source: '/support', destination: '/about/support', unit: 'support page, after the 5 U.S.C. 13107(c) legal check' },
  { source: '/store', destination: '/about/support#store', unit: 'support page, or 410 if cut (Colin)' },
];

/**
 * Legacy pages that stay unreachable until rebuilt. A request matches when its pathname equals
 * `path` or starts with `path/`. `home` names the new location, shown on the "being rebuilt" page.
 */
export interface GatedPage {
  path: string;
  label: string;
  home?: string;
  why: string;
}

export const GATED_PAGES: GatedPage[] = [
  { path: '/tech', label: 'Tech and AI contracts', home: 'Contracts explorer, tech and AI filter', why: 'fell back to demo awards' },
  { path: '/contract', label: 'Contract record', home: 'Contract record pages', why: 'fell back to demo awards' },
  { path: '/covid', label: 'COVID spending', home: 'A re-verified COVID spending report', why: 'figures from RPCs that were never audited' },
  { path: '/doge', label: 'DOGE tracker', home: 'A re-verified DOGE report', why: 'static figures, no source links, dated 2026-05-20' },
  { path: '/analysis/cost-overruns', label: 'Cost overruns', home: 'A re-verified cost-overruns report', why: 'static table with no sources' },
  { path: '/analysis/conflicts', label: 'Conflict engine', home: 'Trades explorer, conflicts view', why: 'scores built on sums of folded same-day lots' },
  { path: '/analysis/history', label: 'Ten-year trading history', home: 'Trades explorer, trends view', why: 'aggregates unaudited' },
  { path: '/analysis/companies', label: 'Company deep dives', home: 'Company pages', why: 'unaudited overlaps' },
  { path: '/analysis', label: 'Analysis', why: 'estimates presented as data' },
  { path: '/loop', label: 'The Loop', home: 'The Loop, re-verified', why: 'static figures, no sources' },
  { path: '/explain', label: 'Glossary', home: 'Glossary', why: 'static examples with unsourced figures' },
  // /congress/trades itself now 301s to the explorer (D4); its sub-pages stay gated.
  { path: '/congress/trades/trump', label: 'Trump trades', home: 'Trades explorer', why: 'hand-entered trades, not from a filing we load' },
  { path: '/entity', label: 'Entity dossier', home: 'Person and company pages', why: 'static dossiers with unsourced claims' },
  { path: '/score/methodology', label: 'Public Servant Score methodology', why: 'cut for v1' },
  { path: '/influence', label: 'Influence hub', home: 'PAC, bills and lobbying explorers', why: 'static PAC, crypto and policy data' },
  { path: '/pacs', label: 'PACs', home: 'PAC explorer', why: 'static PAC data, 7 of 31 with sources' },
  { path: '/crypto', label: 'Crypto', home: 'A re-verified crypto report', why: 'static figures' },
  { path: '/lobbying', label: 'Lobbying', home: 'Lobbying explorer', why: 'hand-typed seed file shown as Senate filings' },
  { path: '/healthcare', label: 'Healthcare lobbying', home: 'Lobbying explorer, health filter', why: 'scraped totals that disagree with /lobbying' },
  { path: '/connect', label: 'Newsletter signup', home: 'Newsletter signup', why: 'the form cannot store addresses yet' },
  { path: '/support', label: 'Support SlushFund', home: 'Support page', why: 'held for a legal check on donation asks' },
  { path: '/store', label: 'Store', home: 'Support page', why: 'held for a legal check' },
];

/** Legacy API and feed routes that serve derived, hand-entered or unaudited data. */
export const GATED_APIS: { path: string; why: string }[] = [
  { path: '/api/alerts', why: 'contract KPIs from RPCs that were never audited' },
  { path: '/api/analytics', why: 'derived summary' },
  { path: '/api/conflicts', why: 'conflict scores' },
  { path: '/api/congress/trades', why: 'carries old conflict scores; also /summary (totals built on folded same-day lots) and /trump (hand-entered trades)' },
  { path: '/api/v1/members', why: 'total_volume sums the top of each disclosed band' },
  { path: '/api/covid-fraud', why: 'derived figures' },
  { path: '/api/covid-stats', why: 'derived figures' },
  { path: '/api/era-stats', why: 'derived figures' },
  { path: '/api/latest', why: 'ranked feed' },
  { path: '/api/policy/bills', why: 'curated static bills list' },
  { path: '/api/tax-expenditures', why: 'unaudited table' },
];

/**
 * Write endpoints whose sources break data-rules.md (third-party aggregators) or whose output is
 * derived. They answer 410 so the cron entries in vercel.json fail loudly instead of writing.
 * (/api/sync, /api/backfill and /api/sync/trigger already return 410 from their own code.)
 */
export const RETIRED_APIS: { path: string; why: string }[] = [
  { path: '/api/sync/quiver', why: 'QuiverQuant is a third-party aggregator; trades load from the House Clerk and Senate eFD only' },
  { path: '/api/sync/history', why: 'QuiverQuant bulk import, same reason' },
  { path: '/api/snapshots/backfill', why: 'rebuilds era snapshots that fed unaudited comparison figures' },
];

export function matchRetiredApi(pathname: string): boolean {
  return RETIRED_APIS.some((g) => pathname === g.path || pathname.startsWith(`${g.path}/`));
}

export function matchGatedPage(pathname: string): GatedPage | undefined {
  // Longest path wins, so /analysis/conflicts beats /analysis.
  let best: GatedPage | undefined;
  for (const g of GATED_PAGES) {
    if (pathname === g.path || pathname.startsWith(`${g.path}/`)) {
      if (!best || g.path.length > best.path.length) best = g;
    }
  }
  return best;
}

export function matchGatedApi(pathname: string): boolean {
  return GATED_APIS.some((g) => pathname === g.path || pathname.startsWith(`${g.path}/`));
}

/** `/investigations/<slug>` or `/blog/<slug>` for a withdrawn slug; returns the slug. */
export function matchWithdrawn(pathname: string): string | null {
  const m = /^\/(?:investigations|blog)\/([^/]+)\/?$/.exec(pathname);
  return m && WITHDRAWN_SET.has(m[1]) ? m[1] : null;
}
