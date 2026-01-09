# Notifications Storage Decision

**Decision**: Option A (Pragmatic / LocalStorage)

## Context
The CRM currently uses `localStorage` (`notifications:queue`) for the Notifier, while `IndexedDB` (`notifications` store) exists but is unused. Workspace Backup/Restore relies on `IndexedDB`.
This disconnect causes notifications to be lost during Workspace Restore.

## Decision
We choose **LocalStorage** as the single source of truth for runtime notifications to avoid high-complexity refactors of the synchronous `Notifier` module.

To support Restore:
1.  **Export**: `dbExportAll` will be patched to read from `localStorage` (`notifications:queue`) when exporting the `notifications` key.
2.  **Restore**: `dbRestoreAll` will be patched to write incoming `notifications` data back to `localStorage` (`notifications:queue`).

## Truth Definition
*   **Runtime**: `localStorage` (`notifications:queue`)
*   **Backup**: JSON Snapshot (sourced from `localStorage`)
*   **IndexedDB**: `notifications` store remains defined but unused (can be deprecated later).

## Verification
*   Tests must ensure that `notifications` survive an Export -> Wipe -> Import cycle.
