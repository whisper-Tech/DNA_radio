# DNA Radio - Automated Testing Script
# Tests all pages and functionality automatically

param(
    [switch]$Continuous,
    [int]$Interval = 30
)

$BaseUrl = "http://localhost:5173"
$TestResults = @()

function Test-Page {
    param(
        [string]$Url,
        [string]$PageName,
        [string[]]$ExpectedContent = @()
    )
    
    Write-Host "Testing $PageName..." -ForegroundColor Yellow
    
    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        $Content = $Response.Content
        
        $Test = [PSCustomObject]@{
            Page = $PageName
            Url = $Url
            StatusCode = $Response.StatusCode
            Success = $Response.StatusCode -eq 200
            Errors = @()
            Timestamp = Get-Date
        }
        
        if ($ExpectedContent) {
            foreach ($Expected in $ExpectedContent) {
                if ($Content -notmatch [regex]::Escape($Expected)) {
                    $Test.Errors += "Missing expected content: $Expected"
                    $Test.Success = $false
                }
            }
        }
        
        # Check for common errors
        if ($Content -match "error|Error|failed|Failed|Cannot find module") {
            $Test.Errors += "Page contains error messages"
            $Test.Success = $false
        }
        
        if ($Test.Success) {
            Write-Host "✅ $PageName - PASSED" -ForegroundColor Green
        } else {
            Write-Host "❌ $PageName - FAILED" -ForegroundColor Red
            $Test.Errors | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        }
        
        return $Test
    }
    catch {
        Write-Host "❌ $PageName - FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return [PSCustomObject]@{
            Page = $PageName
            Url = $Url
            StatusCode = 0
            Success = $false
            Errors = @($_.Exception.Message)
            Timestamp = Get-Date
        }
    }
}

function Test-API {
    Write-Host "Testing API endpoints..." -ForegroundColor Yellow
    
    $ApiTests = @()
    
    # Test status endpoint
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3001/api/status" -UseBasicParsing -TimeoutSec 5
        if ($Response.StatusCode -eq 200) {
            Write-Host "✅ API Status - PASSED" -ForegroundColor Green
            $ApiTests += [PSCustomObject]@{ Endpoint = "Status"; Success = $true }
        }
    }
    catch {
        Write-Host "⚠️ API Status - Backend not running" -ForegroundColor Yellow
        $ApiTests += [PSCustomObject]@{ Endpoint = "Status"; Success = $false; Error = "Backend offline" }
    }
    
    return $ApiTests
}

function Run-AllTests {
    Write-Host "`n" + "="*60 -ForegroundColor Cyan
    Write-Host "DNA Radio - Automated Testing" -ForegroundColor Cyan
    Write-Host "="*60 -ForegroundColor Cyan
    Write-Host "Started at: $(Get-Date)" -ForegroundColor Gray
    Write-Host ""
    
    # Test main pages
    $Pages = @(
        @{ Url = "$BaseUrl/"; Name = "Home Page"; Expected = @("DNA Radio", "root") },
        @{ Url = "$BaseUrl/radio-3d"; Name = "3D Radio"; Expected = @("DNA Radio", "canvas") },
        @{ Url = "$BaseUrl/dashboard"; Name = "Dashboard"; Expected = @("Radio") },
        @{ Url = "$BaseUrl/admin"; Name = "Admin"; Expected = @() }
    )
    
    foreach ($Page in $Pages) {
        $TestResults += Test-Page -Url $Page.Url -PageName $Page.Name -ExpectedContent $Page.Expected
        Start-Sleep -Milliseconds 500
    }
    
    # Test API
    $ApiResults = Test-API
    $TestResults += $ApiResults
    
    # Summary
    Write-Host "`n" + "="*60 -ForegroundColor Cyan
    Write-Host "Test Summary" -ForegroundColor Cyan
    Write-Host "="*60 -ForegroundColor Cyan
    
    $Passed = $TestResults | Where-Object { $_.Success }
    $Failed = $TestResults | Where-Object { -not $_.Success }
    
    Write-Host "Total Tests: $($TestResults.Count)" -ForegroundColor White
    Write-Host "Passed: $($Passed.Count)" -ForegroundColor Green
    Write-Host "Failed: $($Failed.Count)" -ForegroundColor Red
    
    if ($Failed.Count -gt 0) {
        Write-Host "`nFailed Tests:" -ForegroundColor Red
        $Failed | ForEach-Object {
            Write-Host "- $($_.Page): $($_.Errors -join ', ')" -ForegroundColor Red
        }
    }
    
    # Save results
    $ResultsFile = "C:\Coding\DNA_webapp_player\logs\test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $TestResults | ConvertTo-Json -Depth 3 | Out-File -FilePath $ResultsFile
    Write-Host "`nResults saved to: $ResultsFile" -ForegroundColor Gray
    
    return $Failed.Count -eq 0
}

# Main execution
do {
    $AllPassed = Run-AllTests
    
    if ($Continuous) {
        Write-Host "`nWaiting $Interval seconds before next test run..." -ForegroundColor Gray
        Start-Sleep -Seconds $Interval
        
        # Clear screen for next run
        Clear-Host
    }
} while ($Continuous)

if (-not $Continuous) {
    Write-Host "`nPress Enter to exit..."
    Read-Host
}
