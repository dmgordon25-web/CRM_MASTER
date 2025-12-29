# Data Recovery Workflow

## 1. Backup
The CRM application supports a full data export which serves as a backup snapshot.

### Steps
1. Navigate to **Settings > Data Management** (or run `dbExportAll()` in console).
2. Click **Export All Data**.
3. Save the resulting JSON file securely.

This JSON file contains all stores: Contacts, Partners, Tasks, Settings, etc.

## 2. Restore
Restoring from a backup can be done via the Console or a potential future UI.

### Console Restore (Emergency)
1. Open the Browser Console.
2. Load your backup JSON file content into a variable, e.g., `snapshot`.
3. Run:
   ```javascript
   await dbRestoreAll(snapshot, 'replace');
   ```
   **Warning**: `'replace'` mode will wipe current data and replace it with the snapshot. Use `'merge'` to attempt a merge.

## 3. Failure Handling
If data corruption occurs:
1. Stop using the application to prevent overwriting.
2. Check `IndexedDB` in DevTools > Application tab to manually inspect data.
3. If valid data exists in DB but UI is broken, run `await dbExportAll()` immediately to salvage data.
