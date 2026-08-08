$ErrorActionPreference = "Stop"

$siteRoot = Split-Path -Parent $PSScriptRoot
$workflowRoot = if ($env:KK_WORKFLOW_ROOT) {
    [System.IO.Path]::GetFullPath($env:KK_WORKFLOW_ROOT)
}
else {
    $siblingRoot = Join-Path (Split-Path $siteRoot -Parent) "KK Diction"
    if (Test-Path -LiteralPath $siblingRoot) { $siblingRoot } else { $siteRoot }
}
$indexPath = Join-Path $workflowRoot "db mods\source\pandaman\index.drive.json"
$reviewDir = Join-Path $workflowRoot "db mods\source\pandaman\review"

$alreadyUploaded = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]@(
        "[pandaman] eve-heel1 v1.0.zipmod",
        "[pandaman] jiangshi-top1 v1.0.zipmod",
        "[pandaman] northface v1.0.zipmod",
        "[pandaman] sf6-suzi-edit v1.0.zipmod"
    ),
    [System.StringComparer]::OrdinalIgnoreCase
)

if (-not (Test-Path $indexPath)) {
    throw "Drive index not found: $indexPath"
}

$gdown = Get-Command gdown -ErrorAction Stop
$index = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8 | ConvertFrom-Json
$queue = @(
    $index.files |
        Where-Object { $_.name -match "\.(zipmod|zip)$" } |
        Where-Object { -not $alreadyUploaded.Contains([string]$_.name) }
)

if ($queue.Count -ne 89) {
    throw "Safety check failed: expected 89 remaining archives, found $($queue.Count). No downloads started."
}

New-Item -ItemType Directory -Path $reviewDir -Force | Out-Null

$manualDownloadCsv = Join-Path $reviewDir "manual-download-required.csv"
$manualDownloadTxt = Join-Path $reviewDir "manual-download-required.txt"
$failures = [System.Collections.Generic.List[object]]::new()
$completed = 0
$skipped = 0
$position = 0

foreach ($file in $queue) {
    $position++
    $fileName = [string]$file.name
    $fileId = [string]$file.id
    $destination = Join-Path $reviewDir $fileName
    $expectedBytes = [int64]$file.size
    $downloadUrl = "https://drive.google.com/uc?id=$fileId"
    $manualUrl = "https://drive.google.com/file/d/$fileId/view"

    if ((Test-Path -LiteralPath $destination) -and
        ((Get-Item -LiteralPath $destination).Length -eq $expectedBytes)) {
        $skipped++
        Write-Host "[SKIP $position/89] $fileName"
        continue
    }

    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Force
    }

    Write-Host "[DOWNLOAD $position/89] $fileName"
    $failureReason = $null

    try {
        & $gdown.Source $downloadUrl --output $destination
        $gdownExitCode = $LASTEXITCODE

        if ($gdownExitCode -ne 0) {
            $failureReason = "gdown exit code $gdownExitCode"
        }
        elseif (-not (Test-Path -LiteralPath $destination)) {
            $failureReason = "gdown returned success but no file was created"
        }
        else {
            $actualBytes = (Get-Item -LiteralPath $destination).Length
            if ($actualBytes -ne $expectedBytes) {
                $failureReason = "Size mismatch: expected=$expectedBytes actual=$actualBytes"
            }
        }
    }
    catch {
        $failureReason = $_.Exception.Message
    }

    if ($failureReason) {
        if (Test-Path -LiteralPath $destination) {
            Remove-Item -LiteralPath $destination -Force
        }

        $failures.Add([pscustomobject]@{
            FileName = $fileName
            DriveId = $fileId
            ExpectedBytes = $expectedBytes
            ManualDownloadUrl = $manualUrl
            Reason = $failureReason
        })
        Write-Warning "[FAILED $position/89] $fileName - $failureReason; skipped"
        continue
    }

    $completed++
    Write-Host "[OK $position/89] $fileName"
}

if ($failures.Count -gt 0) {
    $failures | Export-Csv -LiteralPath $manualDownloadCsv -NoTypeInformation -Encoding UTF8

    $textLines = [System.Collections.Generic.List[string]]::new()
    $textLines.Add("Manual downloads required: $($failures.Count)")
    $textLines.Add("Download each file to: $reviewDir")
    $textLines.Add("")
    foreach ($failure in $failures) {
        $textLines.Add("File: $($failure.FileName)")
        $textLines.Add("Link: $($failure.ManualDownloadUrl)")
        $textLines.Add("Expected bytes: $($failure.ExpectedBytes)")
        $textLines.Add("Reason: $($failure.Reason)")
        $textLines.Add("")
    }
    Set-Content -LiteralPath $manualDownloadTxt -Value $textLines -Encoding UTF8
}
else {
    Remove-Item -LiteralPath $manualDownloadCsv -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $manualDownloadTxt -Force -ErrorAction SilentlyContinue
}

$readyCount = $completed + $skipped
Write-Host ""
Write-Host "Download pass finished"
Write-Host "Ready for owner review: $readyCount/89"
Write-Host "Downloaded now: $completed"
Write-Host "Already complete: $skipped"
Write-Host "Manual downloads required: $($failures.Count)"
Write-Host "Folder: $reviewDir"

if ($failures.Count -gt 0) {
    Write-Host "Manual-download list (CSV): $manualDownloadCsv"
    Write-Host "Manual-download list (TXT): $manualDownloadTxt"
    Write-Host ""
    Write-Host "Files to download manually:"
    foreach ($failure in $failures) {
        Write-Host "- $($failure.FileName)"
        Write-Host "  $($failure.ManualDownloadUrl)"
    }
}
