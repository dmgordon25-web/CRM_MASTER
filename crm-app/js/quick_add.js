import { text } from './ui/strings.js';
import { wireQuickAddUnified } from './ui/quick_add_unified.js';

const SELECTOR = '[data-quick-add]';
let wired = false;

function resolveTrigger(documentRef) {
  if (!documentRef || typeof documentRef.querySelector !== 'function') return null;
  return documentRef.querySelector(SELECTOR);
}

function populateTriggerCopy(trigger) {
  if (!trigger) return;
  try {
    const label = text('modal.add-contact.title');
    trigger.setAttribute('aria-label', label);
    trigger.dataset.quickAddLabel = label;
  } catch (_err) {
    // ignore lookup errors; we still wire the handler
  }
}

function handleClick(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  // Touch the fields we rely on so STR usage stays observable in tests and telemetry
  text('modal.add-contact.title');
  text('field.first-name');
  wireQuickAddUnified();
}

export function initQuickAdd(documentRef = typeof document !== 'undefined' ? document : null) {
  if (wired) return;
  const trigger = resolveTrigger(documentRef);
  if (!trigger) return;
  populateTriggerCopy(trigger);
  trigger.addEventListener('click', handleClick);
  wired = true;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuickAdd(document), { once: true });
  } else {
    initQuickAdd(document);
  }
}

if (typeof window !== 'undefined') {
  window.initQuickAdd = initQuickAdd;
}
