$ErrorActionPreference = 'Stop'
$astraWorkspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $astraWorkspace
if ((git branch --show-current).Trim() -ne 'codex/astra-production') { throw 'Wrong branch: Astra launch refused.' }
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $(if ($matches[2]) {$matches[2]} else {$null}), 'Process') } }
$env:DOCUMENT_STORAGE_DIR = Join-Path $astraWorkspace '.data/documents'
if ($env:DATABASE_URL -notmatch '@127\.0\.0\.1:5445/credit_strategy_astra\?') { throw 'Astra database mismatch' }
if ($env:REDIS_URL -ne 'redis://127.0.0.1:6395') { throw 'Astra Redis mismatch' }
if ($env:PORT -ne '3015' -or $env:WEB_ORIGIN -ne 'http://127.0.0.1:5195' -or $env:VITE_API_URL -ne 'http://127.0.0.1:3015') { throw 'Astra application origin mismatch' }
if ($env:SESSION_COOKIE_NAME -ne 'credit_astra_sid') { throw 'Astra session cookie prefix mismatch' }
foreach ($astraPort in @(5195,3015)) {
  if (netstat -ano | Select-String ":$astraPort\s+.*LISTENING") { throw "Port $astraPort occupied. No existing process will be stopped." }
}
$astraLogs = Join-Path $astraWorkspace '.tmp/astra-runtime'
New-Item -ItemType Directory -Force -Path $astraLogs | Out-Null
foreach ($astraProcess in @(
  @{Name='api';Args=@('apps/api/dist/server.js')},
  @{Name='worker';Args=@('apps/worker/dist/server.js')},
  @{Name='web';Args=@('apps/web/node_modules/vite/bin/vite.js','apps/web','--host','127.0.0.1','--port','5195','--strictPort')}
)) {
  $astraStarted = Start-Process -FilePath 'node' -ArgumentList $astraProcess.Args -WorkingDirectory $astraWorkspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $astraLogs ($astraProcess.Name+'.out.log')) -RedirectStandardError (Join-Path $astraLogs ($astraProcess.Name+'.err.log')) -PassThru
  $astraStarted.Id | Set-Content (Join-Path $astraLogs ($astraProcess.Name+'.pid'))
}
Write-Output 'Astra started on http://127.0.0.1:5195 with API 3015. Check /ready and logs before review.'
