#!/usr/bin/env python3
"""
Load federal prime CONTRACT awards from USAspending.gov under one documented,
objective selection rule, plus per-agency denominators (R5, 2026-10-03).

Replaces scripts/sync-awards.ts, /api/sync and /api/backfill. Those kept only a
hand-picked "notable" sample (political-connection match, risk score, ...), so every
total computed from them described the sample, not federal spending.

RULE r5-v1. A row is loaded if, and only if, ALL of these hold:
  * it is a prime contract award: USAspending award type A (BPA call), B (purchase
    order), C (delivery order) or D (definitive contract). No IDVs, grants or loans;
  * its base award date (date signed, `award_base_action_date`) falls in a loaded
    federal fiscal year (FY = Oct 1 - Sep 30);
  * EITHER its extent-competed code is a non-competed code (B "not available for
    competition", C "not competed", G "not competed under SAP", NDO "non-competitive
    delivery order": the FPDS competition-report definition) AND its total obligated
    amount is >= $1,000,000,
    OR its total obligated amount is >= $10,000,000, whatever the competition code.
Amounts are USAspending's `total_obligated_amount` for the award (all actions to date).
The rule is applied twice: as USAspending API filters, and again here on every row
(`rule_reasons`), so a row the API returns that does not meet the rule is not loaded.
Political-connection tags are NEVER an input: the loader does not write the connection
columns; a separate, later step fills them.

Commands (run from the repo root; PowerShell: $env:PYTHONIOENCODING='utf-8'):
  python src/scripts/load_awards.py estimate --fy 2026     # row counts for the rule, no writes
  python src/scripts/load_awards.py load --fy 2026 [--prune]
  python src/scripts/load_awards.py incremental [--days 7] [--min-fy auto]
  python src/scripts/load_awards.py summary --fy 2026      # per-agency denominators
  python src/scripts/load_awards.py verify --fy 2026 [--n 30] [--seed 2026]

Source: https://api.usaspending.gov (public domain, U.S. Treasury). Award downloads via
/api/v2/download/awards/ (the Advanced Search download), counts via
/api/v2/search/spending_by_award_count/, denominators via
/api/v2/search/spending_by_category/awarding_agency/.
"""

import argparse
import csv
import datetime as dt
import io
import json
import os
import random
import sys
import tempfile
import time
import zipfile
from decimal import Decimal, InvalidOperation

from _venv import activate as _activate_venv
_activate_venv()

import requests  # noqa: E402

# ─── Rule ──────────────────────────────────────────────────────────────────────
RULE_VERSION = "r5-v1"
CONTRACT_TYPES = ["A", "B", "C", "D"]
NONCOMPETED_CODES = ["B", "C", "G", "NDO"]
COMPETED_CODES = ["A", "D", "E", "F", "CDO"]
NONCOMPETED_MIN = Decimal("1000000")
ANY_MIN = Decimal("10000000")
CLAUSES = {
    "noncompeted_ge_1m": {"award_amounts": [{"lower_bound": float(NONCOMPETED_MIN)}],
                          "extent_competed_type_codes": NONCOMPETED_CODES},
    "any_ge_10m": {"award_amounts": [{"lower_bound": float(ANY_MIN)}]},
}

API = "https://api.usaspending.gov/api/v2"
UA = "slushfund-awards-loader/2.0 (public-records research)"
MIN_INTERVAL = 1.1          # seconds between requests to api.usaspending.gov
BATCH = 500                 # rows per upsert
CACHE_DIR = os.environ.get("SLUSHFUND_AWARDS_CACHE",
                           os.path.join(tempfile.gettempdir(), "slushfund-awards-cache"))

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Columns requested from the award download (contract prime award summaries).
DOWNLOAD_COLUMNS = [
    "contract_award_unique_key", "award_id_piid", "parent_award_agency_id", "parent_award_id_piid",
    "total_obligated_amount", "total_outlayed_amount", "current_total_value_of_award",
    "potential_total_value_of_award", "award_base_action_date", "award_base_action_date_fiscal_year",
    "award_latest_action_date", "period_of_performance_start_date",
    "period_of_performance_current_end_date", "awarding_agency_code", "awarding_agency_name",
    "awarding_sub_agency_code", "awarding_sub_agency_name", "awarding_office_code",
    "awarding_office_name", "funding_agency_code", "funding_agency_name", "funding_sub_agency_name",
    "recipient_uei", "recipient_duns", "recipient_name", "recipient_name_raw",
    "recipient_parent_uei", "recipient_parent_name", "recipient_city_name", "recipient_state_code",
    "recipient_country_code", "primary_place_of_performance_city_name",
    "primary_place_of_performance_state_code", "primary_place_of_performance_country_code",
    "award_type_code", "award_type", "prime_award_base_transaction_description",
    "product_or_service_code", "product_or_service_code_description", "naics_code",
    "naics_description", "extent_competed_code", "extent_competed", "solicitation_procedures_code",
    "solicitation_procedures", "type_of_set_aside_code", "type_of_set_aside",
    "fair_opportunity_limited_sources_code", "fair_opportunity_limited_sources",
    "other_than_full_and_open_competition_code", "other_than_full_and_open_competition",
    "number_of_offers_received", "obligated_amount_from_COVID-19_supplementals",
    "outlayed_amount_from_COVID-19_supplementals", "obligated_amount_from_IIJA_supplemental",
    "outlayed_amount_from_IIJA_supplemental", "usaspending_permalink", "last_modified_date",
]

csv.field_size_limit(10_000_000)
FRESH = [False]             # --fresh: ignore cached downloads

# DoD publishes contract actions to FPDS/USAspending 90 days after the action.
REPORTING_LAG_DAYS = {"097": 90, "ALL": 90}


# ─── HTTP (polite: <= 1 request/second, retries on 429/5xx) ────────────────────
_S = requests.Session()
_S.headers["User-Agent"] = UA
_last = [0.0]


def _wait():
    gap = time.monotonic() - _last[0]
    if gap < MIN_INTERVAL:
        time.sleep(MIN_INTERVAL - gap)
    _last[0] = time.monotonic()


def http(method, url, tries=6, **kw):
    kw.setdefault("timeout", 180)
    for attempt in range(tries):
        _wait()
        try:
            r = _S.request(method, url, **kw)
        except requests.RequestException as e:
            err = str(e)
        else:
            if r.status_code < 400:
                return r
            err = f"HTTP {r.status_code}: {r.text[:200]}"
            if r.status_code < 500 and r.status_code != 429:
                raise RuntimeError(f"{method} {url} -> {err}")
        time.sleep(min(60, 3 * 2 ** attempt))
        print(f"  retry {attempt + 1}/{tries - 1} after: {err}", flush=True)
    raise RuntimeError(f"{method} {url} failed after {tries} tries: {err}")


def api_post(path, body):
    return http("POST", API + path, json=body).json()


def api_get(path, **params):
    return http("GET", API + path, params=params).json()


# ─── Dates / numbers ───────────────────────────────────────────────────────────
def fy_window(fy):
    """(start, end) of federal fiscal year `fy`, end clipped to today."""
    start = dt.date(fy - 1, 10, 1)
    end = min(dt.date(fy, 9, 30), dt.date.today())
    return start.isoformat(), end.isoformat()


def fiscal_year_of(date_str):
    d = dt.date.fromisoformat(date_str[:10])
    return d.year + 1 if d.month >= 10 else d.year


def dec(v):
    if v is None or v == "":
        return None
    try:
        return Decimal(v)
    except InvalidOperation:
        return None


def money(v):
    """Decimal -> JSON-safe string with cents (PostgREST casts it to numeric)."""
    return None if v is None else str(v.quantize(Decimal("0.01")))


def whole(v):
    return None if v is None else int(v.to_integral_value())


def blank(v):
    v = (v or "").strip()
    return v or None


# ─── Supabase (service role; RLS stays on, the key bypasses it) ───────────────
_sb = [None]


def sb():
    if _sb[0] is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            sys.exit("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (.env.local)")
        from supabase import create_client
        _sb[0] = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _sb[0]


def log_start(sync_type, start, end):
    try:
        res = sb().table("sync_log").insert({"sync_type": sync_type, "start_date": start,
                                             "end_date": end, "status": "running"}).execute()
        return res.data[0]["id"]
    except Exception as e:  # logging must never stop a load
        print(f"  (sync_log insert failed: {e})")
        return None


def log_end(log_id, status, synced, errors, t0, pages=0):
    if not log_id:
        return
    try:
        sb().table("sync_log").update({
            "status": status, "records_synced": synced, "pages_processed": pages,
            "errors": errors[:20], "duration_ms": int((time.time() - t0) * 1000),
            "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }).eq("id", log_id).execute()
    except Exception as e:
        print(f"  (sync_log update failed: {e})")


# ─── Award download ────────────────────────────────────────────────────────────
def download(filters, label, max_age_h=20):
    """Request an Advanced Search award download, wait for it, return the contract
    prime-award-summary rows. The zip is cached so a retry does not re-request it."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    tag = label.replace(" ", "_").replace("/", "-")
    path = os.path.join(CACHE_DIR, f"{tag}.zip")
    if (not FRESH[0] and os.path.exists(path)
            and time.time() - os.path.getmtime(path) < max_age_h * 3600):
        print(f"  {label}: using cached download {path}")
    else:
        body = {"filters": filters, "columns": DOWNLOAD_COLUMNS, "file_format": "csv"}
        req = api_post("/download/awards/", body)
        name = req["file_name"]
        print(f"  {label}: requested {name}", flush=True)
        t0 = time.time()
        while True:
            time.sleep(4)
            st = api_get("/download/status/", file_name=name)
            if st.get("status") == "finished":
                break
            if st.get("status") == "failed":
                raise RuntimeError(f"download {name} failed: {st.get('message')}")
            if time.time() - t0 > 3600:
                raise RuntimeError(f"download {name} not ready after 60 min")
        print(f"  {label}: ready, {st.get('total_rows')} rows incl. subawards, "
              f"{st.get('seconds_elapsed')} s", flush=True)
        blob = http("GET", st["file_url"], timeout=600).content
        with open(path + ".part", "wb") as f:
            f.write(blob)
        os.replace(path + ".part", path)
    rows = []
    with zipfile.ZipFile(path) as zf:
        for n in zf.namelist():
            if "Contracts_PrimeAwardSummaries" in n:
                with zf.open(n) as fh:
                    rows.extend(csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig")))
    print(f"  {label}: {len(rows)} prime contract award rows")
    return rows


def rule_reasons(r):
    obl = dec(r.get("total_obligated_amount")) or Decimal(0)
    reasons = []
    if (r.get("extent_competed_code") or "").strip() in NONCOMPETED_CODES and obl >= NONCOMPETED_MIN:
        reasons.append("noncompeted_ge_1m")
    if obl >= ANY_MIN:
        reasons.append("any_ge_10m")
    if (r.get("award_type_code") or "").strip() not in CONTRACT_TYPES:
        return []
    return reasons


def competition_status(code):
    """Display label derived ONLY from the official extent-competed code."""
    if code in NONCOMPETED_CODES:
        return "not_competed"                      # R6e (A7b F4): the agency's own coding, not "no_bid"
    if code in ("A", "CDO"):
        return "open_competition"
    if code in ("D", "E", "F"):
        return "limited_competition"
    return "unknown"


def place(*parts):
    s = ", ".join(p for p in (blank(x) for x in parts) if p)
    return s or None


def to_row(r, reasons, seen_at):
    key = r["contract_award_unique_key"].strip()
    base = blank(r.get("award_base_action_date"))
    obl = dec(r.get("total_obligated_amount")) or Decimal(0)
    ec = blank(r.get("extent_competed_code"))
    covid_o, covid_out = dec(r.get("obligated_amount_from_COVID-19_supplementals")), dec(r.get("outlayed_amount_from_COVID-19_supplementals"))
    iija_o, iija_out = dec(r.get("obligated_amount_from_IIJA_supplemental")), dec(r.get("outlayed_amount_from_IIJA_supplemental"))
    comp_flags = []
    if ec in NONCOMPETED_CODES:
        comp_flags.append("not_competed")
    if blank(r.get("solicitation_procedures_code")) == "SSS":
        comp_flags.append("sole_source")
    struct_flags = []
    if covid_o and covid_o > 0:
        struct_flags.append("covid_related")
    if iija_o and iija_o > 0:
        struct_flags.append("infrastructure")
    offers = blank(r.get("number_of_offers_received"))
    lm = blank(r.get("last_modified_date"))
    fy = blank(r.get("award_base_action_date_fiscal_year"))
    return {
        "id": key,
        "generated_unique_award_id": key,
        "award_id": blank(r.get("award_id_piid")) or key,
        "piid": blank(r.get("award_id_piid")),
        "parent_award_piid": blank(r.get("parent_award_id_piid")),
        "parent_award_agency_code": blank(r.get("parent_award_agency_id")),
        "recipient_name": blank(r.get("recipient_name")) or blank(r.get("recipient_name_raw")) or "UNKNOWN",
        "recipient_uei": blank(r.get("recipient_uei")),
        "recipient_duns": blank(r.get("recipient_duns")),
        "recipient_parent_name": blank(r.get("recipient_parent_name")),
        "recipient_parent_uei": blank(r.get("recipient_parent_uei")),
        "recipient_location": place(r.get("recipient_city_name"), r.get("recipient_state_code"), r.get("recipient_country_code")),
        "dollar_amount": whole(obl),
        "obligated_amount": money(obl),
        "total_outlays": whole(dec(r.get("total_outlayed_amount"))),
        "base_exercised_options_value": money(dec(r.get("current_total_value_of_award"))),
        "base_all_options_value": money(dec(r.get("potential_total_value_of_award"))),
        "description": blank(r.get("prime_award_base_transaction_description")),
        "awarding_agency": blank(r.get("awarding_agency_name")) or "UNKNOWN",
        "awarding_agency_code": blank(r.get("awarding_agency_code")),
        "awarding_sub_agency": blank(r.get("awarding_sub_agency_name")),
        "awarding_sub_agency_code": blank(r.get("awarding_sub_agency_code")),
        "awarding_office_code": blank(r.get("awarding_office_code")),
        "awarding_office_name": blank(r.get("awarding_office_name")),
        "funding_agency": blank(r.get("funding_agency_name")),
        "funding_agency_code": blank(r.get("funding_agency_code")),
        "funding_sub_agency": blank(r.get("funding_sub_agency_name")),
        "award_category": "contract",
        "contract_type": blank(r.get("award_type_code")),
        "award_type": blank(r.get("award_type")),
        "competition_status": competition_status(ec),
        "extent_competed": blank(r.get("extent_competed")),
        "extent_competed_code": ec,
        "solicitation_procedures": blank(r.get("solicitation_procedures")),
        "solicitation_procedures_code": blank(r.get("solicitation_procedures_code")),
        "other_than_full_open": blank(r.get("other_than_full_and_open_competition")),
        "other_than_full_open_code": blank(r.get("other_than_full_and_open_competition_code")),
        "fair_opportunity_limited": blank(r.get("fair_opportunity_limited_sources")),
        "fair_opportunity_limited_code": blank(r.get("fair_opportunity_limited_sources_code")),
        "number_of_offers": int(offers) if offers and offers.isdigit() else None,
        "set_aside": blank(r.get("type_of_set_aside")),
        "set_aside_code": blank(r.get("type_of_set_aside_code")),
        "naics_code": blank(r.get("naics_code")),
        "naics_description": blank(r.get("naics_description")),
        "psc_code": blank(r.get("product_or_service_code")),
        "psc_description": blank(r.get("product_or_service_code_description")),
        "posted_date": base,
        "base_obligation_date": base,
        "latest_action_date": blank(r.get("award_latest_action_date")),
        "last_modified_date": lm[:10] if lm else None,
        "source_last_modified": lm,
        "performance_start": blank(r.get("period_of_performance_start_date")),
        "performance_end": blank(r.get("period_of_performance_current_end_date")),
        "pop_state": blank(r.get("primary_place_of_performance_state_code")),
        "pop_country": blank(r.get("primary_place_of_performance_country_code")),
        "pop_city": blank(r.get("primary_place_of_performance_city_name")),
        "primary_place_of_performance": place(r.get("primary_place_of_performance_city_name"),
                                              r.get("primary_place_of_performance_state_code"),
                                              r.get("primary_place_of_performance_country_code")),
        "flags": comp_flags + struct_flags,
        "competition_flags": comp_flags,
        "structural_flags": struct_flags,
        "covid_obligations": whole(covid_o),
        "covid_outlays": whole(covid_out),
        "infrastructure_obligations": whole(iija_o),
        "infrastructure_outlays": whole(iija_out),
        "usaspending_url": blank(r.get("usaspending_permalink")) or f"https://www.usaspending.gov/award/{key}/",
        "fpds_url": None,
        "source": "usaspending_download",
        "fiscal_year": int(fy) if fy and fy.isdigit() else (fiscal_year_of(base) if base else None),
        "selection_rule": RULE_VERSION,
        "rule_reasons": reasons,
        "last_seen_at": seen_at,
        "updated_at": seen_at,
    }


def collect(windows, date_type, min_fy=None, max_fy=None):
    """Download every rule clause for each (start, end) window and return the rows
    that meet the rule, keyed by generated unique award id, plus counters."""
    out, stats = {}, {"api_rows": 0, "not_in_rule": 0, "outside_fy": 0, "no_key": 0}
    for start, end in windows:
        for clause, extra in CLAUSES.items():
            filters = {"award_type_codes": CONTRACT_TYPES,
                       "time_period": [{"start_date": start, "end_date": end, "date_type": date_type}],
                       **extra}
            rows = download(filters, f"{date_type}_{start}_{end}_{clause}")
            for r in rows:
                stats["api_rows"] += 1
                key = (r.get("contract_award_unique_key") or "").strip()
                if not key:
                    stats["no_key"] += 1
                    continue
                reasons = rule_reasons(r)
                if not reasons:
                    stats["not_in_rule"] += 1
                    continue
                base = blank(r.get("award_base_action_date"))
                fy = fiscal_year_of(base) if base else None
                if fy is None or (min_fy and fy < min_fy) or (max_fy and fy > max_fy):
                    stats["outside_fy"] += 1
                    continue
                out[key] = (r, reasons)
    return out, stats


def refresh_summary():
    """R6e (A7b F10): agency_spending_summary is a materialized view; refresh it after every awards change."""
    try:
        sb().rpc("refresh_agency_spending_summary").execute()
        print("  agency_spending_summary refreshed", flush=True)
    except Exception as e:
        print(f"  WARNING: agency_spending_summary NOT refreshed ({str(e)[:200]}); run: select refresh_agency_spending_summary();", flush=True)


def upsert(rows):
    """Batched upsert on the primary key (= USAspending generated unique award id)."""
    done, errors = 0, []
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        for attempt in range(4):
            try:
                sb().table("awards").upsert(chunk, on_conflict="id").execute()
                done += len(chunk)
                break
            except Exception as e:
                msg = str(e)[:300]
                if attempt == 3:
                    errors.append(f"batch {i // BATCH}: {msg}")
                    print(f"  upsert batch {i // BATCH} FAILED: {msg}", flush=True)
                else:
                    time.sleep(5 * (attempt + 1))
        if (i // BATCH) % 10 == 9:
            print(f"  upserted {done}/{len(rows)}", flush=True)
    return done, errors


# ─── Commands ──────────────────────────────────────────────────────────────────
def cmd_estimate(a):
    start, end = fy_window(a.fy)
    tp = [{"start_date": start, "end_date": end, "date_type": "new_awards_only"}]
    def count(extra):
        body = {"filters": {"award_type_codes": CONTRACT_TYPES, "time_period": tp, **extra}}
        return api_post("/search/spending_by_award_count/", body)["results"]["contracts"]
    nc = count(CLAUSES["noncompeted_ge_1m"])
    big = count(CLAUSES["any_ge_10m"])
    both = count({"award_amounts": [{"lower_bound": float(ANY_MIN)}],
                  "extent_competed_type_codes": NONCOMPETED_CODES})
    total = nc + big - both
    print(json.dumps({"fy": a.fy, "window": [start, end], "rule": RULE_VERSION,
                      "noncompeted_ge_1m": nc, "any_ge_10m": big, "overlap": both,
                      "rows_estimate": total, "mb_at_1.5kb": round(total * 1.5 / 1024, 1)}))


def cmd_load(a):
    t0, seen_at = time.time(), dt.datetime.now(dt.timezone.utc).isoformat()
    start, end = fy_window(a.fy)
    print(f"Load FY{a.fy} ({start} to {end}), rule {RULE_VERSION}", flush=True)
    log_id = log_start(f"awards:{RULE_VERSION}:load_fy{a.fy}", start, end)
    try:
        got, stats = collect([(start, end)], "new_awards_only", a.fy, a.fy)
        rows = [to_row(r, reasons, seen_at) for r, reasons in got.values()]
        print(f"  rule rows {len(rows)}; {json.dumps(stats)}", flush=True)
        done, errors = upsert(rows)
        pruned = 0
        if a.prune and not errors:
            res = (sb().table("awards").delete(count="exact").eq("fiscal_year", a.fy)
                   .lt("last_seen_at", seen_at).execute())
            pruned = res.count or 0
        if not errors:
            refresh_summary()
        status = "complete" if not errors else "failed"
        log_end(log_id, status, done, errors, t0)
        print(json.dumps({"fy": a.fy, "status": status, "upserted": done, "pruned": pruned,
                          "errors": len(errors), **stats, "seconds": round(time.time() - t0)}))
        return 0 if not errors else 1
    except Exception as e:
        log_end(log_id, "failed", 0, [str(e)[:300]], t0)
        raise


def loaded_min_fy():
    res = (sb().table("awards").select("fiscal_year").eq("selection_rule", RULE_VERSION)
           .not_.is_("fiscal_year", "null").order("fiscal_year").limit(1).execute())
    return res.data[0]["fiscal_year"] if res.data else None


def cmd_incremental(a):
    t0, seen_at = time.time(), dt.datetime.now(dt.timezone.utc).isoformat()
    min_fy = loaded_min_fy() if a.min_fy == "auto" else int(a.min_fy)
    if not min_fy:
        sys.exit("No fiscal year loaded yet: run `load --fy N` first (or pass --min-fy).")
    end = dt.date.today()
    start = end - dt.timedelta(days=a.days)
    new_start = end - dt.timedelta(days=a.new_days)
    print(f"Incremental: awards modified {start} to {end} + awards signed {new_start} to {end}, "
          f"base FY >= {min_fy}", flush=True)
    log_id = log_start(f"awards:{RULE_VERSION}:incremental", start.isoformat(), end.isoformat())
    try:
        # 1) change feed: anything USAspending modified in the last N days
        got, stats = collect([(start.isoformat(), end.isoformat())], "last_modified_date", min_fy, None)
        # 2) late publication: DoD releases contract actions 90 days late and they keep
        #    their original modified date, so window 1 never sees them. Re-pull every
        #    award signed in the trailing `new_days` (default 120 > 90) instead.
        got2, stats2 = collect([(new_start.isoformat(), end.isoformat())], "new_awards_only", min_fy, None)
        got.update(got2)
        stats = {k: stats[k] + stats2[k] for k in stats}
        rows = [to_row(r, reasons, seen_at) for r, reasons in got.values()]
        print(f"  rule rows {len(rows)}; {json.dumps(stats)}", flush=True)
        done, errors = upsert(rows)
        if not errors:
            refresh_summary()
        by_fy = {}
        for r in rows:
            by_fy[r["fiscal_year"]] = by_fy.get(r["fiscal_year"], 0) + 1
        log_end(log_id, "complete" if not errors else "failed", done, errors, t0)
        print(json.dumps({"status": "complete" if not errors else "failed", "upserted": done,
                          "by_fy": by_fy, "errors": len(errors), **stats,
                          "seconds": round(time.time() - t0)}))
        return 0 if not errors else 1
    except Exception as e:
        log_end(log_id, "failed", 0, [str(e)[:300]], t0)
        raise


def toptier_map():
    res = api_get("/references/toptier_agencies/")["results"]
    return {x["agency_id"]: x["toptier_code"] for x in res}


def toptier_code_by_name(name):
    """Agencies without a profile page are missing from /references/toptier_agencies/;
    the agency autocomplete still knows their toptier code (exact name match only)."""
    res = api_post("/autocomplete/awarding_agency/", {"search_text": name, "limit": 10})
    for x in res.get("results", []):
        top = x.get("toptier_agency") or {}
        if (top.get("name") or "").lower() == name.lower() and top.get("toptier_code"):
            return top["toptier_code"]
    return None


UNATTRIBUTED = "UNATTRIBUTED"   # obligations USAspending reports without an awarding agency


def by_agency(filters):
    out, page = {}, 1
    while True:
        res = api_post("/search/spending_by_category/awarding_agency/",
                       {"filters": filters, "limit": 100, "page": page})
        for x in res["results"]:
            out[x.get("id") or UNATTRIBUTED] = x
        if not res["page_metadata"].get("hasNext"):
            return out
        page += 1


def cmd_summary(a):
    t0 = time.time()
    start, end = fy_window(a.fy)
    base = {"award_type_codes": CONTRACT_TYPES, "time_period": [{"start_date": start, "end_date": end}]}
    tops = toptier_map()
    total = by_agency(base)
    nc = by_agency({**base, "extent_competed_type_codes": NONCOMPETED_CODES})
    comp = by_agency({**base, "extent_competed_type_codes": COMPETED_CODES})
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    method = ("Sum of federal_action_obligation on prime contract transactions (types A-D) with "
              "action_date in the window, by awarding toptier agency. Non-competed = extent "
              "competed B, C, G, NDO; competed = A, D, E, F, CDO; the rest had no code.")
    src = f"{API}/search/spending_by_category/awarding_agency/"
    rows, missing = [], []
    for aid, x in total.items():
        if aid == UNATTRIBUTED:
            code, name = UNATTRIBUTED, "No awarding agency reported"
        else:
            name = x["name"]
            code = tops.get(aid) or toptier_code_by_name(name)
            if not code:
                missing.append(name)
                code = f"id:{aid}"
        rows.append({
            "fiscal_year": a.fy, "agency_code": code,
            "agency_name": name, "agency_abbreviation": x.get("code"),
            "total_obligations": money(Decimal(str(x["amount"]))),
            "noncompeted_obligations": money(Decimal(str(nc.get(aid, {}).get("amount", 0)))),
            "competed_obligations": money(Decimal(str(comp.get(aid, {}).get("amount", 0)))),
            "period_start": start, "period_end": end, "method": method, "source_url": src,
            "reporting_lag_days": REPORTING_LAG_DAYS.get(code, 0), "fetched_at": now,
        })
    s = lambda k: sum(Decimal(r[k]) for r in rows)
    rows.append({"fiscal_year": a.fy, "agency_code": "ALL", "agency_name": "All agencies",
                 "agency_abbreviation": "ALL", "total_obligations": money(s("total_obligations")),
                 "noncompeted_obligations": money(s("noncompeted_obligations")),
                 "competed_obligations": money(s("competed_obligations")),
                 "period_start": start, "period_end": end,
                 "method": method + " ALL = sum of the agency rows.", "source_url": src,
                 "reporting_lag_days": REPORTING_LAG_DAYS["ALL"], "fetched_at": now})
    codes = [r["agency_code"] for r in rows]
    if len(codes) != len(set(codes)):
        sys.exit(f"duplicate agency codes in summary: {sorted(c for c in codes if codes.count(c) > 1)}")
    sb().table("contract_spending_summary").upsert(rows, on_conflict="fiscal_year,agency_code").execute()
    # the FY's rows are replaced as a set: drop keys this run did not produce
    sb().table("contract_spending_summary").delete().eq("fiscal_year", a.fy).lt("fetched_at", now).execute()
    allr = rows[-1]
    share = Decimal(allr["noncompeted_obligations"]) / Decimal(allr["total_obligations"])
    # independent cross-check of the government-wide total
    sot = api_post("/search/spending_over_time/", {"group": "fiscal_year", "filters": base})
    sot_total = sum(Decimal(str(x.get("aggregated_amount") or 0)) for x in sot.get("results", []))
    print(json.dumps({"fy": a.fy, "window": [start, end], "agencies": len(rows) - 1,
                      "unmapped": missing, "total": allr["total_obligations"],
                      "spending_over_time_total": money(sot_total),
                      "noncompeted": allr["noncompeted_obligations"],
                      "competed": allr["competed_obligations"],
                      "noncompeted_share": round(float(share), 4), "seconds": round(time.time() - t0)}))


def fetch_fy_rows(fy, cols):
    rows, off = [], 0
    while True:
        res = (sb().table("awards").select(cols).eq("fiscal_year", fy)
               .eq("selection_rule", RULE_VERSION).order("id").range(off, off + 999).execute())
        rows.extend(res.data)
        if len(res.data) < 1000:
            return rows
        off += 1000


def cmd_verify(a):
    """Re-check a random sample of loaded rows against the award API, and agency
    denominators against USAspending's agency endpoint. Writes a JSON report."""
    cols = ("id,piid,recipient_name,recipient_uei,obligated_amount,extent_competed_code,"
            "posted_date,performance_start,performance_end,awarding_agency_code,usaspending_url")
    rows = fetch_fy_rows(a.fy, cols)
    sample = random.Random(a.seed).sample(rows, min(a.n, len(rows)))
    results = []
    for r in sample:
        d = api_get(f"/awards/{r['id']}/")
        ltc = d.get("latest_transaction_contract_data") or {}
        rec = d.get("recipient") or {}
        pop = d.get("period_of_performance") or {}
        checks = {
            "amount": (r["obligated_amount"], d.get("total_obligation"),
                       abs(Decimal(str(r["obligated_amount"])) - Decimal(str(d.get("total_obligation") or 0))) < Decimal("0.01")),
            "recipient_uei": (r["recipient_uei"], rec.get("recipient_uei"), (r["recipient_uei"] or "") == (rec.get("recipient_uei") or "")),
            "recipient_name": (r["recipient_name"], rec.get("recipient_name"),
                               (r["recipient_name"] or "").upper() == (rec.get("recipient_name") or "").upper()),
            "extent_competed_code": (r["extent_competed_code"], ltc.get("extent_competed"),
                                     (r["extent_competed_code"] or "") == (ltc.get("extent_competed") or "")),
            "date_signed": (r["posted_date"], d.get("date_signed"), r["posted_date"] == (d.get("date_signed") or "")[:10]),
            "pop_start": (r["performance_start"], pop.get("start_date"), (r["performance_start"] or "") == (pop.get("start_date") or "")[:10]),
            "pop_end": (r["performance_end"], pop.get("end_date"), (r["performance_end"] or "") == (pop.get("end_date") or "")[:10]),
            "piid": (r["piid"], d.get("piid"), r["piid"] == d.get("piid")),
        }
        ok = all(c[2] for c in checks.values())
        results.append({"id": r["id"], "url": r["usaspending_url"], "ok": ok,
                        "last_modified": pop.get("last_modified_date"),
                        "mismatches": {k: [v[0], v[1]] for k, v in checks.items() if not v[2]}})
    n_ok = sum(1 for x in results if x["ok"])
    field_ok = {}
    for x in results:
        for k in ("amount", "recipient_uei", "recipient_name", "extent_competed_code", "date_signed", "pop_start", "pop_end", "piid"):
            field_ok[k] = field_ok.get(k, 0) + (0 if k in x["mismatches"] else 1)
    # agency denominators vs USAspending's agency profile endpoint
    agencies = []
    for code in a.agencies.split(","):
        res = sb().table("contract_spending_summary").select("*").eq("fiscal_year", a.fy).eq("agency_code", code).execute()
        if not res.data:
            agencies.append({"agency_code": code, "error": "not in contract_spending_summary"})
            continue
        s = res.data[0]
        prof = api_get(f"/agency/{code}/awards/", fiscal_year=a.fy, agency_type="awarding",
                       award_type_codes="[" + ",".join(CONTRACT_TYPES) + "]")
        agencies.append({"agency_code": code, "agency_name": s["agency_name"],
                         "stored_total": s["total_obligations"], "usaspending_agency_endpoint": prof.get("obligations"),
                         "diff": float(Decimal(str(s["total_obligations"])) - Decimal(str(prof.get("obligations") or 0))),
                         "stored_noncompeted": s["noncompeted_obligations"],
                         "latest_action_date": prof.get("latest_action_date")})
    report = {"fy": a.fy, "rule": RULE_VERSION, "seed": a.seed, "population": len(rows),
              "sample": len(results), "rows_all_fields_match": n_ok, "field_match": field_ok,
              "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "agencies": agencies, "rows": results}
    path = a.out or os.path.join(CACHE_DIR, f"verify_fy{a.fy}_seed{a.seed}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)
    print(json.dumps({k: report[k] for k in ("fy", "population", "sample", "rows_all_fields_match", "field_match")}))
    for x in results:
        if not x["ok"]:
            print("  MISMATCH", x["id"], json.dumps(x["mismatches"])[:400])
    for ag in agencies:
        print("  AGENCY", json.dumps(ag))
    print(f"  report: {path}")


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("estimate"); e.add_argument("--fy", type=int, required=True)
    l = sub.add_parser("load"); l.add_argument("--fy", type=int, required=True)
    l.add_argument("--prune", action="store_true", help="delete FY rows no longer meeting the rule")
    i = sub.add_parser("incremental"); i.add_argument("--days", type=int, default=7)
    i.add_argument("--new-days", type=int, default=120,
                   help="also re-pull awards signed in this many trailing days (DoD 90-day delay)")
    i.add_argument("--min-fy", default="auto", help="earliest base FY to accept (default: earliest loaded)")
    s = sub.add_parser("summary"); s.add_argument("--fy", type=int, required=True)
    v = sub.add_parser("verify"); v.add_argument("--fy", type=int, required=True)
    v.add_argument("--n", type=int, default=30); v.add_argument("--seed", type=int, default=2026)
    v.add_argument("--agencies", default="097,036,070"); v.add_argument("--out")
    for sp in (l, i):
        sp.add_argument("--fresh", action="store_true", help="ignore cached downloads")
    a = p.parse_args()
    FRESH[0] = getattr(a, "fresh", False)
    return {"estimate": cmd_estimate, "load": cmd_load, "incremental": cmd_incremental,
            "summary": cmd_summary, "verify": cmd_verify}[a.cmd](a) or 0


if __name__ == "__main__":
    sys.exit(main())
