[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $workspace '.tmp\phase9-12-review'
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
    throw "Port $port is already occupied after stopping the recorded review process. Refusing to claim that the review environment started. Listener: $($listener.Line.Trim())"
  }
}

$env:DATABASE_URL = 'postgresql://credit:credit_dev@localhost:5433/credit_strategy_phase9_12_block?schema=public'
$env:REDIS_URL = 'redis://localhost:6380'
$env:PORT = '3007'
$env:WEB_ORIGIN = 'http://localhost:5184'
$env:BETTER_AUTH_URL = 'http://localhost:3007'
$env:VITE_API_URL = 'http://localhost:3007'
$env:NODE_ENV = 'development'

if ($env:DATABASE_URL -match 'behfar' -or $env:DATABASE_URL -notmatch 'credit_strategy_phase9_12_block') {
  throw 'Refusing to start: the Phase 9-12 review environment must use only its dedicated Credit database.'
}

Push-Location $workspace
try {
  @('api', 'worker', 'web') | ForEach-Object { Stop-RecordedReviewProcess $_ }
  Assert-PortAvailable 3007
  Assert-PortAvailable 5184

  docker compose up -d --wait postgres redis
  pnpm db:migrate:deploy
  pnpm db:seed:system
  pnpm db:seed:demo
  pnpm --filter '@credit/api' --filter '@credit/worker' build

  $processes = @(
    @{ Name = 'api'; FilePath = 'node'; Arguments = @('apps/api/dist/server.js') },
    @{ Name = 'worker'; FilePath = 'node'; Arguments = @('apps/worker/dist/server.js') },
    @{ Name = 'web'; FilePath = 'node'; Arguments = @('apps/web/node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5184') }
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
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    foreach ($process in $processes) {
      $pidPath = Join-Path $runtimeDirectory "$($process.Name).pid"
      $startedPid = [int](Get-Content -LiteralPath $pidPath -Raw)
      if (-not (Get-Process -Id $startedPid -ErrorAction SilentlyContinue)) {
        throw "$($process.Name) exited during startup. Review $runtimeDirectory\$($process.Name).err.log."
      }
    }
    try { $health = Invoke-RestMethod -Uri 'http://localhost:3007/health' -TimeoutSec 2 } catch { $health = $null }
    if ($health.status -eq 'ok') { break }
    Start-Sleep -Seconds 1
  }
  if ($health.status -ne 'ok') { throw 'The Phase 9-12 API health contract did not become available.' }
  Write-Output 'Phase 9-12 Credit review environment started: Web http://localhost:5184, API http://localhost:3007.'
  Write-Output "Logs: $runtimeDirectory"
} finally {
  Pop-Location
}
