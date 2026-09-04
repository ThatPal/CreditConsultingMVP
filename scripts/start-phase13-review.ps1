[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $workspace '.tmp\phase13-review'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

function Stop-RecordedReviewProcess([string]$name) {
  $pidPath = Join-Path $runtimeDirectory "$name.pid"
  if (-not (Test-Path -LiteralPath $pidPath)) { return }
  $recordedPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $existing = Get-Process -Id $recordedPid -ErrorAction SilentlyContinue
  if ($existing) {
    Stop-Process -Id $recordedPid -Force
    $existing.WaitForExit(10000)
  }
  Remove-Item -LiteralPath $pidPath -Force
}

function Assert-PortAvailable([int]$port) {
  $listener = netstat -ano | Select-String "LISTENING\s+\d+$" | Where-Object { $_.Line -match ":$port\s" } | Select-Object -First 1
  if ($listener) {
    throw "Port $port is occupied after stopping recorded review processes. Refusing to report a healthy environment. Listener: $($listener.Line.Trim())"
  }
}

function Invoke-Checked([string[]]$arguments) {
  & pnpm @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

$env:DATABASE_URL = 'postgresql://credit:credit_dev@localhost:5433/credit_strategy_phase1316_checkpoint?schema=public'
$env:REDIS_URL = 'redis://localhost:6380'
$env:PORT = '3008'
$env:WEB_ORIGIN = 'http://localhost:5185'
$env:BETTER_AUTH_URL = 'http://localhost:3008'
$env:VITE_API_URL = 'http://localhost:3008'
$env:NODE_ENV = 'development'

if ($env:DATABASE_URL -match 'behfar' -or $env:DATABASE_URL -notmatch 'credit_strategy_phase1316_checkpoint') {
  throw 'Refusing to start: the Phase 13-16 review environment must use only its dedicated Credit database.'
}

Push-Location $workspace
try {
  @('api', 'worker', 'web') | ForEach-Object { Stop-RecordedReviewProcess $_ }
  Assert-PortAvailable 3008
  Assert-PortAvailable 5185

  docker compose up -d --wait postgres redis
  Invoke-Checked @('db:migrate:deploy')
  Invoke-Checked @('db:seed:system')
  Invoke-Checked @('db:seed:demo')
  Invoke-Checked @('--filter', '@credit/api', '--filter', '@credit/worker', 'build')
  $processes = @(
    @{ Name = 'api'; FilePath = 'node'; Arguments = @('apps/api/dist/server.js') },
    @{ Name = 'worker'; FilePath = 'node'; Arguments = @('apps/worker/dist/server.js') },
    @{ Name = 'web'; FilePath = 'node'; Arguments = @('apps/web/node_modules/vite/bin/vite.js', 'apps/web', '--host', '0.0.0.0', '--port', '5185') }
  )
  foreach ($process in $processes) {
    $started = Start-Process -FilePath $process.FilePath `
      -ArgumentList $process.Arguments `
      -WorkingDirectory $workspace `
      -RedirectStandardOutput (Join-Path $runtimeDirectory "$($process.Name).out.log") `
      -RedirectStandardError (Join-Path $runtimeDirectory "$($process.Name).err.log") `
      -WindowStyle Hidden `
      -PassThru
    Set-Content -LiteralPath (Join-Path $runtimeDirectory "$($process.Name).pid") -Value $started.Id
  }

  $health = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    foreach ($process in $processes) {
      $startedPid = [int](Get-Content -LiteralPath (Join-Path $runtimeDirectory "$($process.Name).pid") -Raw)
      if (-not (Get-Process -Id $startedPid -ErrorAction SilentlyContinue)) {
        throw "$($process.Name) exited during startup. Review $runtimeDirectory\$($process.Name).err.log."
      }
    }
    try { $health = Invoke-RestMethod -Uri 'http://localhost:3008/health' -TimeoutSec 2 } catch { $health = $null }
    if ($health.status -eq 'ok') { break }
    Start-Sleep -Seconds 1
  }
  if ($health.status -ne 'ok') { throw 'The Phase 13-16 API health contract did not become available.' }
  $webResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5185/app/journey' -TimeoutSec 5
  if ($webResponse.StatusCode -ne 200 -or $webResponse.Content -notmatch '<div id="root"></div>') {
    throw 'The Phase 13-16 web application contract did not become available.'
  }
  Write-Output 'Phase 13-16 Credit review environment started and verified: Web http://localhost:5185, API http://localhost:3008.'
  Write-Output "Logs: $runtimeDirectory"
} finally {
  Pop-Location
}
