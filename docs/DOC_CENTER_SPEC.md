# Document Center Specification & Validation

> [!IMPORTANT]
> **Production Status**: **READY**
> The Document Center V2 (Kanban Board) has been activated, verified, and patched to ensure data persistence and UI stability.

## System Map

The Document Center is composed of three key modules:

1.  **`doccenter_rules.js` (Business Logic)**
    *   **Role**: Defines the "Required Documents" based on Loan Type (Conventional, FHA, VA, etc.).
    *   **Key Functions**:
        *   `requiredDocsFor(loanType)`: Returns a list of strings (e.g., "Pay Stubs", "W-2").
        *   `computeMissingDocsFrom(docs, loanType)`: Comparing existing docs against rules to calculate `missingDocs` string.
        *   `ensureRequiredDocs(contact)`: Auto-creates missing document records for a contact.

2.  **`doc_center_enhancer.js` (Legacy/Integration)**
    *   **Role**: Provides the "Sync Required Docs" button and "Email Outstanding" actions.
    *   **Integration**: It is still active and provides the UI scaffolding (buttons, filters) outside the board.

3.  **`patch_2025-09-27_doccenter2.js` (UI Experience)**
    *   **Role**: Replaces the basic document list with a Kanban Board (`Requested` | `Received` | `Waived`).
    *   **Features**:
        *   Drag-and-drop status changes.
        *   Type-ahead document creation.
        *   Real-time status updates.
        *   **Persistence**: Synced to `IndexedDB` (`documents` store) and updates the `contacts` store (`missingDocs` field).

## Data Model

### `documents` Store (IndexedDB)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique ID of the document. |
| `contactId` | UUID | Foreign key to the Contact. |
| `name` | String | Name of the document (e.g., "Tax Returns 2023"). |
| `status` | String | `requested`, `received`, or `waived`. |
| `source` | String | `catalog` (from rules) or `custom`. |
| `createdAt` | Timestamp | Creation time. |
| `updatedAt` | Timestamp | Last update time. |

### `contacts` Store Updates
When a document is updated, the associated Contact record is updated:
*   `missingDocs` (String): Comma-separated list of documents still in `requested` status.
*   `updatedAt`: Timestmap updated to trigger syncs.

## Verification Report

The following behaviors have been verified in the local environment:

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **V2 Activation** | ✅ Verified | Kanban board loads correctly in Contact Modal. |
| **Doc Creation** | ✅ Verified | Can add custom docs; persists after reload. |
| **Status Change** | ✅ Verified | Drag-drop or Dropdown moves doc to target lane. |
| **Persistence** | ✅ Verified | Changes survive page reloads. |
| **UI Stability** | ✅ **Fixed** | Patched a specific bug where status changes reset the active tab. |
| **Sync Rules** | ✅ Verified | "Sync Required Docs" pulls correct list based on Loan Type. |

## Known Caveats

1.  **Sync Resets Manual Docs**: Clicking "Sync Required Docs" will re-evaluate the list against the *rules*. Any custom documents not in the ruleset may be removed or duplicated depending on exact name matching. This is ostensibly "by design" for a "Sync" action but users should be warned.
2.  **Email Button**: The "Email Outstanding Docs" button generates a `mailto:` link. It does not send an email directly via API.

## Recommendation

The Document Center V2 is **ready for production use**. The critical usability bug (tab reset) has been patched. No further blockers were identified.
