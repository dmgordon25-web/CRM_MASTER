Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

$pidFile = Join-Path -Path $PSScriptRoot -ChildPath '.devserver.pid'
$pid = $null
$port = $null

if (Test-Path -LiteralPath $pidFile) {
    try {
        $raw = Get-Content -LiteralPath $pidFile -Raw -ErrorAction Stop
        $trimmed = $raw.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
            if ($trimmed.StartsWith('{') -and $trimmed.EndsWith('}')) {
                try {
                    $parsed = $trimmed | ConvertFrom-Json -ErrorAction Stop
                    if ($null -ne $parsed) {
                        if ($parsed.PSObject.Properties.Name -contains 'pid') {
                            $pid = [int]$parsed.pid
                        }
                        if ($parsed.PSObject.Properties.Name -contains 'port') {
                            $port = [int]$parsed.port
                        }
                    }
                } catch {
                    $pid = $null
                    $port = $null
                }
            } else {
                try {
                    $pid = [int]$trimmed
                } catch {
                    $pid = $null
                }
            }
        }
    } catch {
        $pid = $null
        $port = $null
    }

    $isRunning = $false
    if ($pid -and $pid -gt 0) {
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            if ($null -ne $process) {
                $isRunning = $true
            }
        } catch {
            $isRunning = $false
        }
    }

    if ($isRunning) {
        Write-Host "CRM dev server already running (PID $pid)." -ForegroundColor Yellow
        if ($port -and $port -gt 0) {
            $attachUrl = "http://127.0.0.1:$port/"
            Write-Host "Opening $attachUrl" -ForegroundColor Yellow
            try {
                Start-Process $attachUrl | Out-Null
            } catch {}
        } else {
            Write-Host 'Open the existing CRM dev server instance in your browser.' -ForegroundColor Yellow
        }
        exit 0
    }

    try {
        Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
    } catch {}
}

Start-Process -WindowStyle Hidden node -ArgumentList 'tools/dev_server.mjs' | Out-Null
