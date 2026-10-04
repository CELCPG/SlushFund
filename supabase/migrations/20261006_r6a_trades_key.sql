-- R6a step 3: a lossless upsert key for congress_trades (A7 S1/S3, R3 + R4 caveat 1).
-- The old key (member_name, ticker, transaction_date, transaction_type) merged genuinely different lines:
-- two owners, a stock and its option, two different option contracts on one day. The new key adds the
-- owner, the asset type and the instrument (option_type / strike / expiry). NULLS NOT DISTINCT makes the
-- NULL option columns of a plain stock behave as one value, so re-running a loader upserts instead of
-- inserting duplicates.
-- Same-day lots of the same instrument AND owner still fold into one row (lot_count says how many;
-- amount_range keeps every band).
-- Additive and idempotent. Existing rows already satisfy the finer key. RLS and policies are untouched.
create unique index if not exists congress_trades_lossless_key
  on congress_trades (member_name, ticker, transaction_date, transaction_type, owner, asset_type, option_type, strike, expiry)
  nulls not distinct;

-- Every loader that still upserts on the old four columns now fails (42P10) instead of merging lines.
drop index if exists congress_trades_natural_key;

comment on index congress_trades_lossless_key is 'R6a upsert key: member, ticker, date, direction, owner, asset type, option type, strike, expiry (NULLs equal).';
