Set-Location -LiteralPath $PSScriptRoot
Start-Process -WindowStyle Hidden node -ArgumentList 'tools/dev_server.mjs'
