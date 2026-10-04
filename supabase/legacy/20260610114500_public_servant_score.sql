-- SlushFund — Public Servant Score
-- Section: /score
-- Powers the Senate Report Card grade (0-100 → A-F) with 5 weighted pillars.
-- All pillar scores live in `senator_scores` and are version-stamped via
-- `scoring_version` so historical grades remain reproducible.
--
-- Phase 1 launch: Pillars 2 (Stock Trading), 4 (Productivity), 5 (Attendance)
-- are populated. Pillars 1 (Constituency Polling) and 3 (Lobbyist Influence)
-- start as 0 with a transparency callout on the UI side.
--
-- Design rules:
--   - We never invent. Missing data → 0 with a coverage_pct callout.
--   - All inputs are public records (STOCK Act, ProPublica, Congress.gov, Bioguide).
--   - sector_overlap[] is precomputed at ingest time so the scoring engine
--     can do committee-conflict detection in a single JOIN.
--   - Scoring is pure: compute_scores() is deterministic given inputs + version.

-- =============================================================================
-- 1. senators (static reference table)
-- =============================================================================
create table if not exists senators (
  id              uuid primary key default gen_random_uuid(),
  bioguide_id     text unique not null,           -- e.g. 'S000033'
  name_slug       text unique not null,           -- e.g. 'bernie-sanders'
  full_name       text not null,
  first_name      text,
  last_name       text,
  state           text not null,                  -- 2-letter code
  party           text not null check (party in ('D','R','I')),
  photo_url       text,
  term_start      date,
  term_end        date,
  committees      text[] default '{}',            -- populated from ProPublica
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists senators_state_idx on senators(state);
create index if not exists senators_party_idx on senators(party);
create index if not exists senators_active_idx on senators(is_active);

-- =============================================================================
-- 2. senator_scores (weekly grade snapshot)
-- =============================================================================
create table if not exists senator_scores (
  senator_id              uuid references senators(id) on delete cascade,
  week_of                 date not null,

  -- Pillar scores (each 0.0 - 20.0)
  pillar_constituency     numeric(4,1) default 0,
  pillar_stocks           numeric(4,1) default 0,
  pillar_lobbying         numeric(4,1) default 0,
  pillar_productivity     numeric(4,1) default 0,
  pillar_attendance       numeric(4,1) default 0,

  -- Pillar data flags (does this senator have data for this pillar?)
  has_constituency_data   boolean default false,
  has_stocks_data         boolean default false,
  has_lobbying_data       boolean default false,
  has_productivity_data   boolean default false,
  has_attendance_data     boolean default false,

  -- Aggregate
  total_score             numeric(5,1) generated always as (
    pillar_constituency + pillar_stocks + pillar_lobbying +
    pillar_productivity + pillar_attendance
  ) stored,
  grade                   text generated always as (
    case
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 90 then 'A'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 80 then 'B'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 70 then 'C'
      when (pillar_constituency + pillar_stocks + pillar_lobbying +
            pillar_productivity + pillar_attendance) >= 60 then 'D'
      else 'F'
    end
  ) stored,
  data_coverage_pct       integer generated always as (
    (case when has_constituency_data then 1 else 0 end +
     case when has_stocks_data then 1 else 0 end +
     case when has_lobbying_data then 1 else 0 end +
     case when has_productivity_data then 1 else 0 end +
     case when has_attendance_data then 1 else 0 end) * 20
  ) stored,

  -- Provenance
  scoring_version         text not null default '0.1.0',
  computed_at             timestamptz default now(),
  notes                   text,                    -- human note if a pillar was excluded

  primary key (senator_id, week_of)
);

create index if not exists senator_scores_week_idx on senator_scores(week_of desc);
create index if not exists senator_scores_total_idx on senator_scores(week_of desc, total_score desc);
create index if not exists senator_scores_grade_idx on senator_scores(week_of desc, grade);

-- =============================================================================
-- 3. senator_trades (Pillar 2 raw data — STOCK Act)
-- =============================================================================
create table if not exists senator_trades (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  transaction_date        date not null,
  ticker                  text,
  asset_description       text not null,
  transaction_type        text not null check (transaction_type in ('buy','sell','exchange')),
  amount_low              integer,
  amount_high             integer,
  -- Populated at score time: GICS sectors that overlap with the senator's committees
  committee_overlap_sectors text[] default '{}',
  conflict_flag           boolean default false,
  -- Provenance
  source_url              text,
  source_filing_id        text,                   -- e.g. PTR filing id from eopds
  ingested_at             timestamptz default now()
);

create index if not exists senator_trades_senator_idx on senator_trades(senator_id, transaction_date desc);
create index if not exists senator_trades_conflict_idx on senator_trades(senator_id, conflict_flag) where conflict_flag = true;
create index if not exists senator_trades_date_idx on senator_trades(transaction_date desc);

-- =============================================================================
-- 4. senator_votes (Pillar 1 raw data — vote + constituent poll)
-- =============================================================================
create table if not exists senator_votes (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  bill_id                 text not null,         -- congress.gov format: e.g. "s.1234-118"
  vote_date               date not null,
  vote_position           text not null check (vote_position in ('yea','nay','not_voting','present')),
  bill_title              text,
  is_major_bill           boolean default false,
  -- Polling alignment: populated when a state-level poll on the same question exists
  state_poll_pct_supporting numeric(4,1),         -- 0-100, NULL if insufficient polling
  poll_source_count       integer default 0,
  aligned_with_poll       boolean,               -- senator_vote matches majority
  ingested_at             timestamptz default now()
);

create index if not exists senator_votes_senator_idx on senator_votes(senator_id, vote_date desc);
create index if not exists senator_votes_bill_idx on senator_votes(bill_id);
create index if not exists senator_votes_major_idx on senator_votes(is_major_bill) where is_major_bill = true;

-- =============================================================================
-- 5. lobbyist_trips (Pillar 3 raw data — LD-1 / LDA filings)
-- =============================================================================
create table if not exists lobbyist_trips (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  trip_date               date not null,
  sponsor                 text not null,          -- lobbying org / sponsor
  destination             text,
  estimated_cost          numeric(10,2) default 0,
  purpose                 text,
  source_url              text,
  ingested_at             timestamptz default now()
);

create index if not exists lobbyist_trips_senator_idx on lobbyist_trips(senator_id, trip_date desc);

-- =============================================================================
-- 6. senator_bills (Pillar 4 raw data — sponsorship + cosponsorship)
-- =============================================================================
create table if not exists senator_bills (
  id                      uuid primary key default gen_random_uuid(),
  senator_id              uuid references senators(id) on delete cascade,
  bill_id                 text not null,
  role                    text not null check (role in ('sponsor','cosponsor')),
  introduced_date         date,
  bipartisan_cosponsors   integer default 0,     -- cosponsors from opposing party
  passed_chamber          boolean default false,
  signed_into_law         boolean default false,
  ingested_at             timestamptz default now()
);

create index if not exists senator_bills_senator_idx on senator_bills(senator_id, introduced_date desc);
create index if not exists senator_bills_passed_idx on senator_bills(senator_id, passed_chamber) where passed_chamber = true;

-- =============================================================================
-- 7. senator_attendance (Pillar 5 raw data — missed votes + speeches)
-- =============================================================================
create table if not exists senator_attendance (
  senator_id              uuid references senators(id) on delete cascade,
  week_of                 date not null,
  missed_votes_pct        numeric(4,1) default 0,
  speeches_count          integer default 0,
  total_votes             integer default 0,
  missed_votes            integer default 0,
  ingested_at             timestamptz default now(),
  primary key (senator_id, week_of)
);

create index if not exists senator_attendance_week_idx on senator_attendance(week_of desc);

-- =============================================================================
-- 8. compute_scores() — pure scoring function
-- =============================================================================
-- Re-runs the full scoring rubric for all active senators. Idempotent: deletes
-- the week's row and rewrites it. Pass scoring_version to track methodology
-- changes.
--
-- Phase 1 implements Pillars 2, 4, 5. Pillar 1 + 3 are wired through but
-- return 0 with has_*_data = false, until Phase 2 ingestion lands.

create or replace function compute_scores(target_week date, version text default '0.1.0')
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  -- 1) Stock Trading (Pillar 2)
  with trade_stats as (
    select
      st.senator_id,
      count(*) filter (where st.conflict_flag)              as conflicts,
      count(*) filter (where not st.conflict_flag)          as clean_trades
    from senator_trades st
    where st.transaction_date >= (target_week - interval '24 months')
    group by st.senator_id
  ),
  pillar2 as (
    select
      s.id as senator_id,
      case
        when ts.conflicts is null and ts.clean_trades is null then 0::numeric
        else greatest(
          0::numeric,
          least(
            20.0,
            20.0
              - coalesce(ts.conflicts, 0) * 2.0
              - coalesce(ts.clean_trades, 0) * 0.5
          )
        )
      end as score,
      (ts.conflicts is not null or ts.clean_trades is not null) as has_data
    from senators s
    left join trade_stats ts on ts.senator_id = s.id
    where s.is_active
  ),

  -- 2) Bipartisan Productivity (Pillar 4)
  bill_stats as (
    select
      sb.senator_id,
      count(*) filter (where sb.role = 'sponsor' and sb.passed_chamber) as sponsored_passed,
      count(*) filter (where sb.role = 'sponsor' and sb.bipartisan_cosponsors > 0) as bipartisan_sponsors,
      count(*) as total_bills
    from senator_bills sb
    where sb.introduced_date >= (target_week - interval '24 months')
    group by sb.senator_id
  ),
  chamber_max as (
    select
      greatest(
        1.0,
        0.5 * ln(1 + max(coalesce(bs.sponsored_passed, 0))) +
        0.3 * ln(1 + max(coalesce(bs.bipartisan_sponsors, 0))) +
        0.2 * ln(1 + max(coalesce(bs.total_bills, 0)))
      ) as max_raw
    from bill_stats bs
  ),
  pillar4 as (
    select
      s.id as senator_id,
      case
        when bs.sponsored_passed is null and bs.bipartisan_sponsors is null and bs.total_bills is null then 0
        else
          least(
            20.0,
            (
              (0.5 * ln(1 + coalesce(bs.sponsored_passed, 0)) +
               0.3 * ln(1 + coalesce(bs.bipartisan_sponsors, 0)) +
               0.2 * ln(1 + coalesce(bs.total_bills, 0)))
              / cm.max_raw
            ) * 20.0
          )
      end as score,
      (bs.total_bills is not null) as has_data
    from senators s
    left join bill_stats bs on bs.senator_id = s.id
    cross join chamber_max cm
    where s.is_active
  ),

  -- 3) Attendance (Pillar 5)
  att_latest as (
    select distinct on (sa.senator_id)
      sa.senator_id,
      sa.missed_votes_pct,
      sa.speeches_count
    from senator_attendance sa
    where sa.week_of <= target_week
    order by sa.senator_id, sa.week_of desc
  ),
  speech_median as (
    select percentile_cont(0.5) within group (order by speeches_count) as median_speeches
    from att_latest
  ),
  pillar5 as (
    select
      s.id as senator_id,
      case
        when al.missed_votes_pct is null then 0
        else
          greatest(
            0,
            least(
              20.0,
              (12.0 * (1.0 - al.missed_votes_pct / 100.0)) +
              case
                when al.speeches_count >= 0 then
                  case
                    when al.speeches_count >= sm.median_speeches * 1.5 then 8
                    when al.speeches_count >= sm.median_speeches * 0.75 then 6
                    when al.speeches_count >= sm.median_speeches * 0.25 then 4
                    when al.speeches_count > 0 then 2
                    else 0
                  end
                else 0
              end
            )
          )
      end as score,
      (al.missed_votes_pct is not null) as has_data
    from senators s
    left join att_latest al on al.senator_id = s.id
    cross join speech_median sm
    where s.is_active
  ),

  -- 4) Constituency (Pillar 1) — Phase 2 placeholder
  pillar1 as (
    select
      s.id as senator_id,
      0::numeric as score,
      exists(
        select 1 from senator_votes sv
        where sv.senator_id = s.id
          and sv.state_poll_pct_supporting is not null
      ) as has_data
    from senators s
    where s.is_active
  ),

  -- 5) Lobbying (Pillar 3) — Phase 2 placeholder
  pillar3 as (
    select
      s.id as senator_id,
      case
        when not exists(select 1 from lobbyist_trips lt where lt.senator_id = s.id) then 0::numeric
        when sum(lt.estimated_cost) < 1000 then 20
        when sum(lt.estimated_cost) < 5000 then 16
        when sum(lt.estimated_cost) < 15000 then 12
        when sum(lt.estimated_cost) < 50000 then 8
        when sum(lt.estimated_cost) < 100000 then 4
        else 0
      end as score,
      exists(select 1 from lobbyist_trips lt where lt.senator_id = s.id) as has_data
    from senators s
    where s.is_active
    group by s.id
  )

  -- Upsert
  insert into senator_scores (
    senator_id, week_of,
    pillar_constituency, pillar_stocks, pillar_lobbying,
    pillar_productivity, pillar_attendance,
    has_constituency_data, has_stocks_data, has_lobbying_data,
    has_productivity_data, has_attendance_data,
    scoring_version
  )
  select
    s.id, target_week,
    p1.score, p2.score, p3.score, p4.score, p5.score,
    p1.has_data, p2.has_data, p3.has_data, p4.has_data, p5.has_data,
    version
  from senators s
  join pillar1 p1 on p1.senator_id = s.id
  join pillar2 p2 on p2.senator_id = s.id
  join pillar3 p3 on p3.senator_id = s.id
  join pillar4 p4 on p4.senator_id = s.id
  join pillar5 p5 on p5.senator_id = s.id
  where s.is_active
  on conflict (senator_id, week_of) do update set
    pillar_constituency   = excluded.pillar_constituency,
    pillar_stocks         = excluded.pillar_stocks,
    pillar_lobbying       = excluded.pillar_lobbying,
    pillar_productivity   = excluded.pillar_productivity,
    pillar_attendance     = excluded.pillar_attendance,
    has_constituency_data = excluded.has_constituency_data,
    has_stocks_data       = excluded.has_stocks_data,
    has_lobbying_data     = excluded.has_lobbying_data,
    has_productivity_data = excluded.has_productivity_data,
    has_attendance_data   = excluded.has_attendance_data,
    scoring_version       = excluded.scoring_version,
    computed_at           = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- 9. get_score_leaderboard() — landing-page table data
-- =============================================================================
create or replace function get_score_leaderboard(target_week date default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_week date;
  v_result jsonb;
begin
  -- Default to the most recent computed week
  select max(week_of) into v_week from senator_scores;
  if v_week is null then
    return jsonb_build_object('week', null, 'senators', '[]'::jsonb);
  end if;
  if target_week is not null then v_week := target_week; end if;

  select jsonb_build_object(
    'week', v_week,
    'senators', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sen.id,
        'name_slug', sen.name_slug,
        'full_name', sen.full_name,
        'state', sen.state,
        'party', sen.party,
        'photo_url', sen.photo_url,
        'total_score', ss.total_score,
        'grade', ss.grade,
        'pillar_stocks', ss.pillar_stocks,
        'pillar_productivity', ss.pillar_productivity,
        'pillar_attendance', ss.pillar_attendance,
        'pillar_constituency', ss.pillar_constituency,
        'pillar_lobbying', ss.pillar_lobbying,
        'data_coverage_pct', ss.data_coverage_pct
      ) order by ss.total_score desc, sen.full_name asc
    ), '[]'::jsonb)
  )
  into v_result
  from senator_scores ss
  join senators sen on sen.id = ss.senator_id
  where ss.week_of = v_week
    and sen.is_active = true;

  return v_result;
end;
$$;

-- =============================================================================
-- 10. get_senator_report_card() — per-senator page data
-- =============================================================================
create or replace function get_senator_report_card(p_slug text)
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'senator', jsonb_build_object(
      'id', sen.id,
      'name_slug', sen.name_slug,
      'full_name', sen.full_name,
      'state', sen.state,
      'party', sen.party,
      'photo_url', sen.photo_url,
      'term_start', sen.term_start,
      'committees', sen.committees
    ),
    'score', jsonb_build_object(
      'week_of', ss.week_of,
      'total', ss.total_score,
      'grade', ss.grade,
      'pillar_constituency', ss.pillar_constituency,
      'pillar_stocks', ss.pillar_stocks,
      'pillar_lobbying', ss.pillar_lobbying,
      'pillar_productivity', ss.pillar_productivity,
      'pillar_attendance', ss.pillar_attendance,
      'data_coverage_pct', ss.data_coverage_pct,
      'has_constituency_data', ss.has_constituency_data,
      'has_stocks_data', ss.has_stocks_data,
      'has_lobbying_data', ss.has_lobbying_data,
      'has_productivity_data', ss.has_productivity_data,
      'has_attendance_data', ss.has_attendance_data,
      'scoring_version', ss.scoring_version
    ),
    'top_conflicts', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'transaction_date', st.transaction_date,
          'ticker', st.ticker,
          'asset_description', st.asset_description,
          'transaction_type', st.transaction_type,
          'amount_low', st.amount_low,
          'amount_high', st.amount_high,
          'committee_overlap_sectors', st.committee_overlap_sectors
        ) order by st.transaction_date desc
      ), '[]'::jsonb)
      from senator_trades st
      where st.senator_id = sen.id and st.conflict_flag = true
      limit 5
    )
  )
  into v_result
  from senators sen
  left join senator_scores ss on ss.senator_id = sen.id
    and ss.week_of = (select max(week_of) from senator_scores where senator_id = sen.id)
  where sen.name_slug = p_slug;

  return v_result;
end;
$$;

-- =============================================================================
-- Comments for future maintainers
-- =============================================================================
comment on table senators is 'Canonical Senate roster. Sourced from Bioguide + unitedstates/congress-legislators.';
comment on table senator_scores is 'Weekly grade snapshots. Generated by compute_scores(). Never edit by hand.';
comment on column senator_scores.scoring_version is 'Stamp of the rubric version used. Used to reproduce any historical grade.';
comment on function compute_scores is 'Recompute all senator grades for a given week. Pure function of inputs + scoring_version.';
