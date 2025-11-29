function normalizeScope(scope) {
  const raw = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
  if (raw === 'partner' || raw === 'partners') return 'partners';
  if (raw === 'contact' || raw === 'contacts') return 'contacts';
  if (raw === 'default' || !raw) return 'default';
  return raw;
}

function resolveReason(scope, reason) {
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  if (scope === 'partners' || scope === 'contacts') {
    return `${scope}:row-open`;
  }
  return `${scope}:clear`;
}

function safeWindow() {
  return typeof window !== 'undefined' ? window : undefined;
}

// Helper to get SelectionStore safely
function getSelectionStore() {
  const win = safeWindow();
  return win && win.SelectionStore ? win.SelectionStore : null;
}

export async function clearSelectionForSurface(scope, options = {}) {
  const normalizedScope = normalizeScope(scope);
  const win = safeWindow();
  const reason = resolveReason(normalizedScope, options.reason);

  // 1. Try global Selection (legacy)
  try {
    const selection = win && win.Selection ? win.Selection : (typeof globalThis !== 'undefined' ? globalThis.Selection : null);
    if (selection && typeof selection.clear === 'function') {
      selection.clear(reason);
    }
  } catch (_) { }

  // 2. Try SelectionService
  try {
    const selectionService = win && win.SelectionService ? win.SelectionService : null;
    if (selectionService && typeof selectionService.clear === 'function') {
      selectionService.clear(reason);
    }
  } catch (_) { }

  // 3. Try SelectionStore (modern)
  try {
    const store = getSelectionStore();
    if (store && typeof store.clear === 'function') {
      store.clear(normalizedScope);
    }
  } catch (_) { }

  // FIX: Dynamic import to break circular dependency with action_bar.js
  try {
    const { syncActionBarVisibility } = await import('../ui/action_bar.js');
    syncActionBarVisibility(0);
  } catch (e) {
    console.warn('Action bar sync failed', e);
  }

  // Force UI refresh if needed
  if (options.refresh) {
    // ... existing refresh logic if any ...
  }
}
