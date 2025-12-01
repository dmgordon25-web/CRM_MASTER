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
    // Load Action Bar only when needed to prevent circular dependency boot hang
    import('../ui/action_bar.js')
        .then(m => { if (m.syncActionBarVisibility) m.syncActionBarVisibility(0); })
        .catch(err => console.warn('[SelectionReset] failed to sync action bar', err));

    // Fallback: Dispatch event for decoupled listeners
    try {
        window.dispatchEvent(new CustomEvent('selection:clear', { detail: { source: 'reset' } }));
    } catch (_) { }
}
