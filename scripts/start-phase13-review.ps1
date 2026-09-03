[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $workspace '.tmp\phase13-review'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$env:DATABASE_URL = 'postgresql://credit:credit_dev@localhost:5433/credit_strategy_phase13_gate_20260903?schema=public'
$env:REDIS_URL = 'redis://localhost:6380'
$env:PORT = '3008'
$env:WEB_ORIGIN = 'http://localhost:5185'
$env:BETTER_AUTH_URL = 'http://localhost:3008'
$env:VITE_API_URL = 'http://localhost:3008'
$env:NODE_ENV = 'development'

if ($env:DATABASE_URL -match 'behfar' -or $env:DATABASE_URL -notmatch 'credit_strategy_phase13_gate_20260903') {
  throw 'Refusing to start: Phase 13 review must use only its Credit database.'
}

Push-Location $workspace
try {
  docker compose up -d --wait postgres redis
  pnpm db:migrate:deploy
  pnpm db:seed:system
  pnpm db:seed:demo
  pnpm --filter '@credit/api' --filter '@credit/worker' build
  $processes = @(
    @{ Name = 'api'; FilePath = 'node'; Arguments = @('apps/api/dist/server.js') },
    @{ Name = 'worker'; FilePath = 'node'; Arguments = @('apps/worker/dist/server.js') },
    @{ Name = 'web'; FilePath = 'pnpm'; Arguments = @('--filter', '@credit/web', 'exec', 'vite', '--host', '0.0.0.0', '--port', '5185') }
  )
  foreach ($process in $processes) {
    Start-Process -FilePath $process.FilePath -ArgumentList $process.Arguments -WorkingDirectory $workspace -RedirectStandardOutput (Join-Path $runtimeDirectory "$($process.Name).out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$($process.Name).err.log") -WindowStyle Hidden
  }
  Write-Output 'Phase 13 Credit review environment started: Web http://localhost:5185, API http://localhost:3008.'
  Write-Output "Logs: $runtimeDirectory"
} finally {
  Pop-Location
}
