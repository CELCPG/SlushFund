@echo off
rem SlushFund: weekly refresh of committee-seat history and lobbying disclosures.
rem Idempotent; safe to re-run. See logs\task-weekly.log and the sync_log rows.
rem Task Scheduler "SlushFund Weekly Data" calls this directly (no Start-in needed: it cd's itself).
setlocal
set "REPO=%~dp0.."
if not defined SLUSHFUND_PY set "SLUSHFUND_PY=C:\Users\clong\Projects\SlushFund-venv\Scripts\python.exe"
set PYTHONIOENCODING=utf-8
cd /d "%REPO%" || exit /b 1
echo [%date% %time%] committee history >> "%REPO%\logs\task-weekly.log" 2>&1
"%SLUSHFUND_PY%" src\scripts\load_committee_history.py >> "%REPO%\logs\task-weekly.log" 2>&1
set CH_RC=%ERRORLEVEL%
echo [%date% %time%] lobbying, committees rc=%CH_RC% >> "%REPO%\logs\task-weekly.log" 2>&1
"%SLUSHFUND_PY%" src\scripts\load_senate_lda.py >> "%REPO%\logs\task-weekly.log" 2>&1
echo [%date% %time%] done committees_rc=%CH_RC% lda_rc=%ERRORLEVEL% >> "%REPO%\logs\task-weekly.log" 2>&1
exit /b %CH_RC%
