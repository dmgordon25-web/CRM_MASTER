# Requires: Windows PowerShell 5+
param([Parameter(Mandatory=$true)][string]$Command)
$ErrorActionPreference = "Stop"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -Command `"& { $Command }`""
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
$psi.UseShellExecute = $false
$proc = [System.Diagnostics.Process]::Start($psi)
if ($proc -eq $null) { throw "Failed to start hidden process" }
try { Wait-Process -Id $proc.Id } finally { if (!$proc.HasExited) { $proc.Kill() | Out-Null } }
exit $LASTEXITCODE
