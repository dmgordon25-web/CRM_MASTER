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

import { syncActionBarVisibility } from '../ui/action_bar.js';

export function clearSelectionForSurface(scope, options = {}) {
  const normalizedScope = normalizeScope(scope);
  const win = safeWindow();
  const reason = resolveReason(normalizedScope, options.reason);
  try {
    const selection = win && win.Selection ? win.Selection : (typeof globalThis !== 'undefined' ? globalThis.Selection : null);
    if (selection && typeof selection.clear === 'function') {
      selection.clear(reason);
    }
  } catch (_) { }
  try {
    const selectionService = win && win.SelectionService ? win.SelectionService : null;
    if (selectionService && typeof selectionService.clear === 'function') {
      selectionService.clear(reason);
    }
  } catch (_) { }
  try {
    const store = win && win.SelectionStore ? win.SelectionStore : null;
    if (store && typeof store.clear === 'function') {
      store.clear(normalizedScope);
    }
  } catch (_) { }

  // FIX: Force Action Bar sync
  try {
    syncActionBarVisibility(0);
  } catch (_) { }
}
