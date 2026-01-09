# CRM Master

CRM Master is a single-user mortgage CRM demo that runs entirely in the browser with an offline-first data model (IndexedDB). A lightweight Node/PowerShell launcher serves the static bundle locally for Windows users while preserving the same code paths used in development.

## Current feature set
- **Contacts, Partners, Pipeline, and Tasks** with the existing editors, tables, and CSV export tools.
- **Labs dashboard** as the Simple-mode landing view with KPI cards and widgets wired to the same data set.
- **Notifications (MVP)** plus **Safe Mode** to boot only core modules when isolating regressions (`?safe=1`).
- **Offline/local data** backed by IndexedDB; refreshes preserve state unless storage is cleared.

## Run the app (dev/demo)
1. Install dependencies: `npm ci`
2. Start the local static server: `node tools/node_static_server.js crm-app` (default: http://127.0.0.1:8080/)
3. Open the app in your browser. For Windows users, the `Start CRM*.bat` and `Start CRM*.ps1` launchers point to the same static server for a click-to-run demo.
4. Optional validation: `npm run test:boot` to exercise the deterministic boot path used in CI.

## Safe Mode and troubleshooting
- Append `?safe=1` (or set `window.__SAFE_MODE__ = true` before boot) to skip experimental patches and load only the hardened baseline.
- If local data looks stale or corrupted, clear the site’s IndexedDB storage and reload; no remote services are involved.
- Ensure Playwright browsers are installed before running boot checks: `npx playwright install-deps chromium && npx playwright install chromium`.

## Documentation
- See `docs/README.md` for the doc index and historical references.
- [Workspace Data Inventory](docs/WORKSPACE_DATA_INVENTORY.md): Authoritative mapping of data to storage.
- Boot expectations and loader ordering remain defined by `crm-app/js/boot/boot_hardener.js` and the supporting specs in `docs/`.

## Packaging helpers (optional)
Sample PowerShell scripts in `tools/` build or restore the Windows launcher (`Start CRM.exe_`). Copy the `.sample` files to local paths before running them:

```powershell
copy tools\build-server.ps1.sample tools\build-server.ps1
powershell -ExecutionPolicy Bypass -File tools/build-server.ps1
```

```powershell
copy tools\restore_exe.ps1.sample tools\restore_exe.ps1
powershell -ExecutionPolicy Bypass -File tools/restore_exe.ps1
```
