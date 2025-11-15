/**
 * Unified Table Registry
 * Provides shared column schemas, visibility preferences, and rendering for tables across surfaces
 */

const STORAGE_PREFIX = 'cols:';
const SAFE_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('safe') === '1';

// Registry to hold column definitions per surface
const SURFACE_SCHEMAS = new Map();

/**
 * Register a surface schema
 * @param {string} surface - Surface identifier (e.g., 'contacts', 'partners', 'workbench')
 * @param {Array} columns - Array of column definitions
 */
export function registerSurface(surface, columns) {
  if (typeof surface !== 'string' || !surface) {
    console.warn('[table/registry] Invalid surface identifier');
    return;
  }
  if (!Array.isArray(columns)) {
    console.warn('[table/registry] Invalid columns array');
    return;
  }
  SURFACE_SCHEMAS.set(surface, columns);
}

/**
 * Get the full schema for a surface
 * @param {string} surface - Surface identifier
 * @returns {Array} Column definitions
 */
export function getSurfaceSchema(surface) {
  return SURFACE_SCHEMAS.get(surface) || [];
}

/**
 * Get visible columns for a surface (respects user preferences)
 * @param {string} surface - Surface identifier
 * @returns {Array} Visible column definitions
 */
export function getVisibleColumns(surface) {
  const schema = getSurfaceSchema(surface);
  if (!schema.length) return [];

  const stored = getStoredVisibility(surface);
  if (stored && Array.isArray(stored)) {
    // Return columns in stored order
    const visibleIds = new Set(stored);
    return schema.filter(col => visibleIds.has(col.id));
  }

  // Return default visible columns
  return schema.filter(col => col.defaultVisible !== false);
}

/**
 * Set visible columns for a surface (persists to localStorage)
 * @param {string} surface - Surface identifier
 * @param {Array<string>} columnIds - Array of column IDs to make visible
 */
export function setVisibleColumns(surface, columnIds) {
  if (SAFE_MODE) {
    console.info('[table/registry] SAFE mode: skipping localStorage write');
    return;
  }

  if (!Array.isArray(columnIds)) {
    console.warn('[table/registry] Invalid columnIds array');
    return;
  }

  try {
    const key = STORAGE_PREFIX + surface;
    localStorage.setItem(key, JSON.stringify(columnIds));
  } catch (err) {
    console.warn('[table/registry] Failed to persist column visibility', err);
  }
}

/**
 * Reset columns to defaults for a surface
 * @param {string} surface - Surface identifier
 */
export function resetColumns(surface) {
  if (SAFE_MODE) {
    console.info('[table/registry] SAFE mode: skipping localStorage clear');
    return;
  }

  try {
    const key = STORAGE_PREFIX + surface;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[table/registry] Failed to reset columns', err);
  }
}

/**
 * Get stored column visibility from localStorage
 * @param {string} surface - Surface identifier
 * @returns {Array<string>|null} Stored column IDs or null
 */
function getStoredVisibility(surface) {
  if (SAFE_MODE) return null;

  try {
    const key = STORAGE_PREFIX + surface;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

/**
 * Render a table row using the column schema
 * @param {string} surface - Surface identifier
 * @param {Object} record - Data record
 * @param {Array} columns - Columns to render (optional, uses visible columns if not provided)
 * @returns {HTMLTableRowElement} Table row element
 */
export function renderRow(surface, record, columns) {
  const cols = columns || getVisibleColumns(surface);
  const tr = document.createElement('tr');

  cols.forEach(column => {
    const td = document.createElement('td');
    const value = getColumnValue(record, column);

    if (column.render && typeof column.render === 'function') {
      // Custom render function
      const rendered = column.render(value, record);
      if (rendered instanceof HTMLElement) {
        td.appendChild(rendered);
      } else {
        td.textContent = String(rendered || '—');
      }
    } else {
      // Default text rendering
      td.textContent = formatColumnValue(value, column);
    }

    if (column.className) {
      td.className = column.className;
    }

    tr.appendChild(td);
  });

  return tr;
}

/**
 * Get value from record using column accessor
 * @param {Object} record - Data record
 * @param {Object} column - Column definition
 * @returns {*} Column value
 */
function getColumnValue(record, column) {
  if (!record || !column) return null;

  if (typeof column.accessor === 'function') {
    return column.accessor(record);
  }

  if (typeof column.accessor === 'string') {
    return record[column.accessor];
  }

  if (column.id && typeof record[column.id] !== 'undefined') {
    return record[column.id];
  }

  return null;
}

/**
 * Format column value for display
 * @param {*} value - Raw value
 * @param {Object} column - Column definition
 * @returns {string} Formatted value
 */
function formatColumnValue(value, column) {
  if (value == null) return '—';

  if (column.format && typeof column.format === 'function') {
    return String(column.format(value));
  }

  return String(value);
}
