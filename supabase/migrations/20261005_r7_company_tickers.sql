-- R7 (2026-10-03): company_tickers, the link from federal contractors (USAspending recipients
-- and their parents) to SEC-registered public companies and their tickers. Loaded by
-- src/scripts/load_company_tickers.py (rule r7-v1). Apply AFTER 20261004_r5_awards_rule.sql.
--
-- Re-runnable: `create ... if not exists`, guarded policy drops, `create or replace view`;
-- the file runs in one transaction. Contains NO data.
--
-- One row = one (ticker, contractor entity) pair. The contractor entity is, normally, the
-- awards' recipient PARENT group (recipient_parent_uei / recipient_parent_name, USAspending's
-- parent field, or the recipient itself when an award carries no parent). Subsidiaries are
-- linked through that parent UEI, never by name guessing. A row with recipient_uei set
-- (entity_level = 'recipient') covers only that one recipient inside the group; it exists
-- when a recipient's own name matches a registrant but its USAspending parent says otherwise.
-- The view award_tickers below does the join, so callers do not have to.
--
-- status:
--   auto_confirmed   exact normalized name match (one SEC CIK, legal-form words agree), by code
--   manual_confirmed a person approved a needs_review row (reviewed_by / reviewed_at set)
--   needs_review     fuzzy, alias, ambiguous, or otherwise not safe to accept by code
--   rejected         a person (or a verified check) ruled the link wrong; kept so it is not re-suggested
-- A false link would accuse a member of trading a contractor they did not, so the PUBLIC read
-- policy exposes only the two confirmed statuses. needs_review / rejected rows are visible to
-- the service role only.

begin;
set local search_path = public;

create table if not exists company_tickers (
  id bigint generated always as identity primary key,
  -- SEC side (https://www.sec.gov/files/company_tickers.json, company_tickers_exchange.json)
  cik text not null,                         -- 10 digits, zero padded
  ticker text not null,                      -- SEC format (BRK-B, not BRK.B)
  sec_name text not null,                    -- SEC registrant title
  exchange text,                             -- Nasdaq / NYSE / OTC / CBOE, when SEC lists one
  -- USAspending side: the contractor entity
  recipient_parent_uei text not null,        -- awards.recipient_parent_uei (or the recipient's own UEI if no parent)
  recipient_parent_name text not null,
  recipient_uei text,                        -- set only for entity_level = 'recipient'
  recipient_name text,
  entity_level text not null default 'parent'
    check (entity_level in ('parent', 'recipient')),
  -- how it was matched
  match_method text not null
    check (match_method in ('exact_normalized', 'parent_chain', 'alias', 'fuzzy', 'manual')),
  match_score numeric(4,3) not null check (match_score between 0 and 1),
  status text not null
    check (status in ('auto_confirmed', 'manual_confirmed', 'needs_review', 'rejected')),
  evidence_url text not null,                -- SEC EDGAR company page for the CIK
  notes text,                                -- why needs_review, or what the reviewer decided
  rule_version text not null default 'r7-v1',
  reviewed_by text,
  reviewed_at timestamptz,
  matched_at timestamptz not null default now(),
  check ((entity_level = 'recipient') = (recipient_uei is not null))
);

-- one row per ticker per entity; NULL recipient_uei (parent-level rows) counts as one value
create unique index if not exists company_tickers_entity_key
  on company_tickers (ticker, recipient_parent_uei, recipient_uei) nulls not distinct;

comment on table company_tickers is 'Federal contractor (USAspending recipient parent or recipient) to SEC public company + ticker. Built by load_company_tickers.py (r7-v1) from records only; fuzzy matches are never auto-confirmed. Public read shows confirmed rows only.';
comment on column company_tickers.recipient_parent_uei is 'UEI of the recipient parent group (awards.recipient_parent_uei; the recipient''s own UEI when the awards carry no parent)';
comment on column company_tickers.recipient_uei is 'NULL = the whole parent group is the public company; set = only this recipient inside the group (entity_level recipient)';
comment on column company_tickers.evidence_url is 'SEC EDGAR company page: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<cik>';

create index if not exists company_tickers_ticker_idx on company_tickers (ticker);
create index if not exists company_tickers_parent_uei_idx on company_tickers (recipient_parent_uei);
create index if not exists company_tickers_cik_idx on company_tickers (cik);
create index if not exists company_tickers_status_idx on company_tickers (status);

alter table company_tickers enable row level security;
drop policy if exists "public read company_tickers" on company_tickers;
create policy "public read company_tickers" on company_tickers
  for select to anon, authenticated
  using (status in ('auto_confirmed', 'manual_confirmed'));
revoke all on company_tickers from anon, authenticated;
grant select on company_tickers to anon, authenticated;

-- award -> public company join. security_invoker: the caller's RLS applies to both tables,
-- so anon sees confirmed links only.
create or replace view award_tickers with (security_invoker = true) as
select a.id as award_id,
       a.fiscal_year,
       a.recipient_name,
       a.recipient_uei,
       a.recipient_parent_name,
       a.recipient_parent_uei,
       a.obligated_amount,
       a.extent_competed_code,
       a.competition_status,
       c.id as company_ticker_id,
       c.cik,
       c.ticker,
       c.sec_name,
       c.status as link_status,
       c.match_method,
       c.entity_level,
       c.evidence_url
from awards a
join company_tickers c
  on c.recipient_parent_uei = coalesce(a.recipient_parent_uei, a.recipient_uei)
 and (c.recipient_uei is null or c.recipient_uei = a.recipient_uei);

revoke all on award_tickers from anon, authenticated;
grant select on award_tickers to anon, authenticated;

commit;
