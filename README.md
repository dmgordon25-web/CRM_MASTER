# CRM Master

## Boot discipline

- Boot contracts follow the HARD → SOFT sequence defined in `crm-app/js/boot/boot_hardener.js`. HARD prerequisites must succeed
  before the diagnostics overlay hides; SOFT probes run afterwards without throwing or logging errors.
- The loader prints a single `[PERF] overlay hidden in <ms>` info line once boot completes. The boot smoke test asserts its
  presence along with zero console errors.
- Run `npm run verify:build` (manifest audit → contract linter → boot smoke with feature canaries) before shipping changes that
  touch boot, manifests, or diagnostics.

## Documentation

- [Boot contracts](docs/CONTRACTS.md)
- [Testing & verification](docs/TESTING.md)
- [Changelog policy](docs/CHANGELOG_POLICY.md)
- Archived references live in [`docs/archive/`](docs/archive) with deprecation banners for historical context.

## Packaging

Build the single-file launcher and emit a `Start CRM.exe_` artifact (note the trailing underscore) to avoid browser and antivirus
blocks:

```
powershell -ExecutionPolicy Bypass -File tools/build-server.ps1
```

After downloading a release, restore the launcher locally before running it:

```
powershell -ExecutionPolicy Bypass -File tools/restore_exe.ps1
```
