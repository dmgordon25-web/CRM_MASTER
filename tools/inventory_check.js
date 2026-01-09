/**
 * tools/inventory_check.js
 *
 * Developer helper to dump Current persistence state to console.
 * Usage: Paste into DevTools console or run in context of app.
 *
 * DO NOT SHIP IN PRODUCTION BUNDLE.
 */

(function runInventoryCheck() {
    console.group('📦 Workspace Inventory Check');
    
    // 1. Check IDB presence
    const stores = window.STORES || [];
    console.log(`IndexedDB Stores (${stores.length}):`, stores.join(', '));
    
    // 2. Check LocalStorage Keys
    const knownKeys = [
        'profile:v1', 
        'signature:v1', 
        'crm:uiMode', 
        'crm:theme',
        'calendar:legend:visibility',
        'dashboard:config:v1',
        'crm:dashboard:widget-order',
        'dash:layoutMode:v1',
        'dash:layout:hidden:v1',
        'notifications:queue'
    ];
    
    console.groupCollapsd('LocalStorage Inventory');
    const lsKeys = Object.keys(localStorage);
    lsKeys.forEach(key => {
        const isKnown = knownKeys.some(k => key === k || key.startsWith(k));
        const val = localStorage.getItem(key);
        const len = val ? val.length : 0;
        console.log(`${isKnown ? '✅' : '❓'} ${key} [${len} bytes]`);
    });
    console.groupEnd();
    
    // 3. Check Settings Sync Status (Heuristic)
    Promise.resolve().then(async () => {
       if (window.dbSettingsGet) {
           const profile = await window.dbSettingsGet('loProfile');
           const lsProfile = localStorage.getItem('profile:v1');
           const sync = JSON.stringify(profile) === lsProfile;
           console.log('Profile Sync Status:', sync ? '✅ Synced' : '⚠️ Divergent (DB vs LS)');
           
           const dashMode = localStorage.getItem('dash:layoutMode:v1');
           console.log('Dashboard Edit Mode (LS Only):', dashMode === '1' ? 'EDIT' : 'VIEW');
       }
    });

    console.groupEnd();
})();
