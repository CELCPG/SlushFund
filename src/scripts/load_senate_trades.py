#!/usr/bin/env python3
"""
SlushFund R4: load Senate stock trades from the official Senate eFD periodic
transaction reports (PTRs) for EVERY senator who served in 2024-2026.

Source: https://efdsearch.senate.gov (Senate Office of Public Records). Nothing
else is read except the unitedstates/congress-legislators roster (public domain)
and our own congress_members table.

Why this replaces the --all-senators mode of scrape_senate_ptr.py: that script
looped 15 hand-picked names, opened a headless browser per senator-year and
tagged every row party='Unknown'. eFD lets one search return every senator's
PTRs for a filing year, so this loader lists each year once (a handful of requests),
matches each filing to the roster, fetches each electronic report once, and
verifies the listing against per-senator searches.

Stages (each one checkpoints under .checkpoints/senate/ so a retry resumes):
  roster     senators who served in the window (congress_members x congress-legislators terms)
  list       eFD search per filing year: every Senator / Former Senator PTR
  match      listing rows -> roster (bioguide id, party); unmatched rows are listed, not guessed
  fetch      one GET per electronic report, parsed to JSON (resumes per report)
  crosscheck per-senator last-name search over the whole window vs the bulk listing
  load       upsert congress_trades rows per senator-year (resumes per senator-year)
  all        roster, list, match, fetch, crosscheck, load

Paper (scanned) filings, URL /search/view/paper/<id>/, are images: they are counted and
listed (paper-filings.json) but never parsed or guessed.

Politeness: at most 1 request/second to efdsearch.senate.gov (1.1 s sleep), generic
browser User-Agent, no personal identifiers anywhere. Checks gaming mode (exit 3
= stop and checkpoint).

Usage (PowerShell, from the repo root):
    $env:PYTHONIOENCODING = 'utf-8'
    & C:\\Users\\clong\\Projects\\SlushFund-venv\\Scripts\\python.exe src\\scripts\\load_senate_trades.py all
    ... load_senate_trades.py fetch --years 2026 2025 2024
    ... load_senate_trades.py load --dry-run
"""

import argparse
import html as htmllib
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
try:
    from _venv import activate  # noqa: F401  (finds the Windows/mac venv if not active)
    activate()
except Exception:
    pass
from trade_fields import date_flag, date_typo_twin, first_report_basis, lateness_detail, parse_option

BASE = 'https://efdsearch.senate.gov'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
SLEEP = 1.1                       # seconds between eFD requests (<= 1 request/second)
WINDOW_START, WINDOW_END = date(2024, 1, 1), date(2026, 12, 31)
DEFAULT_YEARS = [2026, 2025, 2024]
FILER_TYPES = '[1,5]'             # 1 = Senator, 5 = Former Senator (4 = candidate: 0 rows in the window)
PTR_REPORT_TYPE = '[11]'
GAMING_CHECK = os.environ.get('GAMING_MODE_SCRIPT', r'C:\Users\clong\.openclaw\workspace\scripts\gaming-mode.mjs')

CK = REPO / '.checkpoints' / 'senate'
REPORTS = CK / 'reports'


# ── small utils ──────────────────────────────────────────────────────────────

def jload(path, default=None):
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding='utf-8'))


def jsave(path, obj):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, indent=1, ensure_ascii=False), encoding='utf-8')
    os.replace(tmp, p)


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


class Gaming(Exception):
    pass


_last_gaming = 0.0


def gaming_check(force=False):
    """Exit code 3 from gaming-mode.mjs means Colin is gaming: checkpoint and stop."""
    global _last_gaming
    if not force and time.time() - _last_gaming < 60:
        return
    _last_gaming = time.time()
    if not os.path.exists(GAMING_CHECK):
        return
    try:
        rc = subprocess.run(['node', GAMING_CHECK, 'check'], capture_output=True, timeout=30).returncode
    except Exception:
        return
    if rc == 3:
        raise Gaming('gaming mode is on')


# ── eFD client (plain HTTP; the agreement + CSRF flow the website uses) ───────

class Efd:
    def __init__(self):
        import requests
        self.s = requests.Session()
        self.s.headers['User-Agent'] = UA
        self._t = 0.0
        self.requests = 0
        self.ready = False

    def _wait(self):
        d = SLEEP - (time.time() - self._t)
        if d > 0:
            time.sleep(d)
        self._t = time.time()
        self.requests += 1

    def session(self):
        self._wait()
        r = self.s.get(BASE + '/search/home/', timeout=60)
        tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r.text)
        if not tok:
            raise RuntimeError('eFD agreement page changed: no CSRF token')
        self._wait()
        self.s.post(BASE + '/search/home/', data={'prohibition_agreement': '1', 'csrfmiddlewaretoken': tok.group(1)},
                    headers={'Referer': BASE + '/search/home/'}, timeout=60)
        self._wait()
        r = self.s.get(BASE + '/search/', timeout=60)
        if 'searchForm' not in r.text:
            raise RuntimeError('eFD search page did not load after accepting the agreement')
        self.ready = True

    def _retry(self, fn, what):
        last = None
        for attempt in range(4):
            if not self.ready:
                self.session()
            try:
                self._wait()
                r = fn()
                if r.status_code == 200 and '/search/home/' not in r.url:
                    return r
                last = f'HTTP {r.status_code} {r.url}'
                self.ready = False        # expired session: redo the agreement
            except Exception as e:        # network blip
                last = repr(e)
                self.ready = False
            time.sleep(5 * (attempt + 1))
        raise RuntimeError(f'{what} failed after retries: {last}')

    def search(self, start_date, end_date, first='', last='', report_types=PTR_REPORT_TYPE, filer_types=FILER_TYPES):
        """All rows of a report search (paged 100 at a time)."""
        rows, start, total = [], 0, None
        while True:
            def post():
                csrf = self.s.cookies.get('csrftoken')
                data = {'start': str(start), 'length': '100', 'report_types': report_types, 'filer_types': filer_types,
                        'submitted_start_date': f'{start_date} 00:00:00', 'submitted_end_date': f'{end_date} 23:59:59',
                        'candidate_state': '', 'senator_state': '', 'office_id': '',
                        'first_name': first, 'last_name': last, 'csrfmiddlewaretoken': csrf}
                return self.s.post(BASE + '/search/report/data/', data=data, timeout=90,
                                   headers={'Referer': BASE + '/search/', 'X-CSRFToken': csrf})
            j = self._retry(post, 'search').json()
            if j.get('result') != 'ok':
                raise RuntimeError(f'eFD search returned {str(j)[:200]}')
            total = j['recordsTotal']
            rows += j['data']
            start += 100
            if start >= total or not j['data']:
                break
        if len(rows) != total:
            raise RuntimeError(f'search returned {len(rows)} rows but recordsTotal={total}')
        return rows

    def get(self, path):
        return self._retry(lambda: self.s.get(BASE + path, timeout=90), 'GET ' + path).text


# ── eFD HTML parsing (stdlib only) ───────────────────────────────────────────

def norm(s):
    return re.sub(r'\s+', ' ', htmllib.unescape(s or '')).strip()


class PtrParser(HTMLParser):
    """Pulls the title, filer, filed stamp, summary counts and the transaction table out of a PTR page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.h1 = self.h2 = self.filed = ''
        self.summary = []
        self.headers = []
        self.rows = []
        self._cell = None
        self._row = None
        self._in = {}
        self._buf = {}
        self._tbody = False
        self._th = False
        self.tables = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('h1', 'h2'):
            self._buf[tag] = []
        elif tag == 'p' and 'muted' in (a.get('class') or '').split():
            self._buf['p'] = []
        elif tag == 'li' and 'list-inline-item' in (a.get('class') or ''):
            self._buf['li'] = []
        elif tag == 'table':
            self.tables += 1
        elif tag == 'tbody':
            self._tbody = True
        elif tag == 'th':
            self._buf['th'] = []
        elif tag == 'tr' and self._tbody:
            self._row = []
        elif tag == 'td' and self._row is not None:
            self._cell = {'chunks': [], 'href': None}
        elif tag == 'a' and self._cell is not None and a.get('href'):
            self._cell['href'] = a['href']
        elif tag in ('br', 'div', 'span') and self._cell is not None:
            self._cell['chunks'].append('\x00')       # chunk separator for the asset-name details

    def handle_endtag(self, tag):
        if tag in ('h1', 'h2') and tag in self._buf:
            setattr(self, tag, norm(' '.join(self._buf.pop(tag))))
        elif tag == 'p' and 'p' in self._buf:
            t = norm(' '.join(self._buf.pop('p')))
            if t.startswith('Filed') and not self.filed:
                self.filed = t
        elif tag == 'li' and 'li' in self._buf:
            self.summary.append(norm(' '.join(self._buf.pop('li'))))
        elif tag == 'th' and 'th' in self._buf:
            self.headers.append(norm(' '.join(self._buf.pop('th'))))
        elif tag == 'td' and self._cell is not None:
            self._row.append(self._cell)
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None
        elif tag == 'tbody':
            self._tbody = False

    def handle_data(self, data):
        for k in ('h1', 'h2', 'p', 'li', 'th'):
            if k in self._buf:
                self._buf[k].append(data)
        if self._cell is not None:
            self._cell['chunks'].append(data)


def parse_ptr_page(page_html):
    """-> dict(title, filer, filed, summary, headers, rows[...]) from an eFD /search/view/ptr/ page."""
    p = PtrParser()
    p.feed(page_html)
    out_rows = []
    hdr = [re.sub(r'[^a-z0-9]+', '_', h.lower()).strip('_') or 'n' for h in p.headers]   # '#' -> 'n'
    for r in p.rows:
        cells = []
        for c in r:
            segs = [norm(x) for x in ''.join(c['chunks']).split('\x00')]
            segs = [x for x in segs if x]
            cells.append({'text': norm(' '.join(segs)), 'segs': segs, 'href': c['href']})
        row = {}
        for h, c in zip(hdr, cells):
            row[h] = c['text']
            if h == 'asset_name':
                row['asset_name'] = c['segs'][0] if c['segs'] else ''
                row['asset_detail'] = ' '.join(c['segs'][1:])
            if h == 'ticker':
                row['ticker_url'] = c['href']
        out_rows.append(row)
    return {'title': p.h1, 'filer': p.h2, 'filed': p.filed, 'summary': p.summary, 'headers': p.headers,
            'tables': p.tables, 'rows': out_rows}


# ── roster ───────────────────────────────────────────────────────────────────

SUFFIXES = {'jr', 'sr', 'ii', 'iii', 'iv', 'v'}


def tok(s):
    return [t for t in re.split(r'[^a-z0-9]+', (s or '').lower()) if t]


def last_key(s):
    return ''.join(t for t in tok(s) if t not in SUFFIXES)


def supabase_client():
    from dotenv import load_dotenv
    load_dotenv(REPO / '.env.local')
    from supabase import create_client
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not (url and key):
        raise SystemExit('Supabase URL / service key missing (.env.local)')
    return create_client(url, key)


def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'slushfund-roster/1.0'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode('utf-8'))


def stage_roster(args):
    """Every Senate member in congress_members, flagged in_window = a Senate term overlapping 2024-01-01..2026-12-31."""
    sb = supabase_client()
    members = sb.table('congress_members').select(
        'id,bioguide_id,name,first_name,last_name,suffix,party,state,in_office').eq('chamber', 'Senate').execute().data
    leg = {}
    for u in ('legislators-current', 'legislators-historical'):
        for p in fetch_json(f'https://unitedstates.github.io/congress-legislators/{u}.json'):
            leg[p['id']['bioguide']] = p
    roster = []
    for m in members:
        p = leg.get(m['bioguide_id'])
        if not p:
            log(f"WARN no congress-legislators record for {m['name']} ({m['bioguide_id']})")
            continue
        terms = [t for t in p['terms'] if t['type'] == 'sen'
                 and date.fromisoformat(t['end']) >= WINDOW_START and date.fromisoformat(t['start']) <= WINDOW_END]
        nm = p['name']
        firsts = {x for x in (nm.get('first'), nm.get('nickname'), m['first_name']) if x}
        roster.append({
            'member_id': m['id'], 'bioguide_id': m['bioguide_id'], 'name': m['name'], 'party': m['party'],
            'state': m['state'], 'in_office': m['in_office'], 'in_window': bool(terms),
            'last': nm.get('last') or m['last_name'],
            'last_key': last_key(nm.get('last') or m['last_name']),
            'first_names': sorted(firsts), 'middle_tokens': tok(nm.get('middle') or ''),
            'official_full': nm.get('official_full'),
            'terms': [{'start': t['start'], 'end': t['end'], 'party': t.get('party')} for t in terms],
        })
    roster.sort(key=lambda r: r['name'])
    jsave(CK / 'roster.json', roster)
    n = sum(r['in_window'] for r in roster)
    log(f'roster: {n} senators served 2024-2026 (of {len(roster)} Senate members in congress_members)')
    return roster


# ── listing ──────────────────────────────────────────────────────────────────

LINK = re.compile(r'href="(/search/view/(ptr|paper)/([0-9a-f-]{36})/)"[^>]*>([^<]+)<')


def parse_listing_row(row):
    first, last, office, link, filed = row
    m = LINK.search(link)
    if not m:
        return None
    path, kind, rid, label = m.groups()
    return {
        'first': norm(first), 'last': norm(last), 'office': norm(office), 'label': norm(label),
        'filed': filed.strip(), 'kind': 'electronic' if kind == 'ptr' else 'paper', 'report_id': rid,
        'path': path, 'url': BASE + path,
        'amendment': 'amendment' in label.lower(),
    }


def stage_list(args, efd):
    for y in args.years:
        f = CK / f'listing-{y}.json'
        if f.exists() and not args.refresh:
            log(f'list {y}: checkpoint present ({len(jload(f)["filings"])} filings)')
            continue
        gaming_check(True)
        raw = efd.search(f'01/01/{y}', f'12/31/{y}')
        filings = [x for x in (parse_listing_row(r) for r in raw) if x]
        if len(filings) != len(raw):
            log(f'WARN {y}: {len(raw) - len(filings)} listing rows had no report link')
        jsave(f, {'year': y, 'listed_at': datetime.now().isoformat(timespec='seconds'),
                  'records_total': len(raw), 'filings': filings})
        log(f'list {y}: {len(filings)} filings ({sum(1 for x in filings if x["kind"] == "paper")} paper)')


# ── matching ─────────────────────────────────────────────────────────────────

def match_filer(f, roster):
    """Roster entry for a listing row, or None (never a guess).

    The filer is by definition a senator, so a last name held by exactly one roster senator is enough;
    when several senators share it (Scott, Johnson...) a first-name token must agree (equal, or a shared
    3-letter prefix: Thomas/Tommy, David/Dave). Names that still do not resolve are reported, not guessed.
    """
    lk = last_key(f['last'])
    cands = [r for r in roster if r['last_key'] == lk]
    if len(cands) == 1:
        return cands[0]
    ftoks = tok(f['first'])
    best = []
    for r in cands:
        names = {t for n in r['first_names'] for t in tok(n)} | set(r['middle_tokens'])
        if any(t == n or (len(t) >= 3 and len(n) >= 3 and t[:3] == n[:3]) for t in ftoks for n in names):
            best.append(r)
    return best[0] if len(best) == 1 else None


def stage_match(args):
    roster = jload(CK / 'roster.json')
    if not roster:
        raise SystemExit('run the roster stage first')
    matched, unmatched, paper, out_of_window = [], [], [], []
    for y in args.years:
        L = jload(CK / f'listing-{y}.json')
        if not L:
            raise SystemExit(f'run the list stage for {y} first')
        for f in L['filings']:
            f = dict(f, year=y)
            r = match_filer(f, roster)
            if not r:
                unmatched.append(f)
                continue
            f.update(bioguide_id=r['bioguide_id'], senator=r['name'])
            if not r['in_window']:
                out_of_window.append(f)
            else:
                (paper if f['kind'] == 'paper' else matched).append(f)
    jsave(CK / 'matched.json', matched)
    jsave(CK / 'paper-filings.json', paper)
    jsave(CK / 'unmatched.json', unmatched)
    jsave(CK / 'out-of-window.json', out_of_window)
    log(f'match: {len(matched)} electronic matched, {len(paper)} paper matched, '
        f'{len(out_of_window)} by senators outside 2024-2026, {len(unmatched)} UNMATCHED')
    for u in unmatched[:15]:
        log(f"  unmatched: {u['first']} {u['last']} | {u['office']} | {u['kind']} | {u['filed']}")
    return matched, paper, unmatched


# ── fetch ────────────────────────────────────────────────────────────────────

def stage_fetch(args, efd):
    matched = jload(CK / 'matched.json') or []
    todo = [f for f in matched if f['year'] in args.years and not (REPORTS / f"{f['report_id']}.json").exists()]
    todo.sort(key=lambda f: (f['year'], f['filed']))
    if args.limit:
        todo = todo[:args.limit]
    log(f'fetch: {len(todo)} reports to fetch ({len(matched) - len(todo)} already cached)')
    for i, f in enumerate(todo, 1):
        gaming_check()
        page = efd.get(f['path'])
        p = parse_ptr_page(page)
        n_sum = None
        for s in p['summary']:
            m = re.match(r'\((\d+) transactions? total\)', s)
            if m:
                n_sum = int(m.group(1))
        rec = {'report_id': f['report_id'], 'url': f['url'], 'year': f['year'], 'senator': f['senator'],
               'bioguide_id': f['bioguide_id'], 'listing': {k: f[k] for k in ('first', 'last', 'office', 'label', 'filed', 'amendment')},
               'fetched_at': datetime.now().isoformat(timespec='seconds'), 'declared_count': n_sum, **p}
        jsave(REPORTS / f"{f['report_id']}.json", rec)
        if n_sum is not None and n_sum != len(p['rows']):
            log(f"WARN {f['report_id']} {f['senator']}: page says {n_sum} transactions, parsed {len(p['rows'])}")
        if i % 25 == 0 or i == len(todo):
            log(f'fetch: {i}/{len(todo)}')


# ── crosscheck ───────────────────────────────────────────────────────────────

def stage_crosscheck(args, efd):
    """Independent check of the bulk listing: one search per roster senator over the whole window."""
    everyone = jload(CK / 'roster.json')
    roster = [r for r in everyone if r['in_window']]
    matched = jload(CK / 'matched.json') or []
    paper = jload(CK / 'paper-filings.json') or []
    bulk = {}
    for f in matched + paper:
        bulk.setdefault(f['bioguide_id'], set()).add(f['report_id'])
    f = CK / 'crosscheck.json'
    done = {} if args.refresh else jload(f, {})
    ys = sorted(args.years)
    s, e = f'01/01/{ys[0]}', f'12/31/{ys[-1]}'
    for i, r in enumerate(roster, 1):
        if r['bioguide_id'] in done:
            continue
        gaming_check()
        raw = efd.search(s, e, last=r['last'])
        ids = set()
        for row in raw:
            x = parse_listing_row(row)
            m = match_filer(x, everyone) if x else None      # full roster, so Rick/Tim Scott stay apart
            if m and m['bioguide_id'] == r['bioguide_id']:
                ids.add(x['report_id'])
        done[r['bioguide_id']] = {'name': r['name'], 'search_hits': sorted(ids), 'bulk': sorted(bulk.get(r['bioguide_id'], set()))}
        jsave(f, done)
        if i % 20 == 0:
            log(f'crosscheck: {i}/{len(roster)}')
    bad = {k: v for k, v in done.items() if set(v['search_hits']) != set(v['bulk'])}
    log(f'crosscheck: {len(done)} senators searched, {len(bad)} differ from the bulk listing')
    for k, v in list(bad.items())[:10]:
        log(f"  {v['name']}: search {len(v['search_hits'])} vs bulk {len(v['bulk'])}")
    return done


# ── rows ─────────────────────────────────────────────────────────────────────

TYPE_MAP = [('purchase', 'BUY'), ('sale', 'SELL'), ('exchange', 'EXCHANGE')]
AMT = re.compile(r'\$\s*([\d,]+(?:\.\d+)?)')
OWNER_ORDER = ['Self', 'Spouse', 'Joint', 'Dependent Child', 'Child']
PAREN_TICKER = re.compile(r'\(([A-Z]{1,5}(?:[./-][A-Z]{1,2})?)\)')
NOT_TICKERS = {'ADR', 'ADS', 'ETF', 'LLC', 'INC', 'LTD', 'PLC', 'USD', 'USA', 'US', 'UK', 'LP', 'REIT'}
SYMBOL = r'[A-Z]{1,5}(?:[./-][A-Z]{1,2})?'
WHOLE_NAME_TICKER = re.compile(rf'^({SYMBOL})(?:\s+(?:CALL|PUT))?$')      # 'NVDA', 'SMCI CALL'
PREFIX_TICKER = re.compile(rf'^({SYMBOL})\s*-\s+\S')                       # 'EA - Electronic Arts Inc'


def ticker_from_name(asset, asset_type):
    """Symbol the filer wrote in the asset name when the Ticker column is blank (stock rows only).
    Three explicit notations only; anything else stays ticker-less. -> (ticker, rule) or ('', None)."""
    if asset_type not in ('Stock', 'Stock Option'):
        return '', None
    asset = (asset or '').strip()
    named = [x for x in PAREN_TICKER.findall(asset) if x not in NOT_TICKERS]
    if named:
        return named[-1], 'parenthetical'          # 'Zurich Insurance Group Ltd Sponsored ADR (ZURVY)'
    for rx, rule in ((WHOLE_NAME_TICKER, 'name is the symbol'), (PREFIX_TICKER, 'symbol prefix')):
        m = rx.match(asset)
        if m and m.group(1) not in NOT_TICKERS:
            return m.group(1), rule
    return '', None


def instrument(asset):
    """'CALL' / 'PUT' when the asset name ends that way ('NVDA PUT'), else ''. A call and a put on one key cannot share a row."""
    m = re.search(r'\b(CALL|PUT)$', (asset or '').strip())
    return m.group(1) if m else ''


def tx_type(raw):
    t = (raw or '').strip().lower()
    for k, v in TYPE_MAP:
        if t.startswith(k):
            return v
    return None               # unknown -> row is skipped and reported, never defaulted


def parse_amount(raw):
    """eFD amount bands: '$1,001 - $15,000', 'Over $50,000,000'. -> (min, max); None when open-ended/unparseable."""
    nums = [int(float(x.replace(',', ''))) for x in AMT.findall(raw or '')]
    if len(nums) >= 2:
        return nums[0], nums[1]
    if len(nums) == 1:
        return (nums[0], None) if re.search(r'over|more', raw or '', re.I) else (None, nums[0])
    return None, None


def parse_date(s):
    try:
        return datetime.strptime((s or '').strip(), '%m/%d/%Y').date()
    except ValueError:
        return None


def base_label(label):
    return re.sub(r'\s*\(Amendment[^)]*\)', '', label or '').strip()


def amend_no(label):
    m = re.search(r'\(Amendment\s*(\d*)\)', label or '')
    return 0 if not m else int(m.group(1) or 1)


def pick_versions(recs):
    """An amendment restates the whole report (same rows, corrections applied), so the newest amendment
    supersedes the original and earlier amendments.
    -> (kept [(rec, original_filed_date, original_rec)], superseded [rec]). original_filed_date is the filing date of
    the group's original report (amendment 0) when the listing has it, else None (only amendments are listed:
    the first version's date is unknown, and the amendment's own date is not a substitute). original_rec is that
    original report (R6f, A7c G1: its report id and url are stored as the row's first report), else None."""
    groups = {}
    for rec in recs:
        groups.setdefault(base_label(rec['listing']['label']), []).append(rec)
    kept, superseded = [], []
    for v in groups.values():
        v.sort(key=lambda r: (amend_no(r['listing']['label']), parse_date(r['listing']['filed']) or date.min, r['report_id']))
        originals = [(parse_date(r['listing']['filed']), r) for r in v if amend_no(r['listing']['label']) == 0]
        first, first_rec = min(((d, r) for d, r in originals if d), key=lambda x: (x[0], x[1]['report_id']),
                               default=(None, None))
        if amend_no(v[-1]['listing']['label']) == 0:      # no amendment: every report stands on its own
            kept += [(r, parse_date(r['listing']['filed']), r) for r in v]
        else:
            kept.append((v[-1], first, first_rec))
            superseded += v[:-1]
    return kept, superseded


def fold_owner(owners):
    seen = {o for o in owners if o}
    ordered = [o for o in OWNER_ORDER if o in seen] + sorted(seen - set(OWNER_ORDER))
    return ', '.join(ordered) or None


def option_fields(asset, asset_type, detail):
    """(option_type, strike, expiry) for an eFD line, None x3 when it is not an option (R6a).
    An option is a 'Stock Option' line (the detail reads 'Option Type: Put Strike price: $145.00 Expires: 09/20/2024')
    or a stock line whose name ends CALL / PUT ('SMCI CALL': the filer gave no strike or expiry)."""
    if asset_type == 'Stock Option':
        return parse_option(detail or '', True)
    inst = instrument(asset) if asset_type == 'Stock' else ''
    if inst:
        return inst.lower(), None, None
    return None, None, None


def build_rows(rec, r, acct):
    """congress_trades rows for one parsed report (without the lateness columns: those need the identity
    resolved across reports first).

    Source rows that cannot be stored faithfully are counted in `acct` and listed, never guessed:
      unticked   eFD gave no ticker (bonds, funds, private stock...): the table needs a ticker
                 (the House loader skips them too)
      bad        unknown type / date / no asset name
    Same-day lots of one instrument and owner (same senator, ticker, date, direction, asset type, owner,
    call/put, strike, expiry) are folded into one row: the band is the sum of the lots' bands, lot_count
    says how many, and amount_range lists every band ('... (2 lots)'). Different owners and different
    options are different rows.
    """
    groups = {}
    for row in rec['rows']:
        n = row.get('n', row.get(''))
        ref = {'report_id': rec['report_id'], 'senator': r['name'], 'row': n, 'owner': row.get('owner'),
               'date': row.get('transaction_date'), 'ticker': row.get('ticker'), 'asset': row.get('asset_name'),
               'asset_type': row.get('asset_type'), 'type': row.get('type'), 'amount': row.get('amount'), 'year': rec['year']}
        t = tx_type(row.get('type'))
        d = parse_date(row.get('transaction_date'))
        asset = (row.get('asset_name') or '').strip()
        atype = (row.get('asset_type') or '').strip() or 'Unknown'
        # ticker column as filed ('-- AMCR' = a stray dashes chunk beside the symbol; 'LSXMK SIRI' = an exchange, kept)
        ticker = ' '.join(x for x in (row.get('ticker') or '').split() if x not in ('--', 'N/A'))
        if not ticker:
            # the filer left the Ticker column blank but wrote the symbol in the asset name
            ticker, rule = ticker_from_name(asset, atype)
            if ticker:
                acct['ticker_from_name'].append(dict(ref, rule=rule, stored_ticker=ticker))
        why = (f"unknown transaction type {row.get('type')!r}" if t is None else
               f"bad transaction date {row.get('transaction_date')!r}" if d is None or not (date(2000, 1, 1) <= d <= date(2035, 12, 31)) else
               'no asset name' if not asset else None)
        if why:
            acct['bad'].append(dict(ref, why=why))
            continue
        if not ticker:
            acct['unticked'].append(ref)
            continue
        amin, amax = parse_amount(row.get('amount'))
        opt, strike, expiry = option_fields(asset, atype, row.get('asset_detail'))
        if opt == 'unknown':
            acct['option_unreadable'].append(dict(ref, detail=row.get('asset_detail')))
        owner = (row.get('owner') or '').strip() or None
        groups.setdefault((ticker, d.isoformat(), t, owner, atype, opt, strike, expiry.isoformat() if expiry else None), []).append(
            {'ref': ref, 'asset': asset, 'amin': amin, 'amax': amax, 'band': row.get('amount') or ''})
    out = []
    for (ticker, d, t, owner, atype, opt, strike, expiry), lots in groups.items():
        if len(lots) > 1:
            acct['folded'].extend(dict(x['ref'], into=lots[0]['ref']['row']) for x in lots[1:])
        mins, maxs = [x['amin'] for x in lots], [x['amax'] for x in lots]
        out.append({
            'member_id': r['member_id'], 'member_name': r['name'], 'member_chamber': 'Senate',
            'member_party': r['party'], 'member_state': r['state'], 'bio_guide_id': r['bioguide_id'],
            'ticker': ticker, 'company_name': lots[0]['asset'],
            'transaction_type': t, 'asset_type': atype,
            'amount_min': sum(mins) if all(v is not None for v in mins) else None,
            'amount_max': sum(maxs) if all(v is not None for v in maxs) else None,
            'amount_range': (lots[0]['band'] or None) if len(lots) == 1 else ' + '.join(x['band'] for x in lots) + f' ({len(lots)} lots)',
            'lot_count': len(lots),
            'owner': owner,
            'option_type': opt, 'strike': strike, 'expiry': expiry,
            'transaction_date': d,
            'disclosure_year': rec['year'],
            'source_system': 'Senate_EFD', 'disclosure_url': rec['url'], 'source_doc_id': rec['report_id'],
        })
    return out


# ── load ─────────────────────────────────────────────────────────────────────

# R6a lossless key: owner and instrument are part of it (migration 20261006_r6a_trades_key.sql)
NATURAL_KEY = ('member_name', 'ticker', 'transaction_date', 'transaction_type', 'owner', 'asset_type',
               'option_type', 'strike', 'expiry')


def identity(row, txn_date=None):
    """One disclosed transaction, whatever lots / owners / asset-type label a later filing restates it with.
    txn_date overrides the row's own date for a row whose year was mistyped (R6e twin rule, stage_load)."""
    return (row['ticker'], txn_date or row['transaction_date'], row['transaction_type'],
            row['option_type'], row['strike'], row['expiry'])


def stage_load(args):
    today = date.today()
    run_ts = datetime.now(timezone.utc).isoformat()
    roster = jload(CK / 'roster.json')
    roster_by_bio = {r['bioguide_id']: r for r in roster}
    matched = jload(CK / 'matched.json') or []
    state = jload(CK / 'loaded.json', {})
    sb = None if args.dry_run else supabase_client()
    acct = {'bad': [], 'unticked': [], 'folded': [], 'superseded': [], 'cross_report': [], 'ticker_from_name': [],
            'option_unreadable': []}
    src_rows = 0
    by_sen = {}
    for f in matched:
        p = REPORTS / f"{f['report_id']}.json"
        if not p.exists():
            raise SystemExit(f"report {f['report_id']} not fetched yet (run the fetch stage)")
        rec = jload(p)
        src_rows += len(rec['rows'])
        by_sen.setdefault(f['bioguide_id'], []).append(rec)
    # versions are resolved across all years, so a 2026 amendment of a 2025 report supersedes it
    pending = {}                       # (bioguide, filing year) -> {natural key: row}
    replaced_lines = 0
    for bio, recs in by_sen.items():
        r = roster_by_bio[bio]
        kept, superseded = pick_versions(recs)
        for rec in superseded:
            acct['superseded'].append({'report_id': rec['report_id'], 'senator': r['name'], 'label': rec['listing']['label'],
                                       'filed': rec['listing']['filed'], 'rows': len(rec['rows'])})
        seen = {}                      # identity -> {'doc', 'rows', 'orig' = (date, report) or None}
        built = []
        for rec, first, first_rec in sorted(kept, key=lambda kr: (parse_date(kr[0]['listing']['filed']) or date.min, kr[0]['report_id'])):
            filed = parse_date(rec['listing']['filed'])
            rows_ = build_rows(rec, r, acct)
            for row in rows_:
                row['filed_date'] = filed.isoformat() if filed else None
            built.append((rec, first, first_rec, rows_))
        # R6e (A7b F1): a row whose date cannot be right (after its own filing / in the future) that a LATER report
        # restates with a month/day twin (a mistyped year) is the same transaction: key it on the twin's date, so the
        # later report restates it and the earliest report stays the original (trade_fields.date_typo_twin).
        def _sig(row):
            return (row['ticker'], row['transaction_type'], row['owner'], row['option_type'], row['strike'], row['expiry'])
        by_sig = {}
        for i, (_rec, _first, _first_rec, rows_) in enumerate(built):
            for row in rows_:
                by_sig.setdefault(_sig(row), []).append((i, row['transaction_date']))
        twin_date = {}
        for i, (_rec, _first, _first_rec, rows_) in enumerate(built):
            for row in rows_:
                cands = [d for (j, d) in by_sig[_sig(row)] if j > i]
                twin = date_typo_twin(row['transaction_date'], row['filed_date'], today, cands) if cands else None
                if twin:
                    twin_date[id(row)] = twin.isoformat()
                    acct.setdefault('date_typo_twins', []).append(
                        {'senator': r['name'], 'ticker': row['ticker'], 'typo_date': row['transaction_date'], 'twin_date': twin.isoformat()})
        for rec, first, first_rec, rows_ in built:
            new = {}
            for row in rows_:
                new.setdefault(identity(row, twin_date.get(id(row))), []).append(row)
            for ident, rows in new.items():
                orig = (first, first_rec) if first else None
                old = seen.get(ident)
                if old and old['doc'] != rec['report_id']:
                    # the same transaction in a later filing: the later filing restates it and wins
                    lines = sum(x['lot_count'] for x in old['rows'])
                    replaced_lines += lines
                    acct['cross_report'].append({'senator': r['name'], 'ticker': ident[0], 'date': ident[1], 'type': ident[2],
                                                 'kept_report': rec['report_id'], 'dropped_report': old['doc'],
                                                 'kept_rows': [[x['owner'], x['amount_range']] for x in rows],
                                                 'dropped_rows': [[x['owner'], x['amount_range']] for x in old['rows']]})
                    known = [x for x in (old['orig'], orig) if x]
                    orig = min(known, key=lambda x: (x[0], x[1]['report_id'])) if known else None
                for row in rows:
                    row['original_filed_date'] = orig[0].isoformat() if orig else None
                    # R6f (A7c G1): the first report the original date came from (NULL together when unknown)
                    row['original_source_doc_id'] = orig[1]['report_id'] if orig else None
                    row['original_disclosure_url'] = orig[1]['url'] if orig else None
                    row['original_source_basis'] = first_report_basis(row['source_doc_id'], row['original_source_doc_id'])
                seen[ident] = {'doc': rec['report_id'], 'rows': rows, 'orig': orig}
        for entry in seen.values():
            for row in entry['rows']:
                flag = date_flag(row['transaction_date'], row['original_filed_date'], row['filed_date'], today)
                row['date_flag'] = flag
                row['days_to_file'], row['stock_act_late'], row['lateness_basis'] = lateness_detail(
                    row['transaction_date'], row['original_filed_date'], flag, row.get('amount_max'))
                row['updated_at'] = run_ts
                pending.setdefault((bio, row['disclosure_year']), {})[tuple(row[c] for c in NATURAL_KEY)] = row
    years = set(args.years)
    total = 0
    for (bio, year), rows_by_key in sorted(pending.items(), key=lambda kv: (-kv[0][1], roster_by_bio[kv[0][0]]['name'])):
        if year not in years:
            continue
        key = f'{bio}|{year}'
        if key in state and not args.refresh:
            continue
        gaming_check()
        rows = list(rows_by_key.values())
        if sb and rows:
            for i in range(0, len(rows), 200):
                sb.table('congress_trades').upsert(rows[i:i + 200], on_conflict=','.join(NATURAL_KEY)).execute()
        state[key] = {'senator': roster_by_bio[bio]['name'], 'year': year, 'rows': len(rows),
                      'loaded_at': datetime.now().isoformat(timespec='seconds')}
        if not args.dry_run:
            jsave(CK / 'loaded.json', state)
        total += len(rows)
    # rows of the old key shape (folded across owners / asset types) are not overwritten by the new ones:
    # after a full refresh, remove this source's rows that this run did not write
    pruned = None
    if sb and args.refresh:
        stale = (sb.table('congress_trades').select('id', count='exact').eq('source_system', 'Senate_EFD')
                 .in_('disclosure_year', sorted(years)).lt('updated_at', run_ts).execute())
        pruned = stale.count
        if args.prune and pruned:
            sb.table('congress_trades').delete().eq('source_system', 'Senate_EFD').in_('disclosure_year', sorted(years)).lt('updated_at', run_ts).execute()
    # reconciliation: every source line is accounted for exactly once
    rows_out = sum(len(v) for v in pending.values())
    lines_in_rows = sum(r['lot_count'] for v in pending.values() for r in v.values())
    sup_rows = sum(x['rows'] for x in acct['superseded'])
    opts = {}
    for v in pending.values():
        for r_ in v.values():
            if r_['option_type']:
                opts[r_['option_type']] = opts.get(r_['option_type'], 0) + 1
    summary = {
        'source_rows_in_fetched_reports': src_rows,
        'electronic_reports': len(matched),
        'reports_superseded_by_amendment': len(acct['superseded']),
        'rows_in_superseded_reports': sup_rows,
        'rows_without_ticker_not_loaded': len(acct['unticked']),
        'rows_whose_ticker_came_from_the_asset_name': len(acct['ticker_from_name']),
        'rows_unparseable': len(acct['bad']),
        'lines_replaced_by_a_later_filing': replaced_lines,
        'rows_for_database': rows_out,
        'source_lines_in_those_rows': lines_in_rows,
        'lots_folded_into_same_day_rows': lines_in_rows - rows_out,
        'option_rows_by_type': opts,
        'option_lines_unreadable': len(acct['option_unreadable']),
        'stale_old_shape_rows_found': pruned,
    }
    accounted = len(acct['unticked']) + len(acct['bad']) + sup_rows + replaced_lines + lines_in_rows
    summary['accounted_for'] = accounted
    summary['reconcile_gap'] = src_rows - accounted
    jsave(CK / 'load-summary.json', summary)
    for name, items in acct.items():
        jsave(CK / f'rows-{name}.json', items)
    log(f"load{' (dry run)' if args.dry_run else ''}: {total} rows written this run; summary {json.dumps(summary)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('stage', choices=['roster', 'list', 'match', 'fetch', 'crosscheck', 'load', 'all'])
    ap.add_argument('--years', type=int, nargs='+', default=DEFAULT_YEARS)
    ap.add_argument('--limit', type=int, default=0, help='fetch: stop after N reports')
    ap.add_argument('--refresh', action='store_true', help='ignore checkpoints for this stage')
    ap.add_argument('--dry-run', action='store_true', help='load: build rows, write nothing')
    ap.add_argument('--prune', action='store_true', help='load --refresh: delete this source\'s rows of the loaded years that this run did not write (old key shape)')
    args = ap.parse_args()
    CK.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    gaming_check(True)
    efd = Efd()
    st = args.stage
    try:
        if st in ('roster', 'all'):
            stage_roster(args)
        if st in ('list', 'all'):
            stage_list(args, efd)
        if st in ('match', 'all', 'fetch', 'crosscheck'):
            stage_match(args)
        if st in ('fetch', 'all'):
            stage_fetch(args, efd)
        if st in ('crosscheck', 'all'):
            stage_crosscheck(args, efd)
        if st in ('load', 'all'):
            stage_load(args)
    except Gaming:
        log('gaming mode is on: stopped; checkpoints are saved, rerun to resume')
        sys.exit(3)
    log(f'done ({efd.requests} eFD requests)')


if __name__ == '__main__':
    main()
