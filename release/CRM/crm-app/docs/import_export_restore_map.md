# Import, Export, and Restore Map

## Data stores (IndexedDB)
- **contacts** — keyPath `id`.
- **partners** — keyPath `id`.
- **tasks** — keyPath `id`.
- **documents** — keyPath `id`.
- **commissions** — keyPath `id`.
- **notifications** — keyPath `id`.
- **closings** — keyPath `id`.
- **settings** — keyPath `id` (used for preferences/config).
- **templates** — keyPath `id`.
- **meta** — keyPath `id` (stores housekeeping like backups).
- **docs** — keyPath `id` (document metadata/supporting data).
- **deals** — keyPath `id`.
- **events** — keyPath `id`.
- **savedViews** — keyPath `id`.
- **relationships** — keyPath `id` with indexes `by_fromId`, `by_toId`, and unique `by_edgeKey`.

## Export/Import options
- **Workspace JSON export** (`#btn-export-json` in `js/app.js`)
  - Uses `dbExportAll()` to dump every store listed above, including pending/deleted rows. Also embeds selected `localStorage` keys: `dashboard:config:v1`, `dash:layoutMode:v1`, and `crm:homeView` when present.
  - Symmetric restore via `handleWorkspaceImport(mode)` + `dbRestoreAll(...)` (merge or replace). Restores the same stores, replays embedded `localStorage` keys, dispatches `app:data:changed`, and schedules a repaint.
- **Snapshot JSON export** (`js/snapshot.js`)
  - Exports `{ contacts, partners, events, documents }` only.
  - Restore writes those four stores via `window.db.put`, without clearing other stores or touching `localStorage`.
- **Calendar CSV/ICS export** (`js/calendar_actions.js`)
  - CSV columns: Date, Type, Title, Details, Loan, Status, Source. ICS uses the same event payload to build `VEVENT` entries (with timezone note) and download.
  - No matching import; one-way export only.
- **ICS export (general calendar)** (`js/ical.js`)
  - Builds ICS from `buildEvents()` and downloads `crm-export.ics`; no import path.
- **Table/Workbench CSV exports** (`js/table/table_export.js`, `js/pages/workbench.js`)
  - Export visible HTML table rows/columns (current view/sort). No structured import path beyond the main CSV importer for contacts/partners.
- **CSV importer** (`js/importer.js` plus helpers)
  - Supports contacts and partners with templates/aliases; not symmetric with calendar CSV/ICS or snapshot exports.

## Backup/Restore coverage
- **Workspace backup/import (JSON)**
  - Restores all IndexedDB stores; merge keeps existing rows, replace clears before writing. Also restores selected dashboard/lab layout keys from `localStorage`.
  - Auto-backup on `beforeunload` stores `{ id: 'lastBackup', at, snapshot }` in the `meta` store when toggled.
- **Snapshot restore (`js/snapshot.js`)**
  - Restores only contacts, partners, events, documents; does not clear stores, refresh UI, or restore settings/localStorage.
- **CSV/ICS exports**
  - One-way; no restore.

## Truth Table (export → wipe → restore)
- **Workspace JSON export/import**: after wipe, restoring should repopulate all stores (contacts/partners/tasks/etc.), restore dashboard layout/home view keys, and repaint dashboard/workbench/list views.
- **Snapshot JSON (js/snapshot.js)**: after wipe, restore will only bring back contacts/partners/events/documents. Tasks, settings, layouts, saved views, notifications, and relationships remain empty; UI refresh relies on downstream listeners.
- **Calendar CSV/ICS**: after wipe, no restore path; exports remain archival only.
- **Table/Workbench CSV**: export only; use main CSV importer for contacts/partners if re-importing with matching headers.

## Recommendations (minimal, low-risk)
- Prefer Workspace JSON for full backups because it includes every store plus layout keys; document that calendar/task/status data will not return from the lightweight Snapshot export.
- If Snapshot restore is used, trigger a lightweight repaint and explicitly note that settings/layouts are excluded to avoid confusion.
- Keep the calendar CSV/ICS exports as-is (one-way) to avoid breaking existing downloads; add import only if a matching dataset and UI hook appear.
