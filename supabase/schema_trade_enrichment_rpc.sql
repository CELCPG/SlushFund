-- Sprint 5: Trade enrichment SQL function
-- Eliminates the N+1 award query on /api/congress/trades
--
-- Takes an array of (company_name, transaction_date) tuples and returns
-- matching awards joined back to the trade. Each trade gets up to 3 awards
-- within 30 days before / 60 days after the trade.
--
-- Replaces the prior pattern of: 1 query per BUY+has_contract trade in the
-- page (up to 1,222 sequential round-trips). Now: 1 RPC call for the whole
-- page regardless of size.

-- Drop first so we can change the return type (match_rank bigint).
drop function if exists get_trade_related_contracts(jsonb);

create or replace function get_trade_related_contracts(
  trades_json jsonb
)
returns table (
  trade_company_name text,
  trade_tx_date text,
  award_id text,
  recipient_name text,
  recipient_parent_name text,
  dollar_amount bigint,
  posted_date text,
  awarding_agency text,
  description text,
  match_rank bigint
)
language plpgsql
stable
as $$
declare
  global_min_date date;
  global_max_date date;
begin
  -- Compute the global date range covering all trades' windows.
  -- We pad -30 / +60 days to capture the per-trade date window.
  if jsonb_typeof(trades_json) != 'array' or jsonb_array_length(trades_json) = 0 then
    return;
  end if;

  select
    min((t->>'tx_date')::date) - 30,
    max((t->>'tx_date')::date) + 60
  into global_min_date, global_max_date
  from jsonb_array_elements(trades_json) as t
  where t->>'tx_date' is not null;

  if global_min_date is null or global_max_date is null then
    return;
  end if;

  return query
  with trades_expanded as (
    -- Expand the input JSON into a CTE we can join against.
    select
      (t->>'company_name')::text as company_name,
      (t->>'tx_date')::date as tx_date
    from jsonb_array_elements(trades_json) as t
    where t->>'tx_date' is not null and t->>'company_name' is not null
  ),
  -- Compute the "key" (first 2 words > 2 chars, lowercased) for each trade.
  -- Use the same logic as the JS code.
  trades_with_key as (
    select
      te.company_name,
      te.tx_date,
      lower(
        array_to_string(
          (
            select array_agg(w)
            from (
              select w
              from regexp_split_to_table(
                regexp_replace(te.company_name, '[,.\-]', ' ', 'g'),
                '\s+'
              ) as w
              where length(w) > 2
              limit 2
            ) s
          ),
          ' '
        )
      ) as company_key
    from trades_expanded te
  ),
  -- Find candidate awards within the global date range.
  candidate_awards as (
    select
      a.recipient_name,
      a.recipient_parent_name,
      a.dollar_amount,
      a.posted_date::text as posted_date,
      a.awarding_agency,
      a.description
    from awards a
    where a.dollar_amount >= 10000000
      and a.posted_date is not null
      and a.posted_date >= global_min_date
      and a.posted_date <= global_max_date
  ),
  -- For each (trade, award) pair, check if the award matches the trade's
  -- company_key and falls within the trade's per-tx date window.
  matched as (
    select
      t.company_name as trade_company_name,
      t.tx_date::text as trade_tx_date,
      a.recipient_name,
      a.recipient_parent_name,
      a.dollar_amount,
      a.posted_date,
      a.awarding_agency,
      a.description,
      row_number() over (
        partition by t.tx_date, t.company_name
        order by a.dollar_amount desc
      ) as match_rank
    from trades_with_key t
    cross join lateral (
      select *
      from candidate_awards a
      where
        a.posted_date >= (t.tx_date - 30)::text
        and a.posted_date <= (t.tx_date + 60)::text
        and (
          lower(coalesce(a.recipient_name, '')) like '%' || t.company_key || '%'
          or lower(coalesce(a.recipient_parent_name, '')) like '%' || t.company_key || '%'
        )
    ) a
  )
  select
    m.trade_company_name,
    m.trade_tx_date,
    null::text as award_id, -- not used by the route
    m.recipient_name,
    m.recipient_parent_name,
    m.dollar_amount,
    m.posted_date,
    m.awarding_agency,
    m.description,
    m.match_rank
  from matched m
  where m.match_rank <= 3
  order by m.trade_tx_date desc, m.trade_company_name, m.match_rank;
end;
$$;

grant execute on function get_trade_related_contracts(jsonb) to anon, authenticated;
