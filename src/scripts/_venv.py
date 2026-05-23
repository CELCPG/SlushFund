"""Shared environment bootstrap for SlushFund data scrapers.

Avoids hardcoding a machine-specific virtualenv path in every script.
If the scraper dependencies (supabase, capitolgains, pdfplumber, playwright)
are not already importable, set SLUSHFUND_VENV to your virtualenv root:

    export SLUSHFUND_VENV=/private/tmp/slushfund_venv

Call activate() at the top of a script, before importing those packages.
"""

import glob
import os
import sys


def _load_dotenv() -> None:
    """Load .env.local from the repo root so scripts get Supabase creds."""
    here = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):
        env_path = os.path.join(here, ".env.local")
        if os.path.isfile(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key, val = key.strip(), val.strip().strip('"').strip("'")
                    os.environ.setdefault(key, val)
            return
        here = os.path.dirname(here)


def activate() -> None:
    _load_dotenv()
    venv = os.environ.get("SLUSHFUND_VENV")
    if venv:
        for site_packages in glob.glob(
            os.path.join(venv, "lib", "python*", "site-packages")
        ):
            if site_packages not in sys.path:
                sys.path.insert(0, site_packages)

    # capitolgains' PDF tooling needs a JDK. Honor an existing JAVA_HOME;
    # otherwise fall back to a common Homebrew location if it exists.
    if not os.environ.get("JAVA_HOME"):
        for candidate in (
            "/opt/homebrew/opt/openjdk@11/libexec/openjdk.jdk/Contents/Home",
            "/usr/local/opt/openjdk@11/libexec/openjdk.jdk/Contents/Home",
        ):
            if os.path.isdir(candidate):
                os.environ["JAVA_HOME"] = candidate
                break
