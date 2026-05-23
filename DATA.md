# SlushFund — Data Inventory

Single source of truth for every dataset the app depends on: where it comes from,
what it feeds, how fresh it is, and how to refresh it. Keep this file updated whenever
a data source, table, or loader changes.

_Last reviewed: 2026-05-21_

---

## Datasets

### 1. Federal contract awards
- **Store:** Supabase `awards` table (~16,250 rows). Legacy `contracts` table holds 10 demo rows only.
- **Source:** USAspending.gov API (`https://api.usaspending.gov/api/v2`).
- **Loaded by:** `src/lib/sync.ts`, `src/lib/usaspending.ts`; triggered via `POST /api/backfill` or `src/scripts/sync-cli.ts`.
- **Feeds:** `/dashboard`, `/contract/[id]`, `/api/contracts`, `/api/alerts`, era/COVID/compare pages.
- **Refresh:** `curl -X POST https://slushfund.net/api/backfill` with body `{"fys":[2024,2025,2026]}`, or `npx ts-node src/scripts/sync-cli.ts --full`.
- **Coverage / caveats:** FY2019–FY2026. Connection matching depends on `political-entities.ts`.

### 2. Congressional stock trades
- **Store:** Supabase `congress_trades` table (~25,100 rows, spanning 2016–2026).
- **Sources & `source_system` values:**
  - `House_Clerk` — House Clerk official bulk disclosure index + PTR PDFs.
  - `Senate_EFD` — Senate Electronic Filing Database (structured).
  - `CapitolTrades`, `QuiverQuant` — third-party aggregators (supplementary).
- **Loaded by:**
  - `src/scripts/load_bulk_trades.py` — **primary** House loader (2016–2026).
  - `src/scripts/scrape_senate_ptr.py` — Senate EFD loader.
  - `src/scripts/backfill_congress_trades.py` — capitolgains-based House+Senate scraper.
  - `src/scripts/scrape_capitoltrades.py`, `scrape_quiver_trades.py` — aggregator scrapers.
- **Feeds:** `/analysis/history`, `/congress/trades`, `/api/v1/trades`, `/api/congress/trades`, healthcare "Pharma Stocks" view.
- **Refresh:**
  ```
  python3 src/scripts/load_bulk_trades.py --all          # House 2016-2026
  python3 src/scripts/scrape_senate_ptr.py --all-senators --year 2025
  ```
- **Caveats:**
  - The community "House/Senate Stock Watcher" bulk datasets went offline (S3 403) — `load_bulk_trades.py` uses the official House Clerk bulk index instead.
  - Equities only: bond/CUSIP "tickers" are intentionally excluded.
  - House PTRs before ~2021 are partly scanned PDFs → lower parse yield (no OCR fallback).
  - Dedup key (DB unique index): `(member_name, ticker, transaction_date, transaction_type)`.

### 3. Congressional roster
- **Store:** `src/data/congress_roster.json` (971 members) + Supabase `congress_members` table.
- **Source:** `unitedstates/congress-legislators` (public domain) — current + historical.
- **Loaded by:** `src/scripts/gen_congress_roster.py` → `src/scripts/seed_congress_members.py`.
- **Feeds:** `src/lib/congress-members.ts`, the trade scrapers (party/name join key), `/congress/members/[id]`.
- **Refresh:**
  ```
  python3 src/scripts/gen_congress_roster.py
  python3 src/scripts/seed_congress_members.py
  ```
- **Caveats:** Window = anyone who served 2016–2026. Keyed on `bioguide_id`.

### 4. OpenSecrets lobbying data
- **Store:** `src/data/opensecrets/*.json` (ranked_sectors, industries, top_spenders, top_recipients).
- **Source:** OpenSecrets.org federal-lobbying pages.
- **Loaded by:** `src/scripts/scrape_opensecrets.py` (Playwright).
- **Feeds:** `/healthcare` Lobbying view and "The Connection" correlation view.
- **Refresh:** `python3 src/scripts/scrape_opensecrets.py`.
- **Caveats:** Lobbying spend only — not PAC/campaign-finance data.

### 5. PAC / campaign-finance data
- **Store:** `src/lib/pac-data.ts` — curated static TypeScript (PAC_DATABASE, nodes, edges, category totals).
- **Source:** FEC.gov committee filings, OpenSecrets, investigative news. FEC committee IDs are recorded per PAC.
- **Feeds:** `/influence?tab=pacs`, `PacsView.tsx`, the AIPAC deep dive (incl. race-by-race independent expenditures).
- **Refresh:** Manual. Every figure must carry a `source_urls` citation (investigative-journalism standard).
- **Caveats:** Static snapshot — not synced live from FEC. `committee_id` fields are ready for a future FEC API integration.

### 6. Political entities (connection database)
- **Store:** `src/lib/political-entities.ts` + Supabase `political_entities` table (~12 rows).
- **Source:** Curated — news, Wikipedia, OpenSecrets, FEC.
- **Feeds:** Contract connection-matching during sync; connection badges across the app.
- **Refresh:** Manual — add entity with `aliases`, `connection_category`, `sources`.

### 7. Healthcare / pharma ticker lists
- **Store:** Static ticker constants in `src/components/healthcare/*` and the `sector_trades` SQL view.
- **Source:** Curated equity/biotech/insurer ticker sets.
- **Feeds:** `/healthcare` "Pharma Stocks" + "The Connection" views (filter `congress_trades` by pharma tickers).
- **Refresh:** Manual — edit the ticker arrays.

---

## Refresh runbook

**Prerequisites**
- `SLUSHFUND_VENV` — path to a virtualenv with `supabase`, `pdfplumber`, `playwright`, `capitolgains`.
  Scripts call `_venv.activate()`, which also loads `.env.local` for Supabase credentials.
- `.env.local` must contain `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Full data rebuild order**
1. `python3 src/scripts/gen_congress_roster.py` — refresh the roster JSON.
2. `python3 src/scripts/seed_congress_members.py` — seed `congress_members`.
3. `python3 src/scripts/load_bulk_trades.py --all` — House trades 2016–2026 (~2h; commits per year).
4. `python3 src/scripts/scrape_senate_ptr.py --all-senators --year <YEAR>` — Senate trades per year.
5. `python3 src/scripts/scrape_opensecrets.py` — refresh lobbying JSON.
6. `POST /api/backfill` — refresh federal contract awards.
7. `python3 src/scripts/load_committees.py` — refresh committee assignments.
8. `python3 src/scripts/compute_conflicts.py` — re-score every trade for conflicts.

**Weekly incremental:** re-run steps 3–4 for the current year, `POST /api/backfill` for the
current FY, then re-run step 8 to re-score.

---

## Conflict Engine

The Conflict Engine scores every trade in `congress_trades` for conflict of interest.
It is data, not opinion — every flag is a verifiable fact.

- **Stores:** conflict columns on `congress_trades` (`conflict_score`, `conflict_tier`,
  `conflict_reasons`, `committee_conflict`, `stock_act_late`, `days_to_file`); the
  `member_conflict_scores` leaderboard view; committee assignments on
  `congress_members.committees`.
- **Sources:** committee membership from `unitedstates/congress-legislators`; federal
  contracts from the `awards` table; STOCK Act timing from the trades themselves.
- **Loaded by:** `load_committees.py` (committee assignments), then `compute_conflicts.py`
  (scoring — must run after trades, members, committees, and awards are all loaded).
- **Feeds:** `/analysis/conflicts`, `GET /api/conflicts`.
- **Scoring:** committee jurisdiction +45, federal contractor +30, STOCK Act violation
  +15, large position (>$250K) +10. Tiers: severe ≥70, high ≥45, elevated ≥20.
- **Caveat:** committee conflicts are scored against *current* committee assignments
  (historical rosters aren't cleanly published), so older trades reflect present-day
  jurisdiction. The sector/ticker and federal-contractor maps in `compute_conflicts.py`
  are curated — extend them as coverage needs grow.
