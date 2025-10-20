$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Resolve-Path (Join-Path $here '..')

# Prevent the Node server from opening its own browser when launched via the helper.
$previousSkip = $env:CRM_SKIP_AUTO_OPEN
$env:CRM_SKIP_AUTO_OPEN = '1'
$nodeProcess = Start-Process -FilePath 'node' -ArgumentList 'tools/dev_server.mjs' -WorkingDirectory $root -WindowStyle Hidden -PassThru
if ($previousSkip) { $env:CRM_SKIP_AUTO_OPEN = $previousSkip } else { Remove-Item Env:CRM_SKIP_AUTO_OPEN -ErrorAction SilentlyContinue }

$ports = 8080..8089
$targetPort = $null
$maxAttempts = 40
for ($attempt = 0; $attempt -lt $maxAttempts -and -not $targetPort; $attempt++) {
  foreach ($candidate in $ports) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$candidate/" -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $marker = $response.Headers['X-CRM-Server']
        if ($marker -and $marker -eq 'dev') {
          $targetPort = $candidate
          break
        }
      }
    } catch {
    }
  }
  if (-not $targetPort) { Start-Sleep -Milliseconds 250 }
}

if (-not $targetPort) {
  if ($nodeProcess -and $nodeProcess.Id) {
    try { Stop-Process -Id $nodeProcess.Id -ErrorAction SilentlyContinue } catch {}
  }
  throw 'CRM dev server did not respond in time.'
}

try {
  Start-Process -FilePath "http://127.0.0.1:$targetPort/"
} catch {
  Write-Verbose "Failed to launch default browser: $($_.Exception.Message)"
}

exit 0
