
/**
 * CRM Stability Restoration - Smoke Test
 * 
 * Usage in Console:
 * await import('./js/stability_check.js').then(m => m.runStabilityCheck())
 */

export async function runStabilityCheck() {
    console.group('🛡️ CRM Stability Restoration Check');
    let errors = 0;

    // 1. Selection State & Action Bar
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-id]'));
    const checked = checkboxes.filter(cb => cb.checked);
    const actionBar = document.querySelector('.action-bar') || document.getElementById('action-bar'); // Adjust selector as needed

    console.log(`[Selection] ${checked.length} selected out of ${checkboxes.length} rows.`);

    if (checked.length > 0) {
        if (!actionBar || actionBar.offsetParent === null || actionBar.style.display === 'none') {
            console.error('❌ [Action Bar] Selection > 0 but Action Bar is HIDDEN.');
            errors++;
        } else {
            console.log('✅ [Action Bar] Visible with active selection.');
            // Verify count text if possible
            const countText = actionBar.innerText || actionBar.textContent;
            if (!countText.includes(checked.length.toString())) {
                console.warn(`⚠️ [Action Bar] Count mismatch? Visible text: "${countText}", expected: ${checked.length}`);
            }
        }
    } else {
        if (actionBar && actionBar.offsetParent !== null && actionBar.style.display !== 'none') {
            console.warn('⚠️ [Action Bar] Visible with ZERO selection (Check DEMO_MODE contract: hide or show disabled?)');
            // Strict check: if user said "MUST appear when >=1 item selected", implying hidden otherwise?
            // "Action Bar visibility: MUST appear when >=1 item selected."
        } else {
            console.log('✅ [Action Bar] Correctly hidden/inactive with 0 selection.');
        }
    }

    // 2. Select All Determinism
    const headerCheck = document.querySelector('th input[type="checkbox"]');
    if (headerCheck) {
        if (headerCheck.checked && checked.length !== checkboxes.length) {
            console.error('❌ [Select All] Header checked, but not all rows are selected.');
            errors++;
        } else if (!headerCheck.checked && checked.length === checkboxes.length && checkboxes.length > 0) {
            console.warn('⚠️ [Select All] All rows selected, but header unchecked.');
        } else {
            console.log('✅ [Select All] Header state consistent with rows.');
        }
    }

    // 3. Dashboard Handlers (Static Check)
    // We can't easily click, but we can check if critical elements exist
    const upcoming = document.getElementById('dashboard-celebrations');
    if (upcoming) {
        console.log('✅ [Dashboard] "Upcoming" widget present.');
    }

    // 4. Labs Isolation
    const isLabsRoute = window.location.hash.includes('labs') || window.location.pathname.includes('labs');
    const resizeListeners = getEventListeners ? getEventListeners(window).resize : [];
    // Heuristic: If we are NOT in Labs, we shouldn't have many resize listeners from GridStack.
    if (!isLabsRoute) {
        if (resizeListeners && resizeListeners.length > 5) { // Arbitrary threshold
            console.warn(`⚠️ [Isolation] High resize listeners count (${resizeListeners.length}) in Legacy mode. Labs leak?`);
        }
    }

    if (errors === 0) {
        console.log('🎉 STABILITY CHECK PASSED (Visual/State)');
    } else {
        console.error(`💥 STABILITY CHECK FAILED with ${errors} critical errors.`);
    }
    console.groupEnd();
    return errors === 0;
}
