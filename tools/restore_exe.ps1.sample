Param(
    [switch]$Force
)
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot

$placeholders = Get-ChildItem -Path $repoRoot -Filter '*.exe_' -File -Recurse

if (-not $placeholders) {
    Write-Host "No *.exe_ files found."
    return
}

foreach ($placeholder in $placeholders) {
    $targetPath = [System.IO.Path]::ChangeExtension($placeholder.FullName, '.exe')
    if (Test-Path $targetPath) {
        if ($Force) {
            Remove-Item -Path $targetPath -Force
        } else {
            Write-Warning ("Skipping {0} because {1} already exists. Use -Force to overwrite." -f $placeholder.FullName, $targetPath)
            continue
        }
    }

    $newName = [System.IO.Path]::GetFileName($targetPath)
    Rename-Item -Path $placeholder.FullName -NewName $newName
    Write-Host ("Restored {0}" -f $targetPath)
}

Write-Host "Restore complete."
