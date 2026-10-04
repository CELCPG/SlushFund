# Supabase schema

**Apply the files in `migrations/` in name order: `20261003_slushfund_v2.sql`, then `20261004_r5_awards_rule.sql`, then `20261005_r7_company_tickers.sql`.**
Each is idempotent (safe to re-run), runs in one transaction and contains no data. The v2 file replaces every other
SQL file in this folder (everything else here is history). The R5 file adds the award loader's columns and the
`contract_spending_summary` table; the R7 file adds `company_tickers` (contractor → SEC ticker link) and the `award_tickers` view.
Re-applying v2 drops policies outside its own allowlist, so re-apply R5 and R7 after it.

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
