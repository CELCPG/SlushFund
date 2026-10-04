# SlushFund — Data Inventory

Single source of truth for every dataset the app depends on: where it comes from,
what it feeds, how fresh it is, and how to refresh it. Keep this file updated whenever
a data source, table, or loader changes.

_Last reviewed: 2026-05-21_

---

## Datasets

### 1. Federal contract awards
- **Store:** Supabase `awards` (prime contract awards) and `contract_spending_summary` (per-agency, per-FY
  obligations: all / non-competed / competed, straight from USAspending aggregates).
- **Source:** USAspending.gov API (`https://api.usaspending.gov/api/v2`): the award download, award counts, and
  `spending_by_category`.
- **Loaded by:** `src/scripts/load_awards.py` (R5, 2026-10-03) under selection rule `r5-v1`: prime contract awards
  (types A–D) signed in a loaded FY with extent competed B/C/G/NDO and ≥ $1M obligated, or ≥ $10M obligated
  whatever the competition. Political-connection tags never select rows. The old writers (`/api/sync`,
  `/api/backfill`, `/api/sync/trigger`, `lib/sync.ts`, `src/scripts/sync-cli.ts`, `scripts/sync-awards.ts`) kept a
  hand-picked "notable" sample and are retired (410 / exit 1).
- **Feeds:** `/dashboard`, `/contract/[id]`, `/api/contracts`, `/api/alerts`, era/COVID/compare pages.
- **Refresh:** `python src/scripts/load_awards.py incremental` (daily), `load --fy <FY> --prune` + `summary --fy <FY>`
  (weekly, current and previous FY), `load --fy <FY>` for a backfill. Full method, size math and caveats:
  `openclaw-shared/projects/slushfund/r5-awards.md`.
- **Coverage / caveats:** FY2026 loaded 2026-10-03 (FY2024–25 backfill commands in r5-awards.md). DoD publishes
  contract actions 90 days late, so the most recent ~90 days of DoD awards and obligations are incomplete.

### 1b. Contractor → public-company link (`company_tickers`)
- **Store:** Supabase `company_tickers` (one row per ticker per contractor recipient) and the view `award_tickers`
  (award → ticker join). Public read shows only `auto_confirmed` / `manual_confirmed` rows; `needs_review` and
  `rejected` rows are service-role only.
- **Sources:** SEC `company_tickers.json` + `company_tickers_exchange.json` (CIK, ticker, registrant name), SEC
  submissions JSON and the latest 10-K/20-F EX-21 subsidiary list (evidence), USAspending recipient/parent names and
  UEIs from the loaded `awards`. No third-party aggregator.
- **Loaded by:** `src/scripts/load_company_tickers.py` (R7, 2026-10-03), rule `r7-v1`: exact normalized names only;
  a recipient is accepted through USAspending's parent field only with its own evidence (name relation or EX-21);
  everything fuzzy goes to `needs_review` and is never auto-confirmed. Decisions by a person are recorded with
  `load_company_tickers.py review ...` and survive re-runs.
- **Refresh:** `python src/scripts/load_company_tickers.py match --prune` after each awards load (about 2 minutes,
  SEC and USAspending requests are rate-limited and cached). Method, coverage, verification and the review queue:
  `openclaw-shared/projects/slushfund/r7-tickers.md`.
- **Instrument class and validity window (R6b, audit A7 T1–T3):** every row carries `instrument_class`
  (common / adr / preferred / note / etn / warrant / unit / other, read from the security's registered title on the
  registrant's 12(b) cover page), `valid_from` / `valid_to` (the registrant's listing window and, for a subsidiary,
  the acquisition window; NULL = open), `window_status` (`same_entity` / `checked` / `unchecked`) and `window_source`
  (the EDGAR filing that proves the date). A "member traded a contractor" claim is allowed only for
  `instrument_class` in common/adr/preferred, only when the trade date (or the award's date signed) lies inside
  `[valid_from, valid_to]` and is on or after 2020-10-01, and never from an `unchecked` link. `award_tickers`
  already applies the class and date rules. Loader: `src/scripts/load_ticker_windows.py` (re-run `apply` after
  every `match`). Method, counts and the exact join rule: `openclaw-shared/projects/slushfund/r6b-tickers.md`.

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

### 4b. Senate LDA lobbying data
- **Store:** `src/data/lobbying/lda_top_spenders.json`, `lda_by_issue.json`.
- **Source:** Senate Office of Public Records LDA REST API (`https://lda.senate.gov/api/v1/filings/`) — official, free; `LDA_API_KEY` optional for higher rate limit.
- **Loaded by:** `src/scripts/load_senate_lda.py` (stdlib urllib, no scraping).
- **Feeds:** `/lobbying` page (top clients + spend-by-issue chart).
- **Refresh:** `python3 src/scripts/load_senate_lda.py --year 2024` (`--dry` to preview).
- **Caveats:** Ships with a seed dataset; run the loader to replace with live filings.

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
6. `python src/scripts/load_awards.py load --fy <FY>` and `summary --fy <FY>` per fiscal year — federal contract
   awards and their per-agency denominators.
7. `python3 src/scripts/load_committees.py` — refresh committee assignments.
8. `python3 src/scripts/compute_conflicts.py` — re-score every trade for conflicts.

**Weekly incremental:** re-run steps 3–4 for the current year, `load_awards.py load --fy <FY> --prune` for the
current FY, then re-run step 8 to re-score. Awards also run daily: `load_awards.py incremental`.

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
- **Scoring:** committee jurisdiction +45 (seat held on the trade date), federal contractor +30
  (a linked company had an award signed on or before the trade date), filed late +15 (more than
  45 days after the trade), large position (>$250K) +10. `conflict_tier` stores the score band (`score_70_plus`, `score_45_69`, `score_20_44`, `score_under_20`): show the band, never a word. A score is a prompt to look closer, not a finding.
- **Contractor signal (R6d):** the `awards` table only holds awards signed from 2023-10-01
  (`AWARDS_COVERAGE_START` in `compute_conflicts.py`, one constant). A trade dated before that cannot
  be answered from it: `has_federal_contract` is NULL (not computed), never false. `contract_basis`
  says which case a row is in (`awards_signed_from_2023-10-01`, `not_computed_trade_before_2023-10-01`,
  `not_computed_date_<flag>`). NULL means "not computed", not "no". `has_federal_contract = false` means no award in the listed set
  (contracts not competed of at least $1M, or any of at least $10M, signed from 2023-10-01) was signed on or before the trade, not "no federal contracts".
- **Late filing (R6e):** `lateness_basis` says why `days_to_file` / `stock_act_late` are set or NULL (`computed`, `below_reporting_threshold` when
  `amount_max` <= 1,000, `original_filing_unknown`, `not_computed_date_<flag>`). Rank late filers by `member_conflict_scores.late_report_count`
  (distinct reports), never by `late_transaction_count`.
- **Caveat:** committee seats come from the seat history (`committee_seats`, built from the git
  history of `unitedstates/congress-legislators`); `committee_basis` names the snapshot used and a
  trade with no complete snapshot has `committee_conflict` NULL. The sector/ticker maps in
  `compute_conflicts.py` are curated — extend them as coverage needs grow.
