# Boot Contracts

Boot contracts keep the loader deterministic. They expose tiny, idempotent readiness probes so the boot hardener can promote each phase from HARD → SOFT without racing the DOM or leaking errors to the console.

## Stable boot rule (HARD vs. SOFT)

1. **Module import** – all entries listed in `ensureCoreThenPatches` are imported as ES modules. Top-level code must be side-effect free: no DOM reads, no timers, no storage access.
2. **HARD prerequisites** – executed immediately after the modules load and before the diagnostics overlay can hide. A failing HARD probe must log a single `console.error` describing the missing capability; the boot flow halts and the overlay stays visible.
3. **DOM ready + services** – once `DOMContentLoaded` fires, core services finish their `__WHEN_SERVICES_READY` hooks.
4. **SOFT prerequisites** – executed only after the overlay hides. SOFT probes return `false` while a feature warms up but must never throw. They may emit a one-time `console.info` during warm-up, but must go quiet once the feature is ready.
5. **Patches** – optional modules load after SOFT probes schedule, unless Safe Mode disables them. Never promote a PATCH into CORE without a dedicated readiness shim.

### HARD vs SOFT in practice

- **HARD** checks guard the boot overlay: every failure keeps the diagnostics curtain visible and aborts navigation. HARD probes can only emit a single `[BOOT] HARD failed: …` error before the loader stops.
- **SOFT** checks light up telemetry without blocking boot. They may return `false` until a feature is usable, but must stay silent and deterministic while warming up. SOFT probes update the capability registry so downstream patches can no-op safely.
- The `crm-app/js/core/capabilities_probe.js` shim snapshots both phases into `window.__CAPS__`, exposing booleans such as `toast`, `confirm`, `renderAll`, and `selection`. The smoke suite flips routes and asserts that these flags stay truthful across view changes.

The diagnostics overlay hides exactly once the HARD phase succeeds. A `[PERF] overlay hidden in <ms>` info log captures that moment so the smoke test can assert the boot budget without relying on timers.

## HARD prerequisite checklist

All HARD probes must finish before the overlay hides:

- **Boot loader online** – `boot_hardener` confirms the diagnostics overlay mounts and can show error text.
- **DOM root present** – `#crm-root` exists and `renderAll()` can bind initial views without retry loops.
- **Database open** – IndexedDB bootstrap resolves and exposes the `db.open()` promise used by data stores.
- **Selection service** – `Selection.ready()` resolves and exposes `__SEL_COUNT__` for diagnostics.
- **Renderer** – `renderAll` is callable and idempotent across SAFE/Core boot.
- **Toast/Confirm helpers** – `ui:toast` and `ui:confirm` hooks return callable functions (even if SAFE mode later suppresses patches).

If any HARD probe fails, emit one structured `console.error('[BOOT] HARD failed: <capability>')` and abort boot.

## SAFE mode expectations

- Activate with `?safe=1` or `window.__SAFE_MODE__ = true` before boot.
- Loader still imports CORE modules, mounts diagnostics overlay, and runs all HARD probes.
- Patches, experimental panels, and manifest entries flagged `safe:false` are skipped; capability canaries downgrade to read-only checks.
- SAFE mode never bypasses HARD prerequisites or hides capability gaps—it prevents optional features from executing while keeping boot deterministic.

## Capability canaries

Each SOFT probe pairs with a capability canary exercised by the smoke suite:

- **Toast & Confirm** – call the hooks and resolve a confirm promise without user input.
- **Selection counter** – read `window.__SEL_COUNT__` and assert DOM badges update after simulated selections.
- **Kanban handlers** – drag/drop handlers attach without throwing when the board mounts.
- **Merge dialog** – open/close workflow validates modal wiring and service subscriptions.
- **Navigation shell** – route transitions (`Dashboard → Leads → Pipeline → Partners`) stay error-free.
- **Calendar bridge** – ensures event hydration and timezone formatting succeed.
- **Capability registry** – `window.__CAPS__` flips `toast`, `confirm`, `renderAll`, and `selection` booleans as routes change so diagnostics can assert parity between HARD/SOFT promotions.

Adding a new canary? Document its selector or hook here and extend `tools/boot_smoke_test.mjs`.

## Gating policy

- **Zero console errors** outside module import/HARD prerequisite failures. Any other `console.error` is a release blocker.
- **Manifest discipline** – every script in `/crm-app/js` and `/crm-app/js/patches` appears exactly once in the loader manifest; SAFE-only entries set `safe:false` explicitly.
- **Capability gaps gate CI** – smoke canaries fail fast when a capability hook throws, returns the wrong shape, logs unexpected errors, or trips the console warn cap. CI surfaces the first failure and the PR must fix or extend the contract before merge.

## Console discipline

- `console.error` is reserved for module import failures and HARD prerequisite failures. Anything else is a regression.
- SOFT probes may at most log a **single** `console.warn` when a capability is truly optional; otherwise prefer `console.info` or no logging at all.
- Logging to `/__log` now degrades gracefully: if the endpoint is unreachable the loader prints one `[BOOT] log fallback active …` info line and continues without emitting errors.
- Zero steady-state errors are mandatory. The boot smoke test fails on any console error emitted from page load through tab navigation and the feature canaries.

## Probing with `probe_utils`

Use `crm-app/js/boot/contracts/probe_utils.js` to build safe probes:

```js
import { capability, once, safe } from './probe_utils.js';

const toastReady = capability('Toast.show');
const warmupNote = once('toast:warming', 'info');

const toastProbe = safe(() => {
  const ready = !!toastReady();
  if (!ready) warmupNote('[BOOT] Toast warming up (expected during cold start)');
  return ready;
});

SOFT_PREREQS['toast ready'] = toastProbe;
```

Guidelines:

- Wrap every global lookup with `capability()` and every body with `safe()` so unexpected throws collapse to `false`.
- Prefer derived state over timers or polling; return `false` until real readiness flags flip.
- Keep probes idempotent—no DOM writes, no storage mutations, no network calls.
- Touch the DOM only inside guarded helpers that run **after** the boot hardener confirms the overlay is hidden.

## Change checklist

- Run `npm run verify:build` (manifest audit → contract linter → boot smoke test) before sending a PR.
- Document new HARD or SOFT rules in this file and in `docs/CHANGELOG_POLICY.md` so downstream teams know what changed.
- If a probe introduces a temporary warm-up log, gate it with `once()` and remove it once the feature stabilises.
