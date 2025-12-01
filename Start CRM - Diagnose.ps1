param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'CRM Launcher (Diagnose)'
Set-Location -LiteralPath $PSScriptRoot

Write-Host "Diagnostic mode: visible spawn with verbose logging..." -ForegroundColor Yellow
& "$PSScriptRoot\Start CRM.ps1" -Visible -Diagnose
exit $LASTEXITCODE
