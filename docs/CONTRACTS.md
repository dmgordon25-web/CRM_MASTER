# Boot Contracts Quick Reference

## HARD vs. SOFT Prerequisites
- **HARD** probes gate boot. A failure emits `console.error`, stops the phase, and surfaces in Safe Mode.
- **SOFT** probes observe best-effort integrations. They should never crash boot; failures emit at most a single `console.warn` during investigation.
- Keep SOFT probes quiet in steady state. A passing system produces no recurring console output.

## Adding a Feature Probe
```js
import { safe, capability } from './probe_utils.js';

const featureProbe = safe(() => {
  if (!capability('CRM.modules.feature')()) return false;
  // Optional: inspect the live object for required methods.
  return typeof window.CRM.modules.feature.start === 'function';
});

export const SOFT_PREREQS = {
  ...SOFT_PREREQS,
  'feature ready': featureProbe,
};
```
- Use `safe(fn)` to wrap DOM or global access.
- Use `capability('window.Path.to.thing')` to check for globals without sprinkling `try/catch`.
- Reach for `once(tag)` when a probe needs a one-time info log (`console.warn` only for genuine anomalies).

## Zero `console.error` Policy
- Contract modules must stay free of `console.error`; the linter in `npm run verify:build` enforces this.
- Run `npm run verify:build` locally. It runs the manifest audit, contract linter, and the boot smoke test so you can catch regressions before pushing.
