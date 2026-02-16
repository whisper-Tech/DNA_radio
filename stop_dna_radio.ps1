$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $projectDir "stop_log.txt"
$ports = 3001..3025

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  $line | Tee-Object -FilePath $logFile -Append
}

Set-Content -Path $logFile -Value "============================================================"
Write-Log "DNA Radio stop requested"

$pidsToKill = New-Object System.Collections.Generic.HashSet[int]

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String (":$port\s+.*LISTENING")
  foreach ($line in $lines) {
    $parts = ($line.ToString().Trim() -split "\s+")
    if ($parts.Count -ge 5) {
      $procId = 0
      if ([int]::TryParse($parts[-1], [ref]$procId)) {
        $null = $pidsToKill.Add($procId)
      }
    }
  }
}

if ($pidsToKill.Count -eq 0) {
  Write-Log "No listening DNA Radio ports found (3001-3025)."
  exit 0
}

foreach ($procId in $pidsToKill) {
  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId"
    $cmd = $proc.CommandLine
    $name = $proc.Name

    $isLikelyDna = $false
    if ($cmd -match "DNA_webapp_player" -or $cmd -match "tsx server/index.ts" -or $cmd -match "bun run dev" -or $name -match "node|bun|cmd") {
      $isLikelyDna = $true
    }

    if ($isLikelyDna) {
      Write-Log "Stopping PID $procId ($name)"
      taskkill /PID $procId /T /F | Out-Null
    } else {
      Write-Log "Skipping PID $procId (not recognized as DNA process): $name"
    }
  } catch {
    Write-Log "Failed to inspect/stop PID ${procId}: $($_.Exception.Message)"
  }
}

Write-Log "Stop complete."
exit 0
