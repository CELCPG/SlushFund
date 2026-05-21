# SlushFund 2020 Backfill — Phase Plan
**Project:** slushfund.net — expand data from FY2024-26 → FY2019-2026 (7 FYs)
**Created:** 2026-05-21
**Owner:** Apex (main session)
**Status:** Batch 1 in progress

---

## Background

SlushFund currently covers FY2024–FY2026 (Oct 2023–present). This update adds FY2019–FY2023, enabling Biden-era contrast, COVID deep-dive, and 7-year trend analysis.

**Scope:** 7 fiscal years, ~100,000–200,000 awards estimated
**Era structure:** Trump 1.0 (FY2019) | COVID (FY2020-21) | Biden (FY2022-24) | Trump 2.0 (FY2025-26)

---

## Era Definitions

```typescript
const ERAS = {
  trump_1:  { fy: [2019],                        label: 'Trump 1.0',      shortLabel: 'T1' },
  covid:    { fy: [2020, 2021],                  label: 'COVID Era',       shortLabel: 'COVID' },
  biden:    { fy: [2022, 2023, 2024],             label: 'Biden',           shortLabel: 'BIDEN' },
  trump_2:  { fy: [2025, 2026],                  label: 'Trump 2.0 + DOGE', shortLabel: 'T2' },
};
const ALL_FYS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
```

---

## Phase Structure

### Batch 1: Foundation (Schema + Sync + Entities)
**Prerequisite for all other phases.**

- [ ] Phase 1a: schema.sql — new indexes, updated views, new tables
- [ ] Phase 1b: political-entities.ts — COVID + Biden-era entities added
- [ ] Phase 1c: types.ts + sync.ts — new flags, FY2019-2023 constants, era detection

### Batch 2: API Layer
**Prerequisite for all UI phases.**

- [ ] Phase 2a: /api/backfill endpoint (isolated, long-running)
- [ ] Phase 2b: /api/era-stats + /api/covid-stats endpoints
- [ ] Phase 2c: /api/alerts updated with era filter

### Batch 3: UI — Era System
- [ ] Phase 3a: Era toggle on LiveStatsBand (homepage)
- [ ] Phase 3b: Era filter on dashboard
- [ ] Phase 3c: home-stats.ts updated for era-aware queries

### Batch 4: UI — COVID Dashboard
- [ ] Phase 4a: /covid page with timeline chart
- [ ] Phase 4b: COVID contracts table + top COVID contractors
- [ ] Phase 4c: Biden vs Trump COVID comparison

### Batch 5: UI — Compare Page
- [ ] Phase 5a: /compare page — side-by-side era stats
- [ ] Phase 5b: Per-entity trend lines (SpaceX, Palantir, etc. over 7 years)

### Batch 6: Data Backfill
**Run locally, one FY at a time. Monitor in Supabase after each.**

- [ ] Phase 6a: FY2023 backfill (pilot — smallest post-COVID year)
- [ ] Phase 6b: FY2022 backfill
- [ ] Phase 6c: FY2020 backfill
- [ ] Phase 6d: FY2019 backfill
- [ ] Phase 6e: FY2021 backfill (COVID peak — save for last, largest)

### Batch 7: QA
- [ ] Phase 7a: Spot-check awards from each new FY
- [ ] Phase 7b: Verify COVID flagging
- [ ] Phase 7c: Test Biden/Trump era filtering
- [ ] Phase 7d: Test compare page with real data
- [ ] Phase 7e: Confirm no duplicate awards

---

## Entity Additions

### COVID-Specific (Priority 1)
| Entity | Connection | Notes |
|---|---|---|
| McKesson | none | Largest COVID medical supply contractor |
| Puritan Products | none | GAO flagged no-bid PPE |
| Medline Industries | none | GAO flagged inflated COVID prices |
| Cardinal Health | none | COVID medical supply |
| HCA Healthcare | gop_donor | COVID provider relief funds |

### Biden-Era (Priority 1)
| Entity | Connection | Notes |
|---|---|---|
| America First Legal | trump_ally | Trump org litigation against Biden |
| Change Healthcare | none | $400M+ COVID loan, later breached |

### Kushner/Affinity (Priority 0 — was missing)
| Entity | Connection | Notes |
|---|---|---|
| Affinity Partners | trump_family | $2B Saudi PIF seed, $6.1B AUM, 99% foreign |
| Jared Kushner | trump_family | Runs Affinity — exempt from disclosure |

### New Flags to Add
```typescript
type StructuralFlag = 'covid_related' | 'infrastructure' | 'emergency' | 'pass_through' | 'pandemic_emergency' | 'covid_inflated' | 'ppp_related';
```

---

## New Schema Objects

### Updated Views (remove hardcoded date floors)
- `agency_spending_summary` — remove `posted_date >= '2024-10-01'`
- `top_vendors` — remove `posted_date >= '2024-10-01'`
- `monthly_spending_trend` — already ok (no floor)

### New Tables
```sql
-- Era snapshots (pre-computed for fast homepage stats)
create table era_snapshots (
  era text primary key,
  total_awards int,
  total_dollars bigint,
  connected_dollars bigint,
  flagged_count int,
  no_bid_count int,
  no_bid_dollars bigint,
  computed_at timestamptz default now()
);

-- COVID summary (denormalized)
create table covid_spending_summary (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int,
  quarter text,
  agency text,
  agency_code text,
  total_covid_obligations bigint,
  total_covid_outlays bigint,
  covid_contract_count int,
  covid_no_bid_count int,
  covid_no_bid_dollars bigint,
  top_vendor text,
  top_vendor_dollars bigint,
  updated_at timestamptz default now()
);
```

### New Indexes
```sql
create index if not exists awards_fy_idx on awards(date_trunc('year', posted_date));
create index if not exists awards_covid_idx on awards(covid_obligations) where covid_obligations > 0;
```

---

## FY Date Ranges

```typescript
const FY = {
  2019: { start: '2018-10-01', end: '2019-09-30' },
  2020: { start: '2019-10-01', end: '2020-09-30' },
  2021: { start: '2020-10-01', end: '2021-09-30' },
  2022: { start: '2021-10-01', end: '2022-09-30' },
  2023: { start: '2022-10-01', end: '2023-09-30' },
  2024: { start: '2023-10-01', end: '2024-09-30' },
  2025: { start: '2024-10-01', end: '2025-09-30' },
  2026: { start: '2025-10-01', end: '2026-05-21' },
};
```

---

## Backfill Sequencing

| Order | FY | Est. Awards | Est. Pages | Est. Time |
|---|---|---|---|---|
| 1st | FY2023 | 18K–30K | ~250–330 | 2–3 hrs |
| 2nd | FY2022 | 20K–35K | ~250–400 | 2–3 hrs |
| 3rd | FY2020 | 25K–40K | ~300–450 | 2–3 hrs |
| 4th | FY2019 | 12K–18K | ~180–220 | 1–2 hrs |
| 5th | FY2021 | 40K–70K | ~500–750 | 4–6 hrs |

---

## File Ownership

| File | Owner |
|---|---|
| schema.sql, sync.ts, usaspending.ts | Forge |
| political-entities.ts, sources.ts | Sage |
| types.ts | Forge |
| API routes (/api/*) | Forge |
| Homepage + LiveStatsBand | Hunter |
| Dashboard | Hunter |
| /covid page | Echo |
| /compare page | Echo |

---

_Last updated: 2026-05-21 11:44 EDT_