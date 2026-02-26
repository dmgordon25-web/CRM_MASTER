# Repo Hygiene Keep/Delete List

## Keep (top-level)
- `crm-app/` - app runtime source.
- `tools/` - build + packaging + verification scripts.
- `scripts/` - development support scripts still referenced by npm scripts.
- `tests/` - automated test coverage.
- `docs/` - maintained documentation + archives.
- `devtools/` - audit tooling.
- `release/` - generated release staging/output location.
- `Start CRM.bat`, `Create Desktop Shortcut.bat`, `Create Desktop Shortcut.ps1` - canonical runtime launcher + shortcut scripts that are bundled into client runtime.
- `package.json`, `package-lock.json`, `README.md`, config files (`playwright.config.js`, `vitest.config.mjs`, `.gitignore`) - canonical project metadata/config.

## Deleted in hygiene pass
- Legacy duplicate launcher variants (`Start CRM (Visible).bat`, `Start CRM - Diagnose.bat`, `Start CRM - Diagnose.ps1`, `Start CRM.ps1`) - obsolete competing startup paths.
- Legacy packaging wrappers (`Build and Run Release.bat`, `build_release.ps1`) - duplicate packaging flow superseded by `tools/build_release.js` + npm scripts.
- Root analysis docs (`BOOT_OPTIMIZATION_2025.md`, `DASHBOARD_FEATURES_ANALYSIS.md`, `IMPLEMENTATION_SUMMARY.md`) - obsolete top-level clutter; historical docs remain in `docs/`.
- Root generated artifacts (`launcher.log`, `smoke-test-results.json`, `test_log.txt`) - generated runtime/test output should not be kept at repo root.
- Legacy archive folder (`archive/`) - stale legacy/test artifact dump at root; canonical history is under `docs/archive/`.
- Obsolete top-level ad hoc test helpers (`smoke-tests.mjs`, `stability-tests.mjs`, `test_syntax.mjs`, `TESTING.md`) - superseded by npm-scripted checks and `tests/`.

## Needs confirmation
- None.
