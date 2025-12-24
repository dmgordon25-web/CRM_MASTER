# AGENTS.md — THE CRM Tool Guardrails (Read First)

This repo is a fragile, demo-critical, offline-first SPA. Treat it like a production aircraft.

## Non-negotiables
- Do not stop until **real UI acceptance criteria** are met (not just tests).
- Do **not** weaken, skip, or rewrite tests to “make them pass.”
- No new global document/window listeners (capture or bubble).
- No refactors “for clarity.” Minimal, surgical diffs only.
- Prefer diagnosis + proof over code churn.

## Change rules
- If a fix adds > 50 LOC, justify each block or delete the bloat.
- Remove any scaffolding/debug/selftest code once root cause is fixed.
- Debug logging is allowed only if **gated** behind `window.__DBG_CLICK === true` (default OFF).

## Verification requirements (must include in PR)
- “Manual Proof” section with exact steps + expected results.
- Mention files changed and why.
- Confirm no regressions in:
  - App boot
  - Navigation
  - New+ behavior
  - Editor open/close lifecycle

## UI acceptance criteria format
State explicit, testable criteria like:
- “From Dashboard widget X, clicking row opens the correct editor every time (repeat 5x), save persists, close works, and navigation still works.”
