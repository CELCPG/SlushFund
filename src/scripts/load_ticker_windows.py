#!/usr/bin/env python3
"""R6b: make company_tickers (R7) instrument-aware and date-aware.

Audit A7 (T1-T3): the contractor-to-ticker link must not say a member "traded a contractor" when the
security was a note, or when the company was not owned by that registrant, or not listed, at the time.
This script fills the columns added by supabase/migrations/20261006_r6b_ticker_windows.sql:

  instrument_class   common | adr | preferred | note | etn | warrant | unit | other   (step 2)
  valid_from/to      listing window of the registrant (step 3) and acquisition/divestiture window of a
                     subsidiary (step 4); NULL = open bound
  window_status      same_entity | checked | unchecked
  window_source      URL of the EDGAR filing that proves the date
  window_checked_at

Sources are official only: SEC EDGAR (submissions API, company_tickers_exchange.json, filing cover pages,
8-K / 10-K / 10-Q text, EDGAR full-text search). Requests: at most 1 per second to each host, with a
generic non-personal User-Agent. Every fetch is cached and the run is resumable.

Commands (repo root; `node scripts/gaming-mode.mjs check` first, exit 3 = stop):
  fetch       download the SEC records every later step needs (submissions per CIK, cover pages)
  classify    step 2: instrument_class for every link row -> evidence file, then write to the DB
  listing     step 3: registrant listing / delisting windows -> evidence file, then write
  acquire     step 4: subsidiary acquisition windows (priority order) -> evidence file, then write
  apply       write the evidence files to the DB (idempotent; run after every `load_company_tickers.py match`)
  report      counts by class and window_status, and the 'unchecked' links a member trade touches
  verify      re-check random 'checked' windows against their source filing

Evidence (JSON, one record per decision, with the source URL) is kept in --evidence-dir
(default <repo>/../openclaw-shared/projects/slushfund/r6b-evidence when it exists, else ./r6b-evidence).
"""
import argparse
import datetime as dt
import html
import json
import os
import random
import re
import sys
import tempfile
import time
from collections import Counter, defaultdict

from _venv import activate as _activate_venv
_activate_venv()

import requests  # noqa: E402

from load_company_tickers import (  # noqa: E402
    ascii_up, base_tokens, fetch_all, loose_key, sb, sb_call, strict_key,
)

SEC_UA = "SlushFund research audit@slushfund.net"    # generic project address, never a person's details
SEC_INTERVAL = 1.05                                  # brief: at most 1 request per second per host
WINDOW_START = "2020-10-01"                          # trades/awards of interest start here
TODAY = dt.date.today().isoformat()
CACHE_DIR = os.environ.get("SLUSHFUND_R6B_CACHE", os.path.join(tempfile.gettempdir(), "slushfund-r6b-cache"))
SHARED = r"C:\Users\clong\openclaw-shared\projects\slushfund\r6b-evidence"
INSTRUMENT_CLASSES = ("common", "adr", "preferred", "note", "etn", "warrant", "unit", "other")
# A7 T2: an index-linked product of Goldman Sachs, not an ownership line. Removed from company_tickers.
DROP_TICKERS = {"GSCE"}

_S = requests.Session()
_last = defaultdict(float)


# ─── polite HTTP + cache ───────────────────────────────────────────────────────
def _wait(host):
    gap = time.monotonic() - _last[host]
    if gap < SEC_INTERVAL:
        time.sleep(SEC_INTERVAL - gap)
    _last[host] = time.monotonic()


def http_get(url, as_json=False, max_bytes=None, accept=None):
    """GET with retries. Returns parsed JSON, or text (cut to max_bytes). None on 404."""
    host = re.sub(r"^https?://([^/]+).*", r"\1", url)
    err = ""
    for attempt in range(5):
        _wait(host)
        try:
            hdr = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}
            if accept:
                hdr["Accept"] = accept
            r = _S.get(url, headers=hdr, timeout=90, stream=max_bytes is not None)
            if r.status_code == 404:
                return None
            if r.status_code < 400:
                if as_json:
                    return r.json()
                if max_bytes is None:
                    return r.text
                buf = b""
                for chunk in r.iter_content(65536):
                    buf += chunk
                    if len(buf) >= max_bytes:
                        break
                r.close()
                return buf.decode(r.encoding or "utf-8", errors="replace")
            err = f"HTTP {r.status_code}"
            if r.status_code < 500 and r.status_code != 429:
                raise RuntimeError(f"GET {url} -> {err}")
        except requests.RequestException as e:
            err = str(e)[:100]
        time.sleep(min(60, 3 * 2 ** attempt))
        print(f"  retry {attempt + 1}/4 after: {err}", flush=True)
    raise RuntimeError(f"GET {url} failed after 5 tries: {err}")


def cache_path(name):
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, name)


def cached_json(name, fetch):
    p = cache_path(name)
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    data = fetch()
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def gaming_check():
    """Exit code 3 of the workspace gaming-mode script means Colin is gaming: checkpoint and stop."""
    import subprocess
    try:
        r = subprocess.run(["node", r"C:\Users\clong\.openclaw\workspace\scripts\gaming-mode.mjs", "check"],
                           capture_output=True, text=True, timeout=30)
        if r.returncode == 3:
            sys.exit("gaming mode is on: checkpoint saved, stopping (rerun later; every fetch is cached)")
    except FileNotFoundError:
        pass


def evidence_dir(a=None):
    d = getattr(a, "evidence_dir", None) or (SHARED if os.path.isdir(os.path.dirname(SHARED)) else "r6b-evidence")
    os.makedirs(d, exist_ok=True)
    return d


def read_json(path, default=None):
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, sort_keys=True, ensure_ascii=False)


# ─── SEC records ───────────────────────────────────────────────────────────────
def filing_url(cik, acc, doc=None):
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}"
    return f"{base}/{doc}" if doc else base


def sec_submissions(cik):
    """Compact SEC submissions record: profile + every filing dated 2020-06-01 or later (older index pages are
    fetched only when they overlap that period) + the registrant's first filing date (from page metadata)."""
    def fetch():
        d = http_get(f"https://data.sec.gov/submissions/CIK{cik}.json", as_json=True)
        if d is None:
            return {"cik": cik, "missing": True}
        fil = d.get("filings") or {}
        rec = fil.get("recent") or {}
        rows = [dict(zip(rec.keys(), vals)) for vals in zip(*rec.values())] if rec else []
        first = min([r["filingDate"] for r in rows] or ["9999"])
        for f in fil.get("files") or []:
            first = min(first, f.get("filingFrom") or first)
            if (f.get("filingTo") or "") >= "2020-06-01":
                page = http_get("https://data.sec.gov/submissions/" + f["name"], as_json=True) or {}
                rows += [dict(zip(page.keys(), vals)) for vals in zip(*page.values())] if page else []
        keep = [{"form": r["form"], "date": r["filingDate"], "acc": r["accessionNumber"],
                 "doc": r.get("primaryDocument"), "items": r.get("items") or "",
                 "desc": r.get("primaryDocDescription") or "", "report": r.get("reportDate") or ""}
                for r in rows if r["filingDate"] >= "2020-06-01"]
        return {"cik": cik, "name": d.get("name"), "entityType": d.get("entityType"), "sic": d.get("sic"),
                "sicDescription": d.get("sicDescription"), "state": d.get("stateOfIncorporation"),
                "tickers": d.get("tickers") or [], "exchanges": d.get("exchanges") or [],
                "formerNames": d.get("formerNames") or [], "firstFiling": first, "filings": keep}
    return cached_json(f"subs_{cik}.json", fetch)


def latest_annual(sub):
    for f in sorted(sub.get("filings", []), key=lambda r: r["date"], reverse=True):
        if f["form"] in ("10-K", "10-K/A", "20-F", "40-F", "10-K405") and f["form"] != "10-K/A":
            return f
    return None


def cover_securities(cik, sub):
    """Securities registered under section 12(b) as printed on the latest annual report's cover:
    [{title, symbol, exchange}], from the filing's XBRL cover page (R1.htm), else the main document's head."""
    def fetch():
        ann = latest_annual(sub)
        if not ann:
            return {"none": True}
        out = []
        r1 = http_get(filing_url(cik, ann["acc"], "R1.htm"))
        if r1:
            txt = re.sub(r"<[^>]+>", "|", html.unescape(r1))
            txt = re.sub(r"(\|\s*)+", "|", txt)
            parts = [p.strip() for p in txt.split("|") if p.strip()]
            cur = {}
            for i, p in enumerate(parts):
                if p == "Title of 12(b) Security" and i + 1 < len(parts):
                    if cur.get("title"):
                        out.append(cur)
                    j = i + 1                     # a title can span several cells: read up to the next label
                    pieces = []
                    while j < len(parts) and parts[j] not in ("Trading Symbol", "Security Exchange Name",
                                                              "No Trading Symbol Flag", "Title of 12(b) Security"):
                        pieces.append(parts[j])
                        j += 1
                    cur = {"title": " ".join(pieces)}
                elif p == "Trading Symbol" and i + 1 < len(parts):
                    cur["symbol"] = parts[i + 1]
                elif p == "Security Exchange Name" and i + 1 < len(parts):
                    cur["exchange"] = parts[i + 1]
            if cur.get("title"):
                out.append(cur)
        res = {"form": ann["form"], "date": ann["date"], "acc": ann["acc"],
               "url": filing_url(cik, ann["acc"], ann["doc"]), "securities": out}
        if not out and ann.get("doc"):
            head = http_get(filing_url(cik, ann["acc"], ann["doc"]), max_bytes=400000)
            if head:
                t = html.unescape(re.sub(r"<[^>]+>", " ", head))
                t = re.sub(r"\s+", " ", t)
                i = t.lower().find("12(b)")
                res["head"] = t[max(0, i - 200): i + 2500] if i >= 0 else t[:2500]
        return res
    return cached_json(f"cover_{cik}.json", fetch)


# ─── step 2: instrument class ──────────────────────────────────────────────────
def title_class(title):
    """Instrument class from the security's registered title (cover page / 8-A)."""
    t = " " + re.sub(r"\s+", " ", (title or "").lower()) + " "
    if re.search(r"exchange[- ]traded note|\betns?\b", t):
        return "etn"
    if re.match(r"^\s*units?\b", t) or re.search(r"corporate units|equity units", t):
        return "unit"                        # SPAC units ('Units, each consisting of ...'), equity / corporate units
    if re.match(r"^\s*(common|ordinary|class [a-z]\b|limited partner)", t) and \
            not re.match(r"^\s*(common|ordinary|class [a-z]\b)[^,]*warrants?", t):
        return "common"                      # 'Common Shares ... including associated Share Purchase Rights'
    if re.search(r"\bwarrants?\b", t):
        return "warrant"
    if re.search(r"\brights?\b", t) and not re.search(r"shares|stock", t):
        return "other"
    if re.search(r"preferred units?", t):
        return "preferred"
    if re.search(r"(common|limited partner(ship)?|partnership) units?", t):
        return "common"                      # an MLP's common units are its ownership line
    if re.search(r"\bunits?\b", t) and not re.search(r"\bunits? of beneficial", t):
        return "unit"                        # SPAC units, equity / corporate units
    if re.search(r"\bnotes?\b|debentures?|\bbonds?\b|subordinated (?!preferred)|guaranteed|trust originated|"
                 r"senior (?!preferred)|\bdue (19|20)\d\d\b", t) and not re.search(r"preferred|preference", t):
        return "note"
    if re.search(r"preferred|preference|\bpfd\b", t):
        return "preferred"
    if re.search(r"depositary (shares|receipts)|\bads\b|\badrs?\b", t):
        return "adr"
    if re.search(r"common|ordinary|class [a-z]\b|shares|stock|capital stock|membership|units of beneficial", t):
        return "common"
    return "other"


def sym_matches(ticker, sym):
    """Does a cover-page trading symbol ('BA-PRA', 'BK PRK', 'ETprI', 'BBAI.WS', 'BC-C') denote SEC's ticker
    ('BA-PA', 'BNY-PK', 'ET-PI', 'BBAI-WT', 'BC-PC')?"""
    t = ascii_up(ticker).strip()
    s = re.sub(r"[^A-Z0-9]", "", ascii_up(sym))
    if not s:
        return False
    base, _, suf = t.partition("-")
    tc = re.sub(r"[^A-Z0-9]", "", t)
    if s == tc:
        return True
    m = re.fullmatch(r"P([A-Z])", suf)
    if m:                                                   # preferred-style suffix: PRA / PA / A
        return s in (base + "PR" + m.group(1), base + "P" + m.group(1), base + m.group(1))
    if suf in ("WT", "WS", "W"):
        return s in (base + "WS", base + "WT", base + "W")
    return False


# SEC's ticker file moved to a new symbol that the latest annual-report cover (filed earlier) does not show yet.
COVER_ALIASES = {"BNY": "BK", "BNY-PK": "BK PRK"}
# Securities no filing prints a symbol for. The reason is the evidence; each was checked by hand.
KNOWN_CLASS = {
    "TDDWW": ("warrant", "Tidewater's post-restructuring Series A warrants (OTC symbol ends in W); audit A7 T2"),
    "TDGMW": ("warrant", "Tidewater's post-restructuring Series B warrants (OTC symbol ends in W); audit A7 T2"),
    "DUKU": ("unit", "Duke Energy Corporate Units (equity units): cover of its 8-K filed 2026-09-25, "
                     "https://www.sec.gov/Archives/edgar/data/1326160/000110465926110588/tm2626114d1_8k.htm"),
    "MNESP": ("preferred", "MSA Safety's only other class is its 4.5% cumulative preferred nonvoting stock ($50 par; "
                           "10-Q Q2 2026, Note 8, 71,340 shares issued); OTC symbol's fifth letter P = preferred"),
}


def classify_ticker(ticker, sec_row, sub, cover, traded_fn=None):
    """-> (class, basis). basis says which evidence decided it."""
    sec_name = sec_row.get("sec_name") or ""
    exch = (sec_row.get("exchange") or "").upper()
    forms = {f["form"] for f in (sub or {}).get("filings", [])}
    fpi = bool(sub) and bool(forms & {"20-F", "40-F", "6-K"}) and "10-K" not in forms
    secs = (cover or {}).get("securities") or []
    if ticker in KNOWN_CLASS:
        return KNOWN_CLASS[ticker][0], KNOWN_CLASS[ticker][1]
    cands = [ticker] + ([COVER_ALIASES[ticker]] if ticker in COVER_ALIASES else [])
    matched = [s for s in secs
               if any(sym_matches(tk, s.get("symbol") or "") or ascii_up(s.get("symbol") or "") == tk for tk in cands)]
    if matched:
        # one symbol can carry the ordinary share and its ADS (WPP, RIO): the ADS is what trades in the US
        pick = next((s for s in matched if title_class(s["title"]) == "adr"), matched[0])
        c = title_class(pick["title"])
        if fpi and c == "common" and exch == "OTC":
            c = "adr"
        if c == "adr" and cover["form"] == "10-K" and not re.search(r"ordinary|common|american", pick["title"], re.I):
            c = "preferred"                  # a US registrant's bare 'Depositary Shares' are preferred-stock depositary shares
        title = re.sub(r"\s+", " ", pick["title"])[:300]
        return c, f"cover page of {cover['form']} filed {cover['date']}: '{title}' (symbol {pick.get('symbol')})"
    head = (cover or {}).get("head") or ""
    if head:
        m = re.search(r"(.{8,140}?)\s+" + re.escape(ticker) + r"\s+(?:The\s+)?(?:Nasdaq|New York|NYSE|Cboe|OTC)", head)
        if m:
            title = re.split(r"(?:Market|Exchange|LLC|NYSE|Nasdaq|Cboe)\s+", m.group(1))[-1]
            c = title_class(title)
            if c != "other":
                return c, f"cover text of {cover['form']} filed {cover['date']}: '{title.strip()[-90:]}'"
    # no cover entry: decide from the ticker's shape and the registrant
    if exch == "OTC" and re.fullmatch(r"[A-Z]{4}[FY]", ticker):
        return "adr", "OTC symbol ending F (foreign ordinary share) or Y (ADR), FINRA fifth-letter convention"
    if exch == "OTC" and re.fullmatch(r"[A-Z]{4}[C-EG-XZ]", ticker):
        return "other", f"OTC symbol ending {ticker[-1]} (a share-class / preferred suffix) and no filing names it: unresolved"
    if fpi or re.search(r"/ADR|\bADR\b", sec_name, re.I):
        return "adr", "foreign private issuer line (no 12(b) cover entry): OTC ordinary / ADR"
    traded_names = traded_fn(ticker) if traded_fn else None
    if traded_names:
        c = title_class(traded_names)
        if c in ("preferred", "note", "warrant", "unit", "etn", "adr"):
            return c, f"name printed on the members' disclosures: '{traded_names[:90]}'"
    if re.search(r"-P[A-Z]?$|-PR[A-Z]?$", ticker):
        return "other", "preferred-looking ticker with no cover-page match: unresolved"
    if re.search(r"-W[TS]?$", ticker) or (re.fullmatch(r"[A-Z]{4}W", ticker)):
        return "other", "warrant-looking ticker with no cover-page match: unresolved"
    if secs and len(secs) > 1:
        return "other", "registrant lists several securities and this ticker matches none: unresolved"
    if re.search(r"DEPOSITOR|INDEXPLUS|\bPPLUS\b|STRUCTURED|TRUST SERIES|TRUST CERTIFICATE", sec_name, re.I):
        return "other", "structured-product / trust-certificate registrant: not an ownership line"
    return "common", "single ordinary line: no other security registered under that ticker"


def load_links():
    return fetch_all("company_tickers", "id,cik,ticker,sec_name,exchange,status,entity_level,recipient_parent_uei,"
                                        "recipient_parent_name,recipient_uei,recipient_name,match_method,"
                                        "instrument_class,valid_from,valid_to,window_status,window_source")


def cmd_fetch(a):
    gaming_check()
    links = load_links()
    ciks = sorted({r["cik"] for r in links})
    print(f"{len(ciks)} CIKs; cache {CACHE_DIR}", flush=True)
    t0 = time.time()
    for i, cik in enumerate(ciks, 1):
        if i % 25 == 1:
            gaming_check()
        try:
            sub = sec_submissions(cik)
            if not sub.get("missing") and not a.no_cover:
                cover_securities(cik, sub)
        except Exception as e:  # noqa: BLE001 - one bad CIK must not stop the run
            print(f"  ! {cik}: {str(e)[:120]}", flush=True)
        if i % 25 == 0:
            print(f"  {i}/{len(ciks)} ({int(time.time() - t0)}s)", flush=True)
    print("fetch done")
    return 0


def traded_name(ticker):
    """The security name members' disclosures print for this ticker (most common value), or None."""
    rows = sb_call(lambda: sb().table("congress_trades").select("company_name").eq("ticker", ticker)
                   .limit(25).execute().data)
    names = Counter(r["company_name"] for r in rows if r.get("company_name"))
    return names.most_common(1)[0][0] if names else None


def cmd_classify(a):
    ev_dir = evidence_dir(a)
    links = load_links()
    by_ticker = {}
    for r in links:
        by_ticker.setdefault((r["cik"], r["ticker"]), r)
    out = {}
    for (cik, tk), r in sorted(by_ticker.items()):
        if tk in DROP_TICKERS:
            out[f"{cik}|{tk}"] = {"cik": cik, "ticker": tk, "class": "etn", "drop": True,
                                  "basis": "audit A7 T2: index-linked product, not an ownership line"}
            continue
        sub = sec_submissions(cik)
        cover = None if sub.get("missing") else cover_securities(cik, sub)
        c, basis = classify_ticker(tk, r, sub if not sub.get("missing") else None, cover, traded_name)
        out[f"{cik}|{tk}"] = {"cik": cik, "ticker": tk, "sec_name": r["sec_name"], "exchange": r["exchange"],
                              "class": c, "basis": basis}
    write_json(os.path.join(ev_dir, "r6b-classes.json"), out)
    print(Counter(v["class"] for v in out.values()))
    return 0


# ─── EDGAR full-text search + filing text (step 4) ─────────────────────────────
FTS_URL = "https://efts.sec.gov/LATEST/search-index"
ANNUAL_FORMS = "10-K,10-K405,20-F,40-F"
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
DATE_FULL = re.compile(r"(%s)\s+(\d{1,2}),?\s+(\d{4})" % MONTHS)
DATE_MONTH = re.compile(r"(%s)\s+(\d{4})" % MONTHS)
MONTH_NUM = {m: i for i, m in enumerate(MONTHS.split("|"), 1)}


def fts(phrase, cik, start="2001-01-01", end=None, forms=None):
    """EDGAR full-text search (efts.sec.gov), exact phrase, one registrant. Returns hits oldest first:
    {date, form, ftype, adsh, file, url}. Cached on disk; pages of 100."""
    end = end or TODAY
    key = re.sub(r"[^A-Za-z0-9]+", "_", f"{phrase}_{cik}_{start}_{end}_{forms}")[:150]

    def fetch():
        out, frm = [], 0
        while True:
            params = {"q": f'"{phrase}"', "dateRange": "custom", "startdt": start, "enddt": end,
                      "ciks": cik, "from": frm}
            if forms:
                params["forms"] = forms
            _wait("efts.sec.gov")
            r = _S.get(FTS_URL, params=params, headers={"User-Agent": SEC_UA}, timeout=90)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(5)
                _wait("efts.sec.gov")
                r = _S.get(FTS_URL, params=params, headers={"User-Agent": SEC_UA}, timeout=90)
            if r.status_code != 200:
                raise RuntimeError(f"FTS {r.status_code} for {phrase!r} {cik}")
            hits = (r.json().get("hits") or {}).get("hits") or []
            for h in hits:
                s = h["_source"]
                adsh, _, fn = h["_id"].partition(":")
                out.append({"date": s["file_date"], "form": s["form"], "ftype": s.get("file_type"),
                            "adsh": adsh, "file": fn, "period": s.get("period_ending"),
                            "url": filing_url(cik, adsh, fn)})
            if len(hits) < 100 or frm >= 400:
                return sorted(out, key=lambda x: (x["date"], x["file"]))
            frm += 100
    return cached_json(f"fts_{key}.json", fetch)


def filing_text(url, max_bytes=4_000_000):
    """A filing document as plain text (cached, cut to max_bytes)."""
    def fetch():
        raw = http_get(url, max_bytes=max_bytes)
        if raw is None:
            return {"missing": True}
        t = html.unescape(re.sub(r"<[^>]+>", " ", raw))
        return {"text": re.sub(r"\s+", " ", t)}
    d = cached_json("doc_" + re.sub(r"[^A-Za-z0-9]+", "_", url[-120:]) + ".json", fetch)
    return d.get("text")


def phrase_regex(phrase):
    return re.compile(r"\b" + r"[\s,.\-]+".join(re.escape(w) for w in phrase.split()) + r"\b", re.I)


def contexts(text, phrase, width=450, limit=3):
    """Snippets of text around each occurrence of the phrase."""
    out = []
    for m in phrase_regex(phrase).finditer(text or ""):
        out.append(text[max(0, m.start() - width): m.end() + width])
        if len(out) >= limit:
            break
    return out


def search_phrase(name):
    """The phrase to search for a recipient's name: ASCII, punctuation dropped, legal-form tail dropped
    (INC / LLC / CORP ...), at most 6 words."""
    words = loose_key(name).split()
    return " ".join(w.capitalize() if w.isalpha() and len(w) > 3 else w for w in words[:6])


# ─── step 4: acquisition / divestiture windows of subsidiary links ─────────────
def is_ex21(h):
    """A subsidiary list: EX-21 of a 10-K, or EX-8 / EX-21 of a 20-F / 40-F."""
    return (h.get("ftype") or "").upper().startswith(("EX-21", "EX-8"))


def parse_dates(snippet):
    """Dates in a snippet as (iso, precision, position); precision 'month' means only the month was stated
    and the LAST day of the month is returned (conservative for a valid_from)."""
    out = []
    for m in DATE_FULL.finditer(snippet):
        out.append((f"{int(m.group(3)):04d}-{MONTH_NUM[m.group(1)]:02d}-{int(m.group(2)):02d}", "day", m.start()))
    for m in DATE_MONTH.finditer(snippet):
        if any(abs(m.start() - d[2]) < 4 for d in out):
            continue
        y, mo = int(m.group(2)), MONTH_NUM[m.group(1)]
        last = (dt.date(y + (mo == 12), mo % 12 + 1, 1) - dt.timedelta(days=1)).day
        out.append((f"{y:04d}-{mo:02d}-{last:02d}", "month", m.start()))
    return out


MAIN_FORMS = ("8-K", "8-K/A", "10-Q", "10-K", "10-K405", "20-F", "40-F", "S-4", "S-4/A", "424B3", "DEFM14A",
              "DEFA14A", "425", "6-K")


ACQ_DONE = re.compile(
    r"\b(completed|consummated|closed|completes|has acquired|acquired)\b[^.]{0,260}\b(acquisition|merger|acquire|purchase)"
    r"|\b(acquisition|merger|purchase)\b[^.]{0,200}\b(completed|consummated|closed)\b", re.I)
ACQ_DOC_TYPES = ("8-K", "8-K/A", "EX-99", "EX-2")


def phrase_variants(name, reg_name):
    """Search phrases for a subsidiary: its full loose name; the name without the registrant's own leading words
    ('CACI Azure Summit Technology' -> 'Azure Summit Technology': subsidiary lists often drop the parent's name);
    the first two words when they are not just the registrant's name."""
    words = loose_key(name).split()[:6]
    rt = set(base_tokens(reg_name or ""))
    out = [" ".join(words)]
    # the same name with '&' written as 'and' ('Ordnance and Tactical') and 'USA' as 'U.S.A.'; the strict
    # normalisation above drops both, but a subsidiary list may print them
    raw = re.sub(r"[^A-Za-z0-9&\s]", " ", ascii_up(name).replace("U.S.A.", "USA").replace("U.S.", "US"))
    raw_words = [w for w in raw.replace("&", " AND ").split()]
    while len(raw_words) > 2 and raw_words[-1] in {"INC", "LLC", "CORP", "CO", "LTD", "LP", "PLC", "CORPORATION",
                                                    "COMPANY", "INCORPORATED", "LIMITED"}:
        raw_words.pop()
    if "AND" in raw_words:
        out.append(" ".join(raw_words[:7]))
    if "USA" in raw_words:
        out.append(" ".join(raw_words[:7]).replace("USA", "U.S.A."))
    lead = list(words)
    while len(lead) > 2 and lead[0] in rt:
        lead = lead[1:]
    if lead != words and len(lead) >= 2:
        out.append(" ".join(lead))
    if len(words) > 2 and not set(words[:2]) <= rt:
        out.append(" ".join(words[:2]))
    return list(dict.fromkeys(out))


def analyze_entity(cik, name, reg_name=""):
    """Evidence for one subsidiary name inside one registrant.
    ex21_pre   a subsidiary list filed before 2020-10-01 names it => long-held (owned through the window start)
    ex21_late  named in a list filed in the last 18 months => still held
    ex21_first the earliest subsidiary list that names it (its fiscal year end is an ownership bound)
    acq_8k     an 8-K / press release that says the registrant completed an acquisition naming the entity
    earliest   the earliest mentions in 8-K / 10-Q / 10-K with text snippets (for a human to read)."""
    variants = phrase_variants(name, reg_name)
    rec = {"cik": cik, "name": name, "phrase": variants[0], "variants": variants}
    cutoff = (dt.date.today() - dt.timedelta(days=548)).isoformat()
    ex_all, errs, n_hits = [], 0, 0
    pre = None
    for ph in variants:
        try:
            hits = fts(ph, cik, forms="10-K,10-K405,20-F,40-F")
        except Exception:  # noqa: BLE001 - a phrase that is too generic makes EDGAR answer 500: try the next variant
            errs += 1
            continue
        n_hits += len(hits)
        ex = [h for h in hits if is_ex21(h)]
        ex_all += [dict(h, phrase=ph) for h in ex]
        p = [h for h in ex if h["date"] < WINDOW_START]
        if p:
            pre = dict(p[-1], phrase=ph)
            break
    if errs == len(variants):
        rec["error"] = "full-text search failed for every phrase variant (name too generic)"
        return rec
    ex_all.sort(key=lambda h: h["date"])
    rec["n_annual_hits"] = n_hits
    rec["ex21_first"] = ex_all[0] if ex_all else None
    rec["ex21_pre"] = pre
    late = [h for h in ex_all if h["date"] >= cutoff]
    rec["ex21_late"] = late[-1] if late else None
    if pre:
        rec["phrase"] = pre["phrase"]
        return rec
    sub = sec_submissions(cik)
    by_acc = {f["acc"]: f for f in sub.get("filings", [])}
    acq8k, main_all = [], []
    for ph in variants:
        try:
            allh = fts(ph, cik, start="2019-06-01")
        except Exception:  # noqa: BLE001
            continue
        for h in allh:
            f = by_acc.get(h["adsh"])
            ftype = (h.get("ftype") or "").upper()
            if not (f and f["form"] in ("8-K", "8-K/A") and "2.01" in f["items"]
                    and ftype.startswith(ACQ_DOC_TYPES)):
                continue
            txt = filing_text(h["url"]) or ""
            if ftype.startswith("EX-99"):
                # a press release only counts when its headline says the deal closed ('X Completes Acquisition of Y')
                ok = bool(re.search(r"complet(?:es|ed)[^.]{0,40}acquisition|acquisition[^.]{0,60}complet", txt[:900], re.I)) \
                    and bool(phrase_regex(ph).search(txt))
                seg = txt[:900]
            else:
                # the Item 2.01 text itself (or the introductory note above it), not the cover page or a list
                i = min([m.start() for m in (re.search(r"Introductory Note", txt), re.search(r"Item\s*2\.01", txt)) if m] or [-1])
                seg = txt[i:i + 5000] if i >= 0 else ""
                ok = bool(seg) and bool(phrase_regex(ph).search(seg)) and bool(ACQ_DONE.search(seg))
            if ok:
                acq8k.append({"event": (f["report"] or f["date"])[:10], "filed": f["date"], "url": h["url"],
                              "file": h["file"], "phrase": ph, "item201": ftype.startswith("8-K"),
                              "snippet": re.sub(r"\s+", " ", seg)[:420]})
        main_all += [h for h in allh if not is_ex21(h) and h["form"] in MAIN_FORMS]
    acq8k.sort(key=lambda x: (x["event"], not x["item201"]))
    rec["acq_8k"] = acq8k[:3]
    rec["earliest"] = []
    for h in sorted(main_all, key=lambda h: h["date"])[:3]:
        txt = filing_text(h["url"])
        ctxs = contexts(txt, rec["phrase"], limit=2) if txt else []
        rec["earliest"].append({"date": h["date"], "form": h["form"], "url": h["url"],
                                "snippets": [re.sub(r"\s+", " ", c) for c in ctxs],
                                "dates": [d for c in ctxs for d in parse_dates(c)][:8]})
    return rec


def cmd_acquire(a):
    gaming_check()
    ev_dir = evidence_dir(a)
    path = os.path.join(ev_dir, "r6b-acq-evidence.json")
    done = read_json(path, {})
    links = [r for r in load_links() if r["status"] in ("auto_confirmed", "manual_confirmed")
             and r["match_method"] != "exact_normalized"]
    trade_tickers = {r["ticker"] for r in fetch_all("congress_trades", "id,ticker", order="id") if r.get("ticker")}
    ents = {}
    for r in links:
        nm = r["recipient_name"] or r["recipient_parent_name"]
        e = ents.setdefault(f"{r['cik']}|{strict_key(nm)}", {"cik": r["cik"], "name": nm, "reg": r["sec_name"], "tickers": set()})
        e["tickers"].add(r["ticker"])
    order = sorted(ents.items(), key=lambda kv: (0 if kv[1]["tickers"] & trade_tickers else 1, kv[0]))
    if a.limit:
        order = order[: a.limit]
    print(f"{len(order)} subsidiary entities "
          f"({sum(1 for _, e in order if e['tickers'] & trade_tickers)} with a ticker in congress_trades)", flush=True)
    t0 = time.time()
    for i, (k, e) in enumerate(order, 1):
        if k in done and not a.redo:
            continue
        if a.only_missing and (done.get(k) or {}).get("ex21_pre"):
            continue                      # already proven long-held: nothing to improve
        if i % 20 == 1:
            gaming_check()
        try:
            done[k] = analyze_entity(e["cik"], e["name"], e.get("reg", ""))
        except Exception as ex:  # noqa: BLE001 - one bad name must not stop the run
            done[k] = {"cik": e["cik"], "name": e["name"], "error": str(ex)[:200]}
            print(f"  ! {k}: {str(ex)[:120]}", flush=True)
        if i % 10 == 0:
            write_json(path, done)
            print(f"  {i}/{len(order)} ({int(time.time() - t0)}s)", flush=True)
    write_json(path, done)
    print("acquire evidence written:", path)
    return 0


# ─── step 3: listing windows of the registrant ─────────────────────────────────
SPAC_NAME = re.compile(r"acquisition|merger corp|blank check|capital corp|opportunit(y|ies) corp|"
                       r"holdco|newholdco|growth corp|spac\b", re.I)
DELIST_FORMS = ("25", "25-NSE", "15-12B", "15-12G", "15F-12B", "15F-12G", "15-15D")
PERIODIC_FORMS = ("10-K", "10-Q", "20-F", "40-F", "10-K405", "10-KT", "10-K/A", "10-Q/A", "10-KT/A", "6-K")


def _url(cik, f):
    return filing_url(cik, f["acc"], f["doc"])


def spac_close(cik, sub):
    """If the registrant is the successor of a SPAC / holding shell that was renamed inside the window, the
    business-combination 8-K (Item 2.01) filed within 10 days of the rename: (event date, filing, rename date)."""
    best = None
    for f in sorted(sub["filings"], key=lambda x: x["date"]):
        if f["form"] in ("8-K", "8-K/A") and "5.06" in f["items"] and f["date"] >= WINDOW_START:
            return (f["report"] or f["date"], f, "Item 5.06 change in shell company status")
    for fn in sub.get("formerNames") or []:
        to = (fn.get("to") or "")[:10]
        if to < WINDOW_START or to >= (dt.date.today() - dt.timedelta(days=30)).isoformat() \
                or not SPAC_NAME.search(fn.get("name") or ""):
            continue
        for f in sub["filings"]:
            if f["form"] in ("8-K", "8-K/A") and "2.01" in f["items"]:
                gap = abs((dt.date.fromisoformat(f["date"]) - dt.date.fromisoformat(to)).days)
                if gap <= 10 and (best is None or f["date"] < best[1]["date"]):
                    best = (f["report"] or f["date"], f, f"rename {to}")
    return best


def first_listing_events(cik, sub):
    """Filings that mark the start of an exchange listing inside the window, oldest first:
    EFFECT / CERT (SEC acknowledgement of the exchange's listing certification) around an 8-A12B."""
    fl = sorted((f for f in sub["filings"] if f["date"] >= WINDOW_START), key=lambda f: f["date"])
    return [f for f in fl if f["form"] in ("8-A12B", "8-A12G", "CERT", "EFFECT", "424B4", "10-12B", "F-6", "F-6EF")]


def preferred_start(cik, sub, basis):
    """Listing start of a preferred / depositary-share line of an older registrant: the Form 8-A12B filed in the
    window whose text carries the series' distinctive words (rate and series letter from the cover title)."""
    pat = r"([^'$(]*?preferred (?:stock|units)[^,$(']*(?:,\s*Series [A-Z]\b)?)"
    m = re.search(r"share of\s*" + pat, basis or "", re.I) or re.search(r":\s*'\s*(\d[^'$(]*?preferred (?:stock|units)[^,$(']*(?:,\s*Series [A-Z]\b)?)", basis or "", re.I)
    if not m:
        # the cover title is generic ('Depositary Shares'): look for the cover SYMBOL in a 10-K filed before the window
        sym = re.search(r"\(symbol ([^)]+)\)", basis or "")
        if sym and sym.group(1) != "None":
            hits = fts(sym.group(1), cik, end="2020-09-30", forms="10-K")
            if hits:
                return {"phrase": f"cover symbol '{sym.group(1)}'", "first": hits[0]}
        return None
    phrase = re.sub(r"\s+", " ", m.group(1)).strip(" ,'")
    phrase = re.sub(r"^(?:a|an)\s+", "", phrase, flags=re.I)
    hits = fts(phrase, cik)
    return {"phrase": phrase, "first": hits[0] if hits else None}


def listing_window(cik, sub, tick_class, decisions, ticker=None, basis=None):
    """-> {from, to, source, note}. NULL bounds = true on every day of the window."""
    d = decisions.get(f"{cik}|{ticker}") or decisions.get(cik)
    if d:
        return dict(d)
    first = sub.get("firstFiling") or "9999"
    if tick_class not in ("common", "adr", "preferred"):
        return {"from": None, "to": None, "source": None,
                "note": f"class {tick_class}: not an ownership line, excluded from award_tickers; no window computed"}
    if tick_class == "adr" and re.fullmatch(r"[A-Z]{4}F", ticker or "") and first >= WINDOW_START:
        return {"from": None, "to": None, "source": None, "unproven": True,
                "note": "foreign ordinary line (home-market listing predates the ADR registration); the OTC start "
                        "date is not established"}
    sc = spac_close(cik, sub)
    if sc and tick_class != "preferred":
        ev, f, why = sc
        return {"from": ev[:10], "to": None, "source": _url(cik, f),
                "note": f"successor of a SPAC / shell ({why}): the operating business joined the listed "
                        f"registrant at the business-combination closing (8-K event date {ev[:10]})"}
    if tick_class == "preferred" and first < WINDOW_START:
        ps = preferred_start(cik, sub, basis)
        hit = (ps or {}).get("first")
        if hit and hit["date"] < WINDOW_START:
            return {"from": None, "to": None, "source": hit["url"],
                    "note": f"series '{ps['phrase']}' already named in the registrant's {hit['form']} filed {hit['date']}, "
                            f"before the window: listed before 2020-10-01"}
        if hit:
            # first filing that names the series = its prospectus / pricing; the listing follows within days.
            near = [x for x in sub["filings"] if x["form"] in ("8-A12B", "EFFECT", "CERT") and
                    0 <= (dt.date.fromisoformat(x["date"]) - dt.date.fromisoformat(hit["date"])).days <= 14]
            frm = near[0]["date"] if near else hit["date"]
            return {"from": frm, "to": None, "source": hit["url"],
                    "note": f"preferred line first named in the {hit['form']} filed {hit['date']} (series "
                            f"'{ps['phrase']}'); listing registration {near[0]['form'] + ' ' + near[0]['date'] if near else 'not found'}"}
        return {"from": None, "to": None, "source": None, "unproven": True,
                "note": "preferred line: no filing found that names the series, listing date NOT established"}
    # Was the registrant public at the start of the window? A CIK can be old and still private (SpaceX has filed
    # Form D since 2002 and listed in 2026), so first-filing date alone proves nothing: look for periodic reports.
    per = [f["date"] for f in sub["filings"] if f["form"] in PERIODIC_FORMS and f["date"] <= "2020-12-31"]
    public_before = bool(per) and first < WINDOW_START
    ev = first_listing_events(cik, sub)
    if not public_before:
        start = ipo_start(cik, sub, ev)
        if start:
            return start
        if first >= WINDOW_START:
            return {"from": first, "to": None, "source": f"https://data.sec.gov/submissions/CIK{cik}.json",
                    "note": f"new registrant (first filing {first}); no exchange-registration filing found: "
                            f"first-filing date used, listing date NOT proven", "unproven": True}
    return {"from": None, "to": None, "source": None,
            "note": f"registrant filing since {first}"
                    + (f" with periodic reports dated {min(per)} onward" if per else "")
                    + "; no listing event in the window"}


def ipo_start(cik, sub, ev):
    """Start of the registrant's exchange listing from the SEC filings around its Form 8-A: the date the
    registration statement went EFFECTIVE (IPO / spin-off listing: trading starts that day or the next), else the
    exchange certification (CERT, uplist / direct listing), else the 8-A itself."""
    a8 = [f for f in ev if f["form"] in ("8-A12B", "8-A12G")]
    if not a8:
        cert = [f for f in ev if f["form"] == "CERT"]
        if not cert:
            return None
        a8 = cert[:1]
    a = a8[0]
    ad = dt.date.fromisoformat(a["date"])

    def near(form, lo=-1, hi=21):
        for f in ev:
            if f["form"] == form and lo <= (dt.date.fromisoformat(f["date"]) - ad).days <= hi:
                return f
        return None
    eff, cert = near("EFFECT"), near("CERT")
    pick = eff or cert or a
    return {"from": pick["date"], "to": None, "source": _url(cik, a),
            "note": f"exchange registration (Form {a['form']}) filed {a['date']}; "
                    f"{'registration effective' if pick is eff else 'exchange certification' if pick is cert else 'filed'} "
                    f"{pick['date']}: first trade is that day or the next trading day"}


def cmd_listing(a):
    gaming_check()
    ev_dir = evidence_dir(a)
    classes = read_json(os.path.join(ev_dir, "r6b-classes.json"), {})
    decisions = read_json(os.path.join(ev_dir, "r6b-listing-decisions.json"), {})
    out = {}
    for ck, c in sorted(classes.items()):
        cik, tk = c["cik"], c["ticker"]
        if c.get("drop"):
            continue
        sub = sec_submissions(cik)
        if sub.get("missing"):
            out[ck] = {"from": None, "to": None, "source": None, "note": "no SEC submissions record"}
            continue
        w = listing_window(cik, sub, c["class"], decisions, tk, c.get("basis"))
        w["cik"], w["ticker"], w["class"] = cik, tk, c["class"]
        out[ck] = w
    write_json(os.path.join(ev_dir, "r6b-listing.json"), out)
    kinds = Counter(("from" if w["from"] else "") + ("/to" if w["to"] else "") or "open" for w in out.values())
    print(len(out), "listing windows;", dict(kinds))
    return 0


# ─── verify ────────────────────────────────────────────────────────────────────
# Audit A7's 20-row sample (section e): row id -> (ticker, expected class, expected window).
#   'open'  = the window must not start inside the period (valid_from NULL or <= 2021-01-01) and has no end
#   (date, date) = valid_from must fall between the two dates
A7_SAMPLE = {
    1135: ("RSG", "common", ("2021-08-01", "2021-12-31")),    # ACV Enviro acquired August 2021
    301: ("ICFI", "common", "open"), 1137: ("CLH", "common", "open"), 1260: ("WWD", "common", "open"),
    1270: ("PPG", "common", "open"), 416: ("BAESF", "adr", "open"), 118: ("RTX", "common", "open"),
    109: ("RTX", "common", "open"), 710: ("MMS", "common", "open"), 354: ("MCK", "common", "open"),
    733: ("ROP", "common", "open"), 1371: ("HEI", "common", "open"), 76: ("LMT", "common", "open"),
    598: ("IRM", "common", "open"), 1583: ("HPE-PC", "preferred", "any"), 1249: ("BAESF", "adr", "open"),
    1587: ("AWR", "common", "open"), 28: ("RELX", "adr", "open"),
    466: ("AMTM", "common", ("2024-09-27", "2024-09-27")),    # Amentum Holdings listed 2024-09-27
    234: ("GD", "common", "open"),
}


def fresh_text(url):
    """Download a filing document again, bypassing every cache, as plain text."""
    raw = http_get(url, max_bytes=6_000_000)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw or "")))


def date_forms(iso):
    d = dt.date.fromisoformat(iso)
    return [f"{d.strftime('%B')} {d.day}, {d.year}", f"{d.strftime('%B')} {d.day} {d.year}", iso]


def cmd_verify(a):
    gaming_check()
    ev_dir = evidence_dir(a)
    links = {r["id"]: r for r in load_links()}
    out = {"seed": a.seed, "checked_sample": [], "a7_sample": []}
    pool = [r for r in links.values() if r["window_status"] == "checked" and r["window_source"]
            and r["status"] in CONFIRMED]
    rnd = random.Random(a.seed)
    sample = rnd.sample(pool, min(a.n, len(pool)))
    ok = 0
    for r in sample:
        nm = r["recipient_name"] or r["recipient_parent_name"]
        rec = {"id": r["id"], "ticker": r["ticker"], "recipient": nm, "valid_from": r["valid_from"],
               "valid_to": r["valid_to"], "source": r["window_source"], "checks": []}
        try:
            txt = fresh_text(r["window_source"])
            rec["checks"].append(("source downloads", bool(txt)))
            phrase = search_phrase(nm)
            has_name = bool(phrase_regex(phrase).search(txt)) or bool(phrase_regex(" ".join(phrase.split()[:2])).search(txt))
            tick_in = r["ticker"].split("-")[0] in txt
            if r["valid_from"]:
                dated = any(f in txt for f in date_forms(r["valid_from"]))
                is_list = bool(re.search(r"ex-?21|exhibit-?21|subsidiar", r["window_source"], re.I))
                on_index = False
                if not (dated or is_list):
                    # a listing date comes from the EDGAR filing index (CERT / 8-A12B / EFFECT / 8-K filed that day),
                    # not from the prospectus text: download the registrant's index again and look for the date
                    idx = http_get(f"https://data.sec.gov/submissions/CIK{r['cik']}.json", as_json=True) or {}
                    rc = (idx.get("filings") or {}).get("recent") or {}
                    on_index = any(f in ("CERT", "8-A12B", "8-A12G", "EFFECT", "8-K", "424B4", "424B5", "10-12B")
                                   and d in (r["valid_from"], ) for f, d in zip(rc.get("form", []), rc.get("filingDate", [])))
                rec["checks"].append(("valid_from is written in the document, or the document is the subsidiary list "
                                      "the fiscal-year-end bound comes from, or a listing filing carries that date on "
                                      "the registrant's EDGAR index", dated or is_list or on_index))
            rec["checks"].append(("entity name (or registrant ticker) appears in the document", has_name or tick_in))
        except Exception as e:  # noqa: BLE001
            rec["checks"].append((f"error {str(e)[:80]}", False))
        rec["pass"] = all(c[1] for c in rec["checks"])
        ok += rec["pass"]
        out["checked_sample"].append(rec)
    print(f"'checked' sample: {ok}/{len(sample)} pass (pool {len(pool)}, seed {a.seed})")
    for rec in out["checked_sample"]:
        if not rec["pass"]:
            print("  MISMATCH", rec["id"], rec["ticker"], rec["recipient"], rec["valid_from"], rec["source"], rec["checks"])
    ok7 = 0
    for rid, (tk, cls, exp) in A7_SAMPLE.items():
        r = links.get(rid)
        row = {"id": rid, "ticker": tk, "expected_class": cls, "expected_window": exp}
        if not r:
            row["result"] = "row missing"
        else:
            row.update({"class": r["instrument_class"], "valid_from": r["valid_from"], "valid_to": r["valid_to"],
                        "window_status": r["window_status"], "source": r["window_source"]})
            class_ok = r["instrument_class"] == cls
            vf = r["valid_from"]
            if exp == "open":
                win_ok = (vf is None or vf <= "2021-01-01") and r["valid_to"] is None
            elif exp == "any":
                win_ok = True
            else:
                win_ok = bool(vf) and exp[0] <= vf <= exp[1]
            row["class_ok"], row["window_ok"] = class_ok, win_ok
            row["result"] = "match" if class_ok and win_ok else "MISMATCH"
        ok7 += row["result"] == "match"
        out["a7_sample"].append(row)
    print(f"A7 sample: {ok7}/{len(A7_SAMPLE)} match")
    for row in out["a7_sample"]:
        print(f"  {row['id']:5d} {row['ticker']:7s} class {row.get('class')} from {row.get('valid_from')} to {row.get('valid_to')} "
              f"{row.get('window_status')} -> {row['result']}")
    write_json(os.path.join(ev_dir, f"r6b-verify-seed{a.seed}.json"), out)
    return 0


# ─── report ────────────────────────────────────────────────────────────────────
JOIN_CLASSES = ("common", "adr", "preferred")
STOPWORDS = {"INC", "CORP", "CO", "LTD", "PLC", "GROUP", "HOLDINGS", "HOLDING", "COMMON", "STOCK", "CLASS", "SHARES",
             "SHARE", "ORDINARY", "THE", "DE", "OF", "NEW", "INTERNATIONAL", "COMPANY", "CORPORATION", "TECHNOLOGIES",
             "SYSTEMS", "AND", "LP", "ADR", "SPONSORED", "AMERICAN", "DEPOSITARY", "ETF", "FUND", "TRUST", "ENERGY"}


def sig_tokens(s):
    return {t for t in base_tokens(s) if len(t) >= 3 and t not in STOPWORDS}


def trade_link_status(link, trade_date):
    """Does this link hold for a trade on trade_date? (the join rule page builders must use)"""
    if link["status"] not in ("auto_confirmed", "manual_confirmed"):
        return False
    if link["instrument_class"] not in JOIN_CLASSES or not trade_date or trade_date < WINDOW_START:
        return False
    if link["valid_from"] and trade_date < link["valid_from"]:
        return False
    if link["valid_to"] and trade_date > link["valid_to"]:
        return False
    return True


def cmd_report(a):
    ev_dir = evidence_dir(a)
    links = load_links()
    conf = [r for r in links if r["status"] in ("auto_confirmed", "manual_confirmed")]
    print("rows", len(links), "| confirmed", len(conf), "| CIKs", len({r["cik"] for r in links}),
          "| distinct tickers", len({r["ticker"] for r in links}))
    print("\ninstrument_class (all rows / confirmed rows):")
    ca, cc = Counter(r["instrument_class"] or "NULL" for r in links), Counter(r["instrument_class"] or "NULL" for r in conf)
    for k in sorted(set(ca) | set(cc)):
        print(f"  {k:10s} {ca[k]:5d} {cc[k]:5d}")
    print("\nwindow_status (all rows / confirmed rows):")
    wa, wc = Counter(r["window_status"] or "NULL" for r in links), Counter(r["window_status"] or "NULL" for r in conf)
    for k in sorted(set(wa) | set(wc)):
        print(f"  {k:12s} {wa[k]:5d} {wc[k]:5d}")
    dated = [r for r in links if r["valid_from"] or r["valid_to"]]
    print(f"\nrows with a bound: {len(dated)} (valid_from set {sum(1 for r in dated if r['valid_from'])}, "
          f"valid_to set {sum(1 for r in dated if r['valid_to'])})")
    trades = fetch_all("congress_trades", "id,ticker,transaction_date,member_id,member_name,company_name")
    by_t = defaultdict(list)
    for t in trades:
        if t.get("ticker"):
            by_t[t["ticker"]].append(t)
    # member trades touched, by status
    touched = defaultdict(lambda: [0, set()])
    excluded_window = Counter()
    unchecked_rows = []
    for r in conf:
        for t in by_t.get(r["ticker"], []):
            d = (t["transaction_date"] or "")[:10]
            if trade_link_status(r, d):
                touched[r["window_status"]][0] += 1
                touched[r["window_status"]][1].add(t["member_id"] or t["member_name"])
            elif r["instrument_class"] in JOIN_CLASSES:
                excluded_window["before 2020-10-01" if d < WINDOW_START else "outside link window"] += 1
        if r["window_status"] == "unchecked" and by_t.get(r["ticker"]):
            unchecked_rows.append(r)
    print("\ntrade x link pairs that satisfy the join rule, by window_status:")
    for k, (n, ms) in sorted(touched.items()):
        print(f"  {k:12s} {n:6d} pairs, {len(ms)} members")
    print("trade x link pairs REJECTED by the join rule (class ok, date not):", dict(excluded_window))
    notes = {}
    lst = read_json(os.path.join(ev_dir, "r6b-listing.json"), {})
    out_rows = []
    for r in unchecked_rows:
        n_tr = len(by_t[r["ticker"]])
        out_rows.append({"ticker": r["ticker"], "trades": n_tr, "recipient": r["recipient_name"] or r["recipient_parent_name"],
                         "parent": r["recipient_parent_name"], "cik": r["cik"], "sec_name": r["sec_name"],
                         "link_id": r["id"], "window_source": r["window_source"] or ""})
    out_rows.sort(key=lambda x: (-x["trades"], x["ticker"]))
    import csv
    p = os.path.join(ev_dir, "r6b-unchecked-trade-links.csv")
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["ticker"])
        w.writeheader()
        w.writerows(out_rows)
    print(f"\nunchecked confirmed links whose ticker a member traded: {len(out_rows)} rows, "
          f"{len({x['ticker'] for x in out_rows})} tickers -> {p}")
    # ticker recycling check: the name members' disclosures print vs the SEC registrant
    mism = []
    for tk, ts in by_t.items():
        rows = [r for r in conf if r["ticker"] == tk]
        if not rows:
            continue
        secset = sig_tokens(rows[0]["sec_name"]) | sig_tokens(rows[0]["recipient_parent_name"] or "")
        names = Counter(t["company_name"] for t in ts if t.get("company_name"))
        for nm, n in names.items():
            if secset and not (sig_tokens(nm) & secset):
                mism.append({"ticker": tk, "trade_name": nm, "trades": n, "sec_name": rows[0]["sec_name"]})
    mism.sort(key=lambda x: -x["trades"])
    p2 = os.path.join(ev_dir, "r6b-name-mismatch.csv")
    with open(p2, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ticker", "trade_name", "trades", "sec_name"])
        w.writeheader()
        w.writerows(mism)
    print(f"disclosed-name vs SEC-name mismatches on linked tickers: {len(mism)} (ticker recycling / renames) -> {p2}")
    return 0


# ─── apply: evidence files -> company_tickers ──────────────────────────────────
CONFIRMED = ("auto_confirmed", "manual_confirmed")


def entity_state(r, acq, decisions):
    """What the evidence says about the recipient's ownership by the registrant.
    -> (kind, from, to, source, note) with kind in self | long_held | dated | unchecked."""
    if r["match_method"] == "exact_normalized":
        return "self", None, None, None, "recipient is the registrant itself"
    nm = r["recipient_name"] or r["recipient_parent_name"]
    key = f"{r['cik']}|{strict_key(nm)}"
    d = decisions.get(key)
    if d:
        return d["kind"], d.get("from"), d.get("to"), d.get("source"), d.get("note")
    e = acq.get(key)
    if not e or e.get("error"):
        return "unchecked", None, None, None, "no evidence collected"
    still = bool(e.get("ex21_late"))
    gone = "" if still else "; NOT named in any subsidiary list filed in the last 18 months: possible divestiture or rename"
    if e.get("ex21_pre"):
        h = e["ex21_pre"]
        note = f"named in the subsidiary list (EX-21) of the {h['form']} filed {h['date']}, before the window{gone}"
        return ("long_held" if still else "unchecked"), None, None, h["url"], note
    acq = e.get("acq_8k") or []
    if acq:
        a0 = acq[0]
        if a0["event"] < WINDOW_START:
            return ("long_held" if still else "unchecked"), None, None, a0["url"], \
                f"8-K Item 2.01 (event {a0['event']}) names it: acquired before the window{gone}"
        return ("dated" if still else "unchecked"), a0["event"], None, a0["url"], \
            f"8-K Item 2.01 filed {a0['filed']}, closing event date {a0['event']}{gone}"
    first = e.get("ex21_first")
    if first:
        per = first.get("period") or ""
        bound = per[:10] if per else None
        if bound and bound >= WINDOW_START:
            return ("dated" if still else "unchecked"), bound, None, first["url"], \
                f"first named in a subsidiary list (EX-21) of the {first['form']} filed {first['date']} " \
                f"(period {bound}): owned by then; acquisition date not found, valid_from is that fiscal year end{gone}"
    return "unchecked", None, None, None, "no 8-K Item 2.01 and no subsidiary list names it with a usable date"


def compose(links, classes, listing, acq, decisions):
    """-> (updates: {id: dict}, deletes: [id])."""
    ups, dels = {}, []
    for r in links:
        ck = f"{r['cik']}|{r['ticker']}"
        c = classes.get(ck)
        if c is None:
            continue
        if c.get("drop"):
            dels.append(r["id"])
            continue
        L = listing.get(ck) or {}
        kind, ef, et, esrc, enote = entity_state(r, acq, decisions)
        froms = [x for x in (L.get("from"), ef) if x]
        tos = [x for x in (L.get("to"), et) if x]
        vf = max(froms) if froms else None
        vt = min(tos) if tos else None
        confirmed = r["status"] in CONFIRMED
        if not confirmed:
            status, src = "unchecked", L.get("source")
        elif L.get("unproven"):
            status, src = "unchecked", L.get("source") or esrc          # the registrant's own listing date is a guess
        elif kind in ("self", "long_held") and vf is None and vt is None:
            status, src = "same_entity", esrc or L.get("source")
        elif kind in ("self", "long_held", "dated"):
            status = "checked"
            src = esrc if kind == "dated" and (ef or et) and (not L.get("from") or ef >= L["from"]) else (L.get("source") or esrc)
        else:
            status, src = "unchecked", esrc or L.get("source")
        ups[r["id"]] = {"instrument_class": c["class"], "valid_from": vf, "valid_to": vt,
                        "window_status": status, "window_source": src}
    return ups, dels


def cmd_apply(a):
    ev_dir = evidence_dir(a)
    classes = read_json(os.path.join(ev_dir, "r6b-classes.json"), {})
    listing = read_json(os.path.join(ev_dir, "r6b-listing.json"), {})
    acq = read_json(os.path.join(ev_dir, "r6b-acq-evidence.json"), {})
    decisions = read_json(os.path.join(ev_dir, "r6b-acq-decisions.json"), {})
    links = load_links()
    ups, dels = compose(links, classes, listing, acq, decisions)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    groups = defaultdict(list)
    for i, u in ups.items():
        groups[json.dumps(u, sort_keys=True)].append(i)
    n = 0
    for k, ids in groups.items():
        u = json.loads(k)
        u["window_checked_at"] = now
        for j in range(0, len(ids), 150):
            chunk = ids[j:j + 150]
            if not a.dry_run:
                sb_call(lambda: sb().table("company_tickers").update(u).in_("id", chunk).execute())
            n += len(chunk)
    if dels and not a.dry_run:
        sb_call(lambda: sb().table("company_tickers").delete().in_("id", dels).execute())
    print(f"{'would update' if a.dry_run else 'updated'} {n} rows in {len(groups)} groups; "
          f"{'would delete' if a.dry_run else 'deleted'} {len(dels)} dropped-ticker rows")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--evidence-dir")
    sp = ap.add_subparsers(dest="cmd", required=True)
    f = sp.add_parser("fetch")
    f.add_argument("--no-cover", action="store_true")
    f.set_defaults(fn=cmd_fetch)
    c = sp.add_parser("classify")
    c.set_defaults(fn=cmd_classify)
    q = sp.add_parser("acquire")
    q.add_argument("--limit", type=int)
    q.add_argument("--redo", action="store_true")
    q.add_argument("--only-missing", action="store_true", help="with --redo: skip entities already proven long-held")
    q.set_defaults(fn=cmd_acquire)
    li = sp.add_parser("listing")
    li.set_defaults(fn=cmd_listing)
    p = sp.add_parser("apply")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(fn=cmd_apply)
    rp = sp.add_parser("report")
    rp.set_defaults(fn=cmd_report)
    vp = sp.add_parser("verify")
    vp.add_argument("--n", type=int, default=15)
    vp.add_argument("--seed", type=int, default=6)
    vp.set_defaults(fn=cmd_verify)
    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
