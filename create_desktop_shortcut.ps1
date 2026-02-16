$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath("Desktop")
$startShortcut = Join-Path $desktop "DNA_Radio_Launcher.lnk"
$stopShortcut = Join-Path $desktop "DNA_Radio_Stop.lnk"
$oldShortcut = Join-Path $desktop "DNA Radio Launcher.lnk"

$launcherBat = Join-Path $projectDir "launch_dna_radio.bat"
$stopperBat = Join-Path $projectDir "stop_dna_radio.bat"
$assetsDir = Join-Path $projectDir "assets"
$pngIcon = Join-Path $env:USERPROFILE "Downloads\Icons8\icons8-playboy-50.png"
$icoIcon = Join-Path $assetsDir "icons8-playboy-50.ico"

if (-not (Test-Path $launcherBat)) { throw "Missing launcher: $launcherBat" }
if (-not (Test-Path $stopperBat)) { throw "Missing stopper: $stopperBat" }
if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir | Out-Null }

if (Test-Path $oldShortcut) { Remove-Item $oldShortcut -Force -ErrorAction SilentlyContinue }

if (-not (Test-Path $icoIcon) -and (Test-Path $pngIcon) -and (Get-Command magick -ErrorAction SilentlyContinue)) {
  & magick $pngIcon -background none -define icon:auto-resize=16,24,32,48,64,128,256 $icoIcon
}

$iconToUse = "$env:SystemRoot\System32\SHELL32.dll,137"
if (Test-Path $icoIcon) { $iconToUse = "$icoIcon,0" }

$ws = New-Object -ComObject WScript.Shell

$s = $ws.CreateShortcut($startShortcut)
$s.TargetPath = $launcherBat
$s.WorkingDirectory = $projectDir
$s.WindowStyle = 1
$s.IconLocation = $iconToUse
$s.Description = "Start DNA Radio (dev server + browser)"
$s.Save()

$k = $ws.CreateShortcut($stopShortcut)
$k.TargetPath = $stopperBat
$k.WorkingDirectory = $projectDir
$k.WindowStyle = 1
$k.IconLocation = $iconToUse
$k.Description = "Stop DNA Radio"
$k.Save()

Write-Output "[OK] Desktop shortcuts created:"
Write-Output $startShortcut
Write-Output $stopShortcut

