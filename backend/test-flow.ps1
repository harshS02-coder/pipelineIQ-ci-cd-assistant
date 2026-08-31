# PowerShell script to test the end-to-end failure analysis flow

$BaseUrl = "http://localhost:3000"
$ApiKey = "hrs-hari"
$Headers = @{
    "X-API-Key" = $ApiKey
    "Content-Type" = "application/json"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🧪 Running E2E Failure Analysis Pipeline Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $HealthResponse = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Write-Host "Status: $($HealthResponse.status)" -ForegroundColor Green
    Write-Host "Uptime: $($HealthResponse.uptime) seconds" -ForegroundColor Green
} catch {
    Write-Error "Health check failed: $_"
    Exit 1
}

# 2. Submit Failure
Write-Host "`n2. Submitting simulated CI/CD build failure logs..." -ForegroundColor Yellow
$FailureBody = @{
    logs = @"
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /app/package.json
npm ERR! errno -2
npm ERR! enoent ENOENT: no such file or directory, open '/app/package.json'
npm ERR! enoent This is related to npm not being able to find a file.
npm ERR! enoent 
"@
    pipelineId = "run-$([Guid]::NewGuid().ToString().Substring(0,8))"
    pipelineName = "Node.js Build Pipeline"
    cicdProvider = "github-actions"
    branch = "main"
    commitSha = "e4d2a1b9c8d7e6f5"
} | ConvertTo-Json

try {
    $SubmitResponse = Invoke-RestMethod -Uri "$BaseUrl/api/v1/analyze/submit" -Method Post -Body $FailureBody -ContentType "application/json"
    $FailureId = $SubmitResponse.failureId
    $JobId = $SubmitResponse.jobId
    Write-Host "Successfully submitted failure!" -ForegroundColor Green
    Write-Host "Failure ID: $FailureId" -ForegroundColor Green
    Write-Host "Job ID: $JobId" -ForegroundColor Green
} catch {
    Write-Error "Failure submission failed: $_"
    Exit 1
}

# 3. Poll for Analysis Complete
Write-Host "`n3. Waiting for LLM analysis queue worker to process..." -ForegroundColor Yellow
$MaxAttempts = 15
$Attempt = 1
$Analyzed = $false
$FailureDetail = $null

while ($Attempt -le $MaxAttempts) {
    Write-Host "Polling failure state (Attempt $Attempt/$MaxAttempts)..." -ForegroundColor Cyan
    try {
        $FailureDetail = Invoke-RestMethod -Uri "$BaseUrl/api/v1/analyze/failures/$FailureId" -Method Get -Headers $Headers
        if ($FailureDetail.failure.status -eq "analyzed") {
            $Analyzed = $true
            break
        }
        if ($FailureDetail.failure.status -eq "failed") {
            Write-Error "Job worker reported status 'failed'"
            Exit 1
        }
    } catch {
        Write-Error "Polling failed: $_"
        Exit 1
    }
    Start-Sleep -Seconds 2
    $Attempt++
}

if (-not $Analyzed) {
    Write-Error "Timeout: LLM analysis did not complete in time."
    Exit 1
}

Write-Host "Analysis completed successfully!" -ForegroundColor Green

# 4. Print Results
Write-Host "`n==========================================" -ForegroundColor Magenta
Write-Host "🤖 LLM ANALYSIS RESULTS" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Summary: $($FailureDetail.analysis.summary)" -ForegroundColor White
Write-Host "Root Cause: $($FailureDetail.analysis.rootCause)" -ForegroundColor White
Write-Host "Confidence: $($FailureDetail.analysis.confidence)" -ForegroundColor Green
Write-Host "`nSuggested Fixes:" -ForegroundColor Yellow

foreach ($Fix in $FailureDetail.analysis.suggestedFixes) {
    Write-Host "  - Title: $($Fix.title)" -ForegroundColor White
    Write-Host "    Description: $($Fix.description)" -ForegroundColor DarkGray
    $SafeColor = "Red"
    if ($Fix.isSafe -eq $true -or $Fix.isSafe -eq "True") { $SafeColor = "Green" }
    Write-Host "    Is Safe: $($Fix.isSafe)" -ForegroundColor $SafeColor
    Write-Host "    Commands: $([string]::Join(', ', $Fix.commands))" -ForegroundColor Cyan
}

# 5. Check Stats
Write-Host "`n5. Fetching application stats..." -ForegroundColor Yellow
try {
    $StatsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/v1/analyze/stats" -Method Get -Headers $Headers
    Write-Host "Total Failures: $($StatsResponse.stats.totalFailures)" -ForegroundColor Green
    Write-Host "Analyzed Failures: $($StatsResponse.stats.analyzedFailures) ($($StatsResponse.stats.analysisRate))" -ForegroundColor Green
    Write-Host "Successful Fixes Applied: $($StatsResponse.stats.successfulFixes)" -ForegroundColor Green
} catch {
    Write-Error "Fetching stats failed: $_"
}

Write-Host "`nTest complete!" -ForegroundColor Green
