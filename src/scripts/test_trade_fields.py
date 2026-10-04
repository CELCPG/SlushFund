#!/usr/bin/env python3
"""Self-test for trade_fields.py (R6a): option parsing, date flags, lateness. Run: python src/scripts/test_trade_fields.py"""
from datetime import date

from trade_fields import STRONG_OPTION, date_flag, lateness, parse_option

D = date

# ── options: every notation seen in the House PTRs and the Senate eFD ────────
CASES = [
    ("Option Type: Put Strike price: $145.00 Expires: 09/20/2024", ("put", 145.0, D(2024, 9, 20))),           # Senate eFD (A7 row 2617dd6f)
    ("Option Type: Call Strike price: $75.00 Expires: 2026-08-21", ("call", 75.0, D(2026, 8, 21))),
    ("Call options; Strike price $340; Expires 10/16/2026", ("call", 340.0, D(2026, 10, 16))),                 # House 2023+
    ("Purchased 100 call options with a strike price of $100 and an expiration date of 1/21/22.", ("call", 100.0, D(2022, 1, 21))),
    ("Call Options, Strike Price $287.50, Expires 3/26/21", ("call", 287.5, D(2021, 3, 26))),
    ("Call option, $300, Exp. 1/29/21", ("call", 300.0, D(2021, 1, 29))),                                      # unlabeled strike
    ("AMZN Jun 18 21 3060.0 Put Not part of a compensation package", ("put", 3060.0, D(2021, 6, 18))),
    ("NVDA Sep 17 21 585.0 P", ("put", 585.0, D(2021, 9, 17))),
    ("AAPL 20JAN23 180 Call Not part of Compensation or ESOP", ("call", 180.0, D(2023, 1, 20))),
    ("the terms of the call are a strike price of $270, and an expiration of 12/17/21.", ("call", 270.0, D(2021, 12, 17))),
    ("Call options; Strike Price $150", ("call", 150.0, None)),                                                 # no expiry printed
    ("call", ("call", None, None)),                                                                            # type only
    ("Purchased 20,000 shares.", ("unknown", None, None)),                                                     # coded as an option, no call/put
    ("", ("unknown", None, None)),
    ("Bought a put and sold a call", ("unknown", None, None)),                                                 # both words: not guessed
    ("Call options; Strike price $100 and $110; Expires 1/1/22", ("call", None, D(2022, 1, 1))),               # two strikes: not guessed
]
for text, want in CASES:
    got = parse_option(text, True)
    assert got == want, (text, got, want)
assert parse_option("anything", False) == (None, None, None)

for text in ("Call options; Strike price $340", "2 Separate PayPal Put sales totaling just over $5,000", "Call Closing Transaction.",
             "covered call", "Option Type: Put"):
    assert STRONG_OPTION.search(text), text
for text in ("Purchased 20,000 shares.", "Output of the fund", "Putnam Investments LLC", "Recall notice", "Calling card"):
    assert not STRONG_OPTION.search(text), text

# ── date flags (A7 S2 / H2) ──────────────────────────────────────────────────
TODAY = D(2026, 10, 3)
assert date_flag(D(2026, 12, 26), D(2026, 2, 9), D(2026, 2, 9), TODAY) == 'future'                 # Cohen SONY typo
assert date_flag(D(2023, 12, 7), D(2023, 1, 5), D(2023, 1, 5), TODAY) == 'after_filing'            # Wittman
assert date_flag(D(2015, 5, 8), D(2025, 6, 22), D(2025, 6, 22), TODAY) == 'stale_2y'               # Shreve DHR / DAL
assert date_flag(D(2024, 1, 4), D(2025, 8, 12), D(2025, 8, 12), TODAY) is None                     # Mullin PODD: 586 days, plausible
assert date_flag(D(2024, 1, 4), None, D(2025, 8, 12), TODAY) is None                               # original unknown: the cited filing is used
assert date_flag(D(2024, 8, 1), D(2026, 8, 1), D(2026, 8, 5), TODAY) is None                       # exactly 2 years is not stale
assert date_flag(D(2024, 7, 31), D(2026, 8, 1), D(2026, 8, 5), TODAY) == 'stale_2y'
assert date_flag(D(2024, 2, 29), D(2026, 2, 28), D(2026, 2, 28), TODAY) is None                    # leap day edge

# ── R6c: stale_2y corroborated by the filing's own notification date ─────────
# Suozzi-type row: transaction 2017-01-05, notification 2017-02-01 (27 days later), filed 2021-09-23
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, D(2017, 2, 1)) == 'stale_2y_corroborated'
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, "2017-02-01") == 'stale_2y_corroborated'   # ISO string
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, D(2017, 1, 5)) == 'stale_2y_corroborated'  # same day: day 0 agrees
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, D(2017, 3, 6)) == 'stale_2y_corroborated'  # day 60 agrees
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, D(2017, 3, 7)) == 'stale_2y'              # day 61 does not
assert date_flag(D(2017, 1, 5), D(2021, 9, 23), D(2021, 9, 23), TODAY, D(2017, 1, 4)) == 'stale_2y'              # notified before the trade: inconsistent
assert date_flag(D(2015, 5, 8), D(2025, 6, 22), D(2025, 6, 22), TODAY, D(2025, 5, 15)) == 'stale_2y'             # Shreve DHR / DAL: notification 10 years after
assert date_flag(D(2023, 1, 3), D(2025, 8, 13), D(2025, 8, 13), TODAY, None) == 'stale_2y'                      # Senate Mullin: eFD prints no notification date
assert date_flag(D(2024, 1, 4), D(2025, 8, 12), D(2025, 8, 12), TODAY, D(2024, 1, 5)) is None                   # not stale: the notification date changes nothing
assert date_flag(D(2023, 12, 7), D(2023, 1, 5), D(2023, 1, 5), TODAY, D(2023, 12, 8)) == 'after_filing'          # a corroborating date does not rescue an impossible one
assert date_flag(D(2026, 12, 26), D(2026, 2, 9), D(2026, 2, 9), TODAY, D(2026, 12, 27)) == 'future'

# ── lateness: NULL unless it can be computed honestly ────────────────────────
assert lateness(D(2024, 1, 4), D(2025, 8, 12), None) == (586, True)
assert lateness(D(2024, 5, 7), D(2024, 6, 14), None) == (38, False)
assert lateness(D(2024, 4, 1), D(2024, 5, 16), None) == (45, False)                                # day 45 is on time
assert lateness(D(2024, 4, 1), D(2024, 5, 17), None) == (46, True)
assert lateness(D(2015, 5, 8), D(2025, 6, 22), 'stale_2y') == (None, None)
assert lateness(D(2024, 5, 7), None, None) == (None, None)                                         # original filing unknown
assert lateness("2024-05-07", "2024-06-14", None) == (38, False)                                   # ISO strings accepted
# R6c: a corroborated stale row has real lateness (from the original filing); a suspect one still has none
assert lateness(D(2017, 1, 5), D(2021, 9, 23), 'stale_2y_corroborated') == (1722, True)
assert lateness(D(2017, 1, 5), None, 'stale_2y_corroborated') == (None, None)                       # original filing unknown
assert lateness(D(2015, 5, 8), D(2025, 6, 22), 'stale_2y') == (None, None)
assert lateness(D(2023, 12, 7), D(2023, 1, 5), 'after_filing') == (None, None)
assert lateness(D(2026, 12, 26), D(2026, 2, 9), 'future') == (None, None)
# ── R6e: below the reporting threshold, lateness_basis, month/day twin (A7b F1 / F2) ──
from trade_fields import date_typo_twin, lateness_detail
assert lateness(D(2022, 1, 3), D(2023, 12, 4), None, 581) == (700, None)                          # Meijer CNC $581.86: days kept, never late
assert lateness_detail(D(2022, 1, 3), D(2023, 12, 4), None, 581) == (700, None, 'below_reporting_threshold')
assert lateness_detail(D(2022, 1, 3), D(2022, 1, 20), None, 1000) == (17, None, 'below_reporting_threshold')   # $1,000 is not "over $1,000"
assert lateness_detail(D(2022, 1, 3), D(2022, 3, 1), None, 1001) == (57, True, 'computed')
assert lateness_detail(D(2022, 1, 3), D(2022, 3, 1), None, 15000) == (57, True, 'computed')
assert lateness_detail(D(2022, 1, 3), D(2022, 3, 1), None, None) == (57, True, 'computed')       # no amount: unchanged behaviour
assert lateness_detail(D(2023, 12, 7), D(2023, 1, 5), 'after_filing', 500) == (None, None, 'not_computed_date_after_filing')
assert lateness_detail(D(2015, 5, 8), D(2025, 6, 22), 'stale_2y') == (None, None, 'not_computed_date_stale_2y')
assert lateness_detail(D(2017, 1, 5), D(2021, 9, 23), 'stale_2y_corroborated') == (1722, True, 'computed')
assert lateness_detail(D(2024, 5, 7), None, None) == (None, None, 'original_filing_unknown')
# Wittman MA: the PTR filed 2023-01-05 prints 12/07/2023 (mistyped year); the PTR filed 2023-08-13 prints 12/07/2022
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, [D(2022, 12, 7)]) == D(2022, 12, 7)
assert date_typo_twin("2023-12-07", "2023-01-05", TODAY, ["2022-12-07"]) == D(2022, 12, 7)         # ISO strings accepted
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, []) is None                              # no later filing
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, [D(2022, 12, 8)]) is None                # a different day is not a twin
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, [D(2023, 12, 7)]) is None               # the same date is not a twin
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, [D(2022, 12, 7), D(2021, 12, 7)]) is None   # ambiguous: not guessed
assert date_typo_twin(D(2023, 12, 7), D(2023, 1, 5), TODAY, [D(2023, 1, 7)]) is None                 # month/day differ
assert date_typo_twin(D(2023, 12, 7), D(2022, 12, 6), TODAY, [D(2022, 12, 7)]) is None               # twin after the suspect row's own filing
assert date_typo_twin(D(2023, 12, 7), D(2024, 1, 5), TODAY, [D(2022, 12, 7)]) is None               # not suspect: filed after the trade
assert date_typo_twin(D(2026, 12, 26), D(2026, 2, 9), TODAY, [D(2025, 12, 26)]) == D(2025, 12, 26)   # a 'future' row works the same way
assert date_typo_twin(D(2026, 12, 26), D(2026, 2, 9), TODAY, [D(2026, 12, 26)]) is None
print("trade_fields: all tests passed")
