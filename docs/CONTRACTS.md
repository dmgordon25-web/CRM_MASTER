# Boot Contracts

Boot contracts keep the loader deterministic: they expose small, idempotent readiness probes so the boot hardener can decide whether to continue without ever touching the DOM at import time.

## HARD vs. SOFT readiness and timing

- Contract modules are imported **before** the DOM is guaranteed to exist. Never access `document` or other DOM APIs at the top level — the contract linter blocks it in CI.
- **HARD prerequisites** run immediately after import. They gate execution and should only fail when the application genuinely cannot continue. A failing HARD probe must emit a `console.error` that explains the missing requirement; the loader will stop booting.
- **SOFT prerequisites** run after core modules finish loading and service waiters resolve. They are diagnostic only: they must be safe to call repeatedly, must not throw, and must never block boot. During warm-up a SOFT probe may log a single `console.info` tagged `(expected during cold start)` but it must go quiet automatically once the feature reports ready.

## Zero-error steady state

Production boot is silent by default:

- `console.error` is reserved for module import failures and HARD prerequisite failures.
- SOFT probes must not emit `console.warn` in steady state. Any informational logging should be one-time `console.info` while warming up, and it must stop once ready signals flip positive.
- Keep optional features quiet as well: if a capability is expected to be missing in production, guard it with `capability()` and return `false` without logging.

Run `npm run verify:build` locally before sending changes. The manifest audit, contract linter, and boot smoke test enforce these guardrails in CI.

## Adding a SOFT probe with `probe_utils`

Use the helpers in `crm-app/js/boot/contracts/probe_utils.js` to keep probes copy-pasteable:

```js
import { capability, once, safe } from './probe_utils.js';

const featureReady = capability('Namespace.feature');
const featureWarming = once('feature:warming', 'info');

const featureProbe = safe(() => {
  const ready = featureReady();
  if (!ready) {
    featureWarming('[BOOT] feature warming up (expected during cold start)');
  }
  return ready;
});

SOFT_PREREQS['feature ready'] = featureProbe;
```

Key reminders:

- Call `capability()` to guard every global lookup.
- Wrap the work in `safe()` so unexpected errors collapse to `false` instead of throwing.
- Use `once(tag)` for any cold-start logging so it only fires during the warm-up window.
- Avoid timers or polling to “wait” for readiness — rely on real flags/events and return `false` until they report success.
