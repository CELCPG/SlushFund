-- Sprint 6: Performance indexes for sort/scan operations
-- Some common sort columns didn't have indexes, causing seq scan + sort.
-- Adding these dropped a 50-row LIMIT query from 8ms to 0.7ms (10x).

-- Awards sort columns
CREATE INDEX IF NOT EXISTS awards_dollar_amount_idx ON public.awards USING btree (dollar_amount DESC);
CREATE INDEX IF NOT EXISTS awards_posted_date_idx2 ON public.awards USING btree (posted_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS awards_risk_score_idx2 ON public.awards USING btree (risk_score DESC NULLS LAST);

-- Composite for the high-risk list query (risk_score + date filter)
CREATE INDEX IF NOT EXISTS awards_risk_posted_idx ON public.awards USING btree (risk_score DESC, posted_date DESC);

-- Congress trades sort columns
CREATE INDEX IF NOT EXISTS congress_trades_amount_max_idx ON public.congress_trades USING btree (amount_max DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS congress_trades_filed_date_idx2 ON public.congress_trades USING btree (filed_date DESC NULLS LAST);

-- For the latest feed / flagged trades leaderboard
CREATE INDEX IF NOT EXISTS congress_trades_conflict_idx ON public.congress_trades USING btree (conflict_score DESC NULLS LAST, transaction_date DESC);
