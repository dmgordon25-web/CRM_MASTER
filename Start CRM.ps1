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
                            try { $pid = [int]$parsed.pid } catch { $pid = $null }
                        }
                        if ($parsed.PSObject.Properties.Name -contains 'port') {
                            try { $port = [int]$parsed.port } catch { $port = $null }
                        }
                    }
                } catch {
                    $pid = $null
                    $port = $null
                }
            } elseif ($trimmed -match '^[0-9]+$') {
                try { $pid = [int]$trimmed } catch { $pid = $null }
            }
        }
    } catch {
        $pid = $null
        $port = $null
    }
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
        try { Start-Process $attachUrl | Out-Null } catch {}
    }
    exit 0
}

try {
    Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
} catch {}

$nodeCommand = $null
try {
    $nodeCommand = (Get-Command node -ErrorAction Stop).Source
} catch {
    $nodeCommand = $null
}
if (-not $nodeCommand) {
    $programFilesCandidate = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path -LiteralPath $programFilesCandidate) {
        $nodeCommand = $programFilesCandidate
    }
}
if (-not $nodeCommand) {
    Write-Host 'Node.js not found in PATH. Install Node 18+ or add node.exe to PATH.' -ForegroundColor Red
    exit 2
}

try {
    $child = Start-Process -FilePath $nodeCommand `
        -ArgumentList 'tools/dev_server.mjs' `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -PassThru
} catch {
    Write-Host 'Failed to start CRM dev server process.' -ForegroundColor Red
    exit 1
}

Start-Sleep -Milliseconds 600
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $pidFile)) {
    Start-Sleep -Milliseconds 200
}

if (Test-Path -LiteralPath $pidFile) {
    try {
        $raw = Get-Content -LiteralPath $pidFile -Raw -ErrorAction Stop
        $trimmed = $raw.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmed) -and $trimmed.StartsWith('{') -and $trimmed.EndsWith('}')) {
            try {
                $parsed = $trimmed | ConvertFrom-Json -ErrorAction Stop
                if ($parsed -and $parsed.PSObject.Properties.Name -contains 'port') {
                    try { $port = [int]$parsed.port } catch { $port = $null }
                }
            } catch {}
        }
    } catch {}
}

if ($port -and $port -gt 0) {
    $targetUrl = "http://127.0.0.1:$port/"
} else {
    $targetUrl = 'http://127.0.0.1:8080/'
}
try { Start-Process $targetUrl | Out-Null } catch {}

exit 0
