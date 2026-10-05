# Supabase schema

**Apply the files in `migrations/` in name order: `20261003_slushfund_v2.sql`, `20261004_congress_trades_source_doc.sql`, `20261004_r5_awards_rule.sql`, `20261005_congress_trades_owner.sql`, `20261005_r7_company_tickers.sql`, `20261006_r6a_trades.sql`, `20261006_r6a_trades_key.sql`, then `20261006_r6b_ticker_windows.sql` (the two R6a files add option / lot / date-flag / lateness columns to `congress_trades` and replace its upsert key with a lossless one), then `20261007_r6c_notification_date.sql` and `20261007_r6c_conflicts.sql` (R6c: `notification_date` and the `stale_2y_corroborated` flag; committee seat history tables, `committee_basis`, `instrument`, and `member_conflict_scores.late_filing_count`). After the migrations run `load_committee_history.py`, then `compute_conflicts.py`; re-run `compute_conflicts.py` after any trade, ticker-link or committee load.** Then `20261008_r6d_contractor_wording.sql` (R6d: `congress_trades.contract_basis`, comments on `has_federal_contract` and `signal_type`; drops the empty table `insider_trading_signals` and recreates `get_analytics_summary` with `trade_signals` / `total_trade_signals` in place of the old `insider_*` keys; it stops with an error if that table ever has rows).
Each is idempotent (safe to re-run), runs in one transaction and contains no data. The v2 file replaces every other
SQL file in this folder (everything else here is history). The R5 file adds the award loader's columns and the
`contract_spending_summary` table; the R7 file adds `company_tickers` (contractor → SEC ticker link) and the `award_tickers` view;
the R6b file adds the instrument class and the validity window (`valid_from`/`valid_to`) to `company_tickers` and makes `award_tickers`
return only common/ADR/preferred links whose window contains the award's date signed.
Re-applying v2 drops policies outside its own allowlist, so re-apply R5 and R7 after it.

**R6e (A7b data fixes), after the R6d file:** `20261009_r6e_lateness.sql` (`lateness_basis`; the $1,000 reporting-threshold rule as a CHECK;
`has_federal_contract` default NULL), `20261009_r6e_conflicts.sql` (`member_conflict_scores` counts that say what they count, score-band
tiers `score_70_plus` / `score_45_69` / `score_20_44` / `score_under_20`), `20261009_r6e_wording.sql` (no verdict words in anything anon can read
or run: `not_competed` for `no_bid`, `risk_*` and `flagged_*` gone, `get_covid_fraud_stats` dropped; `agency_spending_summary` is now a
MATERIALIZED view: `select refresh_agency_spending_summary();` after every awards load, `load_awards.py` does it) and
`20261010_r6e_committee_snapshot.sql`. **The v2 file is now bootstrap-only: it refuses to run on a database that has the R6e columns.**
The verdict-word scan is `supabase/tools/scan_verdict_words.mjs` (run it after any migration; it must report 0 binding hits of ours);
`supabase/tools/apply.mjs` applies one migration file through `pg`. After `20261009_r6e_wording.sql` (it rewrites 26,280 `awards` rows) run
`vacuum (full, analyze) awards;` outside a transaction: without it the table kept ~130 MB of dead rows and anon reads of `top_vendors` /
`get_alert_summary` hit the 3 s statement timeout (DB 249 MB before, 99 MB after). Do the same for `congress_trades` after repeated `compute_conflicts.py` runs.

**R6f (A7c G1, G3, G4, G5), after the R6e files:** `20261011_r6f_first_report.sql` (`original_source_doc_id`, `original_disclosure_url`,
`original_source_basis`: the first report of every row, additive), then **backfill with the loaders** (`load_bulk_trades.py` from its PTR cache,
`load_senate_trades.py load --refresh`; no network needed), then `20261012_r6f_counts_and_access.sql` (a CHECK that the three columns agree;
`member_conflict_scores` counts FIRST reports and, with `monthly_spending_trend`, is now a MATERIALIZED view: `select refresh_member_conflict_scores();`
after every trades load, `compute_conflicts.py` does it, and `select refresh_monthly_spending_trend();` after every awards load, `load_awards.py` does it;
`get_trade_related_contracts` is service_role only; `get_congress_trades_summary.totalTrades` counts every row, `futureDatedTrades` says how many are
left out of the windowed figures). Both files run twice. The R6e files `20261009_r6e_conflicts.sql` and `20261009_r6e_wording.sql` drop either kind of
those two relations first, so the whole chain can be re-run; run `20261012_r6f_counts_and_access.sql` last. First report = the earliest filing (filing
date, then DocID) that listed the transaction. For a Senate report that was amended, the original it restates is the first report of every row
(an amendment restates the whole report, so a row an amendment added or corrected still takes the original's date and link). D1 (A8b L6): the
original is the one in the same-title group that shares the most lines with the amendment (tie: earlier filing); a senator's same-day sibling
report that the amendment does not restate stays its own report, and an amendment that shares no instrument with any original is a load error
(`load_senate_trades.py pick_versions`, `test_senate_pairing.py`; `load --only <bioguide>` reloads one senator).
`20261013_r6f_awards_alert_index.sql` adds a covering index so `get_alert_summary` (one aggregate over the 46 MB `awards` heap, 3 s anon timeout) is an index-only scan; run `vacuum (analyze) awards;` after it and after every big awards load. Other awards-scanning reads (`get_top_agencies`, `top_vendors`, `connection_group_summary`, `get_competition_coverage`, `get_covid_stats`, `get_era_stats`) still scan the heap: warm they take 20-200 ms, and a page must show "data unavailable" for a failed read, never zero.

```
# from any machine with the DB password (direct host; use the session pooler if IPv6 is unavailable)
psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require" -f supabase/migrations/20261003_slushfund_v2.sql
```

## Do not load seed or demo data
`seed.ts`, `analytics-seed.sql`, `seed_analytics_data.sql` and `src/lib/mock-data*.ts` held hand-made rows with no
source citations; they were deleted on `redesign/v2` (D1, 2026-10-03). Only official public records, written by the
loaders in `src/scripts/` and `scripts/`, may populate the tables.

## Security model (summary; full rules are the comment block above section 10 of the migration)
- RLS is on for every table in `public`. `anon` and `authenticated` can only `SELECT`, and only on public data.
- `newsletter_subscribers` (personal data) and `sync_log` (raw error payloads) have no `anon`/`authenticated`
  access at all. Every write, and every read of those two, goes through the service role on the server.
- Views are `security_invoker`; functions are `SECURITY INVOKER` with a pinned `search_path`. `compute_scores` and
  `backfill_era_snapshots` are service-role only; the read RPCs the site calls are open to `anon`.
- New table? Enable RLS, add a `public read <table>` policy only if the data is meant to be public, grant nothing else.

## `legacy/` and the old `schema*.sql`
Superseded. `legacy/` holds the three old timestamped migrations, moved out of `migrations/` so `supabase db push`
does not try to run them against an empty database (the first one needs a table that does not exist yet).
