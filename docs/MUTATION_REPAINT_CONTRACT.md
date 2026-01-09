# Mutation → Repaint Contract

**Version:** 1.0  
**Status:** Audit Complete (Jan 2026)  
**Canonical Signal:** `app:data:changed`

## 1. The Core Contract
THE CRM Tool relies on a **"Signal-Driven Repaint"** architecture.
1.  **Data Persistence:** Data is written to IndexedDB (via `db.js` helpers).
2.  **Signal Emission:** The *writer* of the data MUST explicitly dispatch `app:data:changed` after the `await`.
3.  **Repaint:** The UI listens for `app:data:changed` and triggers a repaint (often coalesced by `RenderGuard`).

> [!IMPORTANT]
> **Core Rule:** `dbPut`, `dbBulkPut`, and `dbDelete` in `db.js` **DO NOT** emit signals. Using them directly without dispatching `app:data:changed` will cause "ghost writes" (data saved but UI stale).

## 2. Canonical Signal
The signal is a CustomEvent named `app:data:changed`.

**Dispatch Mechanism:**
```javascript
const payload = {
  scope: 'contacts',    // 'contacts' | 'partners' | 'tasks' | 'pipeline'
  action: 'update',     // 'create' | 'update' | 'delete' | 'merge'
  id: 'record-id',      // Optional: ID of the record changed
  source: 'component',  // Debug purposes: 'contact-modal', 'importer', etc.
};

if (typeof window.dispatchAppDataChanged === 'function') {
  window.dispatchAppDataChanged(payload);
} else {
  // Fallback
  document.dispatchEvent(new CustomEvent('app:data:changed', { detail: payload }));
}
```

**Listeners:**
Key views (Dashboard, Kanban, Grid) listen to this event.
*   **Example:** `dashboard/index.js` subscribes and calls `renderDashboard()`.
*   **Example:** `partners_detail.js` subscribes and reloads reference tables.

## 3. Audited Mutation Paths
The following paths have been audited and confirmed to adhere to the contract.

| Feature | File / Component | Persistence | Emits Signal? | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Contacts** | | | | |
| Editor Save | `js/contacts.js` (`handleSave`) | `dbPut` | ✅ Yes | Dispatches in `finally` or success block. |
| Import | `js/importer.js` | `dbBulkPut` | ✅ Yes | Uses `emitImportChanged` helper. |
| Soft Delete | `js/services/softDelete.js` | `dbPut` | ✅ Yes | Emits after `markPending` or `finalize`. |
| Merge | `js/contacts_merge_orchestrator.js` | `dbPut`/`dbDelete` | ✅ Yes | Emits after transaction completes. |
| **Partners** | | | | |
| Editor Save | `js/ui/partner_edit_modal.js` | `dbPut` | ✅ Yes | Dispatches `scope: 'partners'`. |
| Import | `js/importer.js` | `dbBulkPut` | ✅ Yes | Uses `emitImportChanged`. |
| Merge | `js/partners_merge_orchestrator.js` | `dbPut`/`dbDelete` | ✅ Yes | Emits `scope: 'partners'`. |
| **Tasks** | | | | |
| Create/Update | `js/tasks/api.js` | `dbPut` | ✅ Yes | `dispatchTaskCreated` / `Updated`. |
| Bulk Follow-Up | `js/patch_20250926_ctc_actionbar.js` | `dbBulkPut` | ✅ Yes | Action bar handles dispatch. |
| Automation | `js/patch_2025-09-27_masterfix.js` | `dbPut` | ✅ Yes | `createTask` emits signal. |
| **Action Bar** | | | | |
| Bulk Delete | `js/patch_20250926_ctc_actionbar.js` | `softDeleteMany` | ✅ Yes | Relies on `softDelete` service emitting. |
| Pipeline Convert | `js/patch_2025-09-27_masterfix.js` | `dbPut` | ✅ Yes | `convertLongShotToPipeline` emits. |

## 4. Known Gotchas & Gaps
1.  **Direct DB Usage:** Any new code using `dbPut` directly must manually emit the signal.
2.  **Action Bar Delete Fallback:** In `patch_20250926_ctc_actionbar.js`, the `deleteSelection` function has a fallback to `window.dbDelete` (lines 1550+). This specific fallback path **does not** currently emit a signal. It is a rare edge case (only if `softDelete` service is missing), but technically violates the contract.
3.  **RenderGuard Ordering:** `dispatchAppDataChanged` is patched in `patch_2025-09-27_masterfix.js` to defer dispatch if a render is currently active (`RenderGuard.isRendering()`). This prevents "render loops" but means signals are async. Tests must invoke `await tick()` or `waitFor` logic.

## 5. Verification
To verify a new mutation path:
1.  **Manual:** Open the browser console, `monitorEvents(document, 'app:data:changed')`. Perform action. Ensure event fires.
2.  **Automated:** Spy on `dispatchAppDataChanged` or the document event listener in tests.

---
**Standard:** All future mutations MUST follow this pattern. No "magic" auto-updating stores; explicit signals only.
