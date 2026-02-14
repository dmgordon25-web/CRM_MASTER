# Workspace Data Inventory

This document serves as the authoritative inventory of all data persisted by "THE CRM Tool". It maps data domains to their storage locations (IndexedDB vs. LocalStorage), confirms their inclusion in the `dbExportAll` backup routine, and notes any data loss risks during a wipe/restore cycle.

## Inventory Table

| Data Domain | Storage Location | Exported? | Imported? | Restore Wipe Covers It? | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Contacts** | IDB: `contacts` | ✅ Yes | ✅ Yes | ✅ Yes | Core business data. |
| **Partners** | IDB: `partners` | ✅ Yes | ✅ Yes | ✅ Yes | Core business data. |
| **Tasks** | IDB: `tasks` | ✅ Yes | ✅ Yes | ✅ Yes | Core business data. |
| **Documents** | IDB: `documents` | ✅ Yes | ✅ Yes | ✅ Yes | Metadata for DocCenter. |
| **Deals / Pipeline** | IDB: `deals` | ✅ Yes | ✅ Yes | ✅ Yes | Opportunity tracking. |
| **Commissions** | IDB: `commissions` | ✅ Yes | ✅ Yes | ✅ Yes | Financial data. |
| **Relationships** | IDB: `relationships` | ✅ Yes | ✅ Yes | ✅ Yes | Partner-Contact edges. |
| **Notes / Docs / Meta** | IDB: `docs`, `meta` | ✅ Yes | ✅ Yes | ✅ Yes | Miscellaneous blobs. |
| **User Profile** | IDB: `settings` (key: `loProfile`) | ✅ Yes | ✅ Yes | ✅ Yes | `localStorage` (`profile:v1`) acts as a cache. |
| **Email Signature** | IDB: `settings` (key: `signature`) | ✅ Yes | ✅ Yes | ✅ Yes | `localStorage` (`signature:v1`) acts as a cache. |
| **UI Mode** | IDB: `settings` (key: `uiMode`) | ✅ Yes | ✅ Yes | ✅ Yes | Simple vs. Advanced mode. `localStorage` (`crm:uiMode`) acts as a cache. |
| **Dash Config** | IDB: `settings` (key: `dashboard`) | ✅ Yes | ✅ Yes | ✅ Yes | Widget visibility & order. `localStorage` (`dashboard:config:v1`) acts as a cache. |
| **Notifications** | IDB: `notifications` | ✅ Yes | ✅ Yes | ✅ Yes | `localStorage` (`notifications:queue`) acts as a cache. |
| **Calendar Legend** | **LocalStorage ONLY** | ✅ Yes | ✅ Yes | ✅ Yes | Key: `calendar:legend:visibility`. Preserved by `dbExportAll`/`dbRestoreAll`. |
| **App Theme** | **LocalStorage ONLY** | ✅ Yes | ✅ Yes | ✅ Yes | Key: `crm:theme`. Preserved by `dbExportAll`/`dbRestoreAll`. |
| **Dash Edit Mode** | **LocalStorage ONLY** | ❌ No | ❌ No | ❌ No | Key: `dash:layoutMode:v1`. Transient UI state (Edit vs View). Acceptable loss. |

## Storage Details

### IndexedDB (`crm` database)
The following stores are included in `dbExportAll` and `dbRestoreAll`:
*   `contacts`
*   `partners`
*   `tasks`
*   `documents`
*   `commissions`
*   `notifications`
*   `closings`
*   `settings` (Critical for preferences)
*   `templates`
*   `meta`
*   `docs`
*   `deals`
*   `events`
*   `savedViews`
*   `relationships`

### LocalStorage Keys
These keys are primarily used for caching or transient state.
*   `profile:v1` (Cache for `settings.loProfile`)
*   `signature:v1` (Cache for `settings.signature`)
*   `crm:uiMode` (Cache for `settings.uiMode`)
*   `crm:theme` (**Primary storage for Theme; exported/imported**)
*   `calendar:legend:visibility` (**Primary storage for Calendar Filters; exported/imported**)
*   `dashboard:config:v1`, `crm:dashboard:widget-order`, `dash:layout:hidden:v1` (Caches/fallbacks for Dashboard state)
*   `notifications:queue` (Cache for Notifications)

## Missing Data / Risks
Theme and Calendar Legend visibility are now included in workspace snapshots. Remaining LocalStorage-only transient keys (for example, dashboard edit/view mode) are still intentionally excluded and may reset after a wipe.
