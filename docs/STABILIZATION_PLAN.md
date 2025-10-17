# Stabilization Plan (Boring Patch Phase)

**Status:** BOOT OK (dev server path locked to Node `tools/dev_server.mjs`; CI signature preserved)  
**Discipline:** Tiny, reversible patches; run `npm run verify:build` after every change; stop on red.

## Current Signals (from `npm run verify:build`)
- Manifest audit: PASS (canonical vs live manifest alignment holds; duplicate/unreachable/order failures now hard-stop the gate).
- Boot smoke: PASS.
- Lint / type checks: Not run in gate (n/a).
- Notes: Zero-error policy enforced; diagnostics overlay hidden on happy path.

## Tiny PR Checklist (apply to every patch)
- ☑ Keep diffs surgical; no new deps; no test/selector edits.
- ☑ Preserve Windows launch → `tools/dev_server.mjs`; keep CI log signature exact.
- ☑ Simulate real user input; never set asserted attributes directly.
- ☑ Run `npm run verify:build`; commit only on green.

## Prioritized Roadmap & Acceptance
1) **Patch-Order Convergence (canonical ↔ live manifest)**
   - Problem: Canonical list in `tools/manifest_audit.js` diverges from `crm-app/js/boot/manifest.js` for the 2025-09-27 patch set.
   - Target order (feature → QA/Bundle → fixes → final prep):
     1. `phase6_polish_telemetry.js`
     2. `nth_bundle_and_qa.js`
     3. `masterfix.js`
     4. `release_prep.js`
   - Acceptance: `manifest_audit` passes; no boot regressions; smoke remains green.

2) **Action Bar Visibility Flake (non-merge actions)**
   - Symptom: `smoke:action-selector` `sel-count-timeout-1` for `[data-ui="action-bar"] [data-action]:not([data-action="merge"])`.
   - Hypothesis: Initial render gating (`data-visible`, layout/CSS) hides actions on first tick.
   - Strategy: CSS/layout-only first (no test edits); ensure at least one non-merge action renders and is visible by the time smoke queries.
   - Contract: Keep `data-visible` present with string values (`"true"`/`"false"`) and only flip to `"true"` when `(selectedCount > 0 && actionsReady === true)` with idempotent listener wiring and selection snapshot replay on subscribe.
   - Acceptance: Smoke passes with stable timing across two consecutive runs.

3) **Partner Edit Dual-Modal Bug (readiness)**
   - Scope: Ensure single modal lifecycle; no duplicate overlays; preserve focus trap.
   - Acceptance: Open/edit/close path leaves zero orphan overlays; smoke unaffected.

4) **Splash/Overlay Discipline**
   - Ensure overlay hide fires only after HARD prereqs satisfied; maintain zero-error policy.
   - Acceptance: No console.error except allowed cases; overlay never lingers on happy path.

5) **Telemetry/Perf Ping polish**
   - Keep `phase6_polish_telemetry.js` lightweight; defer heavy work; no impact on TTI.
   - Acceptance: Boot smoke + perf canaries unchanged.

## PR Sequence (suggested branches)
- `stabilize/manifest-order-2025-09-27`
- `fix/action-bar-visible-smoke`
- `bugfix/partner-edit-dual-modal`
- `polish/overlay-discipline`
- `polish/telemetry-perf-guardrails`

## Risks & Mitigations
- Order flips causing late import errors → Mitigate by one-at-a-time moves with immediate `verify:build`.
- CSS-only visibility fixes inadvertently affect layout → Guard with scoping and visual sanity check.
- Modal lifecycle races → Add defensive null checks; avoid global side effects.

## Acceptance to Exit Stabilization
- 100% green on `verify:build` across two consecutive CI runs.
- No boot regressions reported in manual smoke via Windows launcher.
- Canonical ↔ manifest order lock; documented in `tools/manifest_audit.js` comments.

