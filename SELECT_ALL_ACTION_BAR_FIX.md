# Select All Action Bar Fix

## Problem
When using "select all" on Leads, Pipeline, and Partners pages, the action bar minimized icon became visible, but not the action bar itself. Toggling it off made it disappear. This was working correctly on the Workbench page.

## Root Cause
The `applySelectAllToStore` function in `app.js` (lines 1300-1382) was dispatching the `selection:changed` event and calling `window.updateActionbar()`, but it was missing the comprehensive action bar visibility manipulation that the Workbench implementation had.

The Workbench page (in `pages/workbench.js`) had a comprehensive `updateActionBar()` function (lines 2590-2634) that:
1. Directly manipulated the action bar's `data-visible` and `data-idle-visible` attributes
2. Set inline styles (`display`, `opacity`, `visibility`, `pointerEvents`)
3. Called multiple update mechanisms (`ensureActionBarPostPaintRefresh`, `__UPDATE_ACTION_BAR_VISIBLE__`)
4. Updated multiple times (immediately, after microtask, after RAF)

## Solution
Updated the `applySelectAllToStore` function in `/workspace/crm-app/js/app.js` to include the comprehensive action bar update logic from the Workbench implementation.

### Key Changes (lines 1353-1432)

1. **Moved ID normalization before store.set()** - Ensure we have the selection count calculated first
2. **Added comprehensive updateActionBar function** that:
   - Calls `window.updateActionbar()` if available
   - Directly manipulates action bar visibility attributes and styles
   - Calls `ensureActionBarPostPaintRefresh()` and `__UPDATE_ACTION_BAR_VISIBLE__()`
3. **Triple update strategy**:
   - Immediate update
   - Microtask update (via `queueMicrotask` or Promise)
   - RAF update (via `requestAnimationFrame`)

## Affected Pages
This fix applies to all pages that use the general selection infrastructure:
- **Leads** (table: `tbl-longshots`, scope: `pipeline`)
- **Pipeline** (table: `tbl-pipeline`, scope: `pipeline`)
- **Clients** (table: `tbl-clients`, scope: `pipeline`)
- **Partners** (table: `tbl-partners`, scope: `partners`)

## Verification
All tables have the correct `data-selection-scope` attribute in `index.html`:
- Line 598: `tbl-partners` → `data-selection-scope="partners"`
- Line 680: `tbl-pipeline` → `data-selection-scope="pipeline"`
- Line 716: `tbl-clients` → `data-selection-scope="pipeline"`
- Line 918: `tbl-longshots` → `data-selection-scope="pipeline"`

The `wireSelectAllForTable` function (app.js line 1096) calls `applySelectAllToStore` when the select-all checkbox changes (line 1155), so all pages benefit from this fix.

## Notes
- Workbench has its own custom implementation (`handleSelectAllChange` in `pages/workbench.js`) and continues to work with its existing code
- The fix ensures consistent behavior across all pages
- The action bar will now properly show/hide with appropriate visibility, opacity, and display properties
