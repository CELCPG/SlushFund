-- R6f (A7c G5, continued): get_alert_summary is the third anon read that returned HTTP 500 under load (R6e's anon test saw one,
-- and A7c's rerun reproduced a 3.1 s first call, then 100-600 ms). It is one aggregate over every row of `awards`, a 46 MB heap
-- (5,874 pages), and anon has a 3 s statement_timeout: warm it takes 60-120 ms, cold (after heavy writes elsewhere evict the
-- cache) it reads the whole heap from disk and crosses 3 s. A covering index holds only the five columns the function reads
-- (about 2.5 MB), so with a vacuumed visibility map the aggregate is an index-only scan over a few hundred pages.
-- Idempotent. Run `vacuum (analyze) awards;` (outside a transaction) after this file and after every big awards load, so the
-- visibility map is current and the planner keeps choosing the index-only scan.
begin;
set local search_path = public;
create index if not exists awards_alert_cover_idx
  on awards (posted_date) include (dollar_amount, award_category, connection_type, competition_status);
comment on index awards_alert_cover_idx is
  'Covering index for get_alert_summary (A7c G5): posted_date range filter plus the four columns it aggregates, so the call is an index-only scan instead of a scan of the 46 MB awards heap.';
commit;
