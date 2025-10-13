# Requires: Windows PowerShell 5+
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/win/run-hidden.ps1 -Command "npm run start:web"
param(
  [Parameter(Mandatory=$true)][string]$Command
)

$ErrorActionPreference = "Stop"

function Invoke-Hidden {
  param([string]$CmdLine)
  # Start a background PowerShell that runs the target command, keep this wrapper hidden/minimized.
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell.exe"
  $psi.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -Command `"& { $CmdLine }`""
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $psi.CreateNoWindow = $true
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  if ($proc -eq $null) { throw "Failed to start hidden process" }
  try {
    Wait-Process -Id $proc.Id
  } finally {
    if (!$proc.HasExited) { $proc.Kill() | Out-Null }
  }
}

Invoke-Hidden -CmdLine $Command
exit $LASTEXITCODE
