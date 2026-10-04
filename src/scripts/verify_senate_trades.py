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
  * same-day lots folded into one row: the stored band must equal the sum of every source lot of that
    instrument and owner (senator/ticker/date/direction/asset type/owner/call-put/strike/expiry), and
    lot_count must match
  * R6a: options: option_type / strike / expiry must equal what the source line says (read here with
    its own regexes, not the loader's)
  * R6a: filed_date is the filing date of the report the row cites (an amendment's own date);
    original_filed_date is the first version's date (a fresh eFD search for an amendment); the
    lateness columns are recomputed from the source dates: days_to_file = original - transaction,
    stock_act_late = days > 45, both NULL when date_flag is set

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
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from _venv import activate
activate()
from load_senate_trades import (CK, Efd, base_label, instrument, parse_amount, parse_date,  # noqa: E402
                                parse_listing_row, supabase_client, ticker_from_name, tok)

TYPE = {'purchase': 'BUY', 'sale': 'SELL', 'exchange': 'EXCHANGE'}


def source_option(asset, asset_type, detail):
    """(option_type, strike, expiry iso) the SOURCE line shows. `detail` is the structured asset cell that
    capitolgains' scraper returns for a Stock Option line ({'option_type', 'strike_price', 'expiration_date'}):
    read by a different tool than the loader's HTML parser."""
    if asset_type == 'Stock Option':
        d = detail if isinstance(detail, dict) else {}
        kind = (d.get('option_type') or '').strip().lower()
        exp = None
        if d.get('expiration_date'):
            s = str(d['expiration_date']).strip()
            exp = s if '-' in s else datetime.strptime(s, '%m/%d/%Y').date().isoformat()
        strike = d.get('strike_price')
        return (kind if kind in ('call', 'put') else 'unknown', float(strike) if strike not in (None, '') else None, exp)
    inst = instrument(asset) if asset_type == 'Stock' else ''
    return (inst.lower(), None, None) if inst else (None, None, None)


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
    ap.add_argument('--options', action='store_true', help='draw the sample only from option rows (option_type set)')
    ap.add_argument('--late', action='store_true', help='draw the sample only from rows whose lateness was computed')
    ap.add_argument('--not-member', help='R6e: leave this member out of the sample (Armstrong holds 701 of the 754 late Senate rows)')
    ap.add_argument('--late-board', action='store_true', help='R6e: draw the sample only from rows the late-filers board would show (stock_act_late = true)')
    ap.add_argument('--amended', action='store_true', help='draw the sample only from rows whose filed_date differs from original_filed_date')
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
        rows = [r for r in rows if r['lot_count'] > 1]
        print(f'{len(rows)} of them are folded same-day-lot rows (the sample is drawn from these)')
    if args.options:
        rows = [r for r in rows if r['option_type']]
        print(f'{len(rows)} of them are option rows (the sample is drawn from these)')
    if args.late:
        rows = [r for r in rows if r['days_to_file'] is not None]
        print(f'{len(rows)} of them have days_to_file computed (the sample is drawn from these)')
    if args.not_member:
        rows = [r for r in rows if r['member_name'] != args.not_member]
    if args.late_board:
        rows = [r for r in rows if r['stock_act_late'] is True]
        print(f'{len(rows)} of them are late-board rows (stock_act_late = true; the sample is drawn from these)')
    if args.amended:
        rows = [r for r in rows if r['original_filed_date'] and r['filed_date'] != r['original_filed_date']]
        print(f'{len(rows)} of them cite an amendment (filed_date differs from original_filed_date)')
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
            checks['filed_date'] = page_filed == r['filed_date']        # the date on the page the row cites
            if 'amendment' in title.lower():
                if url not in orig_cache:
                    orig_cache[url] = first_filing_date(efd, last, title)
                src_orig = orig_cache[url]
                note += f'amendment filed {page_filed}; original filing per a fresh eFD search: {src_orig}; '
            else:
                src_orig = page_filed
            # the first version's date: the original report's date (a later filing may restate a transaction an earlier one held)
            checks['original_filed_date'] = (r['original_filed_date'] == src_orig) or (
                bool(r['original_filed_date']) and bool(src_orig) and r['original_filed_date'] < src_orig)
            if r['original_filed_date'] and src_orig and r['original_filed_date'] < src_orig:
                note += f"original_filed_date {r['original_filed_date']} is earlier than this report's own first version (an earlier filing held the same transaction); "
            cands = []
            for x in table['rows']:
                name = x.get('asset_name')
                name = name.get('name') if isinstance(name, dict) else name
                detail = x.get('asset_name') if isinstance(x.get('asset_name'), dict) else None
                cands.append({'date': norm_date(x.get('transaction_date')), 'ticker': (x.get('ticker') or '').strip(),
                              'asset': (name or '').strip(), 'type': type_of(x.get('type')), 'amount': (x.get('amount') or '').strip(),
                              'owner': x.get('owner'), 'asset_type': x.get('asset_type'), 'detail': detail})
            tick = r['ticker']
            same_key = [c for c in cands if c['date'] == r['transaction_date'] and c['type'] == r['transaction_type']
                        and eff_ticker(c)[0] == tick and c['asset_type'] == r['asset_type']
                        and (c['owner'] or None) == r['owner']
                        and (lambda o: (o[0], o[1], o[2]))(source_option(c['asset'], c['asset_type'], c['detail']))
                        == (r['option_type'], r['strike'] if r['strike'] is None else float(r['strike']), r['expiry'])]
            lots = r['lot_count'] if r['lot_count'] > 1 else 0
            if same_key:
                checks['option_fields'] = True        # the match above already compared call/put, strike and expiry
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
                    checks['owner'] = all((x['owner'] or None) == r['owner'] for x in same_key)
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
            # lateness, recomputed from the source dates
            tx = date.fromisoformat(r['transaction_date'])
            if src_orig and r['original_filed_date'] and r['date_flag'] is None:
                days = (date.fromisoformat(r['original_filed_date']) - tx).days
                checks['days_to_file'] = r['days_to_file'] == days
                # R6e: a row at or under the $1,000 reporting threshold was never due: stock_act_late must be NULL
                checks['stock_act_late'] = r['stock_act_late'] == (None if (r['amount_max'] is not None and r['amount_max'] <= 1000) else days > 45)
            elif r['date_flag']:
                checks['lateness_null_when_flagged'] = r['days_to_file'] is None and r['stock_act_late'] is None
            ok = all(checks.values())
            results.append({'n': i, 'senator': r['member_name'], 'ticker': r['ticker'], 'asset': r['company_name'],
                            'date': r['transaction_date'], 'type': r['transaction_type'], 'amount': r['amount_range'],
                            'owner': r['owner'], 'report': url, 'ok': ok,
                            'option': [r['option_type'], r['strike'], r['expiry']], 'lot_count': r['lot_count'],
                            'filed': r['filed_date'], 'original': r['original_filed_date'], 'days_to_file': r['days_to_file'],
                            'stock_act_late': r['stock_act_late'], 'date_flag': r['date_flag'],
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
