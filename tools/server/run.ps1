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

$readTask = $server.StandardOutput.ReadLineAsync()
if (-not $readTask.Wait(10000)) {
  try { $server.Kill() } catch {}
  throw "Failed to capture server URL from server.exe"
}

$serverUrl = $readTask.Result
if ([string]::IsNullOrWhiteSpace($serverUrl)) {
  try { $server.Kill() } catch {}
  throw "Server did not emit a listening URL"
}

$serverUrl = $serverUrl.Trim()
$env:CRM_SERVER_URL = $serverUrl

# locate a shell executable in the publish folder (if present)
$shellExe = Get-ChildItem -Path $pub -Filter "Shell.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1

if ($shellExe) {
  Start-Process -FilePath $shellExe.FullName -ArgumentList $serverUrl
} else {
  Write-Warning "Shell.exe not found in publish directory; launching Edge instead."
  Start-Process -FilePath "msedge" -ArgumentList "--app=`"$serverUrl`""
}
