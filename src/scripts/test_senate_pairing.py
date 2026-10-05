#!/usr/bin/env python3
"""Self-test for the Senate amendment pairing rule (D1, A8b L6): load_senate_trades.pick_versions.
Run: python src/scripts/test_senate_pairing.py"""
import json
from pathlib import Path

from load_senate_trades import PairingError, pick_versions, shared_lines


def line(date, ticker, kind='Sale (Full)', asset=None, amount='$1,001 - $15,000', owner='Joint'):
    return {'transaction_date': date, 'owner': owner, 'ticker': ticker, 'asset_name': asset or ticker + ' Common Stock',
            'type': kind, 'amount': amount}


def rep(rid, label, filed, rows):
    return {'report_id': rid, 'url': f'https://efdsearch.senate.gov/search/view/ptr/{rid}/', 'listing': {'label': label, 'filed': filed},
            'rows': rows}


T = 'Periodic Transaction Report for 08/17/2026'
SALES = rep('sales', T, '08/17/2026', [line('07/31/2026', 'CBOE'), line('07/23/2026', 'JPM'), line('07/09/2026', 'HD'), line('07/02/2026', 'TRV')])
BUYS = rep('buys', T, '08/17/2026', [line('07/02/2026', 'SPYM', 'Purchase'), line('07/01/2026', 'VEA', 'Purchase'), line('07/01/2026', 'VWO', 'Purchase')])
AMEND = rep('amend', T + ' (Amendment 1)', '08/17/2026', [line('07/02/2026', 'SPYM', 'Purchase'), line('07/01/2026', 'VEA', 'Purchase'),
                                                           line('07/01/2026', 'VWO', 'Purchase'), line('07/01/2026', 'MDY', 'Purchase')])


def ids(recs):
    return sorted(r['report_id'] for r in recs)


# ── Boozman 08/17/2026 (4184cc9a): the amendment restates the purchases report, not the same-day sales report ──
for order in ([SALES, BUYS, AMEND], [AMEND, BUYS, SALES], [BUYS, AMEND, SALES]):       # input order does not matter
    notes = []
    kept, sup = pick_versions(order, notes)
    got = {r['report_id']: (d, fr['report_id'] if fr else None) for r, d, fr in kept}
    assert set(got) == {'sales', 'amend'}, got                           # the sibling stays its own report; the amendment stands for its original
    assert got['amend'][1] == 'buys' and got['sales'][1] == 'sales', got
    assert ids(sup) == ['buys']
    assert notes[0]['paired_original'] == 'buys' and notes[0]['shared_lines'] == 3 and notes[0]['exact_match'] and not notes[0]['tie_between']
assert shared_lines(AMEND, SALES) == (0, 0) and shared_lines(AMEND, BUYS) == (3, 3)

# ── the old rule's choice (earliest report id) loses to the shared lines ──
EARLY = rep('a-early', T, '08/17/2026', [line('06/01/2026', 'XOM')])
kept, sup = pick_versions([EARLY, BUYS, AMEND])
assert {r['report_id']: fr['report_id'] for r, _d, fr in kept}['amend'] == 'buys' and ids(sup) == ['buys']

# ── one amendment per sibling: each pairs with its own original ──
BUYS2 = rep('buys2', T, '08/17/2026', [line('07/05/2026', 'AAPL', 'Purchase'), line('07/06/2026', 'MSFT', 'Purchase')])
AMEND2 = rep('amend2', T + ' (Amendment 1)', '09/01/2026', [line('07/05/2026', 'AAPL', 'Purchase'), line('07/06/2026', 'MSFT', 'Purchase')])
kept, sup = pick_versions([BUYS, BUYS2, AMEND, AMEND2])
assert {r['report_id']: fr['report_id'] for r, _d, fr in kept} == {'amend': 'buys', 'amend2': 'buys2'} and ids(sup) == ['buys', 'buys2']

# ── a chain: Amendment 2 restates Amendment 1 of the same original; the first report stays the original ──
ORIG = rep('o', 'Periodic Transaction Report for 11/15/2024', '11/15/2024', [line('11/01/2024', 'GOOG'), line('11/02/2024', 'NVDA')])
A1 = rep('a1', 'Periodic Transaction Report for 11/15/2024 (Amendment 1)', '08/05/2026', [line('11/01/2024', 'GOOG'), line('11/02/2024', 'NVDA')])
A2 = rep('a2', 'Periodic Transaction Report for 11/15/2024 (Amendment 2)', '08/06/2026', [line('11/01/2024', 'GOOG'), line('11/02/2024', 'NVDA')])
kept, sup = pick_versions([A2, ORIG, A1])
assert [(r['report_id'], d.isoformat(), fr['report_id']) for r, d, fr in kept] == [('a2', '2024-11-15', 'o')] and ids(sup) == ['a1', 'o']

# ── a correction that changed every line (date / direction): paired on the instruments, noted as no identical line ──
G0 = rep('g0', 'Periodic Transaction Report for 01/26/2024', '01/26/2024', [line('01/10/2024', 'VIG'), line('01/11/2024', 'USFR')])
G1 = rep('g1', 'Periodic Transaction Report for 01/26/2024 (Amendment 1)', '05/08/2024', [line('01/12/2024', 'VIG'), line('01/11/2024', 'USFR', 'Purchase')])
notes = []
kept, sup = pick_versions([G0, G1], notes)
assert kept[0][0]['report_id'] == 'g1' and kept[0][2]['report_id'] == 'g0'
assert notes[0]['shared_lines'] == 0 and notes[0]['shared_instruments'] == 2 and not notes[0]['exact_match']

# ── a tie goes to the earlier filing and is noted ──
D1_ = rep('d1', T, '08/17/2026', [line('07/02/2026', 'SPYM', 'Purchase')])
D2_ = rep('d2', T, '08/18/2026', [line('07/02/2026', 'SPYM', 'Purchase')])
DA = rep('da', T + ' (Amendment 1)', '09/01/2026', [line('07/02/2026', 'SPYM', 'Purchase')])
notes = []
kept, sup = pick_versions([D2_, DA, D1_], notes)
assert {r['report_id']: fr['report_id'] for r, _d, fr in kept} == {'da': 'd1', 'd2': 'd2'}
assert notes[0]['tie_between'] == ['d1', 'd2']

# ── an amendment that shares no instrument with any original in its group is an error, never a pairing ──
OTHER = rep('x', T, '08/17/2026', [line('07/02/2026', 'TRV')])
LONE = rep('lone', T + ' (Amendment 1)', '09/01/2026', [line('07/02/2026', 'SPYM', 'Purchase')])
for recs in ([OTHER, LONE], [SALES, LONE]):
    try:
        pick_versions(recs)
    except PairingError as e:
        assert 'lone' in str(e) and 'not paired' in str(e)
    else:
        raise AssertionError('an amendment with no shared instrument must not be paired')

# ── an amendment whose original is not in the listing (it predates the window): no first report, as before ──
kept, sup = pick_versions([rep('only', 'Periodic Transaction Report for 03/20/2024 (Amendment 1)', '03/19/2025', [line('03/01/2024', 'IBM')])])
assert [(r['report_id'], d, fr) for r, d, fr in kept] == [('only', None, None)] and not sup
# ── reports with no amendment stand on their own ──
kept, sup = pick_versions([SALES, BUYS])
assert ids([r for r, _d, _f in kept]) == ['buys', 'sales'] and not sup

# ── the cached eFD reports (present on the loading machine only): Boozman's five pairs ──
CK = Path(__file__).resolve().parents[2] / '.checkpoints' / 'senate'
if (CK / 'matched.json').exists():
    recs = [json.loads((CK / 'reports' / f"{m['report_id']}.json").read_text(encoding='utf-8'))
            for m in json.loads((CK / 'matched.json').read_text(encoding='utf-8')) if m['bioguide_id'] == 'B001236']
    kept, sup = pick_versions(recs)
    first = {r['report_id'][:8]: fr['report_id'][:8] for r, _d, fr in kept}
    for amend, orig in {'4184cc9a': '4a558db2', '4b5c15fa': 'db2a4c73', '51455bcd': '3a779539', '727b4eb6': 'a9754ff5', 'f727289a': '59691760'}.items():
        assert first[amend] == orig, (amend, first[amend])
    for sibling in ('28e465df', '7f1f888e', '2c4705cc', '2e076759', '52c9fa8c', 'f87f8a40', 'fcacc112'):
        assert first[sibling] == sibling, sibling                       # kept as its own report
    print('Boozman cached reports: 5 amendments paired with their originals, 7 same-day siblings kept')
print('senate pairing: all tests passed')
