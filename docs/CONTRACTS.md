# Boot Contracts

Boot contracts keep the loader deterministic. They expose tiny, idempotent readiness probes so the boot hardener can promote each
phase from HARD → SOFT without racing the DOM or leaking errors to the console.

## Stable boot rule (HARD vs. SOFT)

1. **Module import** – all entries listed in `ensureCoreThenPatches` are imported as ES modules. Top-level code must be side-effect
   free: no DOM reads, no timers, no storage access.
2. **HARD prerequisites** – executed immediately after the modules load and before the diagnostics overlay can hide. A failing HARD
   probe must log a single `console.error` describing the missing capability; the boot flow halts and the overlay stays visible.
3. **DOM ready + services** – once `DOMContentLoaded` fires, core services finish their `__WHEN_SERVICES_READY` hooks.
4. **SOFT prerequisites** – executed only after the overlay hides. SOFT probes return `false` while a feature warms up but must never
   throw. They may emit a one-time `console.info` during warm-up, but must go quiet once the feature is ready.
5. **Patches** – optional modules load after SOFT probes schedule, unless Safe Mode disables them. Never promote a PATCH into CORE
   without a dedicated readiness shim.

The diagnostics overlay hides exactly once the HARD phase succeeds. A `[PERF] overlay hidden in <ms>` info log captures that moment
so the smoke test can assert the boot budget without relying on timers.

## Console discipline

- `console.error` is reserved for module import failures and HARD prerequisite failures. Anything else is a regression.
- SOFT probes may at most log a **single** `console.warn` when a capability is truly optional; otherwise prefer `console.info` or no
  logging at all.
- Logging to `/__log` now degrades gracefully: if the endpoint is unreachable the loader prints one `[BOOT] log fallback active …`
  info line and continues without emitting errors.
- Zero steady-state errors are mandatory. The boot smoke test fails on any console error emitted from page load through tab
  navigation and the feature canaries.

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
