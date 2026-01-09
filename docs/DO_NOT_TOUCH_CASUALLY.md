# Do Not Touch (Casually) Map

**Purpose:** This document aims to reduce regressions and avoid accidental blast radius by identifying high-risk areas and establishing strict rules of engagement.

## Rules of Engagement
- **Prefer wiring/contract fixes over layers:** Don't add abstraction layers to patch issues; fix the underlying wiring or contract.
- **Small PRs, one behavior theme per PR:** Keep changes focused and atomic. Avoid sprawling refactors.
- **Require smoke + relevant e2e:** Any change touching core flows *must* pass boot smoke and relevant E2E tests.

## High-Blast-Radius Areas

| Area | Why it's risky | Safe patterns for touching |
| :--- | :--- | :--- |
| `crm-app/js/app.js` | Controls boot sequencing, view lifecycle, and global repaint orchestration. | Only touch if fixing a boot race or global shell layout issue. Verify the entire lifecycle (load -> app -> navigation). |
| `crm-app/js/boot/*` | Defines boot contracts and splash screen sequencing. High risk of breaking app startup. | Treat as immutable unless explicitly optimizing boot time. Verify with `npm run test:boot`. |
| `crm-app/js/router/*`<br>Navigation Wiring | Handles URL routing and view mounting. Changes here can break back/forward navigation or deep linking. | Ensure all routes (legacy, dashboard, editors) still mount correctly and handle parameters. |
| `crm-app/js/ui/header_toolbar.js` | Manages "New+" menu and header bindings. Global visibility and action availability. | Verify "New+" menu opens/closes correctly and items trigger intended actions on all screens. |
| `crm-app/js/state/selectionStore.js` | Central contract for row selection. Breaks bulk actions if compromised. | **Do not change the contract.** Only fix specific bugs in selection logic. Verify with `contact_delete.spec.js`. |
| `crm-app/js/ui/action_bar.js`<br>`crm-app/js/state/actionBarGuards.js` | Controls visibility and enablement of the action bar. Complex dependency on selection state and route. | Ensure Action Bar appears/disappears correctly on selection changes. Verify guards don't block valid actions. |
| `dashboard/labs` widget drilldown | "Today's Work" and widget drilldowns often rely on specific editor open paths. | Verify clicking rows in widgets opens the *correct* editor and returns correctly on close. |
| IndexedDB schema/db wrappers<br>(`crm-app/js/db.js`) | Data persistence layer. Schema changes or wrapper bugs can cause data loss or corruption. | **Avoid schema changes.** If unavoidable, ensure potential migration is handled safe (or not needed). Verify read/write stability. |
| Import/Export/Restore paths | Workspace backup and restore functionality. Critical for data safety. | Verify a full export/wipe/restore cycle works perfectly. |
| Drag/Drop + Resizable Grid | High DOM churn risk. Can break layout stability or event listeners. | Test extensively with different data shapes and screen sizes. Watch for layout thrashing. |
| Notifications storage layer | `localStorage` vs `IDB` coherence. Risk of desync or dropped notifications. | Ensure notifications persist and mark-read status syncs correctly. |

## When you MUST touch these files
If you must modify the files above:
1.  **Do not assume it's safe.** Treat every line as load-bearing.
2.  **Preserve Invariants:** Identify the existing contracts (e.g., "SelectionStore always emits `change` on update") and ensure they hold true.
3.  **Run Targeted Tests:** Run specific unit and E2E tests related to the component *before* and *after* changes.
4.  **No "Never Modify" Rule:** These files are not frozen, but they require a higher standard of care and verification.

## Verification Checklist
- [ ] **Boot Smoke Passes:** App loads cleanly without console errors.
- [ ] **Selection + Action Bar Sanity Check:** Select rows, verify Action Bar appears, bulk actions work.
- [ ] **New+ Opens/Closes:** Header "New+" menu functions correctly.
- [ ] **Widget Drilldowns:** Clicking widget items opens the correct editor.
- [ ] **Save-then-Repaint:** content changes save and UI updates immediately.
- [ ] **Run Playwright Specs:** Run relevant specs (e.g., `contact_delete.spec.js`) and ensure the build passes.

## Common Regression Symptoms

| Symptom | Likely Culprit Area |
| :--- | :--- |
| Action Bar doesn't appear on select | `selectionStore.js` or `actionBarGuards.js` |
| App hangs at splash screen | `boot/*` or `app.js` (sequencing) |
| "New+" menu dead | `header_toolbar.js` |
| View doesn't update after Save | `app.js` (repaint listener) or DB wrapper |
| Widget click does nothing | Drilldown wiring / `router` |
| Data missing after reload | IndexedDB wrapper / Boot schema check |
