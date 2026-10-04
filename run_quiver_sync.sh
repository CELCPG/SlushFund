#!/bin/bash
# Quiver Congress Trades — Weekly Sync Cron Wrapper
# Runs every Tuesday at 9am ET (America/New_York)
# Chdir to project root so .env.local is found
cd "$(dirname "$0")"
./.venv/bin/python3 src/scripts/scrape_quiver_trades.py --members
