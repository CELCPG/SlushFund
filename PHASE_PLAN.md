# SlushFund 2020 Backfill — Phase Plan
**Project:** slushfund.net — expand data from FY2024-26 → FY2019-2026 (7 FYs)
**Created:** 2026-05-21
**Owner:** Apex (coordinating Sage, Forge, Echo, Hunter)
**Status:** Phase 1–5 COMPLETE — Awaiting Batch 3 (backfill)

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

## ✅ Phase 1: Foundation (Schema + Sync + Entities)
**Status:** COMPLETE — committed + deployed
**Commit:** `d567428` (2026-05-21)

- [x] schema.sql — era_snapshots + covid_spending_summary tables, new indexes, date floors removed from views
- [x] types.ts — pandemic_emergency/covid_inflated/ppp_related flags, Era type, ERA_FYS, ALL_FYS
- [x] sync.ts — FY_DATE_RANGES (2019-2026), detectEra(), isPPPRelated(), era tagging on awards, fullBackfill(fys?)
- [x] political-entities.ts — 11 new entities (COVID suppliers, Affinity/Kushner, America First Legal, PPP lenders)

## ✅ Phase 2: API Layer
**Status:** COMPLETE — committed + deployed
**Commit:** `d567428`

- [x] POST /api/backfill — isolated FY backfill trigger
- [x] GET /api/era-stats?era=X&fy=Y — era-aware stats
- [x] GET /api/covid-stats — COVID breakdown by agency/vendor/quarter
- [x] GET /api/alerts — era + fy filtering added

---

## ✅ Phase 3: UI — Era System
**Status:** COMPLETE — committed + deployed
**Commit:** `0b1a008` (2026-05-21)

- [x] EraToggle.tsx — reusable era selector (All/T1/COVID/Biden/T2)
- [x] LiveStatsBand — era-aware stat fetching via /api/era-stats
- [x] home-stats.ts — getHomeStats(era?) with era date range filtering
- [x] dashboard — era filter in filter bar + ?era= URL param

## ✅ Phase 4: UI — COVID Dashboard
**Status:** COMPLETE — committed + deployed
**Commit:** `0b1a008`

- [x] /covid page — COVID deep dive, quarterly timeline, no-bid stats, agency breakdown, top 20 vendors
- [x] TimelineChart.tsx — CSS-only bar chart (no chart library)
- [x] Navbar — /covid link

## ✅ Phase 5: UI — Compare Page
**Status:** COMPLETE — committed + deployed
**Commit:** `0b1a008`

- [x] /compare page — era comparison cards, key findings, entity trend table
- [x] Navbar — /compare link

---

## 🔜 Phase 6: Data Backfill
**Status:** PENDING — run locally, one FY at a time

Run via CLI from ~/Documents/Apex/BRANDS/government-spending-tracker/:

```bash
# Each FY runs separately. Monitor in Supabase after each run.
npx ts-node src/scripts/sync-cli.ts --full  # defaults to FY2024-2026

# To backfill specific FYs:
npx ts-node -e "
import { fullBackfill } from './src/lib/sync';
fullBackfill([2023]).then(r => console.log('FY2023 done', JSON.stringify(r)));
"

# Or via API (one FY at a time, check /api/backfill after each):
curl -X POST https://slushfund.net/api/backfill -H "Content-Type: application/json" -d '{"fys": [2023]}'
```

**Recommended backfill order:**

| Order | FY | Est. Awards | Est. Time | Notes |
|---|---|---|---|---|
| 1st | FY2023 | 18K–30K | 2–3 hrs | Smallest post-COVID year |
| 2nd | FY2022 | 20K–35K | 2–3 hrs | IRA starts |
| 3rd | FY2020 | 25K–40K | 2–3 hrs | COVID begins |
| 4th | FY2019 | 12K–18K | 1–2 hrs | Baseline |
| 5th | FY2021 | 40K–70K | 4–6 hrs | COVID peak — last |

**After each FY backfill:**
1. Check Supabase `awards` table row count
2. Spot-check a few awards: `select award_id, recipient_name, dollar_amount, posted_date from awards order by random() limit 5;`
3. Verify COVID flagging: `select count(*) from awards where 'covid_related' = any(flags);`
4. Commit a snapshot of era_snapshots if data looks good

## 🔜 Phase 7: QA
**Status:** PENDING**

- [ ] Spot-check awards from each new FY
- [ ] Verify COVID flagging is working (covid_obligations > 0 → covid_related flag)
- [ ] Test Biden/Trump era filtering on dashboard
- [ ] Test /compare page with real data
- [ ] Test /covid page — quarterly timeline should populate
- [ ] Confirm no duplicate awards (award_id uniqueness)
- [ ] Verify political entity matching for COVID-era entities

---

## Entity Additions

### COVID-Specific (Priority 1) ✅ Done
| Entity | Connection | Notes |
|---|---|---|
| McKesson | none | Largest COVID medical supply contractor |
| Puritan Products | none | GAO flagged no-bid PPE |
| Medline Industries | none | GAO flagged inflated COVID prices |
| Cardinal Health | none | COVID medical supply |
| HCA Healthcare | gop_donor | COVID provider relief funds |
| Change Healthcare | none | $400M+ COVID loan, later breached |

### Kushner/Affinity ✅ Done
| Entity | Connection | Notes |
|---|---|---|
| Affinity Partners | trump_family | $2B Saudi PIF seed, $6.1B AUM |
| Jared Kushner | trump_family | Runs Affinity, exempt from disclosure |

### Biden-Era ✅ Done
| Entity | Connection | Notes |
|---|---|---|
| America First Legal | trump_ally | Trump litigation org against Biden |

### PPP Lenders ✅ Done
| Entity | Connection | Notes |
|---|---|---|
| Cross River Bank | none | $3B+ PPP processed |

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

_Last updated: 2026-05-21 11:58 EDT_