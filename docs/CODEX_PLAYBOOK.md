# Codex Playbook (Read First)

**Default mode:** IMPLEMENTER. Your job is to make minimal, surgical changes and keep the gate green after each step.

## Immutable guardrails
- **Boot discipline:** HARD → overlay hide → PATCHES → SOFT. Do **not** change boot_hardener, Safe Mode, /__log behavior, or PATCHES↔CORE boundaries.
- **Zero-Error policy:** Only import failures or true HARD prereq failures may log `console.error`. Everything else is `console.warn` or `console.info`.
- **Smoke test is off-limits:** Do **not** modify `tools/boot_smoke_test.mjs` unless explicitly asked; when editing, it must be **read-only** (you may synthesize `input`/`change` to simulate users, but do not set UI attributes used by assertions).
- **Selectors are stable:** Never rename or remove these without explicit approval:
  - Row checkbox: `[data-ui="row-check"]`
  - Action bar: `[data-ui="action-bar"]` with `data-visible="1|0"`
  - Merge action: `[data-action="merge"]`
  - Merge modal: `[data-ui="merge-modal"]` and `[data-ui="merge-confirm"]`
- **Dependencies & CI:** No new npm deps. No CI changes unless the failure is clearly infra (e.g., missing Chromium libs). Prefer adding steps to the workflow over altering app code.

## Working protocol
1) `npm ci || npm install`
2) `npm run verify:build`  
   - If red: **STOP.** Print the failing step name + first 150 lines. Do not stack changes.
3) Apply **one** task at a time (minimal diff).
4) `npm run verify:build` again.  
   - If green: commit with a concise, descriptive message.  
   - If red: revert the task’s changes and stop.

## UI & selection rules
- `window.__SEL_COUNT__` must reflect the count of selected rows.
- The action bar’s `data-visible` must reflect count>0; do not set it from tests or instrumentation.
- You may dispatch `input`/`change` on checkboxes in tests to simulate real users; do **not** mutate attributes the test asserts.

## Logging & noise
- Keep logs quiet. Convert benign `console.warn` to `info` sparingly.
- If adding diagnostics in tests, keep them short (one line JSON) and under failure-only blocks.

## PR hygiene
- Small, single-purpose commits.
- No “drive-by” refactors.
- Do not modify `tools/manifest_audit.js` or patch order unless explicitly asked to do a paired change (manifest + canonical list).

---

### Codex header to paste at the top of your future prompts
> **Before any action, read and strictly follow `docs/CODEX_PLAYBOOK.md`.** Work ONLY in this repo. Default to IMPLEMENTER mode. Keep the gate green after every step. Stop on red and print concise logs.
