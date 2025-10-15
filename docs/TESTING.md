# Testing & Verification

GitHub Actions runs `npm run verify:build` on every pull request, covering the manifest audit, contract linter, and the zero-error navigation smoke test.

## Local pre-flight

```bash
npm ci
npm run verify:build
```

`npm run verify:build` runs the following steps in order:

1. **Manifest audit** (`tools/manifest_audit.js`) – confirms every script in `/crm-app/js` and `/crm-app/js/patches` is declared exactly once in the loader manifest. Warn-only entries are logged so we can phase them into probes later.
2. **Contract linter** (`tools/contract_lint.mjs`) – checks boot contracts for DOM-free top-level code, enforces HARD/SOFT probe shape, and refuses to ship accidental global lookups.
3. **Boot smoke test** (`tools/boot_smoke_test.mjs`, also the `npm run test:boot` script) – spins up the static server, loads the app in headless Chromium, and fails if any console error is emitted or if more than five non-allowlisted console warnings slip through.

## Reading smoke output

- Look for `BOOT SMOKE TEST PASS` at the end of the run. Any earlier `BOOT SMOKE TEST FAIL:` line prints the thrown error.
- Console and network noise show up immediately: the harness prints `Console error detected: …` or `[SMOKE] 4xx/5xx network failures` before exiting.
- The action bar selector chosen by the canary prints as `smoke:action-selector <selector>` to help trace DOM changes.
- When `/__log` is unreachable the run expects exactly **one** info/warn line describing the fallback. More than one or zero logs trip `/__log fallback emitted noisy logs`.
- Network allowlist lives inline (`IGNORE_404` ignores `favicon.ico`, source maps, and `/__log`). All other 4xx/5xx responses fail the run.

## Smoke canaries & selectors

| Capability | Selector / Hook | What is asserted |
| --- | --- | --- |
| Toast host | `[data-toast-host="true"]` + `window.addEventListener('ui:toast', …)` | Toast helper returns undefined, DOM host updates, `ui:toast` fires. |
| Confirm dialog | `window.Confirm.show` | Promise resolves `true` without user interaction. |
| Selection counter | `#tbl-pipeline [data-ui="row-check"]`, `window.__SEL_COUNT__` | Two checkbox clicks increment selection count and surface the bulk action bar. |
| Merge workflow | `[data-ui="action-bar"] [data-action="merge"]`, `[data-ui="merge-modal"]`, `[data-ui="merge-confirm"]` | Merge button enables, modal opens, confirm handler resolves without errors. |
| Kanban handlers | `.kanban-board`, `[data-ui="kanban-root"]`, `window.__KANBAN_HANDLERS__` | Drag/drop handlers register once and expose stable counters before/after navigation. |
| Navigation shell | `[data-nav="dashboard"|"longshots"|"pipeline"|"partners"|"calendar"]` | Route buttons exist, become active, and no console errors fire during transitions. |
| Capability registry | `window.__CAPS__` | HARD/SOFT capability flags (`toast`, `confirm`, `renderAll`, `selection`) stay truthful after route flips. |
| Calendar exports | `[data-ui="calendar-export-ics"]`, `[data-ui="calendar-export-csv"]` | Single export buttons render and their click handlers run without console noise. |

Additions should extend both this table and `tools/boot_smoke_test.mjs` so CI knows what changed.

## Warn cap & allowlists

- Console warnings are tracked just like errors. The harness now fails the run when more than **five** warnings fall outside the allowlist. Allowlisted warnings are downgraded to `console.info` entries so they do not exhaust the budget.
- `/__log` fallback tolerance is still **one** extra info/warn line; exceeding it triggers `/__log fallback emitted noisy logs`.
- `IGNORE_404` only exempts `favicon.ico`, source maps, and `/__log`. Everything else (4xx/5xx responses, fetch failures) is fatal.
- Keep new diagnostics behind `once()` or SAFE-mode guards so the warn budget stays quiet.

## Debug helpers

Use these snippets in the browser console while debugging locally:

```js
// Trigger a toast using the same hook the smoke test listens for
window.dispatchEvent(new CustomEvent('ui:toast', {
  detail: { msg: 'Local toast check', level: 'info' }
}));

// Mirror the boot contract for selection counts
window.__SEL_COUNT__ = (window.SelectionService?.count?.() ?? 0) | 0;
```

If the canary still fails, print the capability flags with `console.log(window.__CAPS__)` and watch for missing HARD prerequisites.
