$ErrorActionPreference = "Stop"

# publish server self-contained single-file
dotnet publish tools/server -c Release -r win-x64 -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishTrimmed=false

$pubDir = Get-ChildItem -Path "tools/server/bin/Release" -Directory -Recurse | Where-Object { $_.Name -eq "publish" -and $_.FullName -match "win-x64" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $pubDir) {
  throw "Could not resolve publish directory for server"
}
$pub = $pubDir.FullName

# copy crm-app into publish directory
Copy-Item -Recurse -Force crm-app (Join-Path $pub "crm-app")

# launch server and capture the advertised URL from stdout
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = Join-Path $pub "server.exe"
$psi.WorkingDirectory = $pub
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$server = New-Object System.Diagnostics.Process
$server.StartInfo = $psi
$null = $server.Start()

$timeout = [TimeSpan]::FromSeconds(10)
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$serverUrl = $null

while (-not $serverUrl) {
  $remaining = $timeout - $stopwatch.Elapsed
  if ($remaining -le [TimeSpan]::Zero) {
    break
  }

  $readTask = $server.StandardOutput.ReadLineAsync()
  if (-not $readTask.Wait($remaining)) {
    break
  }

  $line = $readTask.Result
  if ($null -eq $line) {
    break
  }

  $line = $line.Trim()
  if ([string]::IsNullOrWhiteSpace($line)) {
    continue
  }

  $uri = $null
  if ([Uri]::TryCreate($line, [System.UriKind]::Absolute, [ref]$uri) -and $uri.Scheme -match '^https?$') {
    $serverUrl = $uri.AbsoluteUri
    break
  }

  $match = [regex]::Match($line, '(https?://\S+)')
  if ($match.Success) {
    $candidate = $match.Value.TrimEnd('"', '\'', ',', ';')
    $uriFromMatch = $null
    if ([Uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$uriFromMatch)) {
      $serverUrl = $uriFromMatch.AbsoluteUri
      break
    }
  }
}

if (-not $serverUrl) {
  try { $server.Kill() } catch {}
  throw "Failed to capture server URL from server.exe"
}

$env:CRM_SERVER_URL = $serverUrl

# locate a shell executable in the publish folder (if present)
$shellExe = Get-ChildItem -Path $pub -Filter "Shell.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1

if ($shellExe) {
  Start-Process -FilePath $shellExe.FullName -ArgumentList $serverUrl
} else {
  Write-Warning "Shell.exe not found in publish directory; launching Edge instead."
  Start-Process -FilePath "msedge" -ArgumentList "--app=`"$serverUrl`""
}
