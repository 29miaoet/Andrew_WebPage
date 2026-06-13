param (
    [Parameter(Mandatory = $true)]
    [string]$FilePath
)

if (!(Test-Path $FilePath)) {
    Write-Host "File not found: $FilePath"
    exit 1
}

$content = Get-Content -Raw -Encoding UTF8 $FilePath

# Normalize CRLF and CR to LF
$normalized = $content -replace "`r`n", "`n" -replace "`r", "`n"

if ($content -ne $normalized) {
    Set-Content -Path $FilePath -Value $normalized -Encoding UTF8 -NoNewline
    Write-Host "Normalized: $FilePath"
} else {
    Write-Host "Already normalized: $FilePath"
}
