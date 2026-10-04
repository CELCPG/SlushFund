#!/usr/bin/env python3
"""
Bulk congressional trades loader — House side.

The community "House/Senate Stock Watcher" bulk datasets that this was meant to
consume went offline (their S3 buckets now return 403). This loader instead
pulls the **official House Clerk bulk disclosure index** — the authoritative,
still-public replacement — and parses every Periodic Transaction Report (PTR)
for the requested years:

  index : https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.zip
  PTR   : https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{DocID}.pdf

Every row stores the PTR's DocID (source_doc_id) and its public PDF URL
(disclosure_url), so a reader can open the filing the row came from.

Senate trades are loaded separately via scrape_senate_ptr.py (the Senate EFD
exposes structured data and needs no PDF parsing).

Resumable: each parsed filing is appended to a per-year JSONL checkpoint in
--cache-dir; a re-run skips filings already parsed by the same PARSER_VERSION
and only retries fetch failures. The database write is an idempotent upsert.

Usage:
  python3 src/scripts/load_bulk_trades.py --years 2024 2023
  python3 src/scripts/load_bulk_trades.py --all          # 2016-2026
  python3 src/scripts/load_bulk_trades.py --years 2024 --check   # reachability only
  python3 src/scripts/load_bulk_trades.py --years 2024 --no-write # parse + cache only

Requires SLUSHFUND_VENV (supabase, pdfplumber) — see _venv.py.
Member matching uses src/data/house_terms.json (gen_house_terms.py).
"""

import argparse
import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request
import zipfile
from collections import Counter, defaultdict
from collections import deque
import threading
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

from _venv import activate as _activate_venv
_activate_venv()

import pdfplumber
from supabase import create_client
from trade_fields import STRONG_OPTION, date_flag, date_typo_twin, first_report_basis, lateness_detail, parse_option

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ROSTER_PATH = os.path.join(DATA_DIR, "congress_roster.json")
TERMS_PATH = os.path.join(DATA_DIR, "house_terms.json")
UA = "slushfund-bulk-loader/1.0"
PARSER_VERSION = "r6c-1"   # r6c-1 = r6a-1 + each line's own notification date (R6c); r6a-1 records stay valid
PARSE_WORKERS = 3
FETCH_WINDOW = 3  # downloads in flight at once (request *starts* stay >= MIN_REQUEST_INTERVAL apart)
MIN_REQUEST_INTERVAL = 1.0  # seconds between requests to the Clerk (data-rules: <= 1 req/s)

INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf"

TYPE_MAP = {"P": "BUY", "S": "SELL", "E": "EXCHANGE"}
# R6a lossless upsert key (migration 20261006_r6a_trades_key.sql)
NATURAL_KEY = ("member_name", "ticker", "transaction_date", "transaction_type", "owner", "asset_type",
               "option_type", "strike", "expiry")
# Owner column codes (blank = the filer). Same words as the Senate loader's `owner` column
# (migration 20261005_congress_trades_owner.sql, R4).
OWNER_MAP = {"SP": "Spouse", "JT": "Joint", "DC": "Child"}
OWNER_ORDER = ["Self", "Spouse", "Joint", "Child"]
# House Clerk asset-type codes -> congress_trades.asset_type
ASSET_TYPE_MAP = {
    "ST": "Stock", "PS": "Stock", "OP": "Option", "EF": "ETF", "MF": "Mutual Fund",
    "GS": "Bond", "CS": "Bond", "DB": "Bond", "AB": "Bond", "CT": "Crypto",
}
# transaction core: <S|P|E>[ (partial)] <transaction date> <notification date>
CORE_RE = re.compile(
    r"\b([SPE])(?:\s*\((?:[Pp]artial|[Ff]ull)\))?\s+(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}/\d{1,2}/\d{4})"
)
# a real equity ticker — 1-5 letters, optional class suffix (BRK.B; preferreds are printed
# like CADE$A). The 2021-22 PDF font renders some capitals as lowercase b/d/g/h/l/u in the
# text layer ("(bOH)", "(AdBE)", "(AChC)"), so those are tolerated and the ticker is
# upper-cased (see _glitch_word).
TICKER_RE = re.compile(r"\(([A-Za-z]{1,5}(?:[./$-][A-Za-z]{1,2})?)\)")
GLITCH_LOWER = "bdghlu"
NOT_TICKERS = {"LLC", "LP", "INC", "ADR", "ADS", "ETF", "USA", "US", "UK", "LTD", "PLC", "REIT"}
CODE_RE = re.compile(r"\[([A-Za-z0-9]{2})\]")
DOLLAR_RE = re.compile(r"\$\s*([\d,]+)(?!\d)(?:\.\d+)?")
# field-label lines under each entry: "F S : New", "S O : ...", "D : ..." (2023+) and
# "FILING STATUS: New", "SUBHOLDING OF: ...", "DESCRIPTION: ..." (2021-22)
LABEL_RE = re.compile(
    r"^\s*(?:[FSDLC](?:\s+[SO])?\s*:|(?:filing\s+status|subholding\s+of|description|location|comments?)\s*:)",
    re.I,
)
# repeated table header at the top of each page + the form's footnote
HEADER_RE = re.compile(r"^\s*(?:ID\s+Owner\s+Asset|Type\s+Date\s+Gains|\$200\?\s*$|\*\s*For the complete list)", re.I)
CHECKBOX_RE = re.compile(r"gfedc[a-z]?")


# end of the transactions table: whatever follows is not part of a transaction's description
STOP_RE = re.compile(
    r"^\s*(?:\*\s*For the complete|I\s*P\s*O\b|Initial\s+Public|Certification|Digitally\s+Signed|Clerk of the House"
    r"|Filing ID|Name:|Status:|State/District|\$200\?)", re.I)


def _label_block(lines, start):
    """(description, filing status) from the label lines under one transaction (R6a). They run from
    `start` to the next transaction line: 'F S : New' / 'FILING STATUS: New', 'S O : ...', and the free-text
    'D : Call options; Strike price $340; Expires 10/16/2026' / 'DESCRIPTION: Purchased 100 call options...',
    which can wrap onto further lines. Options (call / put, strike, expiry) are only readable here."""
    desc, status, cur = [], "", None
    for k in range(start, min(len(lines), start + 14)):
        ln = re.sub(r"[\x00-\x1f]", " ", lines[k])      # 2023+ PDFs pad the label letters with NULs ('F\x00\x00 S\x00: New')
        if CORE_RE.search(ln) or STOP_RE.match(ln):
            break
        if LABEL_RE.match(ln):
            key, _, rest = ln.partition(":")
            key = re.sub(r"[^a-z]", "", key.lower())
            if key in ("d", "description"):
                cur = "d"
                desc.append(rest.strip())
            elif key in ("fs", "filingstatus"):
                cur = "fs"
                status = rest.strip()
            else:
                cur = "x"
        elif cur == "d" and len(desc) < 4:
            desc.append(ln.strip())
    return _clean_text(" ".join(desc))[:300] or None, status or None


def _norm_district(d) -> str:
    try:
        return str(int(d))
    except (TypeError, ValueError):
        return str(d or "0")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _d(s: str) -> date:
    return date.fromisoformat(s)


# ───────────────────────── member matching ─────────────────────────

class MemberMatcher:
    """Match a Clerk index row (last, first, StateDst, filing date) to a bioguide id
    and the party the member held at that time, using every House term from
    unitedstates/congress-legislators."""

    def __init__(self, terms, roster_by_bio):
        self.roster = roster_by_bio
        self.by_state = defaultdict(list)
        for t in terms:
            t = dict(t)
            t["_start"], t["_end"] = _d(t["start"]), _d(t["end"])
            t["_lastkeys"] = self._lastkeys(t["last"])
            t["_firstkeys"] = {k for k in (_norm(t["first"]), _norm(t.get("nickname", "")),
                                           _norm(t.get("middle", ""))) if k}
            self.by_state[t["state"]].append(t)

    @staticmethod
    def _lastkeys(last: str):
        keys = {_norm(last)}
        parts = [p for p in re.split(r"[\s-]+", last or "") if p]
        if len(parts) > 1:
            keys.add(_norm(parts[-1]))
            keys.add(_norm(parts[0]))
        return {k for k in keys if k}

    def match(self, last, first, state, district, on: date):
        lk = self._lastkeys(last)
        fk = _norm(first.split()[0] if first else "")
        best, best_score = None, 0
        for t in self.by_state.get(state, []):
            if not (t["_start"] - timedelta(days=90) <= on <= t["_end"] + timedelta(days=365)):
                continue
            score = 0
            if lk & t["_lastkeys"]:
                score += 10
            if t["district"] == district:
                score += 4
            if fk and (fk in t["_firstkeys"] or any(k.startswith(fk) or fk.startswith(k)
                                                    for k in t["_firstkeys"])):
                score += 2
            if t["_start"] <= on <= t["_end"]:
                score += 1
            # accept: last name matched, or same seat + same first name
            if score >= 10 or (score >= 6 and t["district"] == district and fk):
                if score > best_score or (score == best_score and best and t["_start"] > best["_start"]):
                    best, best_score = t, score
        return best

    def name_for(self, term, first, last):
        if term:
            r = self.roster.get(term["bioguide_id"])
            if r:
                return r["name"]
            if term.get("official_full"):
                return term["official_full"]
        return f"{first} {last}".strip()


def load_matcher():
    with open(ROSTER_PATH, encoding="utf-8") as f:
        roster = {m["bioguide_id"]: m for m in json.load(f)["members"]}
    with open(TERMS_PATH, encoding="utf-8") as f:
        terms = json.load(f)["terms"]
    return MemberMatcher(terms, roster)


# ───────────────────────── fetching ─────────────────────────

_last_request = [0.0]
_rate_lock = threading.Lock()


def fetch(url: str, retries: int = 3) -> bytes:
    """GET with request starts >= MIN_REQUEST_INTERVAL apart (thread-safe) and a few retries."""
    last_err = None
    for attempt in range(retries):
        with _rate_lock:
            wait = MIN_REQUEST_INTERVAL - (time.monotonic() - _last_request[0])
            if wait > 0:
                time.sleep(wait)
            _last_request[0] = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except Exception as e:  # noqa: BLE001
            last_err = e
            if getattr(e, "code", None) in (403, 404):
                break
            time.sleep(2 * (attempt + 1))
    raise last_err


def get_ptr_filings(year: int):
    """Return PTR rows from the House Clerk annual index for a year."""
    raw = fetch(INDEX_URL.format(year=year))
    zf = zipfile.ZipFile(io.BytesIO(raw))
    txt_name = next((n for n in zf.namelist() if n.lower().endswith(".txt")), None)
    if not txt_name:
        return []
    text = zf.read(txt_name).decode("utf-8-sig", errors="replace")
    rows = list(csv.DictReader(io.StringIO(text), delimiter="\t"))
    return [r for r in rows if (r.get("FilingType") or "").strip() == "P"]


# ───────────────────────── parsing ─────────────────────────

def parse_amount(text: str):
    """Parse a disclosure amount range into (min, max). Per-token K/M/B suffix."""
    if not text:
        return None, None
    # The K/M/B suffix must be a standalone letter — not the first letter of a
    # following word (e.g. "Bond"), which otherwise scales the amount ×1e9.
    matches = re.findall(r"\$\s*([\d,]+(?:\.\d+)?)\s*([KMB](?![A-Z]))?", text.upper())
    mults = {"K": 1000, "M": 1_000_000, "B": 1_000_000_000}
    nums = []
    for raw, suffix in matches:
        try:
            nums.append(int(float(raw.replace(",", "")) * mults.get(suffix, 1)))
        except ValueError:
            continue
    if not nums:
        return None, None
    return min(nums), max(nums)


def amount_band(text: str):
    """Normalised band string as printed on the PTR: '$1,001 - $15,000' / 'Over $50,000,000'."""
    nums = [m.group(1) for m in DOLLAR_RE.finditer(text)]
    if not nums:
        return None
    if len(nums) == 1:
        return f"Over ${nums[0]}" if re.search(r"\bOver\b", text, re.I) else f"${nums[0]}"
    return f"${nums[0]} - ${nums[1]}"


def to_iso(d: str, fallback_year: int = None):
    """Convert MM/DD/YYYY to YYYY-MM-DD with year validation.

    Returns None if year is impossible (> current+2 or < 2000).
    If invalid and fallback_year provided, returns YYYY-01-01 as a safe guess.
    """
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", (d or "").strip())
    if not m:
        return None
    year = int(m.group(3))
    current_year = datetime.now().year
    if year > current_year + 2 or year < 2000:
        if fallback_year and 2000 <= fallback_year <= current_year + 1:
            return f"{fallback_year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        return None
    try:
        return date(year, int(m.group(1)), int(m.group(2))).isoformat()
    except ValueError:
        return None


def _amount_complete(text: str) -> bool:
    n = len(DOLLAR_RE.findall(text))
    return n >= 2 or (n == 1 and re.search(r"Over", text, re.I) is not None)


def _clean_text(s: str) -> str:
    """Drop control characters (a stray NUL in a PDF string makes Postgres reject the whole
    upsert batch) and collapse whitespace."""
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]", " ", s or "")).strip()


def _glitch_word(word: str) -> str:
    """Undo the 2021-22 font glitch: capitals b/d/g/h/l/u come out lowercase in the text
    layer ("bOH", "SPgI", "lP", "AChC"). Only a word that is otherwise all capitals is
    touched, so "Nuveen" and "bank" are left alone."""
    letters = [c for c in word if c.isalpha()]
    if (len(letters) >= 2 and any(c.isupper() for c in letters)
            and all(c.isupper() or c in GLITCH_LOWER for c in letters)):
        return word.upper()
    return word


def _fix_glitch(text: str) -> str:
    text = re.sub(r"[A-Za-z]+", lambda m: _glitch_word(m.group(0)), text)
    return text[:1].upper() + text[1:]


def _find_ticker(blob: str):
    for m in TICKER_RE.finditer(blob):
        sym = m.group(1)
        if any(c.islower() for c in sym):
            fixed = _glitch_word(sym)
            if fixed == sym:        # lowercase letters that are not the font glitch: a word, not a ticker
                continue
            sym = fixed
        if sym not in NOT_TICKERS:
            return m, sym
    return None, None


def parse_ptr_pdf(pdf_bytes: bytes):
    """Parse a House PTR PDF. Returns (trades, stats).

    Works line-by-line off the page text: each transaction has a reliable
    `<S|P|E>[ (partial)] <date> <date>` core. The name, ticker, asset code and
    amount can wrap onto the next line(s) for long asset names (even across a page
    break), so up to three continuation lines are folded in while something is
    still missing (never across a new transaction or a label line such as
    `F S : New` / `FILING STATUS: New`).

    stats: pages, chars (extracted text length, ~0 for a scanned image PDF),
    txn_lines (transactions seen), loaded, no_ticker (+ codes), bad_date.
    """
    trades = []
    stats = {"pages": 0, "chars": 0, "txn_lines": 0, "loaded": 0, "no_ticker": 0,
             "bad_date": 0, "no_ticker_codes": {}}
    codes = Counter()
    try:
        lines = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                stats["pages"] += 1
                page_lines = (page.extract_text() or "").split(chr(10))
                stats["chars"] += sum(len(x) for x in page_lines)
                lines.extend(CHECKBOX_RE.sub("", x) for x in page_lines if not HEADER_RE.match(x))
        for i, line in enumerate(lines):
            core = CORE_RE.search(line)
            if not core:
                continue
            stats["txn_lines"] += 1
            ttype, txn_date, notif_date = core.groups()
            head, tail = line[: core.start()], line[core.end():]
            cont = []
            j = i + 1
            while j < len(lines) and len(cont) < 3:
                nxt = lines[j]
                if CORE_RE.search(nxt) or LABEL_RE.match(nxt):
                    break
                blob = " ".join([head, tail] + cont)
                if (_find_ticker(blob)[0] and CODE_RE.search(blob)
                        and _amount_complete(" ".join([tail] + cont))):
                    break
                cont.append(nxt)
                j += 1
            blob = " ".join([head, tail] + cont)
            tk, symbol = _find_ticker(blob)
            code_m = CODE_RE.search(blob)
            code = code_m.group(1).upper() if code_m else ""
            if not tk:
                stats["no_ticker"] += 1
                codes[code or "?"] += 1
                continue
            iso = to_iso(txn_date)
            if not iso:
                stats["bad_date"] += 1
                continue
            amt_text = " ".join([tail] + cont)
            band = amount_band(amt_text)
            amt_min, amt_max = parse_amount(band) if band else (None, None)
            owner_m = re.match(r"^\s*(?:\d{6,}\s+)?(SP|JT|DC)\s", head)
            company = " ".join([head] + cont)
            company = re.sub(r"^\s*(?:\d{6,}\s+)?(?:SP|JT|DC)\s+", "", company)
            company = re.sub(r"^\s*\d{6,}\s+", "", company)
            company = company.replace(tk.group(0), "")
            company = re.sub(r"\[[A-Za-z0-9]{2}\]|\$\s*[\d,]+(?:\.\d+)?", "", company)
            company = _fix_glitch(_clean_text(company).strip(" -"))[:200] or symbol
            desc, filing_status = _label_block(lines, j)
            trades.append({
                "ticker": symbol,
                "company_name": company,
                "transaction_type": TYPE_MAP.get(ttype, "BUY"),
                "transaction_date": iso,
                "notification_date": to_iso(notif_date),   # R6c: the filing's own 'notification date' for this line
                "amount_min": amt_min,
                "amount_max": amt_max,
                "amount_range": band,
                "asset_type": ASSET_TYPE_MAP.get(code, "Other" if code else "Stock"),
                "owner": OWNER_MAP[owner_m.group(1)] if owner_m else "Self",   # no code = the filer
                "desc": desc,                     # R6a: the filing's own description of the asset / trade
                "filing_status": filing_status,   # R6a: 'New' / 'Amended' as printed
            })
            stats["loaded"] += 1
    except Exception as e:  # noqa: BLE001 — a bad PDF must not abort the batch
        stats["error"] = str(e)[:200]
        print(f"    PDF parse error: {e}")
    stats["no_ticker_codes"] = dict(codes)
    return trades, stats


def option_of(trade):
    """(option_type, strike, expiry) for one parsed transaction (R6a), None x3 when it is not an option.
    An option is a line the Clerk coded [OP], or one whose own description names call / put options. A
    description of an option EXERCISE ('Exercised 100 call options ... acquired 10,000 shares') on a line coded
    as stock stays a stock line. The call / put, strike and expiry come only from the filer's description."""
    desc = trade.get("desc") or ""
    if trade["asset_type"] == "Option":
        return parse_option(desc, True)
    if desc and STRONG_OPTION.search(desc) and not re.search(r"exercis", desc, re.I):
        return parse_option(desc, True)
    return None, None, None


def fold_lots(trades):
    """Same-day lots of one instrument and one owner in one PTR share a row: the band is the sum of the lots'
    bands, lot_count says how many, and the lots are listed in amount_range ('... (2 lots)'). The instrument is
    ticker + direction + asset type + call/put + strike + expiry, so two owners, a stock and its option, or two
    different option contracts on one day are different rows (R6a lossless key).
    Returns (rows, lots folded away)."""
    groups = {}
    for t in trades:
        opt, strike, expiry = option_of(t)
        t = dict(t, option_type=opt, strike=strike, expiry=expiry.isoformat() if expiry else None)
        groups.setdefault((t["ticker"], t["transaction_date"], t["transaction_type"], t["owner"], t["asset_type"],
                           opt, strike, t["expiry"]), []).append(t)
    out, folded = [], 0
    for lots in groups.values():
        folded += len(lots) - 1
        row = {k: v for k, v in lots[0].items() if k not in ("desc", "filing_status")}
        row["lot_count"] = len(lots)
        row["_amended"] = any("amend" in (x.get("filing_status") or "").lower() for x in lots)
        # R6c: one notification date per row. When same-day lots print different ones, keep the one farthest
        # from the transaction date (the least corroborating), so a typo in one lot is not hidden by the others.
        notifs = [x.get("notification_date") for x in lots]
        if any(n is None for n in notifs):
            row["notification_date"] = None             # an r6a-1 cache record: not captured
        else:
            row["notification_date"] = max(notifs, key=lambda n: abs((_d(n) - _d(row["transaction_date"])).days))
        if len(lots) > 1:
            mins, maxs = [x["amount_min"] for x in lots], [x["amount_max"] for x in lots]
            row.update(
                amount_min=sum(mins) if all(v is not None for v in mins) else None,
                amount_max=sum(maxs) if all(v is not None for v in maxs) else None,
                amount_range=" + ".join(x["amount_range"] or "?" for x in lots) + f" ({len(lots)} lots)",
            )
        out.append(row)
    return out, folded


def classify(stats) -> str:
    if stats.get("error"):
        return "parse_error"
    if stats["pages"] == 0 or stats["chars"] < 50:
        return "scanned"            # image-only PDF: no text layer, no OCR
    if stats["txn_lines"] == 0:
        return "no_transactions"    # text but no transaction rows recognised
    if stats["loaded"] == 0:
        return "no_ticker"          # transactions found, none with a ticker
    return "ok"


# ───────────────────────── checkpoint cache ─────────────────────────

def load_cache(path):
    done = {}
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if _cache_ok(rec):
                    done[rec["doc"]] = rec
                else:
                    done.pop(rec["doc"], None)      # the newest record of a filing decides: an outdated one means "fetch again"
    return done


# r6a-1 only added what each transaction's filing text says (desc, filing_status); the ticker
# rules are r3-6's. A record from r3-5 / r3-6 is still valid when the filing has no loadable
# transaction (scanned, no ticker): there is nothing to describe. Every filing that produced rows is
# fetched again so its description lines are in the cache.
# r6c-1 only adds each line's notification date; an r6a-1 record stays valid (its rows carry
# notification_date NULL = not captured). Only the filings holding stale_2y rows are re-read (--recapture-stale).
def _cache_ok(rec) -> bool:
    if rec.get("status") == "fetch_failed":
        return False
    if rec.get("parser") in (PARSER_VERSION, "r6a-1"):
        return True
    return rec.get("parser") in ("r3-5", "r3-6") and rec.get("status") in ("scanned", "no_ticker", "no_transactions")


def gaming_ok() -> bool:
    """Optional: SLUSHFUND_GAMING_CHECK=<path to gaming-mode.mjs>; exit 3 = Colin is gaming."""
    script = os.environ.get("SLUSHFUND_GAMING_CHECK")
    if not script:
        return True
    try:
        return subprocess.run(["node", script, "check"], capture_output=True, timeout=30).returncode != 3
    except Exception:  # noqa: BLE001
        return True


# ───────────────────────── database ─────────────────────────

def member_ids(sb):
    """bioguide_id -> congress_members.id"""
    out, start = {}, 0
    while True:
        rows = sb.table("congress_members").select("id,bioguide_id").range(start, start + 999).execute().data
        for r in rows:
            if r.get("bioguide_id"):
                out[r["bioguide_id"]] = r["id"]
        if len(rows) < 1000:
            return out
        start += 1000


def _filing_rank(filed_date, doc):
    """Order filings: earlier filing date first, then the lower DocID (Clerk DocIDs only grow)."""
    return (filed_date or "", int(doc) if str(doc).isdigit() else 0)


def identity(r, txn_date=None):
    """One disclosed transaction, whatever lots / owners / asset-type code a later filing restates it with.
    txn_date overrides the row's own date for a row whose year was mistyped (R6e twin rule, build_all)."""
    return (r["member_name"], r["ticker"], txn_date or r["transaction_date"], r["transaction_type"],
            r["option_type"], r["strike"], r["expiry"])


def _upsert(sb, rows):
    sb.table("congress_trades").upsert(
        rows, on_conflict=",".join(NATURAL_KEY)
    ).execute()


def write_trades(sb, trades):
    """Upsert in batches of 200; if a batch is rejected, retry its rows one by one so one
    bad row cannot drop the other 199. Returns (rows written, rows that failed)."""
    if not trades:
        return 0, 0
    written = failed = 0
    for i in range(0, len(trades), 200):
        batch = trades[i:i + 200]
        try:
            _upsert(sb, batch)
            written += len(batch)
        except Exception as e:  # noqa: BLE001
            print(f"    batch upsert error ({e}); retrying {len(batch)} rows singly")
            for r in batch:
                try:
                    _upsert(sb, [r])
                    written += 1
                except Exception as e2:  # noqa: BLE001
                    failed += 1
                    print(f"    row failed: doc {r.get('source_doc_id')} {r.get('ticker')} {r.get('transaction_date')}: {e2}")
    return written, failed


# ───────────────────────── run ─────────────────────────

def recapture_stale(sb, cache_dir):
    """R6c: re-read only the filings that hold stale_2y / stale_2y_corroborated rows, so each line's own
    notification date is in the cache (r6c-1 records). One request per second, one filing at a time, resumable:
    a filing whose newest cache record is already r6c-1 is skipped. Returns the number of filings fetched."""
    docs = {}
    start = 0
    while True:
        rows = (sb.table("congress_trades").select("source_doc_id,disclosure_year")
                .eq("source_system", "House_Clerk").in_("date_flag", ["stale_2y", "stale_2y_corroborated"])
                .range(start, start + 999).execute().data)
        for r in rows:
            docs[r["source_doc_id"]] = r["disclosure_year"]
        if len(rows) < 1000:
            break
        start += 1000
    print(f"recapture: {len(docs)} filings hold stale_2y rows")
    fetched = 0
    for doc, year in sorted(docs.items()):
        path = os.path.join(cache_dir, f"{year}.jsonl")
        if load_cache(path).get(doc, {}).get("parser") == PARSER_VERSION:
            print(f"  {doc}: already recaptured")
            continue
        if not gaming_ok():
            print("  gaming mode on — checkpointed, stopping")
            raise SystemExit(3)
        pdf_bytes = fetch(PTR_URL.format(year=year, doc=doc))
        trades, stats = parse_ptr_pdf(pdf_bytes)
        rec = {"doc": doc, "year": year, "parser": PARSER_VERSION, "status": classify(stats),
               "stats": stats, "trades": trades}
        with open(path, "a", encoding="utf-8") as out:
            out.write(json.dumps(rec) + "\n")
        fetched += 1
        print(f"  {doc} ({year}): {stats['loaded']} lines, {sum(1 for t in trades if t.get('notification_date'))} with a notification date")
    return fetched


def build_all(cache_dir, matcher, ids, sb, prune):
    """Rows for every cached year, one pass, then written (idempotent upsert on the lossless key).

    Per filing: lots fold by instrument + owner. Across filings: the same transaction (member, ticker, date,
    direction, option type / strike / expiry) filed again (an amendment or re-filing) is restated by the LATER
    filing, which replaces the earlier filing's rows for it. original_filed_date is the earliest filing that
    held the transaction; when that earliest filing is itself marked Amended and no earlier filing is cached,
    the original is unknown (NULL). R6f: original_source_doc_id / original_disclosure_url / original_source_basis
    say which filing that earliest one was (NULL with the date when unknown). Date flags and lateness: trade_fields.py."""
    today = date.today()
    run_ts = datetime.now(timezone.utc).isoformat()
    acct = Counter()
    per_filing = []
    years = sorted(int(n[:4]) for n in os.listdir(cache_dir) if re.fullmatch(r"\d{4}-index\.json", n))
    for year in years:
        with open(os.path.join(cache_dir, f"{year}-index.json"), encoding="utf-8") as xf:
            filings = json.load(xf)
        done = load_cache(os.path.join(cache_dir, f"{year}.jsonl"))
        for f in filings:
            doc = (f.get("DocID") or "").strip()
            rec = done.get(doc)
            if not rec:
                acct["filings_not_cached"] += 1
                continue
            acct["filings_" + rec["status"]] += 1
            if not rec["trades"]:
                continue
            acct["parsed_lines"] += len(rec["trades"])
            last, first = (f.get("Last") or "").strip(), (f.get("First") or "").strip()
            statedst = (f.get("StateDst") or "").strip()
            state, district = statedst[:2], _norm_district(statedst[2:])
            filed = to_iso(f.get("FilingDate", ""))
            term = matcher.match(last, first, state, district, _d(filed) if filed else date(year, 6, 30))
            bio = term["bioguide_id"] if term else None
            if not term:
                acct["filings_unmatched_member"] += 1
            member_name = matcher.name_for(term, first, last)
            url = PTR_URL.format(year=year, doc=doc)
            folded_rows, n_folded = fold_lots(rec["trades"])
            acct["lots_folded"] += n_folded
            rows = []
            for t in folded_rows:
                rows.append({
                    **t,
                    "company_name": _fix_glitch(_clean_text(t["company_name"])),
                    "member_name": member_name,
                    "member_chamber": "House",
                    "member_party": term["party"] if term else "",
                    "member_state": state,
                    "district": district,
                    "bio_guide_id": bio,
                    "member_id": ids.get(bio) if bio else None,
                    "disclosure_year": year,
                    "filed_date": filed,
                    "disclosure_url": url,
                    "source_doc_id": doc,
                    "source_system": "House_Clerk",
                    "flags": [],
                    "signal_type": "routine",
                    # R6e (A7b F6): no has_federal_contract here. compute_conflicts.py owns it (NULL = not computed,
                    # the column default); the loader used to write false for every row.
                })
            per_filing.append((_filing_rank(filed, doc), doc, rows))

    per_filing.sort(key=lambda x: x[0])
    # R6e (A7b F1): a row whose date cannot be right (after its own filing, or in the future) that a LATER filing
    # restates with a month/day twin (a mistyped year; Wittman MA 12/07/2023 for 12/07/2022) is the same transaction.
    # Key it on the twin's date: the later filing then restates it and the earliest filing stays the original.
    # Twin = same member, ticker, direction, owner and option terms, same month and day, a date on or before the
    # suspect row's own filing, exactly one candidate (trade_fields.date_typo_twin).
    def _sig(r):
        return (r["member_name"], r["ticker"], r["transaction_type"], r["owner"], r["option_type"], r["strike"], r["expiry"])
    by_sig = defaultdict(list)
    for rank, _doc, rows in per_filing:
        for r in rows:
            by_sig[_sig(r)].append((rank, r["transaction_date"]))
    twin_date, twin_report = {}, []
    for rank, doc, rows in per_filing:
        for r in rows:
            cands = [d for (rk, d) in by_sig[_sig(r)] if rk > rank]
            twin = date_typo_twin(r["transaction_date"], r["filed_date"], today, cands) if cands else None
            if twin:
                twin_date[id(r)] = twin.isoformat()
                twin_report.append({"member": r["member_name"], "ticker": r["ticker"], "type": r["transaction_type"],
                                    "owner": r["owner"], "typo_date": r["transaction_date"], "twin_date": twin.isoformat(),
                                    "typo_doc": doc, "typo_filed": r["filed_date"]})
    acct["date_typo_twins"] = len(twin_report)
    seen = {}                                   # identity -> {"doc", "rows", "orig", "orig_known", "orig_doc", "orig_url"}
    replaced = []
    for _rank, doc, rows in per_filing:
        groups = {}
        for r in rows:
            groups.setdefault(identity(r, twin_date.get(id(r))), []).append(r)
        for ident, rs in groups.items():
            old = seen.get(ident)
            if old and old["doc"] != doc:
                acct["lines_replaced_by_a_later_filing"] += sum(x["lot_count"] for x in old["rows"])
                acct["rows_replaced_by_a_later_filing"] += len(old["rows"])
                replaced.append({"member": ident[0], "ticker": ident[1], "date": ident[2], "type": ident[3],
                                 "kept_doc": doc, "dropped_doc": old["doc"],
                                 "kept": [[x["owner"], x["amount_range"]] for x in rs],
                                 "dropped": [[x["owner"], x["amount_range"]] for x in old["rows"]]})
                orig, known = old["orig"], old["orig_known"]      # the earliest filing stays the original
                orig_doc, orig_url = old["orig_doc"], old["orig_url"]
            else:
                amended = any(x["_amended"] for x in rs)
                orig, known = (None, False) if amended else (rs[0]["filed_date"], True)
                # R6f (A7c G1): the first report is the earliest filing that held the transaction, by filing date
                # then DocID. Its id and link are stored with its date; NULL together when the original is unknown.
                orig_doc, orig_url = (None, None) if amended else (doc, rs[0]["disclosure_url"])
            seen[ident] = {"doc": doc, "rows": rs, "orig": orig, "orig_known": known,
                           "orig_doc": orig_doc, "orig_url": orig_url}

    final, keys = [], set()
    for entry in seen.values():
        for r in entry["rows"]:
            r = {k: v for k, v in r.items() if k != "_amended"}
            r["original_filed_date"] = entry["orig"]
            r["original_source_doc_id"] = entry["orig_doc"]
            r["original_disclosure_url"] = entry["orig_url"]
            r["original_source_basis"] = first_report_basis(r["source_doc_id"], entry["orig_doc"])
            r.setdefault("notification_date", None)
            flag = date_flag(r["transaction_date"], entry["orig"], r["filed_date"], today, r["notification_date"])
            r["date_flag"] = flag
            r["days_to_file"], r["stock_act_late"], r["lateness_basis"] = lateness_detail(
                r["transaction_date"], entry["orig"], flag, r.get("amount_max"))
            r["updated_at"] = run_ts
            k = tuple(r[c] for c in NATURAL_KEY)
            if k in keys:
                raise SystemExit(f"duplicate lossless key after identity resolution: {k}")
            keys.add(k)
            final.append(r)
    acct["rows"] = len(final)
    acct["lines_in_rows"] = sum(r["lot_count"] for r in final)
    acct["reconcile_gap"] = acct["parsed_lines"] - acct["lines_in_rows"] - acct["lines_replaced_by_a_later_filing"]
    acct["option_rows"] = sum(1 for r in final if r["option_type"])
    acct["option_rows_unknown"] = sum(1 for r in final if r["option_type"] == "unknown")
    acct["original_unknown_rows"] = sum(1 for r in final if r["original_filed_date"] is None)
    for b in ("first_report_this_filing", "first_report_earlier_filing", "first_report_not_identified"):
        acct[b] = sum(1 for r in final if r["original_source_basis"] == b)
    acct["flag_" + "_".join(["none"])] = sum(1 for r in final if r["date_flag"] is None)
    for fl in ("after_filing", "future", "stale_2y_corroborated", "stale_2y"):
        acct["flag_" + fl] = sum(1 for r in final if r["date_flag"] == fl)
    acct["notification_date_captured"] = sum(1 for r in final if r["notification_date"])
    acct["lateness_computed"] = sum(1 for r in final if r["days_to_file"] is not None)
    acct["late_over_45"] = sum(1 for r in final if r["stock_act_late"])
    acct["below_reporting_threshold"] = sum(1 for r in final if r["lateness_basis"] == "below_reporting_threshold")
    with open(os.path.join(cache_dir, "r6e-twins.json"), "w", encoding="utf-8") as sf:
        json.dump(twin_report, sf, indent=1)
    with open(os.path.join(cache_dir, "r6a-summary.json"), "w", encoding="utf-8") as sf:
        json.dump(dict(acct), sf, indent=1)
    with open(os.path.join(cache_dir, "r6a-replaced.json"), "w", encoding="utf-8") as sf:
        json.dump(replaced, sf)
    print("build:", json.dumps(dict(acct)))
    if not sb:
        return 0
    written, failed = write_trades(sb, final)
    print(f"written {written}, failed {failed}")
    if failed:
        print("rows failed: not pruning")
        return written
    stale = sb.table("congress_trades").select("id", count="exact").eq("source_system", "House_Clerk").lt("updated_at", run_ts).execute().count
    print(f"House_Clerk rows this run did not write (old key shape): {stale}")
    if prune and stale:
        sb.table("congress_trades").delete().eq("source_system", "House_Clerk").lt("updated_at", run_ts).execute()
        print(f"pruned {stale}")
    return written


def run(years, check_only=False, limit=None, cache_dir=None, no_write=False, deadline_min=None, prune=False,
        recapture=False):
    matcher = load_matcher()
    print(f"Matcher: {sum(len(v) for v in matcher.by_state.values())} House terms indexed")
    deadline = time.monotonic() + deadline_min * 60 if deadline_min else None
    cache_dir = cache_dir or os.path.join(tempfile.gettempdir(), "slushfund-house-ptr-cache")
    os.makedirs(cache_dir, exist_ok=True)

    sb, ids = None, {}
    if not check_only and not no_write:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not set")
            return 1
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        ids = member_ids(sb)
        print(f"congress_members: {len(ids)} bioguide ids")
        if recapture:
            print(f"recapture: {recapture_stale(sb, cache_dir)} filings fetched")

    grand_total = 0
    pool = ProcessPoolExecutor(max_workers=PARSE_WORKERS)
    fetch_pool = ThreadPoolExecutor(max_workers=FETCH_WINDOW)
    for year in years:
        try:
            filings = get_ptr_filings(year)
        except Exception as e:  # noqa: BLE001
            print(f"{year}: index unreachable — {e}")
            continue
        filings.sort(key=lambda f: (to_iso(f.get("FilingDate", "")) or "", f.get("DocID", "")))
        with open(os.path.join(cache_dir, f"{year}-index.json"), "w", encoding="utf-8") as xf:
            json.dump(filings, xf)       # the build step reads every year's index, not only the requested ones
        if limit:
            filings = filings[:limit]
        print(f"\n{year}: {len(filings)} PTR filings")
        if check_only:
            continue

        cache_path = os.path.join(cache_dir, f"{year}.jsonl")
        done = load_cache(cache_path)
        print(f"  checkpoint: {len(done)} filings already parsed")
        stopped = False
        # Stage 1: downloads overlap on a few threads, but fetch() starts at most one request per
        # second. Stage 2: parsing runs in the process pool.
        fetching = deque()  # (n, doc, future -> pdf bytes)
        pending = deque()   # (n, doc, future -> (trades, stats))

        def drain_fetch(out, block_to):
            while len(fetching) > block_to:
                n_, doc_, ff = fetching.popleft()
                try:
                    pdf_bytes = ff.result()
                except Exception as e:  # noqa: BLE001
                    print(f"  [{n_}/{len(filings)}] {doc_}: PDF fetch failed — {e}")
                    rec = {"doc": doc_, "year": year, "parser": PARSER_VERSION, "status": "fetch_failed",
                           "error": str(e)[:200], "trades": []}
                    out.write(json.dumps(rec) + "\n")
                    out.flush()
                    continue
                pending.append((n_, doc_, pool.submit(parse_ptr_pdf, pdf_bytes)))
                collect(out, block_to=PARSE_WORKERS * 2)

        def collect(out, block_to):
            while len(pending) > block_to:
                n_, doc_, fut = pending.popleft()
                trades, stats = fut.result()
                rec = {"doc": doc_, "year": year, "parser": PARSER_VERSION, "status": classify(stats),
                       "stats": stats, "trades": trades}
                out.write(json.dumps(rec) + "\n")
                out.flush()
                done[doc_] = rec
                if n_ % 50 == 0:
                    print(f"  [{n_}/{len(filings)}] parsed filings: {len(done)}")

        with open(cache_path, "a", encoding="utf-8") as out:
            for n, f in enumerate(filings, 1):
                doc = (f.get("DocID") or "").strip()
                if doc in done:
                    continue
                if n % 100 == 0 and not gaming_ok():
                    print("  gaming mode on — checkpointed, stopping")
                    stopped = True
                    break
                if deadline and time.monotonic() > deadline:
                    print("  deadline reached — checkpointed, stopping")
                    stopped = True
                    break
                fetching.append((n, doc, fetch_pool.submit(fetch, PTR_URL.format(year=year, doc=doc))))
                drain_fetch(out, block_to=FETCH_WINDOW)
            drain_fetch(out, block_to=0)
            collect(out, block_to=0)
        if stopped:
            pool.shutdown()
            fetch_pool.shutdown()
            return 3

    pool.shutdown()
    fetch_pool.shutdown()
    if check_only:
        return 0
    grand_total = build_all(cache_dir, matcher, ids, sb, prune)
    print(f"\n=== DONE: {grand_total} House trades written ===")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Bulk-load House congressional trades")
    ap.add_argument("--years", nargs="+", type=int)
    ap.add_argument("--all", action="store_true", help="2016-2026")
    ap.add_argument("--check", action="store_true", help="reachability check only")
    ap.add_argument("--limit", type=int, help="cap filings per year (testing)")
    ap.add_argument("--cache-dir", help="per-year JSONL checkpoint directory (default: temp dir)")
    ap.add_argument("--no-write", action="store_true", help="parse and checkpoint only; no database writes")
    ap.add_argument("--deadline-min", type=float, help="stop (checkpointed) after this many minutes")
    ap.add_argument("--prune", action="store_true",
                    help="after writing, delete House_Clerk rows this run did not write (rows of the old, lossy key)")
    ap.add_argument("--recapture-stale", action="store_true",
                    help="R6c: first re-read the filings holding stale_2y rows (1 req/s) so the notification dates are cached")
    args = ap.parse_args()

    years = list(range(2016, 2027)) if args.all else (args.years or [2024])
    return run(years, check_only=args.check, limit=args.limit, cache_dir=args.cache_dir,
               no_write=args.no_write, deadline_min=args.deadline_min, prune=args.prune,
               recapture=args.recapture_stale)


if __name__ == "__main__":
    sys.exit(main())
