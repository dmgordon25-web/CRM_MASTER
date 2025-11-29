import { getSelectionStore } from '../state/selectionStore.js';

function normalizeScope(scope) {
    const raw = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
    if (raw === 'partner' || raw === 'partners') return 'partners';
    if (raw === 'contact' || raw === 'contacts') return 'contacts';
    return 'default';
}

function resolveReason(scope, reason) {
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
    if (scope === 'partners' || scope === 'contacts') return `${scope}:row-open`;
    return `${scope}:clear`;
}

export async function clearSelectionForSurface(scope, options = {}) {
    const normalizedScope = normalizeScope(scope);
    const reason = resolveReason(normalizedScope, options.reason);

    // 1. Clear Data
    try {
        const store = window.SelectionStore;
        if (store && typeof store.clear === 'function') {
            store.clear(normalizedScope);
        }
    } catch (_) { }

    // 2. BREAK DEADLOCK: Dynamic Import for UI
    try {
        // Load Action Bar only when needed to prevent circular dependency boot hang
        const { syncActionBarVisibility } = await import('../ui/action_bar.js');
        if (typeof syncActionBarVisibility === 'function') syncActionBarVisibility(0);
    } catch (e) {
        console.warn('Action Bar sync failed', e);
    }
}
