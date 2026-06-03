-- ============================================================
-- Fix Corrupted congressional_trades dates
-- Problem: Python scrapers parsed bad dates from PDF text
--   (e.g. "04/30/3031" from garbled PDF -> becomes 3031-04-30)
-- Rule: if transaction_date year is impossible (> current+2 or < 2000),
--        replace with filed_date (which is reliably from the source)
-- ============================================================
-- Usage: psql $DATABASE_URL -f fix_congress_dates.sql
-- Or via Supabase dashboard SQL editor

DO $$
DECLARE
  fixed_count INT;
  bad_rec RECORD;
BEGIN
  -- Find all bad records
  FOR bad_rec IN (
    SELECT id, member_name, ticker, transaction_date, filed_date, disclosure_year
    FROM congress_trades
    WHERE transaction_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (
        CAST(SUBSTR(transaction_date, 1, 4) AS INTEGER) > CURRENT_DATE::date + interval '2 years'
        OR CAST(SUBSTR(transaction_date, 1, 4) AS INTEGER) < 2000
      )
      AND filed_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND CAST(SUBSTR(filed_date, 1, 4) AS INTEGER) BETWEEN 2000 AND CURRENT_DATE::date + interval '2 years'
  ) LOOP
    RAISE NOTICE 'Fixing: % | % | % -> %',
      bad_rec.member_name,
      bad_rec.ticker,
      bad_rec.transaction_date,
      bad_rec.filed_date;

    UPDATE congress_trades
    SET
      transaction_date = bad_rec.filed_date,
      disclosure_year = CAST(SUBSTR(bad_rec.filed_date, 1, 4) AS INTEGER)
    WHERE id = bad_rec.id;

    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '  Fixed % row(s)', fixed_count;
  END LOOP;

  -- Summary
  RAISE NOTICE 'Done. Run query below to verify no bad dates remain:';
END;
$$;

-- Verify
SELECT
  member_name,
  ticker,
  transaction_date,
  filed_date,
  disclosure_year,
  source_system
FROM congress_trades
WHERE transaction_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND (
    CAST(SUBSTR(transaction_date, 1, 4) AS INTEGER) > CURRENT_DATE::date + interval '2 years'
    OR CAST(SUBSTR(transaction_date, 1, 4) AS INTEGER) < 2000
  )
LIMIT 20;

-- If the above returns 0 rows, all bad dates are fixed