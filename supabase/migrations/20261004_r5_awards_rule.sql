-- R5 (2026-10-03): unbiased contract-awards loader (src/scripts/load_awards.py, rule r5-v1)
-- and per-agency denominators. Apply AFTER 20261003_slushfund_v2.sql.
--
-- Re-runnable: `add column if not exists`, `create ... if not exists`, guarded drops, and
-- the whole file runs in one transaction. Contains NO data.
--
-- What it changes:
--   1. awards: new columns for the fields the loader stores (all nullable, additive).
--   2. awards: the old UNIQUE(award_id) becomes a plain index. award_id holds the PIID,
--      and a PIID is NOT unique: 21 PIIDs in the FY2026 load belong to 2-10 different
--      orders each (e.g. HHS order 75N99026F00001 under 7 different IDVs). The unique key
--      is USAspending's generated unique award id, stored in `id` (primary key) and
--      `generated_unique_award_id`. Consequence: the retired writers that upserted
--      ON CONFLICT (award_id) (/api/sync, /api/backfill, lib/sync.ts, scripts/sync-awards.ts)
--      would now fail; they are disabled in the same commit.
--   3. contract_spending_summary: per-agency, per-FY contract obligations (all, non-competed,
--      competed) straight from USAspending aggregates, so "X% no-bid" is a share of all
--      federal contract spending, not of our sample. Public read, service-role write.
--
-- NOTE: re-applying 20261003_slushfund_v2.sql drops every policy and grant outside its own
-- allowlist, including the public-read policy below. Re-apply this file after it.

begin;
set local search_path = public;

-- -----------------------------------------------------------------------------
-- 1. awards: loader columns
-- -----------------------------------------------------------------------------
alter table awards add column if not exists generated_unique_award_id text;   -- USAspending key (= id)
alter table awards add column if not exists piid text;                        -- procurement instrument id
alter table awards add column if not exists parent_award_piid text;           -- IDV the order sits under
alter table awards add column if not exists parent_award_agency_code text;
alter table awards add column if not exists recipient_parent_uei text;
alter table awards add column if not exists awarding_sub_agency_code text;
alter table awards add column if not exists awarding_office_code text;
alter table awards add column if not exists awarding_office_name text;
alter table awards add column if not exists obligated_amount numeric(16,2);   -- exact total obligated (dollar_amount is rounded)
alter table awards add column if not exists base_exercised_options_value numeric(16,2);
alter table awards add column if not exists base_all_options_value numeric(16,2);
alter table awards add column if not exists award_type text;                  -- e.g. DELIVERY ORDER (contract_type holds the code)
alter table awards add column if not exists solicitation_procedures text;
alter table awards add column if not exists solicitation_procedures_code text;
alter table awards add column if not exists other_than_full_open text;        -- FAR 6.302 justification
alter table awards add column if not exists other_than_full_open_code text;
alter table awards add column if not exists fair_opportunity_limited text;    -- FAR 16.505(b)(2) exception (orders)
alter table awards add column if not exists fair_opportunity_limited_code text;
alter table awards add column if not exists number_of_offers int;
alter table awards add column if not exists set_aside text;
alter table awards add column if not exists set_aside_code text;
alter table awards add column if not exists naics_description text;
alter table awards add column if not exists psc_description text;
alter table awards add column if not exists latest_action_date date;
alter table awards add column if not exists source_last_modified timestamptz;
alter table awards add column if not exists fiscal_year int;                  -- FY of the base award date
alter table awards add column if not exists selection_rule text;              -- e.g. r5-v1 (see load_awards.py)
alter table awards add column if not exists rule_reasons text[];              -- which rule clauses the row meets
alter table awards add column if not exists last_seen_at timestamptz;         -- last load that returned the row

comment on column awards.id is 'USAspending generated unique award id (CONT_AWD_...) for rows from load_awards.py';
comment on column awards.award_id is 'PIID (not unique across awards: orders under different IDVs can share one)';
comment on column awards.selection_rule is 'Selection rule version that loaded the row; r5-v1 documented in src/scripts/load_awards.py and openclaw-shared/projects/slushfund/r5-awards.md';
comment on column awards.connection_type is 'Political-connection tag. Filled by a separate post-load step; never used to select rows. NULL = not tagged yet';

-- 2. PIID is not unique: replace the unique constraint with a plain index
alter table awards drop constraint if exists awards_award_id_key;
create index if not exists awards_award_id_idx on awards (award_id);

create index if not exists awards_fy_agency_idx on awards (fiscal_year, awarding_agency_code);
create index if not exists awards_extent_code_idx on awards (extent_competed_code);
create index if not exists awards_parent_uei_idx on awards (recipient_parent_uei);

-- -----------------------------------------------------------------------------
-- 3. contract_spending_summary: denominators from USAspending aggregates
-- -----------------------------------------------------------------------------
create table if not exists contract_spending_summary (
  fiscal_year int not null,
  agency_code text not null,                 -- USAspending toptier code ('097' = DoD); 'ALL' = all agencies
  agency_name text not null,
  agency_abbreviation text,
  total_obligations numeric(18,2) not null,  -- all prime contract obligations (types A-D) in the window
  noncompeted_obligations numeric(18,2) not null,   -- extent competed B, C, G, NDO
  competed_obligations numeric(18,2) not null,      -- extent competed A, D, E, F, CDO
  unreported_obligations numeric(18,2) generated always as
    (total_obligations - noncompeted_obligations - competed_obligations) stored,
  noncompeted_share numeric generated always as
    (case when total_obligations > 0 then round(noncompeted_obligations / total_obligations, 4) end) stored,
  period_start date not null,
  period_end date not null,                  -- FY end, or the fetch date for the current FY
  method text not null,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  primary key (fiscal_year, agency_code)
);

-- DoD publishes contract actions 90 days late, so its (and the ALL row's) figures for the
-- last 90 days before fetched_at are incomplete. 0 = no known publication delay.
alter table contract_spending_summary add column if not exists reporting_lag_days int not null default 0;

alter table contract_spending_summary enable row level security;
drop policy if exists "public read contract_spending_summary" on contract_spending_summary;
create policy "public read contract_spending_summary" on contract_spending_summary
  for select to anon, authenticated using (true);
revoke all on contract_spending_summary from anon, authenticated;
grant select on contract_spending_summary to anon, authenticated;

commit;
