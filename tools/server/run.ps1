$ErrorActionPreference = "Stop"
# publish server self-contained single-file
dotnet publish tools/server -c Release -r win-x64 -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishTrimmed=false
$pub = Resolve-Path "tools/server/bin/Release/win-x64/publish"
# copy crm-app into publish directory
Copy-Item -Recurse -Force crm-app "$pub/crm-app"
# start server and capture chosen URL
$server = Start-Process -FilePath "$pub/server.exe" -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 400
$urls = Get-Content "$pub/server.exe.log" -ErrorAction SilentlyContinue
# If server didn't log URL, probe default port 0 case is printed to stdout; skip
# Launch shell (WebView2 or Edge) pointing at the URL (default to http://127.0.0.1:8080 if not found)
$u = "http://127.0.0.1:8080"
Start-Process -FilePath "$pub/server.exe" # placeholder if you need to tail logs
