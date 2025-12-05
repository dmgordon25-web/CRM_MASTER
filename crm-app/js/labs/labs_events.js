// Labs-specific event utilities
// Provides a lightweight namespace for Labs-only CustomEvents.

const LABS_EVENT_TARGET = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);

function normalizeType(type) {
  if (!type) return '';
  const value = String(type).trim();
  return value || '';
}

export function emitLabsEvent(type, detail) {
  const target = LABS_EVENT_TARGET;
  const normalizedType = normalizeType(type);
  if (!target || !normalizedType || typeof target.dispatchEvent !== 'function') return false;
  const event = new CustomEvent(normalizedType, { detail });
  return target.dispatchEvent(event);
}

export function onLabsEvent(type, handler) {
  const target = LABS_EVENT_TARGET;
  const normalizedType = normalizeType(type);
  if (!target || !normalizedType || typeof handler !== 'function' || typeof target.addEventListener !== 'function') {
    return () => {};
  }
  const listener = (event) => handler(event?.detail, event);
  target.addEventListener(normalizedType, listener);
  return () => target.removeEventListener(normalizedType, listener);
}
