$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Resolve-Path (Join-Path $here '..')

Start-Process -FilePath 'node' -ArgumentList 'tools/dev_server.mjs' -WorkingDirectory $root -WindowStyle Hidden | Out-Null
