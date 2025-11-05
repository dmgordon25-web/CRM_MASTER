# Select-All Action Bar Fix - November 5, 2025

## Problem Statement

The select-all toggle in table column headings was not properly showing/hiding the action bar:

1. **Issue 1**: Clicking the select-all checkbox would check all boxes visually, but would NOT trigger the action bar to appear
2. **Issue 2**: If rows were manually selected first (making the action bar appear), then clicking select-all would correctly add all rows
3. **Issue 3**: Unchecking select-all would remove all selections but the action bar would NOT minimize back to the floating pill
4. **Working Case**: Workbench tables worked correctly with select-all

## Root Cause

The `syncActionBarVisibility()` function in `/workspace/crm-app/js/patch_20250926_ctc_actionbar.js` was missing critical code to handle the `data-minimized` attribute:

- When count > 0: The function didn't **remove** the `data-minimized` attribute
- When count = 0: The function didn't **set** the `data-minimized="1"` attribute

The `data-minimized` attribute is what controls whether the action bar displays as:
- **Full bar** (when items are selected) - `data-minimized` absent
- **Minimized pill** (when count is 0) - `data-minimized="1"`

## Solution

### 1. Updated `syncActionBarVisibility()` in patch_20250926_ctc_actionbar.js

Added proper handling of the `data-minimized` attribute:

```javascript
if(numeric > 0){
  // Show full action bar when items are selected (not minimized)
  bar.setAttribute('data-visible','1');
  bar.setAttribute('data-idle-visible', '1');
  bar.style.display = '';
  bar.style.opacity = '1';
  bar.style.visibility = 'visible';
  bar.style.pointerEvents = 'auto';
  
  // CRITICAL: Remove minimized state when we have selections
  if(bar.hasAttribute('data-minimized')){
    bar.removeAttribute('data-minimized');
  }
  bar.setAttribute('aria-expanded', 'true');
  
  bar.dataset.count = String(numeric);
}else{
  // When count is 0, show the minimized pill
  bar.removeAttribute('data-visible');
  bar.removeAttribute('data-idle-visible');
  
  if(bar.style.display === 'none'){
    bar.style.display = '';
  }
  bar.style.opacity = '1';
  bar.style.visibility = 'visible';
  bar.style.pointerEvents = 'auto';
  
  // CRITICAL: Set minimized state when count is 0 to show the pill
  bar.setAttribute('data-minimized', '1');
  bar.setAttribute('aria-expanded', 'false');
  
  bar.dataset.count = '0';
}

// Call updateActionBarMinimizedState if available from ui/action_bar.js
if(typeof window !== 'undefined' && typeof window.updateActionBarMinimizedState === 'function'){
  try { window.updateActionBarMinimizedState(numeric); }
  catch (_) {}
}
```

### 2. Exported `updateActionBarMinimizedState` in ui/action_bar.js

Made the function globally available for use by other modules:

```javascript
function _attachActionBarVisibilityHooks(actionBarRoot) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  registerWindowListener('resize', handleActionBarResize, { passive: true });
  window.__UPDATE_ACTION_BAR_VISIBLE__ = function updateActionBarVisible() {
    requestVisibilityRefresh();
  };
  // Export updateActionBarMinimizedState for use by other modules
  window.updateActionBarMinimizedState = updateActionBarMinimizedState;
  if (actionBarRoot) {
    requestVisibilityRefresh();
  }
}
```

## Files Modified

1. `/workspace/crm-app/js/patch_20250926_ctc_actionbar.js` - Lines 579-640
   - Updated `syncActionBarVisibility()` to properly set/remove `data-minimized` attribute
   - Added call to `updateActionBarMinimizedState()` for consistent behavior

2. `/workspace/crm-app/js/ui/action_bar.js` - Line 871
   - Exported `updateActionBarMinimizedState` to `window` object

## Expected Behavior After Fix

### All Tables (Leads, Opportunities, Customers, Partners, etc.)

1. **Select-All Click (from zero selections)**:
   - ✅ All checkboxes are checked
   - ✅ Action bar expands from pill to full bar
   - ✅ Count shows total selected items
   - ✅ All action buttons are enabled appropriately

2. **Select-All Click (with some selections)**:
   - ✅ All remaining checkboxes are checked
   - ✅ Action bar updates count to total
   - ✅ Action bar remains visible (not minimized)

3. **Unselect-All Click**:
   - ✅ All checkboxes are unchecked
   - ✅ Action bar minimizes back to floating pill
   - ✅ Count resets to 0
   - ✅ Pill is visible and clickable

4. **Manual Row Selection**:
   - ✅ Individual checkbox clicks still work normally
   - ✅ Action bar behavior remains consistent

## Testing Recommendations

Test the following scenarios across all table views:

1. **Fresh Select-All**: Start with no selections, click select-all checkbox
   - Verify action bar appears (not minimized)
   - Verify count is correct

2. **Partial Then Select-All**: Select 1-2 rows manually, then click select-all
   - Verify action bar updates count to total
   - Verify all checkboxes are checked

3. **Unselect-All**: With all selected, click select-all to deselect
   - Verify action bar minimizes to pill
   - Verify pill is visible at bottom of screen

4. **Cross-Table Verification**: Test on:
   - ✅ Workbench (already working)
   - Leads view
   - Opportunities view
   - Customers view
   - Partners view
   - Any other table with selection

## Technical Notes

- The fix aligns non-Workbench table behavior with the working Workbench implementation
- The `data-minimized` attribute is the CSS hook that controls action bar display modes
- The `updateActionBarMinimizedState()` function from `ui/action_bar.js` provides additional consistency
- All changes are backward compatible and don't affect existing functionality

## Validation

- ✅ No linter errors introduced
- ✅ Audit passes successfully
- ✅ Code follows existing patterns in the codebase
- ✅ Consistent with Workbench implementation (which works correctly)
