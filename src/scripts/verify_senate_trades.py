#!/usr/bin/env python3
"""
SlushFund R4: verify a random sample of loaded Senate trades against the live eFD report.

Independent of the loader: the loader reads eFD over plain HTTP with a stdlib HTML parser;
this script opens each report in a headless browser through capitolgains
(SenateDisclosureScraper._scrape_ptr_report, a JavaScript DOM extraction) and compares the
database row with what the official page shows. Static assets are blocked, so each report
costs one HTML request, spaced >= 1.5 s apart.

For each sampled row it checks: senator (report heading vs member_name), asset name + ticker,
transaction date, type (Purchase/Sale/Exchange vs BUY/SELL/EXCHANGE), amount band (raw string and
parsed min/max), asset type, owner, filed date and the report id in the URL.

Loader rules the checks apply explicitly (so they are tested, not excused):
  * blank Ticker column: the symbol in the asset name's parentheses must equal the stored ticker
  * same-day lots folded into one row: the stored band must equal the sum of every source lot
    with that senator/ticker/date/direction, and the lot count must match
  * amendment reports: filed_date must equal the ORIGINAL report's filing date (fresh eFD search)

Usage:
    python src/scripts/verify_senate_trades.py --n 25 --seed 20261003 [--out verification-1.json]
Writes .checkpoints/senate/<out> and prints a short summary.
"""

import argparse
import json
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from _venv import activate
activate()
from load_senate_trades import (CK, Efd, base_label, instrument, parse_amount, parse_date,  # noqa: E402
                                parse_listing_row, supabase_client, ticker_from_name, tok)

TYPE = {'purchase': 'BUY', 'sale': 'SELL', 'exchange': 'EXCHANGE'}


def type_of(s):
    s = (s or '').lower()
    return next((v for k, v in TYPE.items() if s.startswith(k)), None)


def norm_date(s):
    try:
        return datetime.strptime((s or '').strip(), '%m/%d/%Y').date().isoformat()
    except ValueError:
        return None


def eff_ticker(c):
    """Ticker as the source row shows it; when the Ticker column is blank, the symbol the filer wrote in the
    asset name's parentheses (stock rows only). Returns (ticker, from_name)."""
    t = ' '.join(x for x in (c['ticker'] or '').split() if x not in ('--', 'N/A'))
    if t:
        return t, False
    named, _rule = ticker_from_name(c['asset'], c['asset_type'])
    return (named, True) if named else ('', False)


def first_filing_date(efd, last, label):
    """Filing date of the ORIGINAL report that an amendment restates, from a fresh eFD search."""
    rows = efd.search('01/01/2024', '12/31/2026', last=last)
    base = base_label(label)
    dates = []
    for row in rows:
        x = parse_listing_row(row)
        if x and x['kind'] == 'electronic' and base_label(x['label']) == base:
            dates.append(parse_date(x['filed']))
    return min(dates).isoformat() if dates else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=25)
    ap.add_argument('--seed', type=int, default=20261003)
    ap.add_argument('--pause', type=float, default=1.5)
    ap.add_argument('--out', default='verification.json')
    ap.add_argument('--from-name-rules', action='store_true', help="sample only rows whose ticker came from 'name is the symbol' / 'symbol prefix'")
    ap.add_argument('--folded', action='store_true', help='draw the sample only from rows that folded same-day lots')
    args = ap.parse_args()

    sb = supabase_client()
    rows, start = [], 0
    while True:
        page = (sb.table('congress_trades').select('*').eq('member_chamber', 'Senate').eq('source_system', 'Senate_EFD')
                .order('id').range(start, start + 999).execute().data)
        rows += page
        if len(page) < 1000:
            break
        start += 1000
    print(f'{len(rows)} Senate_EFD rows in the database')
    if args.from_name_rules:
        evid = json.loads((CK / 'rows-ticker_from_name.json').read_text(encoding='utf-8'))
        keys = {(e['report_id'], (e['asset'] or '').strip()) for e in evid if e['rule'] != 'parenthetical'}
        rows = [r for r in rows if (r['source_doc_id'], r['company_name']) in keys]
        print(f'{len(rows)} of them take the ticker from the asset name by the non-parenthetical rules (the sample is drawn from these)')
    if args.folded:
        rows = [r for r in rows if (r['amount_range'] or '').endswith(' lots)')]
        print(f'{len(rows)} of them are folded same-day-lot rows (the sample is drawn from these)')
    random.seed(args.seed)
    sample = random.sample(rows, min(args.n, len(rows)))

    from capitolgains.utils.senator_scraper import SenateDisclosureScraper
    results, cache, orig_cache = [], {}, {}
    efd = Efd()
    with SenateDisclosureScraper(headless=True) as sc:
        sc.with_session(f'{sc.BASE_URL}{sc.SEARCH_PATH}')
        # one HTML request per report: block images, css, fonts and scripts (the page is server-rendered)
        sc._page.route('**/*', lambda route: route.continue_() if route.request.resource_type == 'document' else route.abort())
        for i, r in enumerate(sample, 1):
            url = r['disclosure_url']
            if url not in cache:
                time.sleep(args.pause)
                cache[url] = sc._scrape_ptr_report(url)
            rep = cache[url]
            meta = rep['metadata']
            table = rep['sections']['transactions']['table'] or {'rows': []}
            checks, note = {}, ''
            last = tok(r['member_name'])[-1]
            checks['senator'] = last in tok(meta.get('filer', ''))
            checks['report_id_in_url'] = r['source_doc_id'] in url
            page_filed = norm_date(re.sub(r'^Filed\s+', '', (meta.get('filed_date') or '')).split('@')[0].strip())
            title = meta.get('title') or ''
            if 'amendment' in title.lower():
                if url not in orig_cache:
                    orig_cache[url] = first_filing_date(efd, last, title)
                checks['filed_date'] = bool(orig_cache[url]) and orig_cache[url] == r['filed_date'] and orig_cache[url] <= (page_filed or '9999')
                note += f'amendment; filed_date is the original filing {orig_cache[url]} (page shows {page_filed}); '
            else:
                checks['filed_date'] = page_filed == r['filed_date']
            cands = []
            for x in table['rows']:
                name = x.get('asset_name')
                name = name.get('name') if isinstance(name, dict) else name
                cands.append({'date': norm_date(x.get('transaction_date')), 'ticker': (x.get('ticker') or '').strip(),
                              'asset': (name or '').strip(), 'type': type_of(x.get('type')), 'amount': (x.get('amount') or '').strip(),
                              'owner': x.get('owner'), 'asset_type': x.get('asset_type')})
            tick = r['ticker']
            same_key = [c for c in cands if c['date'] == r['transaction_date'] and c['type'] == r['transaction_type']
                        and eff_ticker(c)[0] == tick and c['asset_type'] == r['asset_type']
                        and instrument(c['asset']) == instrument(r['company_name'])]
            m = re.search(r'\((\d+) lots\)$', r['amount_range'] or '')
            lots = int(m.group(1)) if m else 0
            checks['row_found'] = bool(same_key)
            if same_key:
                c = same_key[0]
                checks['asset'] = c['asset'] == r['company_name'] or (lots > 0 and any(x['asset'] == r['company_name'] for x in same_key))
                checks['ticker'] = eff_ticker(c)[0] == tick
                if eff_ticker(c)[1]:
                    note += 'ticker taken from the asset name (source Ticker column blank); '
                checks['date'] = c['date'] == r['transaction_date']
                checks['type'] = c['type'] == r['transaction_type']
                checks['asset_type'] = c['asset_type'] == r['asset_type']
                if lots:
                    bands = [parse_amount(x['amount']) for x in same_key]
                    checks['lot_count'] = len(same_key) == lots
                    checks['amount_band'] = r['amount_range'] == ' + '.join(x['amount'] for x in same_key) + f' ({lots} lots)'
                    checks['amount_min_max'] = ((sum(b[0] for b in bands), sum(b[1] for b in bands)) == (r['amount_min'], r['amount_max']))
                    checks['owner'] = sorted({x['owner'] for x in same_key}) == sorted((r['owner'] or '').split(', '))
                    note += f'{lots} same-day lots folded, bands summed; '
                else:
                    hit = next((x for x in same_key if x['amount'] == (r['amount_range'] or '')), None)
                    c = hit or c
                    checks['amount_band'] = c['amount'] == (r['amount_range'] or '')
                    lo, hi = parse_amount(c['amount'])
                    checks['amount_min_max'] = (lo, hi) == (r['amount_min'], r['amount_max'])
                    checks['owner'] = (c['owner'] or '') == (r['owner'] or '')
            else:
                note += 'no source row with this date/type/ticker/asset type; '
            ok = all(checks.values())
            results.append({'n': i, 'senator': r['member_name'], 'ticker': r['ticker'], 'asset': r['company_name'],
                            'date': r['transaction_date'], 'type': r['transaction_type'], 'amount': r['amount_range'],
                            'owner': r['owner'], 'report': url, 'ok': ok,
                            'failed': [k for k, v in checks.items() if not v], 'note': note.strip()})
            print(f"{i:>2} {'OK ' if ok else 'BAD'} {r['member_name']:<22} {r['transaction_date']} {r['transaction_type']:<8} "
                  f"{(r['ticker'] or '--'):<8} {str(r['amount_range'])[:40]:<40} {note.strip()[:70]}")
    n_ok = sum(x['ok'] for x in results)
    out = {'seed': args.seed, 'rows_in_db': len(rows), 'sampled': len(results), 'matched': n_ok,
           'match_rate': round(n_ok / len(results), 4) if results else None,
           'distinct_reports_opened': len(cache), 'results': results}
    (CK / args.out).write_text(json.dumps(out, indent=1), encoding='utf-8')
    print(f'\nmatch rate: {n_ok}/{len(results)} over {len(cache)} distinct reports')
    for x in results:
        if not x['ok']:
            print('MISMATCH', x['senator'], x['date'], x['type'], x['ticker'], x['amount'], x['failed'], x['report'])


if __name__ == '__main__':
    main()
