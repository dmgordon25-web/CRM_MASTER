$ErrorActionPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = (Resolve-Path (Join-Path $here "..")).Path
$scriptPath = Join-Path $root "tools/dev_server.mjs"
Start-Process -FilePath "node" -ArgumentList @($scriptPath) -WorkingDirectory $root -WindowStyle Hidden
exit 0
