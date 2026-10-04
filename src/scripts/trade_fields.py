"""R6a: option details, date flags and STOCK Act lateness for congress_trades rows.

Shared by load_bulk_trades.py (House) and load_senate_trades.py (Senate), so both chambers
fill the new columns with the same rules (migration 20261006_r6a_trades.sql):

  option_type  call | put | unknown | None      strike  numeric     expiry  date
  date_flag    None | after_filing | future | stale_2y_corroborated | stale_2y
  days_to_file / stock_act_late                   None = not computed (computed for stale_2y_corroborated)
  lateness_basis                                  why: computed | below_reporting_threshold | original_filing_unknown |
                                                  not_computed_date_<flag>   (R6e, migration 20261009_r6e_wording.sql)

Nothing here "corrects" a filer's date: a date that cannot be right is flagged and the
lateness is left NULL.
"""
import re
from datetime import date, datetime

# ── options ──────────────────────────────────────────────────────────────────

CALL_PUT = re.compile(r"\b(call|put)s?\b", re.I)
# a line coded as something other than an option is still an option when its own description says so:
# "call options", "put sales", "Option Type: Put", "covered call", "the terms of the call are ...", or a
# description that starts with call / put ("Call Closing Transaction.", "call")
STRONG_OPTION = re.compile(
    r"\b(?:call|put)s?\s+(?:options?|contracts?|spreads?|sales?|purchases?|trades?|transactions?)\b"
    r"|\boptions?\s+(?:call|put)\b|\boption\s+type\s*:\s*(?:call|put)\b"
    r"|\b(?:covered|naked|long|short)\s+(?:call|put)s?\b|\bterms of the (?:call|put)\b"
    r"|^\s*(?:call|put)s?\b",
    re.I,
)
NUM = r"([\d,]*\d(?:\.\d+)?)"
STRIKE_RES = [
    re.compile(r"strike(?:\s+price)?(?:\s+(?:of|at|was|is))?\s*[:=]?\s*\$?\s*" + NUM, re.I),
    re.compile(r"\$\s*" + NUM + r"\s+strike", re.I),
    re.compile(r"\bat\s+(?:a\s+)?\$\s*" + NUM + r"\s+(?:strike|exercise)", re.I),
    # 'Call option, $300, Exp. 1/29/21': the strike with no label, right after the call / put
    re.compile(r"\b(?:call|put)s?(?:\s+options?)?\s*[,;:]\s*\$\s*" + NUM + r"\b(?!\s*(?:premium|each|per|total))", re.I),
]
# 'AMZN Jun 18 21 3060.0 Put' (the symbol is optional): expiry month / day / 2-digit year, strike, call or put
OCC_STYLE = re.compile(r"\b([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2})\s+([\d,]*\d(?:\.\d+)?)\s+(call|put|c|p)\b", re.I)
EXP_WORD = r"(?:expir\w*|exp\b\.?|expiring)"
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
NUM_DATE = r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})"
ISO_DATE = r"(\d{4})-(\d{2})-(\d{2})"
WORD_DATE = r"([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})"
EXP_RES = [
    re.compile(EXP_WORD + r"(?:\s+date)?(?:\s+(?:of|on|is|was))?\s*[:=]?\s*" + NUM_DATE, re.I),
    re.compile(EXP_WORD + r"(?:\s+date)?(?:\s+(?:of|on|is|was))?\s*[:=]?\s*" + ISO_DATE, re.I),
    re.compile(EXP_WORD + r"(?:\s+date)?(?:\s+(?:of|on|is|was))?\s*[:=]?\s*" + WORD_DATE, re.I),
]


# 'AAPL 20JAN23 180 Call': expiry day / month / 2-digit year run together, then strike and call or put
DAY_MON_YR = re.compile(r"\b(\d{1,2})([A-Za-z]{3})(\d{2})\s+([\d,]*\d(?:\.\d+)?)\s+(calls?|puts?)\b", re.I)


def _mk_date(y, m, d):
    try:
        y = int(y)
        if y < 100:
            y += 2000
        return date(y, int(m), int(d))
    except ValueError:
        return None


def _expiry_dates(text):
    out = []
    for m in OCC_STYLE.finditer(text):
        mon = MONTHS.get(m.group(1)[:3].lower())
        out.append(_mk_date(m.group(3), mon, m.group(2)) if mon else None)
    for m in DAY_MON_YR.finditer(text):
        mon = MONTHS.get(m.group(2)[:3].lower())
        out.append(_mk_date(m.group(3), mon, m.group(1)) if mon else None)
    for rx in EXP_RES:
        for m in rx.finditer(text):
            g = m.groups()
            if rx is EXP_RES[0]:
                out.append(_mk_date(g[2], g[0], g[1]))
            elif rx is EXP_RES[1]:
                out.append(_mk_date(g[0], g[1], g[2]))
            else:
                mon = MONTHS.get(g[0][:3].lower())
                out.append(_mk_date(g[2], mon, g[1]) if mon else None)
    return [d for d in out if d]


MORE_STRIKES = re.compile(r"\s*(?:,|and|&|/)\s*\$\s*" + NUM, re.I)


def _strikes(text):
    vals = []
    for m in OCC_STYLE.finditer(text):
        if MONTHS.get(m.group(1)[:3].lower()):
            vals.append(float(m.group(4).replace(",", "")))
    for m in DAY_MON_YR.finditer(text):
        if MONTHS.get(m.group(2)[:3].lower()):
            vals.append(float(m.group(4).replace(",", "")))
    for rx in STRIKE_RES:
        for m in rx.finditer(text):
            try:
                vals.append(float(m.group(1).replace(",", "")))
            except ValueError:
                continue
            pos = m.end()
            while True:                              # 'strike $100 and $110': every strike named, so a spread is not guessed
                more = MORE_STRIKES.match(text, pos)
                if not more:
                    break
                vals.append(float(more.group(1).replace(",", "")))
                pos = more.end()
    return vals


def parse_option(text, is_option=True):
    """Option details from a filing's free text (House 'D :' / 'DESCRIPTION:' line, Senate asset detail).

    -> (option_type, strike, expiry):
      option_type  'call' / 'put' when the text names exactly one of them, 'unknown' when it names
                   both or neither (the filing says it is an option but the details cannot be read)
      strike       a float when the text gives exactly one strike value, else None
      expiry       a date when the text gives exactly one expiry date, else None
    The caller decides is_option (House asset code [OP], Senate asset type 'Stock Option', a CALL/PUT
    asset name). Returns (None, None, None) when it is not an option.
    """
    if not is_option:
        return None, None, None
    text = text or ""
    kinds = {m.group(1).lower() for m in CALL_PUT.finditer(text)}
    kinds |= {'call' if m.group(5).lower() in ('c', 'call') else 'put' for m in OCC_STYLE.finditer(text)
              if MONTHS.get(m.group(1)[:3].lower())}
    opt = kinds.pop() if len(kinds) == 1 else 'unknown'
    strikes, expiries = set(_strikes(text)), set(_expiry_dates(text))
    strike = strikes.pop() if len(strikes) == 1 else None
    expiry = expiries.pop() if len(expiries) == 1 else None
    return opt, strike, expiry


# ── dates ────────────────────────────────────────────────────────────────────

def add_years(d, n):
    try:
        return d.replace(year=d.year + n)
    except ValueError:                      # 29 Feb
        return d.replace(year=d.year + n, day=28)


def as_date(v):
    if v is None or isinstance(v, date):
        return v
    return datetime.strptime(str(v)[:10], '%Y-%m-%d').date()


CORROBORATION_DAYS = 60     # R6c: a notification date this close to the transaction date agrees with it


def date_flag(txn, original_filed, filed, today=None, notification=None):
    """NULL | 'after_filing' | 'future' | 'stale_2y_corroborated' | 'stale_2y'. Measured against the first
    version's filing date when it is known, else against the filing the row cites. The filed dates are never
    changed.

    A transaction more than 2 years before the filing is 'stale_2y_corroborated' when the filing's own
    notification date (House PTRs print one per line) falls 0-60 days after the transaction date: the two
    dates agree with each other, so this is a genuinely late filing, not a typo. Without a notification date
    (the Senate prints none), or with one far from the transaction date, it stays 'stale_2y' (suspect)."""
    txn, today = as_date(txn), today or date.today()
    ref = as_date(original_filed) or as_date(filed)
    if txn > today:
        return 'future'
    if ref is not None:
        if txn > ref:
            return 'after_filing'
        if txn < add_years(ref, -2):
            notif = as_date(notification)
            if notif is not None and 0 <= (notif - txn).days <= CORROBORATION_DAYS:
                return 'stale_2y_corroborated'
            return 'stale_2y'
    return None


REPORTING_THRESHOLD = 1000   # STOCK Act: a PTR lists transactions over $1,000. A row whose top of range is <= this cannot be late.


def lateness_detail(txn, original_filed, flag, amount_max=None):
    """(days_to_file, stock_act_late, lateness_basis). days / late are None (= not computed) when the transaction
    date is flagged (except 'stale_2y_corroborated', whose dates agree) or the first version's filing date is
    unknown. STOCK Act limit: 45 days from the transaction.

    R6e (A7b F2): when amount_max <= REPORTING_THRESHOLD the transaction was never due on a PTR, so stock_act_late
    is None with basis 'below_reporting_threshold'; days_to_file is kept for information only.

    lateness_basis: computed | below_reporting_threshold | original_filing_unknown | not_computed_date_<flag>"""
    original_filed = as_date(original_filed)
    if flag and flag != 'stale_2y_corroborated':
        return None, None, f'not_computed_date_{flag}'
    if original_filed is None:
        return None, None, 'original_filing_unknown'
    days = (original_filed - as_date(txn)).days
    if amount_max is not None and amount_max <= REPORTING_THRESHOLD:
        return days, None, 'below_reporting_threshold'
    return days, days > 45, 'computed'


def lateness(txn, original_filed, flag, amount_max=None):
    """(days_to_file, stock_act_late): lateness_detail without the basis."""
    return lateness_detail(txn, original_filed, flag, amount_max)[:2]


def date_typo_twin(txn, filed, today, candidates):
    """R6e (A7b F1): the correct transaction date of a row whose date cannot be right, when another filing restates it.

    A row is suspect when its transaction date is after its own filing date ('after_filing') or in the future
    ('future'). The typo is usually a mistyped year (Wittman MA: printed 12/07/2023 in a PTR filed 2023-01-05, the
    trade was 12/07/2022). `candidates` are the transaction dates of rows in LATER filings that share this row's
    member, ticker, direction, owner and option terms. The twin is the one candidate with the same month and day
    in a different year that falls on or before the suspect row's own filing date (so the earlier filing could
    have held it). Returns that date, or None when there is no twin or the match is not unique.
    The caller then treats the two rows as one transaction: the later filing restates the earlier one and the
    earliest filing stays the original."""
    txn, filed, today = as_date(txn), as_date(filed), today or date.today()
    if not (txn > today or (filed is not None and txn > filed)):
        return None
    ref = filed if filed is not None else today
    twins = {as_date(c) for c in candidates
             if as_date(c) != txn and (as_date(c).month, as_date(c).day) == (txn.month, txn.day) and as_date(c) <= ref}
    return twins.pop() if len(twins) == 1 else None
