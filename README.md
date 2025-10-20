# CRM Master

[![CI](https://img.shields.io/badge/CI-verify--build-blue.svg)](#continuous-integration)

## Development

### Quickstart

1. `npm ci`
2. `npm run verify:build`
3. `node tools/node_static_server.js crm-app` (then browse to `http://127.0.0.1:8080/`)

Additional guardrails:

- **SAFE mode** – append `?safe=1` (or set `window.__SAFE_MODE__ = true` before boot) to load only CORE modules and HARD probes. Use this when isolating loader regressions; patches and experimental panels stay dormant.
- **Patches stay pure** – PATCH modules must ship with **no** top-level side-effects. Keep DOM reads, timers, and storage access inside readiness hooks so Safe Mode and the boot contracts stay deterministic and warn-cap compliant.

## Boot discipline

- Boot contracts follow the HARD → SOFT sequence defined in `crm-app/js/boot/boot_hardener.js`. HARD prerequisites must succeed before the diagnostics overlay hides; SOFT probes run afterwards without throwing or logging errors.
- The loader prints a single `[PERF] overlay hidden in <ms>` info line once boot completes. The boot smoke test asserts its presence along with zero console errors.
- Run `npm run verify:build` (manifest audit → contract linter → boot smoke with feature canaries) before shipping changes that touch boot, manifests, or diagnostics.

## Documentation

- [Boot contracts](docs/CONTRACTS.md)
- [Testing & verification](docs/TESTING.md)
- [Changelog policy](docs/CHANGELOG_POLICY.md)
- Archived references live in [`docs/archive/`](docs/archive) with deprecation banners for historical context.

## Continuous integration

- GitHub Actions runs `npm run verify:build` on every pull request and blocks merges on console errors, manifest drift, or canary regressions.
- See [Testing & verification](docs/TESTING.md) for interpreting failures and extending the suite.

## Packaging

Build the single-file launcher and emit a `Start CRM.exe_` artifact (note the trailing underscore) to avoid browser and antivirus blocks. First copy the sample script so it can run locally without being tracked in git:

```
copy tools\build-server.ps1.sample tools\build-server.ps1
powershell -ExecutionPolicy Bypass -File tools/build-server.ps1
```

After downloading a release, restore the launcher locally before running it (copy the sample first, if needed):

```
copy tools\restore_exe.ps1.sample tools\restore_exe.ps1
powershell -ExecutionPolicy Bypass -File tools/restore_exe.ps1
```
