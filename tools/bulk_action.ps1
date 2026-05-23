<#
This is a script designed to help operations on 
a large number of files at once, the syntax is:

./path/to/bulk_action.ps1 "files to modify" {
operation $file
}

example:
./tools/bulk_action.ps1 "*.html" {
Write-Host $file
}

or:
.\tools\bulk_action.ps1 "*.html" {
Write-Host $file
}

depending on your operating system.

#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Pattern,

    [Parameter(Mandatory = $true, Position = 1)]
    [scriptblock]$Actions,

    [string]$CurrentPath = "."
)

$CurrentPath = (Resolve-Path $CurrentPath).Path

Write-Host "Scanning: $CurrentPath"
Write-Host "Pattern: $Pattern"

$files = Get-ChildItem -Path $CurrentPath -File -Filter $Pattern -ErrorAction SilentlyContinue

Write-Host "Found $($files.Count) files"

foreach ($file in $files) {
    Write-Host "Processing: $($file.FullName)"

    try {
        & $Actions $file
    }
    catch {
        Write-Warning "Error processing $($file.FullName): $_"
    }
}
