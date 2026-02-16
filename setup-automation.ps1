# DNA Radio - Automation Setup Script
# Run this once to set up all automation tools

Write-Host "Setting up DNA Radio automation tools..." -ForegroundColor Cyan

# 1. Create necessary directories
$Directories = @(
    "C:\Coding\DNA_webapp_player\logs",
    "C:\Coding\DNA_webapp_player\scripts",
    "C:\Coding\DNA_webapp_player\automation"
)

foreach ($Dir in $Directories) {
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
        Write-Host "Created directory: $Dir" -ForegroundColor Green
    }
}

# 2. Check if AutoHotkey is installed
$AHKPath = Get-Command "AutoHotkey64.exe" -ErrorAction SilentlyContinue
if (-not $AHKPath) {
    Write-Host "AutoHotkey not found. Please install from https://www.autohotkey.com/" -ForegroundColor Yellow
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
} else {
    Write-Host "AutoHotkey found at: $($AHKPath.Source)" -ForegroundColor Green
    
    # Create startup shortcut for AutoHotkey script
    $ShortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\DNA_Radio_Automation.lnk"
    $ScriptPath = "C:\Coding\DNA_webapp_player\DNA_Radio_Automation.ahk"
    
    if (Test-Path $ScriptPath) {
        $Shell = New-Object -ComObject WScript.Shell
        $Shortcut = $Shell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $ScriptPath
        $Shortcut.WorkingDirectory = "C:\Coding\DNA_webapp_player"
        $Shortcut.Save()
        Write-Host "AutoHotkey script added to startup" -ForegroundColor Green
    }
}

# 3. Set up PowerShell profile for quick access
$ProfilePath = $PROFILE.CurrentUserAllHosts
$ProfileContent = @"

# DNA Radio Player - Quick Commands
function dnr { Set-Location "C:\Coding\DNA_webapp_player" }
function dnr-start { & "C:\Coding\DNA_webapp_player\DNA_Radio_Tools.ps1" }
function dnr-vite { Set-Location "C:\Coding\DNA_webapp_player"; npx vite --port 5173 }
function dnr-backend { Set-Location "C:\Coding\DNA_webapp_player"; tsx server/index.ts }
function dnr-stop { Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force }
function dnr-status { 
    try { Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 | Out-Null; Write-Host "✅ Vite: Running" -ForegroundColor Green } catch { Write-Host "❌ Vite: Offline" -ForegroundColor Red }
    try { Invoke-WebRequest -Uri "http://localhost:3001/api/status" -TimeoutSec 2 | Out-Null; Write-Host "✅ Backend: Running" -ForegroundColor Green } catch { Write-Host "❌ Backend: Offline" -ForegroundColor Red }
}

Write-Host "DNA Radio commands loaded. Type 'dnr-help' for more info." -ForegroundColor Cyan
"@

if (-not (Test-Path $ProfilePath)) {
    New-Item -Path $ProfilePath -ItemType File -Force | Out-Null
}

# Add to profile if not already present
$ExistingProfile = Get-Content $ProfilePath -ErrorAction SilentlyContinue
if ($ExistingProfile -notmatch "DNA Radio Player") {
    Add-Content -Path $ProfilePath -Value $ProfileContent
    Write-Host "Added DNA Radio commands to PowerShell profile" -ForegroundColor Green
}

# 4. Create Windows Terminal profile for DNA Radio
$WTSettingsPath = "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\Settings\settings.json"
if (Test-Path $WTSettingsPath) {
    Write-Host "Windows Terminal settings found. You can manually add the following profile:" -ForegroundColor Yellow
    Write-Host @"
{
    "name": "DNA Radio",
    "commandline": "pwsh -NoExit -Command \"cd C:\\Coding\\DNA_webapp_player\"",
    "startingDirectory": "C:\\Coding\\DNA_webapp_player",
    "icon": "📻",
    "colorScheme": "Campbell"
}
"@ -ForegroundColor Gray
}

# 5. Create desktop shortcuts
$DesktopPath = [Environment]::GetFolderPath("Desktop")

# DNA Radio Tools shortcut
$ToolsShortcut = "$DesktopPath\DNA Radio Tools.lnk"
if (-not (Test-Path $ToolsShortcut)) {
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($ToolsShortcut)
    $Shortcut.TargetPath = "pwsh.exe"
    $Shortcut.Arguments = "-NoExit -Command `"& 'C:\Coding\DNA_webapp_player\DNA_Radio_Tools.ps1'`""
    $Shortcut.WorkingDirectory = "C:\Coding\DNA_webapp_player"
    $Shortcut.IconLocation = "shell32.dll,25"
    $Shortcut.Save()
    Write-Host "Created desktop shortcut for DNA Radio Tools" -ForegroundColor Green
}

# 3D Radio shortcut
$RadioShortcut = "$DesktopPath\DNA Radio 3D.lnk"
if (-not (Test-Path $RadioShortcut)) {
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($RadioShortcut)
    $Shortcut.TargetPath = "chrome.exe"
    $Shortcut.Arguments = "http://localhost:5173/radio-3d"
    $Shortcut.IconLocation = "shell32.dll,120"
    $Shortcut.Save()
    Write-Host "Created desktop shortcut for DNA Radio 3D" -ForegroundColor Green
}

# 6. Set up log rotation
$LogRotationScript = @"
# DNA Radio - Log Rotation Script
# Run this weekly to clean old logs

`$LogPath = "C:\Coding\DNA_webapp_player\logs"
`$DaysToKeep = 7

Get-ChildItem -Path `$LogPath -Filter "*.log" | Where-Object {
    `$_.LastWriteTime -lt (Get-Date).AddDays(-`$DaysToKeep)
} | Remove-Item -Force

Write-Host "Log rotation completed. Removed logs older than `$DaysToKeep days."
"@

$LogRotationScript | Out-File -FilePath "C:\Coding\DNA_webapp_player\scripts\rotate-logs.ps1" -Encoding UTF8

# 7. Create a quick launch batch file
$BatchContent = @"
@echo off
echo Starting DNA Radio Development Environment...
echo.

REM Start PowerShell with the automation script
powershell -ExecutionPolicy Bypass -File "C:\Coding\DNA_webapp_player\DNA_Radio_Tools.ps1"
"@

$BatchContent | Out-File -FilePath "C:\Coding\DNA_webapp_player\Start_DNA_Radio.bat" -Encoding ASCII

Write-Host "`n✅ Setup completed!" -ForegroundColor Green
Write-Host "`nQuick Start Options:" -ForegroundColor Cyan
Write-Host "1. Run 'Start_DNA_Radio.bat' from the project folder" -ForegroundColor White
Write-Host "2. Double-click 'DNA Radio Tools' on desktop" -ForegroundColor White
Write-Host "3. Use PowerShell commands: dnr-start, dnr-vite, dnr-backend" -ForegroundColor White
Write-Host "4. Use AutoHotkey hotkeys (Ctrl+Alt+R, Ctrl+Alt+B, etc.)" -ForegroundColor White
Write-Host "`nPress any key to continue..."
Read-Host
