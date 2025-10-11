# Testing & Verification

GitHub Actions now runs `npm run verify:build` on every pull request, covering the manifest audit, contract linter, and zero-error navigation smoke test.

`npm run verify:build` is the pre-flight suite for every boot or manifest change. It runs the following steps in order:

1. **Manifest audit** (`tools/manifest_audit.js`) – confirms every script in `/crm-app/js` and `/crm-app/js/patches` is declared
   exactly once in the loader manifest. Warn-only entries are logged so we can phase them into probes later.
2. **Contract linter** (`tools/contract_lint.mjs`) – checks boot contracts for DOM-free top-level code, enforces HARD/SOFT probe
   shape, and refuses to ship accidental global lookups.
3. **Boot smoke test** (`tools/boot_smoke_test.mjs`, also the `npm run test:boot` script) – spins up the static server, loads the
   app in headless Chromium, and fails if any console error is emitted.

## What the smoke test covers

- Waits for `window.__BOOT_DONE__?.fatal === false` and ensures the diagnostics overlay is hidden at every checkpoint.
- Navigates **Dashboard → Long Shots → Pipeline → Partners** with zero console errors.
- Runs feature canaries:
  - Toast/Confirm helpers return the expected shape and resolve a confirm promise without user input.
  - Notifications hooks allow an onChanged subscribe/unsubscribe cycle without throwing.
  - Pipeline table search hides and restores rows client-side without touching the network.
  - `/__log` access degrades gracefully—one info/warn log if the endpoint is missing, no errors.
- Asserts the one-time `[PERF] overlay hidden in <ms>` info log appears exactly once per page load.

## Reading failures

| Failure | Typical cause | Next steps |
| --- | --- | --- |
| `Console error detected` | A HARD probe threw, a module import failed, or a feature canary surfaced a regression. | Inspect the console output at the failure timestamp and fix the offending module. |
| `diagnostics-splash` still visible | A HARD prereq failed or a SAFE-mode check forced the overlay to remain. | Verify HARD probes and make sure DOM work happens after `DOMContentLoaded`. |
| `/__log unavailable without diagnostic log` | The log fallback did not emit an info/warn line. | Ensure `/__log` failures call `console.info('[BOOT] log fallback active …')`. |
| Toast/Confirm/Notifications/Pipeline canary failures | Helper APIs changed shape or lost DOM hooks. | Update the helper or extend the canary to cover the new contract. |

Run the suite locally until it passes—CI will fail on the first regression.
