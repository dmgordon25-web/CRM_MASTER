@echo off
setlocal
pushd "%~dp0"
node tools\dev_server.mjs
popd
exit /b 0
