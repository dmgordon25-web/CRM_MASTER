# Stabilization Exit Checklist

**Status:** BOOT OK, CI green.

## Completed in this phase
- Manifest ↔ canonical order aligned for 2025-09-27 patches.
- Action bar: visible at boot; centered layout (CSS-only).
- Partner Edit: singleton modal; idempotent open/close.
- Telemetry: deferred to idle; safe `sendBeacon` guard; zero-error compliant.
- Overlay discipline: hide after HARD prereqs + first paint; idempotent.
- Table row checks: visible/clickable at boot (CSS-only).
- Merge modal: visible/z-index; confirm control clickable (CSS-only).
- Merge modal lifecycle: singleton + minimal focus trap + focus restore.
- Honest `data-visible` lifecycle for action bar & merge modal.
- Logging normalized to zero-error policy (demoted non-HARD/import errors).

## Exit criteria (must remain true)
- `npm run verify:build` green twice consecutively in CI on `main` after merge.
- No `console.error` during happy-path boot except import/HARD prereq failures.
- Server log signature preserved exactly:
  `[SERVER] listening on http://127.0.0.1:8080/ (root: <path>)`
- Windows launcher: double-click starts Node `tools/dev_server.mjs`, opens app, launcher exits cleanly.
- Manifest audit: no order drift; canonical and live manifest remain in lockstep.

## Out of scope / follow-ups (track separately)
- UX polish beyond visibility/layout already landed.
- Any dependency updates or framework changes.
- New tests or selector changes (guardrails remain frozen).

## Rollback plan
- Each change landed as a tiny PR; revert by PR if any regression is reported.
- If boot regresses, re-run `verify:build`, restore last known-good commit, and re-apply patches one-by-one.

_Last updated: 2025-10-16_
