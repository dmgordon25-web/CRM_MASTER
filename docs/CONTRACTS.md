# Boot Contracts

Boot contracts protect the application boot sequence. Each contract exposes HARD and SOFT readiness probes so the loader can make safe decisions without touching the DOM at import time.

## HARD vs. SOFT readiness

- **HARD prerequisites** must pass before execution continues. Failing a HARD probe blocks boot and should emit a `console.error` explaining the missing requirement.
- **SOFT prerequisites** are best-effort diagnostics. They should never block boot, but they give engineers a fast signal when a feature is offline. SOFT probes must be safe to run repeatedly and must not touch the DOM or throw.
- Keep HARD probes as small as possible. If a SOFT probe becomes critical, promote it intentionally in a follow-up rather than expanding the HARD list in place.

## Zero-error steady state

Production boot must be quiet: no `console.error` output unless a manifest-declared module fails to import or a HARD prerequisite fails. Prefer `console.info` for expected gaps in production (for example, optional helpers that are disabled) and reserve `console.warn` for anomalous behaviour that still lets boot continue.

## Adding a SOFT probe

Use the helpers in `crm-app/js/boot/contracts/probe_utils.js` so new probes are copy-pasteable and idempotent. The pattern is always the same:

```js
const featureCapability = capability('Namespace.feature');
const featureProbe = safe(() => featureCapability());
SOFT_PREREQS['feature ready'] = featureProbe;
```

Add any cold-start logging with `once(tag)` so it only fires during the first failing check, and make sure probes guard every global access. Run `npm run verify:build` after wiring a new probe and confirm the boot smoke test stays green with zero console errors.
