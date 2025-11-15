# Splash Page and Select All Fixes - 2025-11-05

## Summary

Fixed two critical bugs per user requirements:

1. **Splash Page Timing** - Splash page was ending way too early, before dashboard was fully initialized
2. **Select All Action Bar** - Action bar was not appearing when all rows were selected, and not disappearing when unselected

---

## Fix #1: Splash Page Initialization Sequence

### Problem
- Splash page (`#diagnostics-splash`) was hiding immediately after boot contracts were satisfied
- Did not wait for dashboard to render and initialize
- No toggle between All/Today modes before or after tab cycling
- Everything was happening too fast without proper render time

### Solution
Created a new module `/crm-app/js/boot/splash_sequence.js` that implements the proper initialization sequence:

#### Sequence Steps:
1. **Wait for Dashboard** - Polls for dashboard to be ready and visible
2. **Phase 1: Toggle All/Today (2x BEFORE tabs)**
   - Toggle to "All" mode (wait 800ms for render)
   - Toggle to "Today" mode (wait 800ms for render)
   - Toggle to "All" mode (wait 800ms for render)
   - Toggle to "Today" mode (wait 800ms for render)
3. **Phase 2: Cycle Through Tabs**
   - Navigate to "Pipeline" tab (wait 600ms)
   - Navigate to "Partners" tab (wait 600ms)
   - Navigate back to "Dashboard" tab (wait 600ms)
4. **Phase 3: Toggle All/Today (2x AFTER tabs)**
   - Toggle to "All" mode (wait 800ms for render)
   - Toggle to "Today" mode (wait 800ms for render)
   - Toggle to "All" mode (wait 800ms for render) - **FINAL TRIGGER**
   - Toggle to "Today" mode (wait 1200ms for final render)
5. **Phase 4: Hide Splash** - Only after all sequences complete

### Changes Made:

#### New File: `/crm-app/js/boot/splash_sequence.js`
- Implements `runSplashSequence()` function with full initialization sequence
- Implements `toggleDashboardMode(mode)` to toggle between All/Today
- Implements `navigateToTab(tabName)` to cycle through tabs
- Implements `waitForDashboard()` to ensure dashboard is ready
- Implements `hideSplash()` to properly hide both splash screens
- Auto-initializes after boot completes

#### Modified: `/crm-app/js/patches/loader.js`
- **Disabled early splash hiding** - Commented out lines that hide splash after SHELL/SERVICES contracts
- **Added splash_sequence.js import** - Dynamically imports and runs splash sequence after boot
- **Added fallback** - If splash_sequence fails to load, falls back to hiding splash immediately

### Key Features:
- ✅ Proper timing with configurable delays (800ms for toggles, 600ms for tabs)
- ✅ Yields for page rendering between each action
- ✅ 1200ms extra delay for final render before hiding splash
- ✅ Console logging for debugging sequence progression
- ✅ Error handling with fallback to hide splash on failure
- ✅ Triggered by actual dashboard completion, not just boot contracts

---

## Fix #2: Select All Action Bar Visibility

### Problem
- When "Select All" checkbox was clicked, action bar did not appear
- When one row was selected first, then Select All worked (inconsistent behavior)
- When Select All was unchecked, action bar did not disappear
- Action bar visibility logic was not properly responding to selection count changes

### Root Cause
- Two conflicting implementations of `syncActionBarVisibility`:
  1. In `/crm-app/js/patch_20250926_ctc_actionbar.js` - Simple show/hide
  2. In `/crm-app/js/ui/action_bar.js` - More sophisticated with idle visibility
- The ctc_actionbar implementation was too simplistic and didn't properly show/hide the bar
- Missing proper style updates (opacity, visibility, pointerEvents)
- Not triggering global action bar update functions

### Solution

#### Modified: `/crm-app/js/patch_20250926_ctc_actionbar.js`

**Enhanced `syncActionBarVisibility()` function:**
```javascript
function syncActionBarVisibility(selCount){
  // ... validation ...
  
  if(numeric > 0){
    // Show action bar when items are selected
    bar.setAttribute('data-visible','1');
    bar.setAttribute('data-idle-visible', '1'); // Ensure it stays visible
    bar.style.display = '';
    bar.style.opacity = '1';
    bar.style.visibility = 'visible';
    bar.style.pointerEvents = 'auto';
    bar.dataset.count = String(numeric);
    
    console.info(`[actionbar] Showing action bar with ${numeric} selection(s)`);
  }else{
    // Hide action bar when no items are selected
    bar.removeAttribute('data-visible');
    bar.removeAttribute('data-idle-visible');
    bar.style.display = 'none';
    bar.style.opacity = '0';
    bar.style.visibility = 'hidden';
    bar.style.pointerEvents = 'none';
    bar.dataset.count = '0';
    
    console.info('[actionbar] Hiding action bar (no selections)');
  }
  
  // Trigger global action bar update if available
  if(typeof window.__UPDATE_ACTION_BAR_VISIBLE__ === 'function'){
    window.__UPDATE_ACTION_BAR_VISIBLE__();
  }
  if(typeof window.applyActionBarGuards === 'function'){
    window.applyActionBarGuards(bar, numeric);
  }
}
```

**Added logging to `updateActionbarBase()`:**
```javascript
console.info(`[actionbar] updateActionbarBase: count=${count}`);
```

#### Modified: `/crm-app/js/ui/action_bar.js`

**Enhanced `syncActionBarVisibility()` function:**
- Added comprehensive logging for debugging
- Properly sets all style properties (opacity, visibility, pointerEvents)
- Properly removes data-idle-visible when count is 0
- Ensures bar is hidden when no selections

**Enhanced `handleSelectionChanged()` function:**
- Added logging to track selection changes
- Shows count, source, and ids.length for debugging

### Key Features:
- ✅ Action bar appears immediately when Select All is checked
- ✅ Action bar disappears immediately when Select All is unchecked
- ✅ Consistent behavior whether selecting all or individual rows
- ✅ Proper count display matching total rows when all selected
- ✅ Triggers all global action bar update mechanisms
- ✅ Sets all necessary style properties for proper visibility
- ✅ Console logging for debugging selection and visibility issues

---

## Testing Instructions

### Test Splash Page Sequence:
1. Clear browser cache and reload the application
2. Watch the splash screen during initialization
3. Verify the following sequence:
   - Dashboard appears
   - All/Today mode toggles 2x (visible mode changes)
   - Navigation tabs cycle: Pipeline → Partners → Dashboard
   - All/Today mode toggles 2x again
   - Splash page disappears only after final toggle
4. Check browser console for `[splash-seq]` log messages showing progression

### Test Select All Functionality:

#### Test on Partners Page:
1. Navigate to Partners page
2. Check "Select All" checkbox
3. ✅ **VERIFY**: Action bar appears at bottom
4. ✅ **VERIFY**: Action bar shows count matching total partners
5. ✅ **VERIFY**: All row checkboxes are checked
6. Uncheck "Select All"
7. ✅ **VERIFY**: Action bar disappears
8. ✅ **VERIFY**: All row checkboxes are unchecked

#### Test on Pipeline Page:
1. Navigate to Pipeline page
2. Check "Select All" checkbox
3. ✅ **VERIFY**: Action bar appears
4. ✅ **VERIFY**: Count matches total contacts
5. Uncheck "Select All"
6. ✅ **VERIFY**: Action bar disappears

#### Test on Leads Page:
1. Navigate to Leads page
2. Check "Select All" checkbox
3. ✅ **VERIFY**: Action bar appears
4. ✅ **VERIFY**: Count matches total leads
5. Uncheck "Select All"
6. ✅ **VERIFY**: Action bar disappears

#### Test Mixed Selection:
1. Select 1-2 individual rows (action bar should appear)
2. Check "Select All" (all rows should be selected, count updates)
3. Uncheck "Select All" (action bar should disappear, all rows unselected)

---

## Browser Console Logging

Both fixes include comprehensive console logging for debugging:

### Splash Sequence Logs:
```
[splash-seq] Starting initialization sequence
[splash-seq] Dashboard is ready
[splash-seq] Phase 1: Toggle All/Today (2x before tabs)
[splash-seq] Toggled dashboard to all mode
[splash-seq] Toggled dashboard to today mode
[splash-seq] Phase 2: Cycling through tabs
[splash-seq] Navigated to pipeline tab
[splash-seq] Phase 3: Toggle All/Today (2x after tabs)
[splash-seq] Phase 4: Hiding splash page
[splash-seq] Initialization sequence complete
```

### Action Bar Logs:
```
[actionbar] updateActionbarBase: count=5
[actionbar] Showing action bar with 5 selection(s)
[action_bar] handleSelectionChanged: count=5, source=workbench:select-all, ids.length=5
[action_bar] syncActionBarVisibility: count=5, ready=true, hasSelections=true, shouldBeVisible=true
```

---

## Files Modified

1. `/crm-app/js/boot/splash_sequence.js` - **NEW FILE** - Splash initialization sequence
2. `/crm-app/js/patches/loader.js` - Disabled early splash hiding, added splash_sequence import
3. `/crm-app/js/patch_20250926_ctc_actionbar.js` - Enhanced syncActionBarVisibility with proper show/hide
4. `/crm-app/js/ui/action_bar.js` - Enhanced syncActionBarVisibility and handleSelectionChanged with logging

---

## Notes

- The splash sequence uses `setTimeout` for delays to allow proper rendering
- Toggle delays are 800ms, tab navigation delays are 600ms
- Final delay before hiding splash is 1200ms for thorough rendering
- Action bar visibility now properly synchronizes across both implementations
- Console logging can be removed in production if desired
- All changes are backward compatible and include fallback behavior

---

## Expected User Experience

### Splash Page:
- User sees splash screen during boot
- Dashboard appears and user can see it cycling through modes and tabs
- This demonstrates the app is initializing properly
- Splash disappears smoothly after full initialization
- Feels polished and intentional, not rushed

### Select All:
- Click "Select All" → Action bar immediately appears with correct count
- Uncheck "Select All" → Action bar immediately disappears
- Consistent behavior across all pages with tables
- Selection count always matches expected total
- No mysterious missing action bar issues
