@echo off
rem SlushFund: refresh congressional trades (House Clerk + Senate eFD), recompute conflict signals.
rem Safe to re-run (idempotent). Exit 0 = ok, 1 = failed (see logs\refresh-YYYY-MM-DD.jsonl and the sync_log row),
rem 3 = gaming mode is on (nothing written; the next scheduled run picks it up).
rem Task Scheduler: Program = this file, Start in = the repo root. Override SLUSHFUND_PY / SLUSHFUND_CACHE if needed.
setlocal
set "REPO=%~dp0.."
if not defined SLUSHFUND_PY set "SLUSHFUND_PY=C:\Users\clong\Projects\SlushFund-venv\Scripts\python.exe"
set PYTHONIOENCODING=utf-8
cd /d "%REPO%" || exit /b 1
"%SLUSHFUND_PY%" src\scripts\refresh_trades.py %*
exit /b %ERRORLEVEL%