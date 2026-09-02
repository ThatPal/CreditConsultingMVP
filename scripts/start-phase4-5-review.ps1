[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $workspace '.tmp\phase4-5-review'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$env:DATABASE_URL = 'postgresql://credit:credit_dev@localhost:5433/credit_strategy_phase4_5_block?schema=public'
$env:REDIS_URL = 'redis://localhost:6380'
$env:PORT = '3007'
$env:WEB_ORIGIN = 'http://localhost:5184'
$env:BETTER_AUTH_URL = 'http://localhost:3007'
$env:VITE_API_URL = 'http://localhost:3007'
$env:NODE_ENV = 'development'

if ($env:DATABASE_URL -match 'behfar') {
  throw 'Refusing to start: the Phase 4-5 review environment must use only the Credit database.'
}

Push-Location $workspace
try {
  docker compose up -d --wait postgres redis
  pnpm db:migrate:deploy
  pnpm db:seed:system
  pnpm --filter '@credit/api' --filter '@credit/worker' build

  $processes = @(
    @{ Name = 'api'; FilePath = 'node'; Arguments = @('apps/api/dist/server.js') },
    @{ Name = 'worker'; FilePath = 'node'; Arguments = @('apps/worker/dist/server.js') },
    @{ Name = 'web'; FilePath = 'pnpm'; Arguments = @('--filter', '@credit/web', 'exec', 'vite', '--host', '0.0.0.0', '--port', '5184') }
  )
  foreach ($process in $processes) {
    Start-Process -FilePath $process.FilePath `
      -ArgumentList $process.Arguments `
      -WorkingDirectory $workspace `
      -RedirectStandardOutput (Join-Path $runtimeDirectory "$($process.Name).out.log") `
      -RedirectStandardError (Join-Path $runtimeDirectory "$($process.Name).err.log") `
      -WindowStyle Hidden
  }
  Write-Output 'Credit review environment started: Web http://localhost:5184, API http://localhost:3007.'
  Write-Output "Logs: $runtimeDirectory"
} finally {
  Pop-Location
}
