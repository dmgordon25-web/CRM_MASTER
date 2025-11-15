# Boot Sequence Fix - November 5, 2025

## Problem
The boot sequence was out of control:
- All/Today toggle was happening too early at startup
- Splash screen was disappearing ~5 seconds too soon (before tab switching completed)
- Timing and sequence of operations needed to be reorganized

## Solution
Modified `/workspace/crm-app/js/boot/boot_hardener.js` to implement the correct boot sequence:

### New Boot Sequence (in `animateTabCycle()`)

1. **Start on Dashboard** (line 720)
   - Initial load on dashboard tab

2. **Wait for Page to be Quiet** (line 723)
   - 800ms wait for page to stabilize and load

3. **Optional Partner Cycling** (lines 725-737)
   - Cycles through available partners if any exist

4. **Tab Cycling - Once Each, Equally Spaced** (lines 739-743)
   - Cycles through all tabs once: `['dashboard', 'longshots', 'pipeline', 'partners', 'calendar', 'reports', 'workbench']`
   - Each tab gets `TAB_POST_DELAY = 200ms` after activation
   - Equal spacing for all tabs

5. **Return to Dashboard** (lines 745-746)
   - Navigate back to dashboard after tab cycling

6. **All/Today Toggle - 2x Each with 1 Second Pauses** (lines 748-756)
   - Toggle to "All" (1st time) → wait 1000ms
   - Toggle to "Today" (1st time) → wait 1000ms
   - Toggle to "All" (2nd time) → wait 1000ms
   - Toggle to "Today" (2nd time) → wait 1000ms

7. **Wait for Dashboard Ready** (lines 758-759)
   - Waits for dashboard widgets ready event

8. **Final Delay** (line 761)
   - Extra delay to ensure stability

9. **Splash Screen Hidden** (line 851)
   - Splash is hidden AFTER all animation completes
   - This happens in `ensureCoreThenPatches()` after `await animateTabCycle()` returns

## Key Changes

### Removed Early Toggle
**Before:** Dashboard toggles happened at startup (lines 723-726)
```javascript
console.info('[BOOT_ANIMATION] Initial dashboard toggles (2x): Today ↔ All');
for (const mode of MODE_SEQUENCE) {
  await ensureDashboardMode(mode, { postDelay: MODE_POST_DELAY });
}
```

**After:** Removed - toggles now happen AFTER tab cycling

### Moved Toggle to After Tab Cycling
**Before:** Toggles at end with short delays
```javascript
console.info('[BOOT_ANIMATION] Final dashboard toggles (2x): All ↔ Today');
for (const mode of MODE_SEQUENCE) {
  const postDelay = mode === 'today' ? MODE_FINAL_POST_DELAY : MODE_POST_DELAY;
  await ensureDashboardMode(mode, { postDelay });
}
```

**After:** Explicit 1-second pauses after each toggle
```javascript
console.info('[BOOT_ANIMATION] Dashboard toggles (2x): All ↔ Today with 1 second pauses');
// Toggle to All (1st time)
await ensureDashboardMode('all', { postDelay: 1000 });
// Toggle to Today (1st time)
await ensureDashboardMode('today', { postDelay: 1000 });
// Toggle to All (2nd time)
await ensureDashboardMode('all', { postDelay: 1000 });
// Toggle to Today (2nd time)
await ensureDashboardMode('today', { postDelay: 1000 });
```

### Added Partners Tab
Updated `TAB_SEQUENCE` to include 'partners':
```javascript
const TAB_SEQUENCE = ['dashboard', 'longshots', 'pipeline', 'partners', 'calendar', 'reports', 'workbench'];
```

### Splash Screen Timing
The splash screen now stays visible through the ENTIRE sequence:
- Animation starts at line 847: `await animateTabCycle()`
- Splash hidden at line 851: `hideSplashOnce()` - AFTER animation completes
- This ensures the splash stays visible ~5 seconds longer (through all tab cycling and toggles)

## Result
- Boot sequence is now orderly and predictable
- Splash screen stays visible until all initialization is complete
- All tabs are clicked exactly once with equal spacing
- All/Today toggle happens at the proper time with proper delays
- Page has time to stabilize before user interaction begins

## Testing
To verify the fix:
1. Start the CRM application
2. Observe that the splash screen stays visible during boot
3. Watch the tabs cycle through once each
4. See the dashboard toggle between All/Today 2x each
5. Splash disappears only after all animations complete
