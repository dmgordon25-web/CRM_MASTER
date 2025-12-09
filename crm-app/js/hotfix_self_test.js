
/**
 * HOTFIX SELF-TEST SCRIPT
 * Usage: Run this in the browser console after the app boots to verify stability.
 */

(function runHotfixCheck() {
    console.group('🛡️ CRM Hotfix Stability Check');
    let errors = 0;
    let warnings = 0;

    // 1. Check for SelectionStore Clears
    // We can't easily check past events, but we can check current state
    const selStore = window.SelectionStore || (window.CRM && window.CRM.services && window.CRM.services.selectionStore);

    if (!selStore) {
        console.error('❌ FAIL: SelectionStore not found in window or CRM services.');
        errors++;
    } else {
        console.log('✅ SelectionStore available');
    }

    // 2. Check Action Bar Drag Patch Status
    const patchFlag = window.__INIT_FLAGS__ ? window.__INIT_FLAGS__['patch:2025-10-23:actionbar-drag'] : undefined;
    // If we disabled it correctly, it might be true (loaded) but the ACTIVE flag should NOT be set if we prevented execution logic.
    // Actually, our patch returns early, so __PATCH_ACTIONBAR_DRAG_ACTIVE__ should be undefined or false.

    if (window.__PATCH_ACTIONBAR_DRAG_ACTIVE__) {
        console.error('❌ FAIL: Action Bar Drag Patch is ACTIVE. It should be disabled.');
        errors++;
    } else {
        console.log('✅ Action Bar Drag Patch is INACTIVE');
    }

    // 3. Check for lingering listeners (heuristic)
    if (window.__ACTION_BAR_WIRING__) {
        const wins = window.__ACTION_BAR_WIRING__.windowListeners ? window.__ACTION_BAR_WIRING__.windowListeners.size : 0;
        const docs = window.__ACTION_BAR_WIRING__.documentListeners ? window.__ACTION_BAR_WIRING__.documentListeners.size : 0;
        console.log(`ℹ️ Action Bar Listeners: Window=${wins}, Doc=${docs}`);
        if (wins > 5 || docs > 5) {
            console.warn('⚠️ WARN: High number of global listeners from Action Bar.');
            warnings++;
        } else {
            console.log('✅ Action Bar Listener count looks healthy');
        }
    }

    // 4. Widget Click Handler Check (Manual prompt)
    console.log('👉 MANUAL CHECK: Click a row in "Upcoming Birthdays" or "Tasks Due".');
    console.log('   Expected: Opens Editor immediately.');
    console.log('   Failure: Freezes or spikes console warnings.');

    // Summary
    if (errors === 0) {
        console.log(`%c✨ PASS: System appears stable. (${warnings} warnings)`, 'color: #4ade80; font-weight: bold; font-size: 14px;');
    } else {
        console.log(`%c🛑 FAIL: ${errors} critical issues found.`, 'color: #ef4444; font-weight: bold; font-size: 14px;');
    }
    console.groupEnd();
})();
