@echo off
setlocal
REM Visible fallback launcher for diagnostics; keeps console open.
pushd "%~dp0"
cmd /k node tools/dev_server.mjs
popd
