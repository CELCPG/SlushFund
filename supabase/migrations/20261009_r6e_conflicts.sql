-- R6e (A7b F3, F8, F9): member_conflict_scores counts that say what they count, and score-band tier labels.
-- Additive / idempotent: every statement can run twice. One transaction; the only data change is the one-time rename of
-- the stored tier values and of the 'date_not_reliable_' basis prefix (compute_conflicts.py writes the new forms).
-- RLS stays on for every table; anon and authenticated can only SELECT (unchanged).
--
-- 1. congress_trades.conflict_tier stores a SCORE BAND, not a verdict word (A7b F8: "severe" was shown as "severe conflict"):
--      score_70_plus (was severe) | score_45_69 (was high) | score_20_44 (was elevated) | score_under_20 (was routine)
--    Pages show the band ("70-100"), never a word. A score is a prompt to look closer, not a finding.
-- 2. member_conflict_scores (A7b F3), same other columns:
--      late_filing_count   -> late_transaction_count : it counted TRANSACTIONS (Armstrong 701 was 1 report)
--      + late_report_count                           : distinct reports (source_doc_id) holding a late transaction
--      conflicted_trades   -> signal_trades          : trades with conflict_score > 0 (any of the four signals, size and
--                                                      lateness included; 4,833 of 7,434 have no committee or contractor signal)
--      high_conflict_trades-> high_signal_trades     : trades in the two top score bands (score >= 45)
-- 3. 'date_not_reliable_<flag>' in committee_basis / contract_basis -> 'not_computed_date_<flag>' (A7b F9: the filer's dates
--    are shown as filed; "not reliable" was our judgement of them).

begin;
set local search_path = public;

-- 1. tier values --------------------------------------------------------------------------------------------
alter table congress_trades drop constraint if exists congress_trades_conflict_tier_valid;
update congress_trades set conflict_tier = case conflict_tier
    when 'severe' then 'score_70_plus' when 'high' then 'score_45_69'
    when 'elevated' then 'score_20_44' when 'routine' then 'score_under_20' end
 where conflict_tier in ('severe', 'high', 'elevated', 'routine');
alter table congress_trades add constraint congress_trades_conflict_tier_valid
  check (conflict_tier is null or conflict_tier in ('score_under_20', 'score_20_44', 'score_45_69', 'score_70_plus'));

-- 3. basis strings ----------------------------------------------------------------------------------------------
update congress_trades set committee_basis = regexp_replace(committee_basis, '^date_not_reliable_', 'not_computed_date_')
 where committee_basis like 'date\_not\_reliable\_%';
update congress_trades set contract_basis = regexp_replace(contract_basis, '^date_not_reliable_', 'not_computed_date_')
 where contract_basis like 'date\_not\_reliable\_%';

comment on column congress_trades.conflict_tier is
  'Score band of conflict_score, not a verdict: score_70_plus | score_45_69 | score_20_44 | score_under_20. Written by compute_conflicts.py. Show the band ("70-100"); a score is a prompt to look closer, not a finding.';
comment on column congress_trades.conflict_score is
  '0-100 from four documented signals: committee seat +45, listed federal contractor +30, reported late +15, large position +10. A prompt to look closer, not a finding. NULL signals are not computed, never "no".';
comment on column congress_trades.conflict_reasons is
  'One plain-language fact per signal that fired, each with its basis: the committee seat (our hand-built sector map, not a statement of jurisdiction), the listed award(s) signed on or before the trade (obligated to date, USAspending as of the stated date), days filed after the trade, large position. Written by compute_conflicts.py.';
comment on column congress_trades.committee_basis is
  'Source of the committee signal: congress_legislators_snapshot_<date> = latest complete snapshot on or before the trade; no_committee_data_since_<date> = a new Congress began and no complete snapshot exists yet (committee_conflict NULL); not_computed_date_<flag> = the transaction date as filed is flagged (see date_flag), committee_conflict NULL.';
comment on column congress_trades.contract_basis is
  'Basis of has_federal_contract. awards_signed_from_2023-10-01 = computed against our listed set: true when a linked company had an award in it signed on or before the trade date, false when it had none. not_computed_trade_before_2023-10-01 = the trade predates the awards table, which cannot answer: has_federal_contract is NULL. not_computed_date_<flag> = the transaction date as filed is flagged (see date_flag): NULL. Written by compute_conflicts.py.';

-- 2. the view ------------------------------------------------------------------------------------------------------
drop view if exists member_conflict_scores;
create view member_conflict_scores with (security_invoker = true) as
select
  ct.member_name,
  coalesce(max(nullif(ct.member_party, 'Unknown')), 'Unknown')   as member_party,
  coalesce(max(nullif(ct.member_chamber, 'Unknown')), 'Unknown') as member_chamber,
  coalesce(max(nullif(ct.member_state, 'Unknown')), 'Unknown')   as member_state,
  count(*)                                                        as total_trades,
  count(*) filter (where ct.conflict_score > 0)                   as signal_trades,
  count(*) filter (where ct.stock_act_late)                       as late_transaction_count,
  count(distinct ct.source_doc_id) filter (where ct.stock_act_late) as late_report_count,
  count(*) filter (where ct.committee_conflict)                   as committee_conflicts,
  count(*) filter (where ct.has_federal_contract)                 as contractor_trades,
  count(*) filter (where ct.conflict_tier in ('score_45_69', 'score_70_plus')) as high_signal_trades,
  coalesce(sum(ct.amount_max), 0)::bigint                         as estimated_volume,
  coalesce(max(ct.conflict_score), 0)                             as peak_conflict_score,
  coalesce(round(avg(ct.conflict_score), 1), 0)                   as avg_conflict_score
from congress_trades ct
group by ct.member_name;

grant select on member_conflict_scores to anon, authenticated;

comment on view member_conflict_scores is
  'Per-member roll-up of the conflict-engine columns on congress_trades. Rank late filers by late_report_count (distinct reports) or days, never by late_transaction_count: one report can hold hundreds of transactions (Armstrong: 701 transactions, 1 report). signal_trades = trades with conflict_score > 0 (any signal, size and lateness included, not a count of conflicts); high_signal_trades = trades with score >= 45. A score is a prompt to look closer, not a finding. NULL signals are not counted.';

commit;
