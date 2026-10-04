#!/usr/bin/env python3
"""
Link federal contractors to publicly traded companies (R7, 2026-10-03, rule r7-v1).

Builds `company_tickers`: which USAspending recipients/parents (the contractor entities on
the loaded `awards`) are SEC-registered public companies, and under which ticker. This is
what lets the site say "Member X traded company Y, which received $Z in non-competed
contracts" from official records only. No third-party aggregator is used.

Sources (all official):
  * SEC  https://www.sec.gov/files/company_tickers.json and company_tickers_exchange.json
         (CIK, ticker, registrant name, exchange); https://data.sec.gov/submissions/CIK*.json
         (former names, SIC, state) to document review rows and to verify;
  * USAspending (via the loaded `awards` table): recipient parent name / UEI, recipient name /
    UEI. Subsidiaries are linked through USAspending's parent field, never by name guessing,
    so "Sikorsky" or "Lockheed Martin Rotary and Mission Systems" reach LMT through their
    parent UEI;
  * the tickers that appear in `congress_trades` (for the trade-side coverage report).

RULE r7-v1 (what may be accepted by code). One row = one (ticker, contractor recipient) pair.
  * A contractor entity is a recipient parent GROUP (USAspending's parent UEI + name, from the awards) or
    the recipient itself when its awards carry no parent. Names are normalized (ASCII upper case, '&' = 'AND'
    (dropped), punctuation and '/DE/'-style suffixes removed, leading/trailing 'THE' removed, legal-form
    spellings unified: COMPANY = CO, CORPORATION = CORP, INCORPORATED = INC, LIMITED = LTD, HOLDING = HOLDINGS).
  * auto_confirmed needs ONE of these, per recipient, and only when the name equals exactly one SEC CIK:
      - self / same-name (exact_normalized): the recipient IS the registrant (its UEI is the parent UEI, or its
        normalized name equals the parent's, which equals the registrant's name);
      - parent chain (parent_chain): the recipient's USAspending PARENT equals the registrant AND the recipient
        carries its own evidence: its name starts with a distinctive word of the parent's name ('KBR Wyle
        Services' under 'KBR, Inc.'), or the registrant's SEC subsidiary list (EX-21 of its latest 10-K / 20-F /
        40-F) names it. The parent field alone is NOT accepted: it has errors (a $1.7B IT recipient filed under
        'The Timken Company', Honeywell recipients under 'Resideo', Nightwing under 'Etsy').
    Joint ventures are never auto-confirmed (only partly owned).
  * Names equal only after DROPPING trailing INC/CORP/CO/LLC/LTD/PLC/HOLDINGS words are needs_review, not auto:
    'CRANE & CO. INC.' (paper maker) is not 'Crane Co' (industrial), 'NVE, INC' is not 'NVE CORP'.
  * Everything else is needs_review with its reason and score: fuzzy similarity, name-prefix candidates,
    ambiguous names (2+ CIKs), SEC former-name hits (alias), a recipient named like a registrant while USAspending
    names another parent, recipients named in a registrant's EX-21 that the parent field does not link,
    parent-chain recipients without evidence. A fuzzy match is NEVER auto-confirmed: a false link would accuse a
    member of trading a contractor they did not.
  * A CIK with more than MAX_TICKERS_PER_CIK tickers (exchange-traded-note issuers such as Bank of Montreal: 45)
    is linked through its primary ticker only, so an ETN trade is not recorded as a trade in the issuer's stock.
  * A person's decision (status manual_confirmed / rejected, or reviewed_at set) is never overwritten by a re-run.
  * The public read policy shows only auto_confirmed / manual_confirmed rows.

Commands (repo root; PowerShell: $env:PYTHONIOENCODING='utf-8'):
  python src/scripts/load_company_tickers.py match [--dry-run] [--prune] [--no-enrich]
  python src/scripts/load_company_tickers.py report --out <dir> [--fy 2026]
  python src/scripts/load_company_tickers.py verify [--n 30] [--seed 7] --out <file.json>
  python src/scripts/load_company_tickers.py review --uei <parent uei> --cik <cik> \
         --status manual_confirmed|rejected|needs_review --by <who> --note "<why>" [--recipient-uei <uei> | --all-children]
"""

import argparse
import csv
import datetime as dt
import difflib
import html
import json
import math
import os
import random
import re
import sys
import tempfile
import time
import unicodedata
from collections import Counter, defaultdict

from _venv import activate as _activate_venv
_activate_venv()

import requests  # noqa: E402

RULE_VERSION = "r7-v1"

# The brief's User-Agent: a generic project address, never anyone's personal details.
SEC_UA = "SlushFund research audit@slushfund.net"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
EDGAR_PAGE = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
USA_API = "https://api.usaspending.gov/api/v2"
SEC_INTERVAL = 0.25          # seconds between SEC requests (SEC allows 10/s; we stay at 4/s)
USA_INTERVAL = 1.1           # seconds between USAspending requests

CACHE_DIR = os.environ.get("SLUSHFUND_TICKERS_CACHE",
                           os.path.join(tempfile.gettempdir(), "slushfund-tickers-cache"))
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

MAX_TICKERS_PER_CIK = 6
# Tickers that are not an ownership line of the company (audit A7 T2): GSCE is an index-linked product of
# Goldman Sachs. Never linked, so a re-run of `match --prune` does not bring it back.
DROP_TICKERS = {"GSCE"}
NONCOMPETED = ("B", "C", "G", "NDO")
STATUS_RANK = {"auto_confirmed": 0, "manual_confirmed": 0, "needs_review": 1, "rejected": 2}

# ─── Name normalization ────────────────────────────────────────────────────────
# Legal-form spellings unified for the STRICT key (the one auto-confirmation requires).
LEGAL_CANON = {"INCORPORATED": "INC", "CORPORATION": "CORP", "COMPANY": "CO", "LIMITED": "LTD",
               "HOLDING": "HOLDINGS", "HLDGS": "HOLDINGS", "HLDG": "HOLDINGS"}
# Words dropped from the END of a name for the LOOSE key (candidate generation only).
LEGAL_TAIL = {"INC", "CORP", "CO", "LLC", "LP", "LLLP", "LLP", "LTD", "PLC", "NV", "SA", "AG",
              "SE", "PC", "PLLC", "HOLDINGS"}
JV_NAME = re.compile(r"\b(JV|AJV|JOINT VENTURE|JOINT VENTURES)\b")
_STATE_SUFFIX = re.compile(r"\s*/[A-Z]{2,4}/?\s*$")           # SEC style "CORP /DE/"
_PAREN_TAIL = re.compile(r"\s*\([^)]*\)\s*$")                  # "(DE)", "(THE)"


def ascii_up(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()


def base_tokens(name):
    s = ascii_up(name).strip()
    s = _PAREN_TAIL.sub("", s)
    s = _STATE_SUFFIX.sub("", s)
    s = s.replace("&", " AND ")
    s = re.sub(r"[.'’`]", "", s)                    # L.L.C. -> LLC, U.S. -> US, O'Neil -> ONEIL
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    t = [w for w in s.split() if w != "AND"]
    if len(t) > 1 and t[0] == "THE":
        t = t[1:]
    if len(t) > 1 and t[-1] == "THE":
        t = t[:-1]
    return [LEGAL_CANON.get(w, w) for w in t]


def strict_key(name):
    return " ".join(base_tokens(name))


def loose_tokens(name):
    t = base_tokens(name)
    while len(t) > 1 and t[-1] in LEGAL_TAIL:
        t.pop()
    return t


def loose_key(name):
    return " ".join(loose_tokens(name))


def norm_ticker(t):
    """SEC writes share classes with a hyphen (BRK-B); disclosures use BRK.B / BRK B."""
    t = ascii_up(t).strip()
    return re.sub(r"[./ ]", "-", t) if re.fullmatch(r"[A-Z]{1,5}[./ ][A-Z]", t) else t


# ─── Supabase ──────────────────────────────────────────────────────────────────
_sb = [None]


def sb():
    if _sb[0] is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            sys.exit("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (.env.local)")
        from supabase import create_client
        _sb[0] = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _sb[0]


def sb_call(fn, tries=5):
    """Supabase REST sits behind Cloudflare, which now and then answers 522/5xx for one request: retry with
    backoff, and never print the HTML error page."""
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            msg = re.sub(r"\s+", " ", str(e))[:160]
            if i == tries - 1:
                raise RuntimeError(f"Supabase request failed after {tries} tries: {msg}") from None
            print(f"  supabase retry {i + 1}/{tries - 1} after: {msg[:90]}", flush=True)
            time.sleep(3 * 2 ** i)


def fetch_all(table, cols, page=1000, order="id"):
    out, start = [], 0
    while True:
        rows = sb_call(lambda: sb().table(table).select(cols).order(order).range(start, start + page - 1)
                       .execute().data)
        out.extend(rows)
        if len(rows) < page:
            return out
        start += page


# ─── HTTP (polite) ─────────────────────────────────────────────────────────────
_last = defaultdict(float)
_S = requests.Session()


def _gap_wait(host_key, interval):
    gap = time.monotonic() - _last[host_key]
    if gap < interval:
        time.sleep(interval - gap)
    _last[host_key] = time.monotonic()


def get_json(url, host_key, interval, ua):
    err = ""
    for attempt in range(5):
        _gap_wait(host_key, interval)
        try:
            r = _S.get(url, headers={"User-Agent": ua, "Accept": "application/json"}, timeout=60)
        except requests.RequestException as e:
            err = str(e)
        else:
            if r.status_code < 400:
                return r.json()
            err = f"HTTP {r.status_code}"
            if r.status_code < 500 and r.status_code != 429:
                raise RuntimeError(f"GET {url} -> {err}")
        time.sleep(min(60, 3 * 2 ** attempt))
        print(f"  retry {attempt + 1}/4 after: {err}", flush=True)
    raise RuntimeError(f"GET {url} failed after 5 tries: {err}")


def sec_get(url):
    return get_json(url, "sec", SEC_INTERVAL, SEC_UA)


def usa_get(path):
    return get_json(USA_API + path, "usa", USA_INTERVAL, "slushfund-tickers/1.0 (public-records research)")


def cached(name, fetch, max_age_h=24):
    os.makedirs(CACHE_DIR, exist_ok=True)
    p = os.path.join(CACHE_DIR, name)
    if os.path.isfile(p) and (time.time() - os.path.getmtime(p)) < max_age_h * 3600:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    data = fetch()
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


# ─── SEC side ──────────────────────────────────────────────────────────────────
def load_sec():
    """One dict per (CIK, ticker): cik (10 digits), ticker, name, exchange."""
    base = cached("company_tickers.json", lambda: sec_get(SEC_TICKERS_URL))
    exch = cached("company_tickers_exchange.json", lambda: sec_get(SEC_EXCHANGE_URL))
    fields = exch["fields"]
    ex = {}
    for row in exch["data"]:
        d = dict(zip(fields, row))
        ex[(int(d["cik"]), ascii_up(d["ticker"]))] = d.get("exchange")
    out, seen = [], set()
    for order, v in enumerate(base.values()):           # file order = SEC's own ranking, primary listing first
        cik, tk = int(v["cik_str"]), ascii_up(v["ticker"]).strip()
        if (cik, tk) in seen or not tk or tk in DROP_TICKERS:
            continue
        seen.add((cik, tk))
        out.append({"cik": f"{cik:010d}", "ticker": tk, "name": v["title"].strip(),
                    "exchange": ex.get((cik, tk)), "order": order})
    # A registrant with many listed tickers is almost always an issuer of exchange-traded notes (Bank of Montreal:
    # 45, one of them its stock). Linking every ticker would record a trade in an ETN as a trade in the bank's stock,
    # so such a CIK is linkable through its primary (first-listed) ticker only. Up to MAX_TICKERS_PER_CIK tickers
    # (share classes, preferreds, warrants of one company) are all kept.
    per = defaultdict(list)
    for r in out:
        per[r["cik"]].append(r)
    for rows in per.values():
        rows.sort(key=lambda r: r["order"])
        for i, r in enumerate(rows):
            r["linkable"] = len(rows) <= MAX_TICKERS_PER_CIK or i == 0
    return out


def sec_profile(cik):
    """SEC submissions summary for one CIK (former names, SIC, state); cached 7 days."""
    def fetch():
        d = sec_get(SEC_SUBMISSIONS_URL.format(cik=cik))
        biz = (d.get("addresses") or {}).get("business") or {}
        rec = (d.get("filings") or {}).get("recent") or {}
        annual = next(({"form": f, "accession": a, "date": dd}
                       for f, a, dd in zip(rec.get("form", []), rec.get("accessionNumber", []), rec.get("filingDate", []))
                       if f in ("10-K", "20-F", "40-F")), None)
        return {"cik": cik, "name": d.get("name"), "entityType": d.get("entityType"), "annual": annual,
                "sic": d.get("sic"), "sicDescription": d.get("sicDescription"),
                "stateOfIncorporation": d.get("stateOfIncorporation"),
                "businessState": biz.get("stateOrCountry"), "businessCity": biz.get("city"),
                "tickers": d.get("tickers") or [], "exchanges": d.get("exchanges") or [],
                "category": d.get("category"), "formerNames": d.get("formerNames") or []}
    try:
        return cached(f"sub2_{cik}.json", fetch, max_age_h=24 * 7)
    except Exception as e:  # noqa: BLE001 - enrichment must never stop a match run
        print(f"  (SEC profile {cik} failed: {str(e)[:100]})")
        return None


def sec_ex21(cik):
    """The registrant's latest annual report (10-K / 20-F / 40-F) subsidiary list (EX-21, or EX-8 for 20-F),
    as normalized text. Cached 30 days. Returns {url, accession, text} or None."""
    def fetch():
        p = sec_profile(cik)
        ann = (p or {}).get("annual")
        if not ann:
            return {"none": True}
        base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{ann['accession'].replace('-', '')}"
        idx = sec_get(base + "/index.json")
        names = [i["name"] for i in idx["directory"]["item"]]
        pat = re.compile(r"ex[-_]?21|exhibit[-_]?21" if ann["form"] != "20-F" else r"ex[-_]?(8|21)|exhibit[-_]?(8|21)", re.I)
        pick = [n for n in names if pat.search(n)]
        if not pick:
            return {"none": True}
        _gap_wait("sec", SEC_INTERVAL)
        r = _S.get(f"{base}/{pick[0]}", headers={"User-Agent": SEC_UA}, timeout=90)
        r.raise_for_status()
        txt = html.unescape(re.sub(r"<[^>]+>", " ", r.text))
        return {"url": f"{base}/{pick[0]}", "accession": ann["accession"], "text": " " + " ".join(base_tokens(txt)) + " "}
    try:
        d = cached(f"ex21_{cik}.json", fetch, max_age_h=24 * 30)
    except Exception as e:  # noqa: BLE001 - corroboration is best-effort
        print(f"  (EX-21 {cik} failed: {str(e)[:100]})")
        return None
    return None if d.get("none") else d


def ex21_has(doc, name):
    """True when the recipient's name (legal-form words dropped) appears as a phrase in the subsidiary list."""
    k = loose_key(name)
    if len(k.replace(" ", "")) < 6:
        return False
    return f" {k} " in doc["text"]


# ─── Contractor side (the loaded awards) ───────────────────────────────────────
def load_awards():
    return fetch_all("awards", "id,fiscal_year,recipient_name,recipient_uei,recipient_parent_name,"
                               "recipient_parent_uei,obligated_amount,extent_competed_code,"
                               "usaspending_url,description,naics_description,recipient_location")


def build_entities(awards):
    """One entity per parent group: key = recipient_parent_uei, or the recipient's own UEI."""
    ents = {}
    for r in awards:
        has_parent = bool(r["recipient_parent_uei"])
        uei = r["recipient_parent_uei"] or r["recipient_uei"]
        name = r["recipient_parent_name"] if has_parent else r["recipient_name"]
        if not uei or not name:
            continue
        amt = float(r["obligated_amount"] or 0)
        nc = r["extent_competed_code"] in NONCOMPETED
        e = ents.setdefault(uei, {"uei": uei, "names": Counter(), "children": {},
                                  "by_fy": defaultdict(lambda: [0, 0.0, 0.0]), "top": None})
        e["names"][name] += amt
        ch = e["children"].setdefault(r["recipient_uei"], {"uei": r["recipient_uei"], "names": Counter(), "obl": 0.0,
                                                           "by_fy": defaultdict(lambda: [0, 0.0, 0.0]), "top": None})
        ch["names"][r["recipient_name"]] += amt
        ch["obl"] += amt
        cf = ch["by_fy"][r["fiscal_year"]]
        cf[0] += 1
        cf[1] += amt
        cf[2] += amt if nc else 0.0
        if ch["top"] is None or amt > ch["top"]["amt"]:
            ch["top"] = {"amt": amt, "id": r["id"], "url": r["usaspending_url"], "desc": r["description"],
                         "naics": r["naics_description"], "loc": r["recipient_location"]}
        fy = e["by_fy"][r["fiscal_year"]]          # [awards, obligated, non-competed obligated]
        fy[0] += 1
        fy[1] += amt
        fy[2] += amt if nc else 0.0
        if e["top"] is None or amt > e["top"]["amt"]:
            e["top"] = {"amt": amt, "id": r["id"], "url": r["usaspending_url"],
                        "desc": r["description"], "naics": r["naics_description"],
                        "loc": r["recipient_location"]}
    for e in ents.values():
        e["name"] = e["names"].most_common(1)[0][0]
        for ch in e["children"].values():
            ch["name"] = ch["names"].most_common(1)[0][0]
    return ents


def ent_dollars(e, fy=None):
    """(awards, obligated, non-competed) for one FY, or all loaded FYs."""
    fys = [fy] if fy else list(e["by_fy"])
    n = sum(e["by_fy"][f][0] for f in fys if f in e["by_fy"])
    ob = sum(e["by_fy"][f][1] for f in fys if f in e["by_fy"])
    nc = sum(e["by_fy"][f][2] for f in fys if f in e["by_fy"])
    return n, ob, nc


# ─── Matching ──────────────────────────────────────────────────────────────────
RARE_DF = 12                # a word is "distinctive" when it opens <= this many SEC names
JACCARD_MIN = 0.60
PREFIX_SCORE = 0.90
WEAK_SCORE = 0.70           # one rare shared word only; kept only if a SEC former name confirms it
WEAK_MIN_OBLIGATED = 5e6
GENERIC = {"INC", "CORP", "CO", "LLC", "LTD", "LP", "THE", "GROUP", "INTERNATIONAL", "SYSTEMS", "SERVICES",
           "TECHNOLOGIES", "TECHNOLOGY", "SOLUTIONS", "AMERICA", "AMERICAN", "USA", "US", "FEDERAL",
           "GOVERNMENT", "DEFENSE", "COMPANY", "CORPORATION", "INDUSTRIES", "HOLDINGS", "GLOBAL", "NATIONAL",
           "MANUFACTURING", "ENERGY", "HEALTH", "AEROSPACE", "INTEGRATED", "GENERAL", "UNITED", "FIRST"}


class SecIndex:
    def __init__(self, sec):
        self.sec = sec
        self.by_strict = defaultdict(list)
        self.by_loose = defaultdict(list)
        for s in sec:
            s["strict"], s["loose"] = strict_key(s["name"]), loose_key(s["name"])
            if s.get("linkable", True):
                self.by_strict[s["strict"]].append(s)
                self.by_loose[s["loose"]].append(s)
        self.by_token = defaultdict(set)
        for lk in self.by_loose:
            for t in set(lk.split()):
                self.by_token[t].add(lk)
        self.n_keys = len(self.by_loose)
        self.by_cik = defaultdict(list)
        for s in sec:
            self.by_cik[s["cik"]].append(s)
        self.by_ticker = defaultdict(list)
        for s in sec:
            self.by_ticker[s["ticker"]].append(s)

    def df(self, tok):
        return len(self.by_token.get(tok, ()))

    def idf(self, tok):
        return math.log((self.n_keys + 1) / (self.df(tok) + 1))

    def distinctive(self, name):
        return {t for t in loose_tokens(name) if len(t) >= 3 and t not in GENERIC and self.df(t) <= RARE_DF}


class Matcher:
    def __init__(self, idx, use_ex21=True):
        self.idx = idx
        self.use_ex21 = use_ex21
        self.rows = {}          # (ticker, parent_uei, recipient_uei|None) -> row
        self.stats = Counter()

    def add(self, ent, s, method, score, status, notes, child=None, hint=""):
        key = (s["ticker"], ent["uei"], child["uei"] if child else None)
        row = {
            "cik": s["cik"], "ticker": s["ticker"], "sec_name": s["name"], "exchange": s["exchange"],
            "recipient_parent_uei": ent["uei"], "recipient_parent_name": ent["name"],
            "recipient_uei": child["uei"] if child else None,
            "recipient_name": child["name"] if child else None,
            "entity_level": "recipient" if child else "parent",
            "match_method": method, "match_score": round(score, 3), "status": status,
            "evidence_url": EDGAR_PAGE.format(cik=s["cik"]), "notes": notes,
            "rule_version": RULE_VERSION, "_hint": hint, "_evidence": "",
        }
        old = self.rows.get(key)
        if old and (STATUS_RANK[old["status"]], -old["match_score"]) <= (STATUS_RANK[status], -score):
            return
        self.rows[key] = row

    # -- parent group named exactly like one registrant: decide every recipient on its own evidence
    def parent_chain(self, ent, hits):
        """The group's (parent) name equals one registrant. Auto-confirm a recipient only when it carries its
        own evidence; USAspending's parent field alone is NOT enough (it has errors, e.g. a $1.7B IT recipient
        filed under an unrelated manufacturer)."""
        idx = self.idx
        pname = ent["name"]
        pdist = idx.distinctive(pname)
        pkey = strict_key(pname)
        cik = hits[0]["cik"]
        for ch in ent["children"].values():
            ev, how = "", ""
            if ch["uei"] == ent["uei"]:
                how, ev = "self", "the parent's own recipient record carries the registrant's name"
            elif strict_key(ch["name"]) == pkey:
                how, ev = "same-name", "recipient carries the registrant's name"
            elif loose_tokens(ch["name"])[0] in pdist:
                # the recipient's name STARTS with a distinctive word of the parent's name ('KBR SERVICES', 'BOEING
                # DISTRIBUTION'); a shared word elsewhere ('BLACK CONSTRUCTION-TUTOR PERINI JV') is not enough
                how, ev = "related-name", (f"recipient name starts with '{loose_tokens(ch['name'])[0]}', a distinctive "
                                           f"word of the parent name")
            elif self.use_ex21:
                doc = sec_ex21(cik)
                if doc and ex21_has(doc, ch["name"]):
                    how, ev = "ex21", f"recipient is named in the registrant's subsidiary list: {doc['url']}"
            if how and JV_NAME.search(ascii_up(ch["name"])):
                # a joint venture is only partly the registrant's: never accepted by code
                self.stats["joint_venture_review"] += 1
                for h in hits:
                    self.add(ent, h, "parent_chain", 0.80, "needs_review",
                             f"recipient is a joint venture ('{ch['name']}'): only partly owned by the registrant; "
                             f"{ev}", ch, "joint-venture")
            elif how:
                self.stats[f"auto_{how}"] += 1
                direct = how in ("self", "same-name")
                for h in hits:
                    self.add(ent, h, "exact_normalized" if direct else "parent_chain", 1.0 if direct else 0.99,
                             "auto_confirmed",
                             (f"exact normalized name ({how})" if direct
                              else f"USAspending parent '{pname}' = registrant; {ev}"), ch)
                    self.rows[(h["ticker"], ent["uei"], ch["uei"])]["_evidence"] = ev
            else:
                self.stats["chain_uncorroborated"] += 1
                for h in hits:
                    self.add(ent, h, "parent_chain", 0.80, "needs_review",
                             f"USAspending lists the parent as '{pname}' (= registrant), but this recipient's name is "
                             f"unrelated and is not in the registrant's SEC subsidiary list (EX-21): possible parent-field error",
                             ch, "chain-uncorroborated")

    # -- group-level candidates (never auto)
    def group_exact_review(self, ent, hits, strict):
        ciks = {h["cik"] for h in hits}
        if strict and len(ciks) > 1:
            self.stats["exact_ambiguous"] += 1
            for h in hits:
                self.add(ent, h, "exact_normalized", 1.0, "needs_review",
                         f"ambiguous: this name matches {len(ciks)} different SEC registrants", None, "ambiguous")
        elif not strict:
            self.stats["loose_equal"] += 1
            for h in hits:
                self.add(ent, h, "exact_normalized", 0.95, "needs_review",
                         f"equal only after dropping legal-form/holdings words ('{ent['name']}' vs '{h['name']}')",
                         None, "loose-equal")

    def child_name_exact(self, ent, ch, matched_ciks):
        """A recipient whose OWN name equals a registrant while the group/parent says otherwise."""
        idx = self.idx
        sk, lk = strict_key(ch["name"]), loose_key(ch["name"])
        hits = idx.by_strict.get(sk)
        strict = bool(hits)
        hits = hits or idx.by_loose.get(lk)
        if not hits or {h["cik"] for h in hits} <= matched_ciks:
            return
        ciks = {h["cik"] for h in hits}
        self.stats["child_conflict" if strict else "child_loose"] += 1
        for h in hits:
            amb = f" (name shared by {len(ciks)} registrants)" if len(ciks) > 1 else ""
            self.add(ent, h, "exact_normalized", 1.0 if strict and len(ciks) == 1 else 0.95, "needs_review",
                     ("recipient name equals the SEC registrant" if strict else
                      f"recipient name equals the registrant only after dropping legal-form words ('{h['name']}')")
                     + f", but USAspending lists its parent as '{ent['name']}'{amb}", ch,
                     "child-vs-parent conflict")

    def fuzzy(self, ent):
        idx = self.idx
        ta = loose_tokens(ent["name"])
        if not ta:
            return
        ents_ob = ent_dollars(ent)[1]
        cands = {}
        for t in set(ta):
            if 0 < idx.df(t) <= RARE_DF:
                for lk in idx.by_token[t]:
                    cands[lk] = None
        found = []
        for lk in cands:
            tb = lk.split()
            if tb == ta:
                continue
            shared = set(ta) & set(tb)
            score, note, hint, weak = 0.0, "", "", False
            short, long_, a_is_short = (ta, tb, True) if len(ta) <= len(tb) else (tb, ta, False)
            if long_[:len(short)] == short and (len(short) >= 2 or (idx.df(short[0]) <= 3 and len(short[0]) >= 4)):
                score, hint = PREFIX_SCORE, "name-prefix"
                note = ("registrant's name begins with the contractor's name" if a_is_short
                        else "contractor name begins with the registrant's name")
            else:
                w_sh = sum(idx.idf(t) for t in shared)
                w_un = sum(idx.idf(t) for t in set(ta) | set(tb))
                j = w_sh / w_un if w_un else 0.0
                if j >= JACCARD_MIN and (len(shared) >= 2 or any(idx.df(t) <= 3 for t in shared)):
                    score, hint, note = min(0.89, round(j, 3)), "similar", f"similar names (weighted word overlap {j:.2f})"
                elif (ents_ob >= WEAK_MIN_OBLIGATED and ta[0] == tb[0]
                      and idx.df(ta[0]) <= 2 and len(ta[0]) >= 5):
                    # same distinctive FIRST word ('JACOBS ENGINEERING GROUP' / 'JACOBS SOLUTIONS'):
                    # only worth keeping when an SEC former name confirms it (see enrich)
                    score, hint, note, weak = WEAK_SCORE, "shared-word", "shares a distinctive first word", True
            if score:
                found.append((score, lk, note, hint, weak))
        found.sort(key=lambda x: -x[0])
        for score, lk, note, hint, weak in found[:3]:
            for h in idx.by_loose[lk]:
                self.add(ent, h, "fuzzy", score, "needs_review", note + (" [weak]" if weak else ""), None, hint)
        self.stats["fuzzy_entities" if found else "no_candidate"] += 1


def match_entities(ents, idx, use_ex21=True):
    m = Matcher(idx, use_ex21)
    for ent in ents.values():
        matched_ciks = set()
        hits = idx.by_strict.get(strict_key(ent["name"]))
        if hits and len({h["cik"] for h in hits}) == 1:
            m.parent_chain(ent, hits)
            matched_ciks = {hits[0]["cik"]}
        elif hits:
            m.group_exact_review(ent, hits, True)
        else:
            lhits = idx.by_loose.get(loose_key(ent["name"]))
            if lhits:
                m.group_exact_review(ent, lhits, False)
            else:
                m.fuzzy(ent)
        for ch in ent["children"].values():
            if ch["uei"] == ent["uei"] or loose_key(ch["name"]) == loose_key(ent["name"]):
                continue
            m.child_name_exact(ent, ch, matched_ciks)
    return m


REVERSE_MIN_OBLIGATED = 5e6


def ex21_reverse(m, ents, idx):
    """Recipients whose own USAspending parent is themselves (Dynetics, GD Land Systems ...) can still be owned by a
    registrant we already link: the registrant's SEC subsidiary list (EX-21) names them. That is ownership evidence
    from an official filing, but it is not the parent field and not an exact name match, so it is only queued
    (needs_review), never auto-confirmed."""
    ciks = sorted({r["cik"] for r in m.rows.values() if r["status"] == "auto_confirmed"})
    docs = {}
    for c in ciks:
        d = sec_ex21(c)
        if d:
            docs[c] = d
    have = {(r["recipient_parent_uei"], r["recipient_uei"], r["cik"]) for r in m.rows.values()}
    done = {(r["recipient_parent_uei"], r["recipient_uei"]) for r in m.rows.values() if r["status"] == "auto_confirmed"}
    added = 0
    for ent in ents.values():
        for ch in ent["children"].values():
            if ch["obl"] < REVERSE_MIN_OBLIGATED or (ent["uei"], ch["uei"]) in done or JV_NAME.search(ascii_up(ch["name"])):
                continue
            k = loose_key(ch["name"])
            if len(k.replace(" ", "")) < 7 or k in GENERIC:
                continue
            hits = [c for c, d in docs.items() if f" {k} " in d["text"]]
            if len(hits) != 1 or (ent["uei"], ch["uei"], hits[0]) in have:
                continue                    # not listed anywhere, or listed by 2+ registrants (ambiguous)
            c = hits[0]
            have.add((ent["uei"], ch["uei"], c))
            for h in idx.by_cik.get(c, []):
                if h.get("linkable", True):
                    m.add(ent, h, "parent_chain", 0.90, "needs_review",
                          f"recipient is named in the registrant's SEC subsidiary list (EX-21, which also lists "
                          f"minority-owned entities): {docs[c]['url']}; USAspending's parent field "
                          f"('{ent['name']}') does not link it", ch, "ex21-listed")
            added += 1
    return added


FUZZY_MIN_OBLIGATED = 5e6


def prune_low_priority(rows, ents, trades):
    """Fuzzy candidates only enter the review queue when the contractor is big or the ticker is traded."""
    drop = [k for k, r in rows.items()
            if r["match_method"] == "fuzzy"
            and ent_dollars(ents[r["recipient_parent_uei"]])[1] < FUZZY_MIN_OBLIGATED
            and r["ticker"] not in trades]
    for k in drop:
        del rows[k]
    return len(drop)


def enrich(rows, ents):
    """SEC submissions for every CIK still in the review queue: former names -> alias, plus SIC/state."""
    ciks = sorted({r["cik"] for r in rows.values() if r["status"] == "needs_review"})
    print(f"  enriching {len(ciks)} CIKs from SEC submissions (4 requests/s)...", flush=True)
    prof = {}
    for i, c in enumerate(ciks):
        prof[c] = sec_profile(c)
        if i and i % 100 == 0:
            print(f"    {i}/{len(ciks)}", flush=True)
    drop = []
    for key, r in rows.items():
        if r["status"] != "needs_review":
            continue
        p = prof.get(r["cik"])
        r["_profile"] = p
        weak = "[weak]" in (r["notes"] or "")
        if p:
            names = r["recipient_name"] or r["recipient_parent_name"]
            ek, el = strict_key(names), loose_key(names)
            for fn in p["formerNames"]:
                if strict_key(fn["name"]) == ek or loose_key(fn["name"]) == el:
                    when = (fn.get("to") or "")[:10]
                    r["match_method"], r["_hint"] = "alias", "former-name"
                    r["match_score"] = 0.97 if strict_key(fn["name"]) == ek else 0.95
                    r["notes"] = f"matches SEC former name '{fn['name']}' (until {when}); current SEC name '{r['sec_name']}'"
                    weak = False
                    break
        if weak:
            drop.append(key)
    for k in drop:
        del rows[k]
    return prof


# ─── Trades ────────────────────────────────────────────────────────────────────
def load_trade_tickers():
    rows = fetch_all("congress_trades", "id,ticker,company_name,member_name")
    agg = {}
    for r in rows:
        tk = norm_ticker(r["ticker"] or "")
        if not tk:
            continue
        a = agg.setdefault(tk, {"trades": 0, "members": set(), "names": Counter(), "raw": set()})
        a["trades"] += 1
        a["members"].add(r["member_name"])
        a["names"][(r["company_name"] or "").strip()] += 1
        a["raw"].add(r["ticker"])
    return agg


# ─── Commands ──────────────────────────────────────────────────────────────────
def cmd_match(a):
    sec = load_sec()
    awards = load_awards()
    ents = build_entities(awards)
    idx = SecIndex(sec)
    print(f"SEC rows {len(sec)} (CIKs {len(idx.by_cik)}); awards {len(awards)}; contractor entities {len(ents)}")
    m = match_entities(ents, idx, use_ex21=not a.no_enrich)
    trades = load_trade_tickers()
    dropped = prune_low_priority(m.rows, ents, trades)
    print(f"  dropped {dropped} low-priority fuzzy candidates (entity < ${FUZZY_MIN_OBLIGATED / 1e6:.0f}M obligated "
          f"and ticker never traded in congress_trades)")
    if not a.no_enrich:
        print(f"  EX-21 reverse lookups added {ex21_reverse(m, ents, idx)} recipient/registrant candidates")
        enrich(m.rows, ents)
    rows = m.rows
    print("entity stats:", dict(m.stats))
    print("rows by status:", dict(Counter(r["status"] for r in rows.values())),
          " by method:", dict(Counter((r["status"], r["match_method"]) for r in rows.values())))
    if a.dry_run:
        return 0
    t0 = time.time()
    log_id = log_start("company_tickers:r7-v1:match")
    try:
        write_rows(rows, a.prune)
        log_end(log_id, "completed", len(rows), [], t0)
    except Exception as e:  # noqa: BLE001
        log_end(log_id, "failed", 0, [str(e)[:300]], t0)
        raise
    return 0


def log_start(sync_type):
    try:
        d = dt.date.today().isoformat()
        return sb().table("sync_log").insert({"sync_type": sync_type, "start_date": d, "end_date": d,
                                              "status": "running"}).execute().data[0]["id"]
    except Exception as e:  # noqa: BLE001
        print(f"  (sync_log insert failed: {e})")
        return None


def log_end(log_id, status, synced, errors, t0):
    if not log_id:
        return
    try:
        sb().table("sync_log").update({
            "status": status, "records_synced": synced, "errors": errors[:20],
            "duration_ms": int((time.time() - t0) * 1000),
            "completed_at": dt.datetime.now(dt.timezone.utc).isoformat()}).eq("id", log_id).execute()
    except Exception as e:  # noqa: BLE001
        print(f"  (sync_log update failed: {e})")


def write_rows(rows, prune):
    existing = fetch_all("company_tickers", "id,ticker,recipient_parent_uei,recipient_uei,status,reviewed_at,match_method")
    ek = lambda r: (r["ticker"], r["recipient_parent_uei"], r["recipient_uei"])  # noqa: E731
    keep = {ek(r) for r in existing
            if r["reviewed_at"] or r["status"] in ("manual_confirmed", "rejected") or r["match_method"] == "manual"}
    out = []
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    for k, r in rows.items():
        if k in keep:
            continue
        o = {c: v for c, v in r.items() if not c.startswith("_")}
        o["matched_at"] = now
        out.append(o)
    done = 0
    # supabase-py needs a uniform key set per upsert call; all rows share it.
    for i in range(0, len(out), 500):
        sb_call(lambda: sb().table("company_tickers").upsert(
            out[i:i + 500], on_conflict="ticker,recipient_parent_uei,recipient_uei").execute())
        done += len(out[i:i + 500])
    print(f"upserted {done} rows; preserved {len(keep)} reviewed rows")
    if prune:
        seen = set(rows) | keep
        stale = [r["id"] for r in existing if ek(r) not in seen]
        for i in range(0, len(stale), 200):
            sb_call(lambda: sb().table("company_tickers").delete().in_("id", stale[i:i + 200]).execute())
        print(f"pruned {len(stale)} stale rows")


def cmd_review(a):
    """Record a person's decision on needs_review rows: all tickers of one CIK for one entity (or, with
    --all-children, for every recipient of that parent group)."""
    q = (sb().table("company_tickers").select("id,ticker,status,recipient_uei").eq("recipient_parent_uei", a.uei)
         .eq("cik", a.cik.zfill(10)))
    if a.recipient_uei:
        q = q.eq("recipient_uei", a.recipient_uei)
    elif not a.all_children:
        q = q.is_("recipient_uei", "null")
    rows = [r for r in sb_call(lambda: q.execute().data) if r["status"] == "needs_review" or a.status == "needs_review"]
    if not rows:
        sys.exit("no matching needs_review rows")
    upd = {"status": a.status, "reviewed_by": a.by, "reviewed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
           "notes": a.note}
    if a.status == "manual_confirmed":
        upd["match_method"] = "manual"
    sb_call(lambda: sb().table("company_tickers").update(upd).in_("id", [r["id"] for r in rows]).execute())
    print(f"{len(rows)} rows ({', '.join(sorted({r['ticker'] for r in rows}))}) -> {a.status}")
    return 0


# ─── Report ────────────────────────────────────────────────────────────────────
def load_links():
    return fetch_all("company_tickers",
                     "id,cik,ticker,sec_name,exchange,recipient_parent_uei,recipient_parent_name,"
                     "recipient_uei,recipient_name,entity_level,match_method,match_score,status,notes,evidence_url")


def link_index(links, statuses):
    """(parent_uei, recipient_uei|None) -> list of link rows, for the given statuses."""
    ix = defaultdict(list)
    for l in links:
        if l["status"] in statuses:
            ix[(l["recipient_parent_uei"], l["recipient_uei"])].append(l)
    return ix


def award_links(award, ix):
    g = award["recipient_parent_uei"] or award["recipient_uei"]
    return ix.get((g, None), []) + ix.get((g, award["recipient_uei"]), [])


def money(x):
    return f"${x / 1e9:,.2f}B" if abs(x) >= 1e9 else f"${x / 1e6:,.1f}M"


def cmd_report(a):
    os.makedirs(a.out, exist_ok=True)
    fy = a.fy
    awards = load_awards()
    ents = build_entities(awards)
    links = load_links()
    sec = SecIndex(load_sec())
    trades = load_trade_tickers()
    summ = sb_call(lambda: sb().table("contract_spending_summary").select("*").eq("fiscal_year", fy).eq("agency_code", "ALL").execute().data)
    ix_auto = link_index(links, {"auto_confirmed"})
    ix_conf = link_index(links, {"auto_confirmed", "manual_confirmed"})
    ix_any = link_index(links, {"auto_confirmed", "manual_confirmed", "needs_review"})
    out = {"fiscal_year": fy, "rule": RULE_VERSION, "generated": dt.datetime.now(dt.timezone.utc).isoformat()}

    # ── coverage: dollars of loaded FY awards whose recipient maps to a ticker
    def coverage(rows, label):
        tot = sum(float(r["obligated_amount"] or 0) for r in rows)
        res = {"awards": len(rows), "obligated": tot}
        for name, ix in (("auto_confirmed", ix_auto), ("confirmed_incl_manual", ix_conf), ("upper_bound_if_all_review_approved", ix_any)):
            hit = [r for r in rows if award_links(r, ix)]
            ob = sum(float(r["obligated_amount"] or 0) for r in hit)
            res[name] = {"awards": len(hit), "obligated": ob, "pct_dollars": round(100 * ob / tot, 2) if tot else 0,
                         "pct_awards": round(100 * len(hit) / len(rows), 2) if rows else 0}
        out[label] = res

    fy_rows = [r for r in awards if r["fiscal_year"] == fy]
    coverage([r for r in fy_rows if r["extent_competed_code"] in NONCOMPETED], "coverage_noncompeted_loaded")
    coverage(fy_rows, "coverage_all_loaded")
    if summ:
        s = summ[0]
        nc_all = float(s["noncompeted_obligations"])
        out["denominator_ALL_noncompeted"] = nc_all
        out["auto_dollars_share_of_ALL_noncompeted"] = round(
            100 * out["coverage_noncompeted_loaded"]["auto_confirmed"]["obligated"] / nc_all, 2)
    for other in sorted({r["fiscal_year"] for r in awards} - {fy}):
        coverage([r for r in awards if r["fiscal_year"] == other and r["extent_competed_code"] in NONCOMPETED],
                 f"coverage_noncompeted_loaded_fy{other}")

    # ── top 50 parents by non-competed $, with how much of each parent's dollars carry a link
    cls = defaultdict(lambda: {"auto": 0.0, "review": 0.0, "none": 0.0})
    for r in fy_rows:
        if r["extent_competed_code"] not in NONCOMPETED:
            continue
        g = r["recipient_parent_uei"] or r["recipient_uei"]
        amt = float(r["obligated_amount"] or 0)
        cls["%s" % g]["auto" if award_links(r, ix_conf) else "review" if award_links(r, ix_any) else "none"] += amt

    def entity_links(e, ix):
        got = list(ix.get((e["uei"], None), []))
        for c in e["children"]:
            got += ix.get((e["uei"], c), [])
        return got

    top = sorted(ents.values(), key=lambda e: -ent_dollars(e, fy)[2])[:50]
    top_rows = []
    for rank, e in enumerate(top, 1):
        n, ob, nc = ent_dollars(e, fy)
        c = cls[e["uei"]]
        got = entity_links(e, ix_conf) or entity_links(e, ix_any)
        status = ("auto_confirmed" if c["auto"] and not (c["review"] or c["none"]) else
                  "auto_confirmed (partial)" if c["auto"] else
                  "needs_review" if c["review"] else "no_match")
        tickers = sorted({l["ticker"] for l in got})
        ciks = sorted({l["cik"] for l in got})
        top_rows.append({"rank": rank, "parent": e["name"], "parent_uei": e["uei"], "awards": n,
                         "obligated": round(ob), "noncompeted": round(nc), "status": status,
                         "auto_noncompeted": round(c["auto"]), "review_only_noncompeted": round(c["review"]),
                         "unlinked_noncompeted": round(c["none"]),
                         "tickers": "/".join(tickers[:4]), "sec_name": got[0]["sec_name"] if got else "",
                         "cik": "/".join(ciks[:2]),
                         "recipients": "; ".join(sorted({ch["name"] for ch in e["children"].values()})[:3])})
    with open(os.path.join(a.out, f"r7-top50-parents-fy{fy}.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(top_rows[0]))
        w.writeheader()
        w.writerows(top_rows)
    out["top50"] = top_rows
    out["top50_noncompeted_total"] = sum(r["noncompeted"] for r in top_rows)
    out["top50_auto_noncompeted"] = sum(r["auto_noncompeted"] for r in top_rows)

    # ── trade side
    ticker_state = {}
    tk_status = defaultdict(set)
    for l in links:
        tk_status[l["ticker"]].add(l["status"])
    for tk, t in trades.items():
        rows = sec.by_ticker.get(tk, [])
        if not rows:
            st = "not_in_sec_list"
        else:
            sts = tk_status.get(tk, set())
            st = ("contractor_confirmed" if sts & {"auto_confirmed", "manual_confirmed"}
                  else "contractor_needs_review" if "needs_review" in sts else "no_contractor_link")
        ticker_state[tk] = st
    cnt = Counter(ticker_state.values())
    trade_n = Counter()
    mem = defaultdict(set)
    for tk, t in trades.items():
        trade_n[ticker_state[tk]] += t["trades"]
        mem[ticker_state[tk]] |= t["members"]
    out["trade_tickers"] = {"distinct_tickers": len(trades), "by_state": dict(cnt),
                            "trades_by_state": dict(trade_n), "members_by_state": {k: len(v) for k, v in mem.items()},
                            "total_trades": sum(t["trades"] for t in trades.values())}

    # unmapped trade tickers (not in SEC list) vs contractor names: help review of historical tickers
    ent_loose = defaultdict(list)
    for e in ents.values():
        ent_loose[loose_key(e["name"])].append(e)
    un_rows = []
    for tk, t in sorted(trades.items(), key=lambda kv: -kv[1]["trades"]):
        if ticker_state[tk] != "not_in_sec_list":
            continue
        nm = t["names"].most_common(1)[0][0]
        cand = ent_loose.get(loose_key(nm), []) if nm else []
        un_rows.append({"ticker": tk, "trades": t["trades"], "members": len(t["members"]), "company_name_in_disclosure": nm,
                        "contractor_candidate": "; ".join(f"{e['name']} ({e['uei']})" for e in cand)})
    with open(os.path.join(a.out, "r7-trade-tickers-not-in-sec.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ticker", "trades", "members", "company_name_in_disclosure", "contractor_candidate"])
        w.writeheader()
        w.writerows(un_rows)
    out["trade_tickers"]["not_in_sec_with_contractor_name_candidate"] = sum(1 for r in un_rows if r["contractor_candidate"])

    # contractor-linked trade tickers with volume (for the report)
    linked = []
    for tk, t in trades.items():
        if ticker_state[tk] in ("contractor_confirmed", "contractor_needs_review"):
            want = ("auto_confirmed", "manual_confirmed") if ticker_state[tk] == "contractor_confirmed" else ("needs_review",)
            ent_names = sorted({l["recipient_parent_name"] for l in links if l["ticker"] == tk and l["status"] in want})
            linked.append({"ticker": tk, "trades": t["trades"], "members": len(t["members"]),
                           "state": ticker_state[tk], "contractor": "; ".join(ent_names[:2])})
    linked.sort(key=lambda r: -r["trades"])
    with open(os.path.join(a.out, "r7-trade-tickers-contractor-linked.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ticker", "trades", "members", "state", "contractor"])
        w.writeheader()
        w.writerows(linked)
    out["trade_tickers_confirmed_top15"] = [r for r in linked if r["state"] == "contractor_confirmed"][:15]

    # ── needs-review CSV: one row per (entity, recipient, CIK), tickers joined
    groups = {}
    for l in links:
        if l["status"] != "needs_review":
            continue
        k = (l["recipient_parent_uei"], l["recipient_uei"], l["cik"])
        g = groups.setdefault(k, {"rows": []})
        g["rows"].append(l)
    prof_cache = {}
    review = []
    for (puei, ruei, cik), g in groups.items():
        e = ents.get(puei)
        if not e:
            continue
        l0 = g["rows"][0]
        tickers = sorted({l["ticker"] for l in g["rows"]})
        tr = sum(trades.get(t, {}).get("trades", 0) for t in tickers)
        sub = e["children"].get(ruei) if ruei else e
        sub = sub or e
        n, ob, nc = ent_dollars(sub, fy)
        n_all, ob_all, nc_all = ent_dollars(sub)
        if cik not in prof_cache:
            prof_cache[cik] = sec_profile(cik) or {}
        p = prof_cache[cik]
        top_ = sub.get("top") or e["top"] or {}
        review.append({
            "fy_noncompeted": round(nc), "all_loaded_noncompeted": round(nc_all), "all_loaded_obligated": round(ob_all),
            "awards_all_loaded": n_all, "entity": e["name"] if not ruei else l0["recipient_name"],
            "entity_level": l0["entity_level"], "parent_in_usaspending": e["name"], "parent_uei": puei,
            "recipient_uei": ruei or "", "tickers": "/".join(tickers), "cik": cik, "sec_name": l0["sec_name"],
            "sec_sic": p.get("sicDescription") or "", "sec_state": p.get("businessState") or "",
            "sec_exchange": l0["exchange"] or "", "method": l0["match_method"], "score": l0["match_score"],
            "reason": l0["notes"], "reviewer_hint": "",
            "trades_in_congress_trades": tr, "edgar_url": l0["evidence_url"],
            "sample_award_url": top_.get("url") or "", "sample_award_description": (top_.get("desc") or "")[:140],
            "sample_naics": top_.get("naics") or "", "recipient_location": top_.get("loc") or "",
            "decide_command": (f'python src/scripts/load_company_tickers.py review --uei {puei} --cik {cik} '
                               + (f'--recipient-uei {ruei} ' if ruei else '') + '--status manual_confirmed|rejected --by <who> --note "<why>"'),
        })
    # reviewer hint, derived from the stored notes (the hint itself is not stored in the table)
    def hint_for(n_):
        n_ = n_ or ""
        for prefix, h in (("matches SEC former name", "likely same company: SEC former name"),
                          ("equal only after", "likely same company: legal-form words differ"),
                          ("recipient name equals", "check: USAspending parent disagrees"),
                          ("ambiguous", "ambiguous: 2+ SEC registrants"),
                          ("USAspending lists the parent", "parent field unverified: child name unrelated, not in EX-21"),
                          ("recipient is a joint venture", "joint venture: only partly owned"),
                          ("recipient is named in the registrant's SEC subsidiary list", "likely owned: named in registrant's EX-21"),
                          ("contractor name begins with", "possible subsidiary: check ownership"),
                          ("registrant's name begins with", "possible match: registrant name extends contractor name"),
                          ("similar names", "similar names: low confidence")):
            if n_.startswith(prefix):
                return h
        return "check"
    for r in review:
        r["reviewer_hint"] = hint_for(r["reason"])
    review.sort(key=lambda r: (-r["fy_noncompeted"], -r["all_loaded_obligated"]))
    with open(os.path.join(a.out, "r7-needs-review.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(review[0]) if review else ["empty"])
        w.writeheader()
        w.writerows(review)
    out["needs_review"] = {"rows_in_table": sum(1 for l in links if l["status"] == "needs_review"),
                           "csv_rows_entity_cik": len(review),
                           "by_hint": dict(Counter(r["reviewer_hint"] for r in review))}
    out["table"] = {"rows": len(links), "by_status": dict(Counter(l["status"] for l in links)),
                    "by_method": {f"{k[0]}/{k[1]}": v for k, v in Counter((l["status"], l["match_method"]) for l in links).items()},
                    "distinct_entities_auto": len({l["recipient_parent_uei"] for l in links if l["status"] == "auto_confirmed"}),
                    "distinct_ciks_auto": len({l["cik"] for l in links if l["status"] == "auto_confirmed"})}
    with open(os.path.join(a.out, "r7-coverage.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, default=str)
    brief = {k: v for k, v in out.items() if k not in ("top50", "trade_tickers_confirmed_top15")}
    print(json.dumps(brief, indent=1, default=str)[:6000])
    return 0


# ─── Verify ────────────────────────────────────────────────────────────────────
def cmd_verify(a):
    """Re-check a random sample of auto_confirmed links against the two source records: the USAspending
    award page's recipient/parent and the SEC submissions record of the CIK."""
    links = [l for l in load_links() if l["status"] == "auto_confirmed"]
    awards = load_awards()
    by_recipient = defaultdict(list)
    for r in awards:
        by_recipient[r["recipient_uei"]].append(r)
    pairs = {}
    for l in links:
        pairs.setdefault((l["recipient_uei"] or l["recipient_parent_uei"], l["cik"]), []).append(l)
    keys = sorted(pairs)
    random.Random(a.seed).shuffle(keys)
    sample = keys[:a.n]
    print(f"auto_confirmed (recipient, CIK) pairs: {len(keys)}; sampling {len(sample)} (seed {a.seed})")
    results = []
    for ruei, cik in sample:
        ls = pairs[(ruei, cik)]
        l0 = ls[0]
        grp = [r for r in by_recipient[ruei] if (r["recipient_parent_uei"] or r["recipient_uei"]) == l0["recipient_parent_uei"]]
        top = max(grp or by_recipient[ruei], key=lambda r: float(r["obligated_amount"] or 0))
        direct = l0["match_method"] == "exact_normalized"
        expected = l0["recipient_name"] if direct else l0["recipient_parent_name"]
        res = {"recipient": l0["recipient_name"], "recipient_uei": ruei, "parent": l0["recipient_parent_name"],
               "parent_uei": l0["recipient_parent_uei"], "cik": cik, "tickers": sorted(l["ticker"] for l in ls),
               "sec_name_table": l0["sec_name"], "method": l0["match_method"], "evidence": l0["notes"],
               "award_id": top["id"], "award_url": top["usaspending_url"],
               "award_obligated": float(top["obligated_amount"] or 0), "award_description": (top["description"] or "")[:110],
               "naics": top["naics_description"], "checks": {}}
        try:
            aw = usa_get(f"/awards/{top['id']}/")
            rc = aw["recipient"]
            loc = rc.get("location") or {}
            res["usaspending"] = {"recipient_name": rc["recipient_name"], "recipient_uei": rc["recipient_uei"],
                                  "parent_name": rc["parent_recipient_name"], "parent_uei": rc["parent_recipient_uei"],
                                  "city": loc.get("city_name"), "state": loc.get("state_code"), "country": loc.get("location_country_code"),
                                  "recipient_page": (f"https://www.usaspending.gov/recipient/{rc['parent_recipient_hash']}/latest"
                                                     if rc.get("parent_recipient_hash") else None)}
            res["checks"]["usaspending_recipient_uei_matches_table"] = rc["recipient_uei"] == ruei
            res["checks"]["usaspending_parent_uei_matches_table"] = (rc["parent_recipient_uei"] or rc["recipient_uei"]) == l0["recipient_parent_uei"]
            res["checks"]["usaspending_names_match_table"] = (strict_key(rc["recipient_name"]) == strict_key(l0["recipient_name"])
                                                              and strict_key(rc["parent_recipient_name"] or rc["recipient_name"]) == strict_key(l0["recipient_parent_name"]))
            ent_name = rc["recipient_name"] if direct else (rc["parent_recipient_name"] or rc["recipient_name"])
        except Exception as e:  # noqa: BLE001
            res["usaspending_error"] = str(e)[:200]
            ent_name = None
        p = sec_profile(cik)
        if p:
            res["sec"] = {"name": p["name"], "entityType": p["entityType"], "sic": p["sicDescription"],
                          "businessState": p["businessState"], "city": p["businessCity"],
                          "stateOfIncorporation": p["stateOfIncorporation"], "tickers": p["tickers"],
                          "exchanges": p["exchanges"], "category": p["category"]}
            res["checks"]["sec_name_equals_usaspending_name"] = bool(ent_name) and strict_key(p["name"]) == strict_key(ent_name)
            sec_tk = {x.upper() for x in p["tickers"]}
            res["checks"]["sec_lists_every_table_ticker"] = all(t in sec_tk or t.replace("-", ".") in sec_tk or t.replace("-", "") in sec_tk
                                                                for t in res["tickers"])
            if res.get("usaspending", {}).get("state") and p["businessState"]:
                res["info_state_equal"] = res["usaspending"]["state"] == p["businessState"]
        res["auto_checks_pass"] = bool(res["checks"]) and all(res["checks"].values())
        results.append(res)
        print(f"  {(res['recipient'] or '')[:34]:34} {','.join(res['tickers'])[:12]:12} pass={res['auto_checks_pass']}", flush=True)
    summary = {"n": len(results), "auto_checks_pass": sum(1 for r in results if r["auto_checks_pass"]), "seed": a.seed,
               "population_pairs": len(keys)}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, indent=1)
    print(json.dumps(summary))
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("match")
    m.add_argument("--dry-run", action="store_true")
    m.add_argument("--prune", action="store_true", help="delete unreviewed rows this run did not produce")
    m.add_argument("--no-enrich", action="store_true", help="skip SEC submissions lookups (no alias detection)")
    r = sub.add_parser("report")
    r.add_argument("--out", required=True)
    r.add_argument("--fy", type=int, default=2026)
    v = sub.add_parser("verify")
    v.add_argument("--n", type=int, default=30)
    v.add_argument("--seed", type=int, default=7)
    v.add_argument("--out", required=True)
    rv = sub.add_parser("review")
    rv.add_argument("--uei", required=True)
    rv.add_argument("--cik", required=True)
    rv.add_argument("--recipient-uei")
    rv.add_argument("--all-children", action="store_true", help="apply to every recipient of the parent group")
    rv.add_argument("--status", required=True, choices=["manual_confirmed", "rejected", "needs_review"])
    rv.add_argument("--by", required=True)
    rv.add_argument("--note", required=True)
    a = p.parse_args()
    return {"match": cmd_match, "report": cmd_report, "verify": cmd_verify, "review": cmd_review}[a.cmd](a) or 0


if __name__ == "__main__":
    sys.exit(main())
