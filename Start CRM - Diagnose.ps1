Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'CRM Launcher (Diagnose)'
Set-Location -LiteralPath $PSScriptRoot
Write-Host "Diagnostic mode: visible spawn with verbose logging..."

& "$PSScriptRoot\Start CRM.ps1"
exit $LASTEXITCODE
