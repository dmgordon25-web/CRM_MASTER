# Select-All Action Bar Fix - 2025-11-05

## Issue

When clicking the select-all toggle directly (with no prior row selections), all checkboxes would get checked but the action bar would not appear. Instead, only the minimized circle icon remained visible. This affected all tables outside of workbench (contacts, partners, pipeline, clients, longshots).

## Root Cause

The `applySelectAllToStore` function in `app.js` was directly manipulating the action bar's visibility attributes but **was not removing the `data-minimized="1"` attribute** when selections were made. This caused the action bar to remain in its minimized "pill" state even though items were selected.

The action bar's CSS uses `data-minimized="1"` to hide the main action bar shell and show only the pill icon. When this attribute is present, the full action bar remains hidden regardless of other visibility attributes.

## Fix Applied

Modified `crm-app/js/app.js` (lines ~1401-1456) in the `applySelectAllToStore` function's `updateActionBar` closure:

### Key Changes:

1. **When selections > 0:**
   - Added explicit removal of `data-minimized` attribute: `bar.removeAttribute('data-minimized')`
   - Added `aria-expanded="true"` for accessibility
   - This ensures the full action bar shell becomes visible

2. **When selections = 0:**
   - Added explicit setting of `data-minimized="1"` attribute
   - Changed style handling to NOT set `display: 'none'` - instead let CSS handle visibility via `data-minimized`
   - Added `aria-expanded="false"` for accessibility
   - This properly restores the minimized pill state

## Code Location

File: `/workspace/crm-app/js/app.js`
Function: `applySelectAllToStore` → `updateActionBar` closure
Lines: ~1413-1443

## Behavior Now

1. **Select-all from 0 selections:** Full action bar appears with all action buttons available
2. **Individual selection first:** Works as before - action bar appears
3. **Deselect-all:** Action bar properly minimizes back to pill icon
4. **Workbench:** Continues to work correctly (uses separate implementation)

## Testing Notes

- Affects tables with `data-selection-scope`: contacts, partners, pipeline, clients, longshots
- Preserves existing behavior for individual row selection
- Maintains proper minimized/expanded state transitions
- Action bar positioning (drag, center, etc.) remains functional

## Related Files

- Primary fix: `crm-app/js/app.js`
- Action bar core: `crm-app/js/ui/action_bar.js` (updateActionBarMinimizedState)
- Workbench (reference): `crm-app/js/pages/workbench.js` (working implementation)
