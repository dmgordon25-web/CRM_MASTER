export const TOUCH_OPTIONS = [
  { key: 'call', label: 'Call', prefix: 'Called' },
  { key: 'email', label: 'Email', prefix: 'Emailed' },
  { key: 'meeting', label: 'Meeting', prefix: 'Met' }
];

function normalizeKey(key) {
  if (typeof key !== 'string') return '';
  return key.trim().toLowerCase();
}

export function findTouchOption(key) {
  const normalized = normalizeKey(key);
  return TOUCH_OPTIONS.find(option => option.key === normalized) || null;
}

export function formatTouchDate(date = new Date()) {
  const source = date instanceof Date ? date : new Date(date);
  if (!(source instanceof Date) || Number.isNaN(source.getTime())) {
    return '';
  }
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, '0');
  const day = String(source.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createTouchLogEntry(key, date = new Date()) {
  const option = findTouchOption(key);
  const prefix = option ? option.prefix : (typeof key === 'string' && key.trim() ? key.trim() : 'Touch');
  const isoDate = formatTouchDate(date);
  if (!isoDate) {
    return `${prefix}: `;
  }
  return `${prefix} ${isoDate}: `;
}

export function touchSuccessMessage(key) {
  const option = findTouchOption(key);
  if (option) {
    return `${option.label} logged`;
  }
  return 'Touch logged';
}
