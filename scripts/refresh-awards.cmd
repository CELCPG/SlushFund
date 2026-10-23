@echo off
rem SlushFund: refresh contract awards from USAspending.gov (rule r5-v1) and re-match ticker links.
rem Idempotent; safe to re-run. Exit 0 = ok, 1 = failed (see logs\task-awards.log and the sync_log row).
rem Task Scheduler "SlushFund Awards Refresh" calls this directly (no Start-in needed: it cd's itself).
setlocal
set "REPO=%~dp0.."
if not defined SLUSHFUND_PY set "SLUSHFUND_PY=C:\Users\clong\Projects\SlushFund-venv\Scripts\python.exe"
set PYTHONIOENCODING=utf-8
cd /d "%REPO%" || exit /b 1
echo [%date% %time%] awards incremental >> "%REPO%\logs\task-awards.log" 2>&1
"%SLUSHFUND_PY%" src\scripts\load_awards.py incremental --days 7 --new-days 120 >> "%REPO%\logs\task-awards.log" 2>&1
set AWARDS_RC=%ERRORLEVEL%
echo [%date% %time%] tickers match (no prune), awards rc=%AWARDS_RC% >> "%REPO%\logs\task-awards.log" 2>&1
"%SLUSHFUND_PY%" src\scripts\load_company_tickers.py match >> "%REPO%\logs\task-awards.log" 2>&1
echo [%date% %time%] done awards_rc=%AWARDS_RC% tickers_rc=%ERRORLEVEL% >> "%REPO%\logs\task-awards.log" 2>&1
exit /b %AWARDS_RC%
