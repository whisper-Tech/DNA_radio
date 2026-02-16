# DNA Radio Player - PowerShell Automation Script
# Save as DNA_Radio_Tools.ps1
# Requires PowerShell 7.5 with admin privileges

#Requires -RunAsAdministrator
#Requires -Version 7.5

using namespace System.Management.Automation
using namespace System.Diagnostics

# Initialize logging
$LogPath = "C:\Coding\DNA_webapp_player\logs\automation.log"
$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    Write-Host $LogEntry -ForegroundColor $(
        switch ($Level) {
            "INFO" { "Green" }
            "WARN" { "Yellow" }
            "ERROR" { "Red" }
            default { "White" }
        }
    )
    Add-Content -Path $LogPath -Value $LogEntry -ErrorAction SilentlyContinue
}

# Server Management Functions
function Start-ViteServer {
    Write-Log "Starting Vite development server..."
    
    # Kill existing processes
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    # Start Vite in background
    $ViteJob = Start-Job -ScriptBlock {
        Set-Location "C:\Coding\DNA_webapp_player"
        npx vite --port 5173
    }
    
    # Wait for server to be ready
    $MaxWait = 30
    $Waited = 0
    while ($Waited -lt $MaxWait) {
        try {
            $Response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2
            if ($Response.StatusCode -eq 200) {
                Write-Log "Vite server is running on port 5173"
                return $ViteJob
            }
        }
        catch {
            Start-Sleep -Seconds 1
            $Waited++
        }
    }
    
    throw "Vite server failed to start within $MaxWait seconds"
}

function Start-BackendServer {
    Write-Log "Starting TypeScript backend server..."
    
    # Start backend in background
    $BackendJob = Start-Job -ScriptBlock {
        Set-Location "C:\Coding\DNA_webapp_player"
        tsx server/index.ts
    }
    
    # Wait for server to be ready
    $MaxWait = 30
    $Waited = 0
    while ($Waited -lt $MaxWait) {
        try {
            $Response = Invoke-WebRequest -Uri "http://localhost:3001/api/status" -TimeoutSec 2
            if ($Response.StatusCode -eq 200) {
                Write-Log "Backend server is running on port 3001"
                return $BackendJob
            }
        }
        catch {
            Start-Sleep -Seconds 1
            $Waited++
        }
    }
    
    throw "Backend server failed to start within $MaxWait seconds"
}

function Stop-AllServers {
    Write-Log "Stopping all development servers..."
    
    # Stop all Node.js processes
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Stop all background jobs
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    
    Write-Log "All servers stopped"
}

# Development Environment Functions
function Set-DevEnvironment {
    Write-Log "Setting up development environment..."
    
    # Create log directory
    $LogDir = "C:\Coding\DNA_webapp_player\logs"
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    
    # Open VS Code
    Start-Process "code" -ArgumentList "C:\Coding\DNA_webapp_player"
    
    # Open Windows Terminal with tabs
    $WTProfile = @"
{"commandline": "pwsh -NoExit -Command \"cd C:\Coding\DNA_webapp_player\"", "name": "Project Root"},
{"commandline": "pwsh -NoExit -Command \"cd C:\Coding\DNA_webapp_player; npx vite --port 5173\"", "name": "Vite Server"},
{"commandline": "pwsh -NoExit -Command \"cd C:\Coding\DNA_webapp_player; tsx server/index.ts\"", "name": "Backend Server"}
"@
    
    Start-Process "wt" -ArgumentList "new-tab", "--profile", "PowerShell", "-d", "C:\Coding\DNA_webapp_player"
    
    # Open browser tabs
    Start-Process "chrome" -ArgumentList "http://localhost:5173/radio-3d"
    Start-Process "chrome" -ArgumentList "http://localhost:5173"
    
    Write-Log "Development environment ready"
}

# Testing Functions
function Invoke-AllTests {
    Write-Log "Running all tests..."
    
    # Run unit tests
    try {
        npm test 2>&1 | Tee-Object -FilePath $LogPath -Append
        Write-Log "Unit tests completed"
    }
    catch {
        Write-Log "Unit tests failed" -Level "ERROR"
    }
    
    # Run E2E tests
    try {
        npx playwright test 2>&1 | Tee-Object -FilePath $LogPath -Append
        Write-Log "E2E tests completed"
    }
    catch {
        Write-Log "E2E tests failed" -Level "ERROR"
    }
}

# Git Functions
function Invoke-QuickCommit {
    param([string]$Message)
    
    if (-not $Message) {
        $Message = Read-Host "Enter commit message"
    }
    
    Write-Log "Committing changes: $Message"
    
    Set-Location "C:\Coding\DNA_webapp_player"
    git add .
    git commit -m $Message
    
    Write-Log "Changes committed successfully"
}

function Invoke-QuickPush {
    Write-Log "Pushing changes to remote..."
    
    Set-Location "C:\Coding\DNA_webapp_player"
    git push
    
    Write-Log "Changes pushed successfully"
}

# System Monitoring
function Get-SystemStatus {
    $Status = [PSCustomObject]@{
        Timestamp = Get-Date
        Services = @()
    }
    
    # Check Vite server
    try {
        $ViteResponse = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2
        $Status.Services += [PSCustomObject]@{
            Name = "Vite Server"
            Status = "Running"
            Port = 5173
            Details = "Frontend development server"
        }
    }
    catch {
        $Status.Services += [PSCustomObject]@{
            Name = "Vite Server"
            Status = "Offline"
            Port = 5173
            Details = "Frontend development server"
        }
    }
    
    # Check Backend server
    try {
        $BackendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/status" -TimeoutSec 2
        $Status.Services += [PSCustomObject]@{
            Name = "Backend Server"
            Status = "Running"
            Port = 3001
            Details = "TypeScript API server"
        }
    }
    catch {
        $Status.Services += [PSCustomObject]@{
            Name = "Backend Server"
            Status = "Offline"
            Port = 3001
            Details = "TypeScript API server"
        }
    }
    
    # Check Git status
    Set-Location "C:\Coding\DNA_webapp_player"
    $GitStatus = git status --porcelain
    $Status.Services += [PSCustomObject]@{
        Name = "Git Repository"
        Status = if ($GitStatus) { "Dirty" } else { "Clean" }
        Port = $null
        Details = if ($GitStatus) { "Uncommitted changes" } else { "Working directory clean" }
    }
    
    # Check Node processes
    $NodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    $Status.Services += [PSCustomObject]@{
        Name = "Node.js Processes"
        Status = if ($NodeProcesses) { "Running" } else { "None" }
        Port = $null
        Details = "$($NodeProcesses.Count) process(es) running"
    }
    
    return $Status
}

# Database Management
function Reset-Database {
    Write-Log "Resetting database..."
    
    Set-Location "C:\Coding\DNA_webapp_player"
    
    # Drop and recreate tables
    npm run db:reset 2>&1 | Tee-Object -FilePath $LogPath -Append
    
    Write-Log "Database reset completed"
}

# Performance Monitoring
function Start-PerformanceMonitor {
    Write-Log "Starting performance monitor..."
    
    $MonitorJob = Start-Job -ScriptBlock {
        $LogPath = "C:\Coding\DNA_webapp_player\logs\performance.log"
        
        while ($true) {
            $CPU = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
            $Memory = Get-Counter '\Memory\Available MBytes' -ErrorAction SilentlyContinue
            
            $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $LogEntry = "[$Timestamp] CPU: $($CPU.CounterSamples.CookedValue)% | Memory: $($Memory.CounterSamples.CookedValue)MB"
            
            Add-Content -Path $LogPath -Value $LogEntry -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Log "Performance monitor started (Job ID: $($MonitorJob.Id))"
}

# Main Command Interface
function Show-MainMenu {
    Clear-Host
    Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║                DNA Radio Player - Automation Tools               ║
╠══════════════════════════════════════════════════════════════╣
║  [1] Start Development Environment                               ║
║  [2] Start Vite Server Only                                      ║
║  [3] Start Backend Server Only                                   ║
║  [4] Stop All Servers                                            ║
║  [5] Run All Tests                                               ║
║  [6] Quick Git Commit                                            ║
║  [7] Quick Git Push                                              ║
║  [8] System Status                                               ║
║  [9] Reset Database                                             ║
║ [10] Start Performance Monitor                                   ║
║  [11] View Logs                                                  ║
║  [0] Exit                                                        ║
╚══════════════════════════════════════════════════════════════╝
"@
}

# Main execution loop
do {
    Show-MainMenu
    $Choice = Read-Host "Select an option"
    
    switch ($Choice) {
        "1" { Set-DevEnvironment }
        "2" { Start-ViteServer | Out-Null }
        "3" { Start-BackendServer | Out-Null }
        "4" { Stop-AllServers }
        "5" { Invoke-AllTests }
        "6" { Invoke-QuickCommit }
        "7" { Invoke-QuickPush }
        "8" { Get-SystemStatus | Format-Table -AutoSize }
        "9" { Reset-Database }
        "10" { Start-PerformanceMonitor }
        "11" { Get-Content $LogPath | Select-Object -Last 20 }
        "0" { 
            Write-Log "Exiting automation tools"
            break 
        }
        default { Write-Log "Invalid option: $Choice" -Level "WARN" }
    }
    
    if ($Choice -ne "0") {
        Write-Host "`nPress Enter to continue..."
        Read-Host
    }
} while ($Choice -ne "0")

# Cleanup on exit
Get-Job | Stop-Job
Get-Job | Remove-Job
Write-Log "Automation tools exited"
