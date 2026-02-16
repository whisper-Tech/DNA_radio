$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $projectDir "launch_log.txt"
$serverLog = Join-Path $env:TEMP "dna_radio_server.log"
$hostBase = "http://127.0.0.1"
$portStart = 3001
$portEnd = 3025
$maxWaitSeconds = 60

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  $line | Tee-Object -FilePath $logFile -Append
}

function Find-HealthyPort {
  for ($p = $portStart; $p -le $portEnd; $p++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 "$hostBase`:$p/api/status"
      if ($r.StatusCode -eq 200) { return $p }
    } catch {}
  }
  return $null
}

function Require-Path([string]$path) {
  if (-not (Test-Path $path)) {
    throw "Required path missing: $path"
  }
}

Set-Content -Path $logFile -Value "============================================================"
Write-Log "DNA Radio launcher starting"
Write-Log "Project dir: $projectDir"

Require-Path (Join-Path $projectDir "package.json")
Require-Path (Join-Path $projectDir "server\index.ts")
Require-Path (Join-Path $projectDir "src\pages\RadioPage.tsx")

$runner = $null
$runArgs = @()
$installArgs = @()
if (Get-Command bun -ErrorAction SilentlyContinue) {
  $runner = "bun"
  $runArgs = @("run", "dev")
  $installArgs = @("install")
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
  $runner = "npm"
  $runArgs = @("run", "dev")
  $installArgs = @("install")
} else {
  throw "Neither bun nor npm found on PATH."
}
Write-Log "Using runner: $runner"

$existingPort = Find-HealthyPort
if ($existingPort) {
  Write-Log "Existing healthy instance found on $hostBase`:$existingPort"
  Start-Process explorer.exe "$hostBase`:$existingPort/"
  exit 0
}

$nodeModules = Join-Path $projectDir "node_modules"
$reactPlayer = Join-Path $projectDir "node_modules\react-player"
if (-not (Test-Path $nodeModules) -or -not (Test-Path $reactPlayer)) {
  Write-Log "Dependencies missing or incomplete. Running install..."
  $install = Start-Process -FilePath $runner -ArgumentList $installArgs -WorkingDirectory $projectDir -NoNewWindow -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "Dependency install failed with exit code $($install.ExitCode)."
  }
}

if (Test-Path $serverLog) { Remove-Item $serverLog -Force -ErrorAction SilentlyContinue }

Write-Log "Starting dev server..."
$runCmd = "{0} {1} > `"{2}`" 2>&1" -f $runner, ($runArgs -join " "), $serverLog
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $runCmd -WorkingDirectory $projectDir -WindowStyle Minimized -PassThru
Write-Log "Dev process started with PID $($proc.Id)"

$deadline = (Get-Date).AddSeconds($maxWaitSeconds)
$livePort = $null
while ((Get-Date) -lt $deadline) {
  $livePort = Find-HealthyPort
  if ($livePort) { break }
  Start-Sleep -Seconds 1
}

if (-not $livePort) {
  Write-Log "ERROR: service did not become healthy in ${maxWaitSeconds}s"
  if (Test-Path $serverLog) {
    Write-Log "--- tail of server log ---"
    Get-Content $serverLog -Tail 120 | Add-Content $logFile
  }
  throw "Server failed to start. See logs."
}

Write-Log "Healthy at $hostBase`:$livePort/"
Start-Process explorer.exe "$hostBase`:$livePort/"
exit 0
