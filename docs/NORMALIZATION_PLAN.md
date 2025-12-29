# Status Normalization Plan

## Goal
Ensure all Contact records stored in the database conform to the Canonical Schema defined in `STATUS_TAXONOMY.md`, ensuring consistent reporting and behavior.

## 1. Read-Time Normalization (Already Implemented)
The application currently employs a robust "Read-Time" normalization strategy in `js/pipeline/constants.js`.
*   **Mechanism**: When a record is loaded or a label is displayed, `normalizeStage(value)` and `normalizeStatus(value)` are called.
*   **Effect**: "Lead" becomes `long-shot`, "CTC" becomes `cleared-to-close`.
*   **Action**: Continue this pattern. No immediate database migration is required for basic functionality.

## 2. Write-Time Enforcement (Proposed)
To gradually clean the dataset, we should enforce normalization *on save*.

*   **Trigger**: `dbPut('contacts', ...)` or `Contacts.save(...)`
*   **Logic**:
    ```javascript
    record.stage = canonicalStageKey(record.stage); // 'Lead' -> 'long-shot'
    record.status = canonicalStatusKey(record.status); // 'In Progress' -> 'inprogress'
    ```
*   **Benefit**: Over time, the database converges to the canonical format without a heavy "stop-the-world" migration.

## 3. Data Migration (Optional / Future)
If reporting performance degrades or direct DB queries (outside the app) are needed, a one-time migration script can be run.

**Script Scope:**
1.  Iterate all `contacts` in IndexedDB.
2.  Check if `stage` or `status` differs from its `canonical` form.
3.  Update and Save if changed.

**Risk**: Low, but unnecessary for the current client-side architecture.

## 4. Import Hardening
Ensure the CSV Importer (`importer.js`) explicitly runs `normalizeStage` and `normalizeStatus` on incoming data columns *before* creating the record draft.
*   **Current State**: Verified `importer.js` does mapping, but should be audited to ensure it uses the *latest* `pipeline/constants.js` aliases.

## 5. Summary
*   **Immediate**: Enable Write-Time Enforcement in the Contact Editor save handler.
*   **deferred**: Batch Data Migration.
