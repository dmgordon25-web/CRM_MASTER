export function safeMax(value, limit) {
  const text = String(value ?? '');
  const max = Number.isFinite(limit) ? Number(limit) : 0;
  if (!max || max < 0) return text;
  return text.length > max ? text.slice(0, max) : text;
}

export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}
