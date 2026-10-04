"""
Shared helpers for Public Servant Score ingest scripts.

Conventions:
  - All scripts are idempotent: re-running with same data produces same DB state.
  - Every script accepts a --dry flag to print a summary without writing.
  - All scripts read NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from env.
  - All scripts emit per-run metrics (inserted, updated, skipped, errors) at end.
  - All timestamps are UTC. Dates are written as DATE (no time component) in DB.
"""

import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

# Activate the shared venv (matches the pattern in src/scripts/_venv.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# _venv.py lives one directory up (in src/scripts/)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
try:
    from _venv import activate as _activate_venv  # type: ignore  # noqa: E402
    _activate_venv()
except ImportError:
    pass  # _venv.py is optional; we'll fall through to system Python

from supabase import create_client  # type: ignore  # noqa: E402

# Re-ingest window: 24 months. Bumped if we backfill historical.
SCORE_LOOKBACK_MONTHS = 24


def get_supabase_admin():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def cutoff_date() -> date:
    """Earliest date the scoring engine considers. Today - 24 months."""
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=SCORE_LOOKBACK_MONTHS * 30)


def slugify_senator(full_name: str) -> str:
    """bernie-sanders. Lowercase, hyphens, ASCII only."""
    s = full_name.lower().strip()
    s = s.replace("'", "").replace("\"", "")
    s = s.replace(" ", "-").replace(".", "")
    s = s.replace("à", "a").replace("á", "a").replace("â", "a")
    s = s.replace("è", "e").replace("é", "e").replace("ê", "e")
    s = s.replace("í", "i").replace("î", "i")
    s = s.replace("ó", "o").replace("ô", "o")
    s = s.replace("ú", "u").replace("û", "u")
    s = s.replace("ñ", "n")
    return s


def short_party(party: str) -> str:
    """Republican/Democrat/Independent → R/D/I."""
    p = party.strip().lower()
    if p.startswith("r"):
        return "R"
    if p.startswith("d"):
        return "D"
    return "I"


def chunked(iterable, size: int):
    """Yield successive chunks of `size` from iterable."""
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def report_run(label: str, inserted: int, updated: int, skipped: int, errors: int, dry: bool = False) -> None:
    """Print a consistent per-run summary line."""
    mode = "DRY" if dry else "OK"
    print(f"  [{mode}] {label}: inserted={inserted} updated={updated} skipped={skipped} errors={errors}")


def fetch_json(url: str, timeout: int = 30) -> dict:
    """Light HTTP GET returning JSON, with a sane UA."""
    req = urllib_request(url)
    with urllib_request_urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# Tiny re-implementations of urllib.request.* so the rest of the file is cleaner.
def urllib_request(url: str):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "SlushFund-Bot/1.0 (+https://slushfund.net)"})
    return req


def urllib_request_urlopen(req, timeout: int = 30):
    import urllib.request
    return urllib.request.urlopen(req, timeout=timeout)
