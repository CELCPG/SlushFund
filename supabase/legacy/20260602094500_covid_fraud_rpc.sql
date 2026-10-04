-- SlushFund — COVID Fraud Stats RPC
--
-- Powers the "PPE loans & COVID fraud" section on /covid.
-- Aggregates fraud-signal fields across all COVID-tagged awards:
--   - flags[], price_flags[], connection_flags[], risk_score, price_premium_pct
--   - aggregates by risk band (high/moderate/low)
--   - top suspicious vendors (any award with flags populated)
--   - price-premium stats (when estimated_market_rate is on file)
--   - category breakdown of what was actually bought (naics_code/description)
--
-- The prior /api/covid-stats RPC only counted no-bid/sole-source, which is
-- a tiny slice of the actual fraud signal. This function surfaces what the
-- dataset knows about COVID-tagged awards that look suspicious.
--
-- Run this in: Supabase → SQL Editor → New Query → Paste and Run

create or replace function get_covid_fraud_stats()
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    -- Aggregate fraud counts
    'total_awards',           count(*),
    'flagged_count',          count(*) filter (where array_length(flags, 1) > 0),
    'flagged_dollars',        coalesce(sum(covid_obligations) filter (where array_length(flags, 1) > 0), 0),
    'price_flagged_count',    count(*) filter (where array_length(price_flags, 1) > 0),
    'price_flagged_dollars',  coalesce(sum(covid_obligations) filter (where array_length(price_flags, 1) > 0), 0),
    'connection_flagged_count',   count(*) filter (where array_length(connection_flags, 1) > 0),
    'connection_flagged_dollars', coalesce(sum(covid_obligations) filter (where array_length(connection_flags, 1) > 0), 0),
    'no_bid_count',           count(*) filter (where competition_status in ('no_bid', 'sole_source')),
    'no_bid_dollars',         coalesce(sum(covid_obligations) filter (where competition_status in ('no_bid', 'sole_source')), 0),
    'high_risk_count',        count(*) filter (where risk_score >= 70),
    'high_risk_dollars',      coalesce(sum(covid_obligations) filter (where risk_score >= 70), 0),

    -- Price-premium stats: only over awards that have a market-rate estimate
    'price_premium_count',    count(*) filter (where price_premium_pct is not null),
    'avg_price_premium_pct',  coalesce(avg(price_premium_pct) filter (where price_premium_pct is not null), 0),
    'total_inflated_overpayment', coalesce(
      sum(coalesce(covid_obligations, 0) - coalesce(estimated_market_rate, 0))
        filter (where price_premium_pct is not null and estimated_market_rate is not null and covid_obligations > estimated_market_rate),
      0
    ),

    -- Top suspicious COVID vendors — only those with at least one flag, ranked by flagged dollars
    'top_suspicious_vendors', (
      select coalesce(jsonb_agg(row_to_json(t) order by flagged_dollars desc), '[]'::jsonb)
      from (
        select
          recipient_name as name,
          count(*) filter (where array_length(flags, 1) > 0) as flagged_award_count,
          count(*) as award_count,
          coalesce(sum(covid_obligations) filter (where array_length(flags, 1) > 0), 0) as flagged_dollars,
          coalesce(sum(covid_obligations), 0) as total_dollars,
          max(risk_score) as max_risk_score
        from awards
        where covid_obligations > 0 and array_length(flags, 1) > 0
        group by recipient_name
        order by flagged_dollars desc
        limit 10
      ) t
    ),

    -- Distribution of fraud-signal flag kinds across all COVID awards
    'flag_breakdown', (
      select coalesce(jsonb_object_agg(flag_value, count), '{}'::jsonb)
      from (
        select unnest(flags) as flag_value, count(*) as count
        from awards
        where covid_obligations > 0 and array_length(flags, 1) > 0
        group by 1
        order by count desc
      ) f
    ),

    -- Highest-risk individual awards — the "show your work" list
    'highest_risk_awards', (
      select coalesce(jsonb_agg(row_to_json(t) order by risk_score desc, covid_obligations desc), '[]'::jsonb)
      from (
        select
          award_id,
          recipient_name,
          awarding_agency,
          covid_obligations,
          risk_score,
          risk_factors,
          flags,
          price_flags,
          connection_flags,
          price_premium_pct,
          description
        from awards
        where covid_obligations > 0 and risk_score is not null
        order by risk_score desc, covid_obligations desc
        limit 8
      ) t
    )
  ) into result
  from awards
  where covid_obligations > 0;

  return result;
end;
$$;

grant execute on function get_covid_fraud_stats() to anon, authenticated;
