# R10b: register the Windows scheduled task "SlushFund OGE load" for the current user.
# Every 30 minutes; MultipleInstances = IgnoreNew (no second instance while one runs); the runner also holds an OS file
# lock, checks gaming mode before every page (exit 3 -> exits cleanly) and disables this task when every filing is
# loaded and checked. Registers ONLY this task; touches nothing else.
#   powershell -NoProfile -File src\scripts\register_oge_task.ps1 [-WhatIf]
param([switch]$WhatIf)
$name = 'SlushFund OGE load'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$py = 'C:\Users\clong\Projects\SlushFund-venv\Scripts\pythonw.exe'
$script = Join-Path $repo 'src\scripts\run_oge_load.py'
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { Write-Output "task '$name' already exists: not changed"; exit 0 }
$action = New-ScheduledTaskAction -Execute $py -Argument "`"$script`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 30)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 10) `
  -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
if ($WhatIf) { Write-Output "would register '$name': $py `"$script`" every 30 min, IgnoreNew, 10 h limit"; exit 0 }
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'R10b: loads the President''s 278-T filings (SlushFund executive_trades) with Gemma on the B65. Gaming-gated, single instance, disables itself when done. Stop: schtasks /Change /TN "SlushFund OGE load" /DISABLE' | Out-Null
Get-ScheduledTask -TaskName $name | Select-Object TaskName, State | Format-Table -AutoSize | Out-String
